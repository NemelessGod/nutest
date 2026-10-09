import test from "node:test";
import assert from "node:assert/strict";
import { World } from "../server/game/world.js";
import { decide, PERSONALITIES } from "../server/ai/controller.js";
function fresh() {
  const w = new World({ bots: 0 });
  w.food.clear();
  w.walls = [];
  const s = w.spawn({ id: "p" });
  s.x = 1000;
  s.y = 1000;
  s.angle = 0;
  s.input.angle = 0;
  s.body = Array.from({ length: w.length(s) }, (_, i) => ({
    x: 1000 - i * 7,
    y: 1000,
  }));
  s.active = {};
  w.rebuild();
  return { w, s };
}
function run(w, n = 30) {
  for (let i = 0; i < n; i++) w.tick(1 / 30);
}
test("movement is fixed-step, smooth and turn limited", () => {
  const { w, s } = fresh();
  run(w);
  assert(s.x > 1165 && s.x < 1180);
  assert.equal(s.y, 1000);
  const angle = s.angle;
  s.input.angle = Math.PI;
  w.tick(1 / 30);
  assert(Math.abs(s.angle - angle) < 0.12);
  for (let i = 1; i < s.body.length; i++)
    assert(
      Math.hypot(
        s.body[i].x - s.body[i - 1].x,
        s.body[i].y - s.body[i - 1].y,
      ) <= 7.01,
    );
});
test("collection increases authoritative mass and tracks energy", () => {
  const { w, s } = fresh();
  w.addFood(1005, 1000, 8);
  w.tick(1 / 30);
  assert.equal(s.mass, 40);
  assert.equal(s.collected, 8);
});
test("boost is faster and consumes mass and energy", () => {
  const a = fresh(),
    b = fresh();
  b.s.input.boost = true;
  run(a.w);
  run(b.w);
  assert(b.s.x > a.s.x + 80);
  assert(b.s.mass < a.s.mass);
  assert(b.s.energy < 100);
  assert.equal(b.s.boosts, 1);
});
test("opponent body collision kills and drops food exactly once", () => {
  const { w, s } = fresh();
  const t = w.spawn({ id: "t" });
  t.x = 1005;
  t.y = 1000;
  t.body = [{ x: 1005, y: 1000 }];
  let deaths = 0;
  w.onDeath = () => deaths++;
  w.tick(1 / 30);
  assert(!s.alive);
  assert.equal(t.kills, 1);
  assert(w.food.size > 0);
  w.kill(s);
  assert.equal(deaths, 1);
});
test("shield absorbs one collision, ghost cannot cross walls", () => {
  const { w, s } = fresh();
  assert(w.useAbility(s, "shield"));
  w.collide(s, "t", "body");
  assert(s.alive);
  w.collide(s, "other", "body");
  assert(!s.alive);
  const b = fresh();
  b.w.useAbility(b.s, "ghost");
  b.s.x = b.w.size - 9;
  b.s.body[0].x = b.s.x;
  b.w.tick(1 / 30);
  assert(!b.s.alive);
});
test("ghost passes opponent bodies, all abilities enforce costs and cooldown", () => {
  const { w, s } = fresh();
  assert(w.useAbility(s, "ghost"));
  w.collide(s, "t", "body");
  assert(s.alive);
  assert(!w.useAbility(s, "ghost"));
  assert.equal(s.energy, 60);
  for (const id of ["dash", "shield", "magnet", "pulse"]) {
    const v = fresh();
    assert(v.w.useAbility(v.s, id));
    assert(v.s.cooldowns[id] > 0);
    assert(v.s.energy < 100);
    assert(!v.w.useAbility(v.s, id));
  }
});
test("magnet attracts food and pulse is blocked by obstacles", () => {
  const { w, s } = fresh();
  const f = w.addFood(1100, 1000, 5);
  w.useAbility(s, "magnet");
  w.tick(1 / 30);
  assert(f.x < 1100);
  const t = w.spawn({ id: "enemy" });
  t.x = 1100;
  t.y = 1000;
  w.walls = [{ x: 1050, y: 1000, r: 20 }];
  w.useAbility(s, "pulse");
  assert(!t.push);
  s.cooldowns.pulse = 0;
  s.energy = 100;
  w.walls = [];
  w.useAbility(s, "pulse");
  assert(t.push);
});
test("obstacles use swept collision and prevent traversal", () => {
  const { w, s } = fresh();
  w.walls = [{ x: 1020, y: 1000, r: 10 }];
  w.useAbility(s, "dash");
  w.tick(1 / 30);
  assert(!s.alive);
  assert(s.x < 1020);
});
test("classes have real movement, mass and duration differences", () => {
  const a = fresh(),
    b = fresh();
  a.s.classId = "assault";
  b.s.classId = "titan";
  run(a.w);
  run(b.w);
  assert(a.s.x > b.s.x);
  const c = fresh();
  c.s.classId = "titan";
  c.w.addFood(1005, 1000, 10);
  c.w.tick(1 / 30);
  assert.equal(c.s.mass, 45);
  const d = fresh();
  d.s.classId = "phantom";
  d.w.useAbility(d.s, "ghost");
  assert(d.s.active.ghost > 3);
});
test("six bot personalities choose safe paths and collect over time", () => {
  for (const personality of PERSONALITIES) {
    const { w, s } = fresh();
    s.bot = true;
    s.personality = personality;
    s.angle = Math.PI;
    s.x = 40;
    s.body = s.body.map((p, i) => ({ x: 40 + i * 7, y: 1000 }));
    w.rebuild();
    decide(s, w, 1);
    const future = {
      x: s.x + Math.cos(s.input.angle) * 150,
      y: s.y + Math.sin(s.input.angle) * 150,
    };
    assert(future.x > 40, personality);
  }
  const w = new World({ bots: 40 });
  run(w, 300);
  assert([...w.snakes.values()].some((s) => s.collected > 0));
  assert.equal(w.snakes.size, 40);
});
test("event registry produces each event and a damageable multi-phase boss", () => {
  const { w, s } = fresh();
  for (const type of ["rain", "gold", "storm", "hunt", "boss"]) {
    w.startEvent(type);
    assert.equal(w.event.type, type);
  }
  const boss = w.snakes.get("ancient");
  boss.x = s.x + 50;
  boss.y = s.y;
  boss.hp = 18;
  w.useAbility(s, "pulse");
  assert(!boss.alive);
  assert.equal(s.bosses, 1);
  assert(w.food.size > 100);
});
test("snapshots cull distant food and do not expose account credentials", () => {
  const { w, s } = fresh();
  w.addFood(4000, 4000, 10);
  const snapshot = w.snapshot(s.id);
  assert(!snapshot.food.some((f) => f.x === 4000));
  assert(!JSON.stringify(snapshot).includes("accountId"));
  assert.equal(snapshot.you, s.id);
});
test("arena modes change real simulation rules", () => {
  const classic = new World({ bots: 0, mode: "classic" }),
    fast = new World({ bots: 0, mode: "overdrive" }),
    hard = new World({ bots: 0, mode: "hardcore" });
  assert(fast.rules.speed > classic.rules.speed);
  assert(fast.rules.gain > classic.rules.gain);
  assert.equal(hard.spawn({ id: "p" }).active.shield, 0);
  assert(hard.rules.boostCost > classic.rules.boostCost);
});
test("shield bounces away from a wall and survives the same contact", () => {
  const { w, s } = fresh();
  w.walls = [{ x: 1020, y: 1000, r: 10 }];
  w.useAbility(s, "shield");
  w.tick(1 / 30);
  const x = s.x;
  w.tick(1 / 30);
  assert(s.alive);
  assert(s.x < x);
});
