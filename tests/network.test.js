import test from "node:test";
import assert from "node:assert/strict";
import { io } from "socket.io-client";
import { createGameServer } from "../server/index.js";
const waitEvent = (s, event) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(Error("Timeout: " + event)), 6000);
    s.once(event, (v) => {
      clearTimeout(t);
      resolve(v);
    });
  });
async function guest(base) {
  const r = await fetch(base + "/api/guest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  return {
    cookie: r.headers.get("set-cookie").split(";")[0],
    account: await r.json(),
  };
}
async function connect(base, cookie) {
  const s = io(base, {
    extraHeaders: { Cookie: cookie },
    transports: ["websocket"],
    forceNew: true,
  });
  await waitEvent(s, "connect");
  return s;
}
const join = (s) =>
  new Promise((r) => s.emit("join", { classId: "assault" }, r));
test("two real clients share authoritative world, inputs, rooms, rewards and rejoin", async () => {
  const server = createGameServer({
    bots: 0,
    capacity: 2,
    database: ":memory:",
  });
  await new Promise((r) => server.http.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.http.address().port}`;
  const sockets = [];
  try {
    const a = await guest(base),
      b = await guest(base),
      c = await guest(base);
    const s1 = await connect(base, a.cookie),
      s2 = await connect(base, b.cookie),
      s3 = await connect(base, c.cookie);
    sockets.push(s1, s2, s3);
    const r1 = await join(s1),
      r2 = await join(s2),
      r3 = await join(s3);
    assert.equal(r1.room, r2.room);
    assert.notEqual(r1.room, r3.room);
    const room = server.rooms.rooms.get(r1.room),
      p = room.world.snakes.get(s1.id),
      q = room.world.snakes.get(s2.id);
    p.x = 1500;
    p.y = 1500;
    p.angle = 0;
    q.x = 1900;
    q.y = 1500;
    q.angle = 0;
    p.body = p.body.map((_, i) => ({ x: 1500 - i * 7, y: 1500 }));
    q.body = q.body.map((_, i) => ({ x: 1900 - i * 7, y: 1500 }));
    p.active.shield = 5;
    q.active.shield = 5;
    room.world.addFood(1508, 1500, 10);
    s1.emit("input", { angle: 0, boost: false, mass: 999999 });
    const state = await waitEvent(s1, "state");
    assert(state.snakes.some((s) => s.id === s2.id));
    assert(p.mass < 100);
    const x = p.x;
    await new Promise((r) => setTimeout(r, 150));
    assert(p.x > x);
    s1.emit("input", { angle: "bad", boost: true });
    s1.emit("input", { angle: Infinity, boost: true });
    assert.equal(p.input.boost, false);
    const before = p.energy;
    s1.emit("ability", "ghost");
    await new Promise((r) => setTimeout(r, 50));
    assert(p.energy >= before);
    const death = waitEvent(s1, "death");
    room.world.kill(p, s2.id);
    const result = await death;
    assert(result.xp > 0);
    assert.equal(server.store.get(a.account.id).stats.matches, 1);
    await join(s1);
    assert(room.world.snakes.get(s1.id).alive);
    const unauthorized = await fetch(base + "/api/shop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"id":"gold"}',
    });
    assert.equal(unauthorized.status, 401);
    const forged = await fetch(base + "/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: a.cookie },
      body: '{"coins":999999}',
    });
    assert.notEqual((await forged.json()).coins, 999999);
  } finally {
    for (const s of sockets) s.disconnect();
    await server.close();
  }
});
test("origin restrictions and session authentication reject hostile clients", async () => {
  const server = createGameServer({ bots: 0, database: ":memory:" });
  await new Promise((r) => server.http.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.http.address().port}`;
  try {
    const r = await fetch(base + "/api/guest", {
      method: "POST",
      headers: {
        Origin: "https://evil.example",
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    assert.equal(r.status, 403);
    const s = io(base, { transports: ["websocket"], reconnection: false });
    const e = await waitEvent(s, "connect_error");
    assert.match(e.message, /аккаунт/);
    s.disconnect();
  } finally {
    await server.close();
  }
});
