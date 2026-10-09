import { randomUUID } from "node:crypto";
import {
  CLASSES,
  ABILITIES,
  COLORS,
  WORLD_SIZE,
  MODES,
} from "../../shared/catalog.js";
import { SpatialGrid, distance, angleDelta, segmentCircle } from "./spatial.js";
import { decide, PERSONALITIES } from "../ai/controller.js";
const names = [
  "KIRA",
  "VORTEX",
  "SPECTRE",
  "NOVA",
  "PIXEL",
  "AXIOM",
  "ZERO",
  "GLITCH",
  "ECHO",
  "ONYX",
  "FLUX",
  "ORBIT",
  "NYX",
  "VEGA",
  "HUSH",
  "RIFT",
  "SORA",
  "BYTE",
  "LUX",
  "ATLAS",
];
export class World {
  constructor({
    bots = 40,
    random = Math.random,
    onDeath = () => {},
    size = WORLD_SIZE,
    mode = "classic",
  } = {}) {
    this.mode = mode;
    this.rules = MODES[mode] || MODES.classic;
    this.eventOrder = ["rain", "gold", "storm", "hunt", "boss"];
    for (let i = 4; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [this.eventOrder[i], this.eventOrder[j]] = [
        this.eventOrder[j],
        this.eventOrder[i],
      ];
    }
    this.size = size;
    this.random = random;
    this.onDeath = onDeath;
    this.time = 0;
    this.snakes = new Map();
    this.food = new Map();
    this.foodGrid = new SpatialGrid(100);
    this.bodyGrid = new SpatialGrid(100);
    this.counter = 0;
    this.botCount = bots;
    this.event = null;
    this.nextEvent = 55;
    this.eventIndex = 0;
    this.effects = [];
    this.walls = [
      { x: size * 0.27, y: size * 0.3, r: 90 },
      { x: size * 0.72, y: size * 0.65, r: 110 },
      { x: size * 0.53, y: size * 0.24, r: 65 },
      { x: size * 0.3, y: size * 0.76, r: 75 },
    ];
    for (let i = 0; i < 1500; i++) this.addFood();
    for (let i = 0; i < bots; i++)
      this.spawn({
        id: `bot-${i}`,
        bot: true,
        name: names[i % names.length] + (i >= 20 ? " " + (i - 19) : ""),
        personality: PERSONALITIES[i % 6],
        classId: Object.keys(CLASSES)[i % 3],
        color: COLORS[i % 6],
      });
    this.rebuild();
  }
  addFood(
    x = 80 + this.random() * (this.size - 160),
    y = 80 + this.random() * (this.size - 160),
    value = 1 + Math.floor(this.random() * 3),
    color = COLORS[Math.floor(this.random() * 6)],
  ) {
    if (this.food.size > 4200) return;
    const f = { id: ++this.counter, x, y, value, color };
    this.food.set(f.id, f);
    return f;
  }
  spawn(options = {}) {
    let p;
    const padding = options.bot ? 180 : Math.min(600, this.size * 0.2);
    for (let i = 0; i < 100; i++) {
      p = {
        x: padding + this.random() * (this.size - padding * 2),
        y: padding + this.random() * (this.size - padding * 2),
      };
      if (
        this.walls.every((w) => distance(w, p) > w.r + 180) &&
        [...this.snakes.values()].every(
          (s) =>
            !s.alive ||
            (distance(s, p) > 180 && s.body.every((b) => distance(b, p) > 100)),
        )
      )
        break;
    }
    const s = {
      id: options.id || randomUUID(),
      name: options.name || "Пилот",
      classId: options.classId || "assault",
      color: options.color || COLORS[0],
      bot: false,
      boss: false,
      personality: "farmer",
      ...options,
      ...p,
      angle: this.random() * Math.PI * 2,
      mass: options.mass || 32,
      energy: 100,
      radius: 9,
      alive: true,
      body: [],
      input: { angle: 0, boost: false },
      cooldowns: {},
      active: { shield: this.rules.spawnShield },
      kills: 0,
      collected: 0,
      boosts: 0,
      abilities: 0,
      bosses: 0,
      started: this.time,
      think: 0,
      seed: this.random() * 20,
      boosting: false,
      bestMass: options.mass || 32,
    };
    s.input.angle = s.angle;
    const n = this.length(s);
    for (let i = 0; i < n; i++)
      s.body.push({
        x: s.x - Math.cos(s.angle) * i * 7,
        y: s.y - Math.sin(s.angle) * i * 7,
      });
    this.snakes.set(s.id, s);
    return s;
  }
  length(s) {
    return Math.min(260, Math.floor(16 + Math.sqrt(s.mass) * 3.2));
  }
  rebuild() {
    this.foodGrid.clear();
    for (const f of this.food.values()) this.foodGrid.insert(f);
    this.bodyGrid.clear();
    for (const s of this.snakes.values())
      if (s.alive)
        s.body.forEach((p, index) =>
          this.bodyGrid.insert({ ...p, id: s.id, index, r: s.radius }),
        );
  }
  useAbility(s, id) {
    const a = ABILITIES[id];
    if (!a || !s.alive || (s.cooldowns[id] || 0) > 0 || s.energy < a.cost)
      return false;
    s.energy -= a.cost;
    s.cooldowns[id] = a.cooldown;
    s.active[id] =
      a.duration *
      (id === "ghost" && s.classId === "phantom"
        ? 1.65
        : id === "shield" && s.classId === "titan"
          ? 1.5
          : 1);
    s.abilities++;
    if (id === "shield") s.shieldCharges = s.classId === "titan" ? 2 : 1;
    if (id === "pulse") {
      for (const enemy of this.snakes.values())
        if (
          enemy.alive &&
          enemy.id !== s.id &&
          distance(s, enemy) < 170 &&
          !this.walls.some((w) => segmentCircle(s, enemy, w, w.r))
        ) {
          const a = Math.atan2(enemy.y - s.y, enemy.x - s.x);
          enemy.push = { angle: a, time: 0.35 };
          if (enemy.boss) {
            enemy.hp -= 18;
            enemy.damageBy = s.id;
            if (enemy.hp <= 0) this.kill(enemy, s.id, "Импульс");
          }
        }
    }
    this.effects.push({
      id: ++this.counter,
      type: id,
      x: s.x,
      y: s.y,
      color: s.color,
      time: this.time,
    });
    return true;
  }
  kill(s, killerId = null, reason = "Столкновение") {
    if (!s.alive) return;
    const wasLeader = this.leaderboard()[0]?.id === s.id;
    s.alive = false;
    const killer = this.snakes.get(killerId);
    if (killer?.alive && killer.id !== s.id) {
      killer.kills++;
      if (s.boss) killer.bosses++;
      if (this.event?.type === "hunt" && this.event.leader === s.id)
        killer.mass += 150;
    }
    const points = s.body.filter((_, i) => i % 2 === 0);
    for (const p of points)
      this.addFood(
        p.x,
        p.y,
        Math.max(3, Math.floor(s.mass / Math.max(1, points.length))),
        s.color,
      );
    if (s.boss)
      for (let i = 0; i < 120; i++)
        this.addFood(
          Math.max(
            30,
            Math.min(this.size - 30, s.x + (this.random() - 0.5) * 400),
          ),
          Math.max(
            30,
            Math.min(this.size - 30, s.y + (this.random() - 0.5) * 400),
          ),
          10,
          COLORS[3],
        );
    this.effects.push({
      id: ++this.counter,
      type: "death",
      x: s.x,
      y: s.y,
      color: s.color,
      time: this.time,
      style: s.cosmetics?.death,
    });
    if (!s.bot)
      this.onDeath(s, {
        mass: Math.floor(s.bestMass),
        kills: s.kills,
        survival: Math.floor(this.time - s.started),
        collected: s.collected,
        boosts: s.boosts,
        abilities: s.abilities,
        bosses: s.bosses,
        wins: wasLeader ? 1 : 0,
        reason,
      });
    s.respawnAt = this.time + 3;
  }
  collide(s, killerId, reason) {
    if (s.active.ghost > 0 && killerId) return;
    const contact = killerId || reason;
    if (s.contactGrace?.contact === contact && s.contactGrace.until > this.time)
      return;
    if (s.active.shield > 0) {
      s.shieldCharges = (s.shieldCharges ?? 1) - 1;
      if (s.shieldCharges <= 0) s.active.shield = 0;
      s.angle += Math.PI;
      s.push = { angle: s.angle, time: 0.4 };
      s.input.angle = s.angle;
      s.contactGrace = { contact, until: this.time + 0.3 };
      return;
    }
    this.kill(s, killerId, reason);
  }
  startEvent(type = this.eventOrder[this.eventIndex++ % 5]) {
    const titles = {
      rain: "Энергетический дождь",
      gold: "Золотая зона",
      storm: "Электрическая буря",
      hunt: "Охота за лидером",
      boss: "Пробуждение древнего",
    };
    this.event = {
      type,
      title: titles[type],
      ends: this.time + 45,
      x: this.size * 0.5,
      y: this.size * 0.5,
      r: 430,
    };
    if (type === "rain")
      for (let i = 0; i < 700; i++) this.addFood(undefined, undefined, 6);
    if (type === "gold")
      for (let i = 0; i < 180; i++) {
        const a = this.random() * Math.PI * 2,
          r = this.random() * 400;
        this.addFood(
          this.event.x + Math.cos(a) * r,
          this.event.y + Math.sin(a) * r,
          7,
          COLORS[3],
        );
      }
    if (type === "storm")
      this.event.zones = [
        { x: this.size * 0.35, y: this.size * 0.4, r: 150 },
        { x: this.size * 0.7, y: this.size * 0.5, r: 180 },
      ];
    if (type === "hunt") this.event.leader = this.leaderboard()[0]?.id;
    if (type === "boss") {
      const b = this.spawn({
        id: "ancient",
        bot: true,
        boss: true,
        name: "ДРЕВНИЙ / Ω",
        classId: "titan",
        color: "#ffca6b",
        mass: 1800,
      });
      b.hp = 180;
      b.maxHp = 180;
    }
  }
  tick(dt) {
    this.time += dt;
    this.effects = this.effects.filter((e) => this.time - e.time < 1.4);
    if (this.time >= this.nextEvent) {
      this.startEvent();
      this.nextEvent = this.time + this.rules.eventInterval;
    }
    if (this.event && this.time > this.event.ends) {
      this.event = null;
      const b = this.snakes.get("ancient");
      if (b) {
        b.alive = false;
        this.snakes.delete("ancient");
      }
    }
    if (this.event?.type === "storm")
      this.event.zones.forEach((z, i) => {
        z.x += Math.cos(this.time * 0.14 + i * 3) * 55 * dt;
        z.y += Math.sin(this.time * 0.14 + i * 3) * 55 * dt;
      });
    this.rebuild();
    for (const s of this.snakes.values()) {
      if (!s.alive) {
        if (s.bot && !s.boss && this.time > s.respawnAt)
          this.spawn({
            id: s.id,
            bot: true,
            name: s.name,
            personality: s.personality,
            classId: s.classId,
            color: s.color,
          });
        continue;
      }
      const klass = CLASSES[s.classId] || CLASSES.assault;
      for (const k in s.cooldowns)
        s.cooldowns[k] = Math.max(0, s.cooldowns[k] - dt);
      for (const k in s.active) s.active[k] = Math.max(0, s.active[k] - dt);
      s.radius = Math.min(20, 8 + Math.sqrt(s.mass) * 0.12);
      if (s.boss) {
        const targets = [...this.snakes.values()].filter(
          (x) => x.alive && !x.bot,
        );
        const target = targets.sort(
          (a, b) => distance(s, a) - distance(s, b),
        )[0];
        s.phase = s.hp > 120 ? 1 : s.hp > 60 ? 2 : 3;
        s.input.angle = target
          ? Math.atan2(target.y - s.y, target.x - s.x)
          : s.angle + 0.1;
        s.input.boost = s.phase === 3;
        if (target && distance(s, target) < 200)
          this.useAbility(
            s,
            s.phase === 1 ? "magnet" : s.phase === 2 ? "pulse" : "dash",
          );
      } else if (s.bot) decide(s, this, dt);
      const pushing = s.push?.time > 0;
      const target = pushing ? s.push.angle : s.input.angle;
      const maxTurn =
        (((s.boss ? 1.4 : 3.4) * klass.turn) / (1 + s.mass / 1800)) * dt;
      s.angle += Math.max(
        -maxTurn,
        Math.min(maxTurn, angleDelta(target, s.angle)),
      );
      const boosting = s.input.boost && s.energy > 0 && s.mass > 24;
      if (boosting && !s.boosting) s.boosts++;
      s.boosting = boosting;
      s.energy = Math.min(
        100,
        Math.max(0, s.energy + (boosting ? -this.rules.boostCost : 13) * dt),
      );
      if (boosting) {
        s.mass = Math.max(24, s.mass - 4 * dt);
        if (this.random() < dt * 9)
          this.addFood(s.body.at(-1).x, s.body.at(-1).y, 1, s.color);
      }
      let speed =
        (((s.boss ? 120 : 155) * klass.speed * this.rules.speed) /
          (1 + s.mass / 6000)) *
        (boosting ? 1.72 : 1) *
        (s.active.dash > 0 ? 2.6 * klass.dash : 1) *
        (pushing ? 1.2 : 1);
      const old = { x: s.x, y: s.y };
      const movingAngle = pushing ? s.push.angle : s.angle;
      s.x += Math.cos(movingAngle) * speed * dt;
      s.y += Math.sin(movingAngle) * speed * dt;
      if (pushing) s.push.time -= dt;
      if (
        s.x < s.radius ||
        s.y < s.radius ||
        s.x > this.size - s.radius ||
        s.y > this.size - s.radius
      ) {
        s.x = Math.max(s.radius, Math.min(this.size - s.radius, s.x));
        s.y = Math.max(s.radius, Math.min(this.size - s.radius, s.y));
        this.collide(s, null, "Граница арены");
      }
      for (const wall of this.walls)
        if (segmentCircle(old, s, wall, wall.r + s.radius)) {
          const a = Math.atan2(s.y - wall.y, s.x - wall.x);
          s.x = wall.x + Math.cos(a) * (wall.r + s.radius + 1);
          s.y = wall.y + Math.sin(a) * (wall.r + s.radius + 1);
          this.collide(s, null, "Энергетическая стена");
          break;
        }
      if (!s.alive) continue;
      const n = this.length(s);
      while (s.body.length < n) s.body.push({ ...s.body.at(-1) });
      s.body.length = n;
      s.body[0] = { x: s.x, y: s.y };
      for (let i = 1; i < n; i++) {
        const p = s.body[i],
          prev = s.body[i - 1],
          d = distance(p, prev);
        if (d > 7) {
          p.x = prev.x + ((p.x - prev.x) / d) * 7;
          p.y = prev.y + ((p.y - prev.y) / d) * 7;
        }
      }
      for (const f of this.foodGrid.query(
        s.x,
        s.y,
        s.active.magnet > 0 ? 160 : 30,
      )) {
        if (!this.food.has(f.id)) continue;
        if (s.active.magnet > 0) {
          const d = distance(s, f);
          if (d > 1) {
            f.x += ((s.x - f.x) / d) * 230 * dt;
            f.y += ((s.y - f.y) / d) * 230 * dt;
          }
        }
        if (distance(s, f) < s.radius + 7) {
          this.food.delete(f.id);
          const gain =
            f.value *
            klass.gain *
            this.rules.gain *
            (this.event?.type === "gold" &&
            distance(s, this.event) < this.event.r
              ? 1.5
              : 1);
          s.mass += gain;
          s.collected += f.value;
          s.bestMass = Math.max(s.bestMass, s.mass);
        }
      }
      if (s.boss) continue;
      const candidates = this.bodyGrid.query(
        (old.x + s.x) / 2,
        (old.y + s.y) / 2,
        35 + speed * dt,
      );
      for (const p of candidates)
        if (p.id !== s.id && segmentCircle(old, s, p, s.radius + p.r - 2)) {
          const enemy = this.snakes.get(p.id);
          if (!enemy?.alive) continue;
          if (enemy.boss && s.active.ghost > 0) {
            enemy.hp -= dt * 12;
            enemy.damageBy = s.id;
            if (enemy.hp <= 0) this.kill(enemy, s.id, "Призрачный удар");
          }
          this.collide(s, p.id, "Столкновение со змеёй");
          break;
        }
      if (this.event?.type === "storm")
        for (const z of this.event.zones)
          if (distance(s, z) < z.r && s.active.ghost <= 0) {
            s.energy = Math.max(0, s.energy - 40 * dt);
            s.mass -= 12 * dt;
            if (s.mass < 24) this.collide(s, null, "Электрическая буря");
          }
    }
    for (let i = 0; i < Math.min(8, 1500 - this.food.size); i++) this.addFood();
  }
  leaderboard() {
    return [...this.snakes.values()]
      .filter((s) => s.alive && !s.boss)
      .sort((a, b) => b.mass - a.mass)
      .slice(0, 10)
      .map((s) => ({
        id: s.id,
        name: s.name,
        mass: Math.floor(s.mass),
        color: s.color,
      }));
  }
  snapshot(id) {
    const player = this.snakes.get(id);
    const focus = player?.alive
      ? player
      : { x: this.size / 2, y: this.size / 2 };
    const range = player?.view || 1100;
    const visible = [...this.snakes.values()].filter(
      (s) =>
        s.alive &&
        (s.id === id || s.body.some((p) => distance(p, focus) < range)),
    );
    const boss = this.snakes.get("ancient");
    return {
      time: this.time,
      size: this.size,
      mode: this.mode,
      you: id,
      snakes: visible.map((s) => ({
        id: s.id,
        name: s.name,
        classId: s.classId,
        color: s.color,
        x: s.x,
        y: s.y,
        angle: s.angle,
        mass: Math.floor(s.mass),
        radius: s.radius,
        body: s.body.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) })),
        energy: Math.round(s.energy),
        active: s.active,
        cooldowns: s.cooldowns,
        kills: s.kills,
        boosting: s.boosting,
        boss: s.boss,
        cosmetics: s.cosmetics || {},
        phase: s.phase,
      })),
      food: [...this.food.values()]
        .filter((f) => distance(f, focus) < range)
        .map((f) => ({ ...f, x: Math.round(f.x), y: Math.round(f.y) })),
      walls: this.walls,
      leaderboard: this.leaderboard(),
      rank: player?.alive
        ? [...this.snakes.values()].filter(
            (s) => s.alive && !s.boss && s.mass > player.mass,
          ).length + 1
        : 0,
      survival: player ? Math.floor(this.time - player.started) : 0,
      event: this.event,
      boss: boss?.alive
        ? { hp: boss.hp, maxHp: boss.maxHp, phase: boss.phase }
        : null,
      effects: this.effects.filter((e) => distance(e, focus) < range),
      minimap: [...this.snakes.values()]
        .filter((s) => s.alive)
        .map((s) => ({ x: s.x, y: s.y, id: s.id, boss: s.boss })),
    };
  }
}
