import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Store } from "./persistence/store.js";
import { Rooms } from "./networking/rooms.js";
import {
  CLASSES,
  SKINS,
  ABILITIES,
  TICK_RATE,
  MODES,
} from "../shared/catalog.js";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export function createGameServer({
  bots = Number(process.env.BOT_COUNT ?? 40),
  capacity = Number(process.env.ROOM_CAPACITY ?? 24),
  database = path.join(
    process.env.DATA_DIR || path.join(root, "data"),
    "neon.sqlite",
  ),
} = {}) {
  const store = new Store(database),
    app = express(),
    http = createServer(app);
  if (process.env.TRUST_PROXY)
    app.set("trust proxy", Number(process.env.TRUST_PROXY));
  app.disable("x-powered-by");
  app.use(express.json({ limit: "8kb" }));
  const origins = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .filter(Boolean);
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("X-Frame-Options", "DENY");
    if (req.method !== "GET" && req.headers.origin) {
      const origin = req.headers.origin;
      const same = origin === `${req.protocol}://${req.get("host")}`;
      if (
        !same &&
        !origins.includes(origin) &&
        !(
          !process.env.COOKIE_SECURE &&
          /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+):5173$/.test(
            origin,
          )
        )
      )
        return res.status(403).json({ error: "Недопустимый origin" });
    }
    next();
  });
  const limits = new Map();
  function limit(key, max, windowMs) {
    const now = Date.now();
    let b = limits.get(key);
    if (!b || now - b.start > windowMs) {
      b = { start: now, n: 0 };
      limits.set(key, b);
    }
    return ++b.n <= max;
  }
  function cookie(req) {
    const c = req.headers.cookie || "";
    return c
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("neon_session="))
      ?.slice(13);
  }
  function session(res, token) {
    res.cookie("neon_session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.COOKIE_SECURE === "true",
      maxAge: 30 * 86400000,
      path: "/",
    });
  }
  app.use("/api", (req, res, next) => {
    if (!limit("api:" + req.ip, 180, 60000))
      return res.status(429).json({ error: "Слишком много запросов" });
    req.account = store.resolve(cookie(req));
    next();
  });
  app.get("/api/health", (req, res) =>
    res.json({
      status: "ok",
      rooms: rooms.rooms.size,
      players: [...rooms.rooms.values()].reduce(
        (n, r) => n + r.clients.size,
        0,
      ),
      tickRate: TICK_RATE,
    }),
  );
  app.post("/api/guest", (req, res) => {
    if (req.account) return res.json(req.account);
    if (!limit("guest:" + req.ip, 15, 60000))
      return res.status(429).json({ error: "Подождите перед новым входом" });
    const r = store.create();
    session(res, r.token);
    res.json(r.account);
  });
  app.get("/api/me", (req, res) => {
    if (!req.account)
      return res.status(401).json({ error: "Войдите в аккаунт" });
    store.rollover(req.account);
    res.json(store.save(req.account));
  });
  function auth(req, res, next) {
    if (!req.account)
      return res.status(401).json({ error: "Войдите в аккаунт" });
    next();
  }
  function route(fn) {
    return (req, res, next) => {
      try {
        res.json(fn(req, res));
      } catch (e) {
        res.status(400).json({ error: e.message });
      }
    };
  }
  app.post(
    "/api/register",
    auth,
    route((req) => {
      if (!limit("auth:" + req.ip, 8, 60000))
        throw Error("Слишком много попыток");
      return store.register(req.account, req.body.username, req.body.password);
    }),
  );
  app.post(
    "/api/login",
    route((req, res) => {
      if (!limit("auth:" + req.ip, 8, 60000))
        throw Error("Слишком много попыток");
      const r = store.login(req.body.username, req.body.password);
      session(res, r.token);
      return r.account;
    }),
  );
  app.post(
    "/api/logout",
    auth,
    route((req, res) => {
      store.logout(cookie(req));
      res.clearCookie("neon_session");
      return { ok: true };
    }),
  );
  app.patch(
    "/api/profile",
    auth,
    route((req) => store.update(req.account.id, req.body)),
  );
  app.post(
    "/api/shop",
    auth,
    route((req) => store.buy(req.account.id, req.body.id)),
  );
  app.post(
    "/api/quest",
    auth,
    route((req) => store.quest(req.account.id, req.body.id)),
  );
  app.get("/api/records", (req, res) => res.json(store.records()));
  const activeAccounts = new Map();
  const io = new Server(http, {
    maxHttpBufferSize: 8192,
    allowRequest: (req, cb) => {
      const o = req.headers.origin;
      let ok = !o;
      if (o) {
        try {
          ok =
            new URL(o).host === req.headers.host ||
            origins.includes(o) ||
            (!process.env.COOKIE_SECURE &&
              /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+):5173$/.test(
                o,
              ));
        } catch {}
      }
      cb(null, ok);
    },
  });
  const rooms = new Rooms({
    bots: Math.max(0, Math.min(100, bots)),
    capacity: Math.max(2, Math.min(64, capacity)),
    onDeath: (s, result) => {
      if (!s.accountId) return;
      const rewards = store.settle(s.accountId, result);
      io.to(s.id).emit("death", { ...result, ...rewards });
    },
  });
  io.use((socket, next) => {
    const a = store.resolve(cookie(socket.request));
    if (!a) return next(Error("Войдите в аккаунт"));
    socket.data.accountId = a.id;
    next();
  });
  function leave(socket) {
    const room = socket.data.room;
    if (!room) return;
    const s = room.world.snakes.get(socket.id);
    if (s?.alive) room.world.kill(s, null, "Вы вышли с арены");
    room.world.snakes.delete(socket.id);
    room.clients.delete(socket.id);
    socket.leave(room.id);
    socket.data.room = null;
    if (activeAccounts.get(socket.data.accountId) === socket.id)
      activeAccounts.delete(socket.data.accountId);
    rooms.cleanup();
  }
  io.on("connection", (socket) => {
    let count = 0,
      last = Date.now(),
      joins = 0;
    socket.on("join", (payload = {}, ack = () => {}) => {
      if (typeof ack !== "function") return;
      if (++joins > 30) return ack({ error: "Слишком много попыток входа" });
      const a = store.get(socket.data.accountId);
      if (activeAccounts.has(a.id) && activeAccounts.get(a.id) !== socket.id)
        return ack({ error: "Аккаунт уже играет в другой вкладке" });
      leave(socket);
      const room = rooms.acquire(
        MODES[payload?.mode] ? payload.mode : "classic",
      );
      socket.data.room = room;
      room.clients.add(socket.id);
      socket.join(room.id);
      activeAccounts.set(a.id, socket.id);
      const skin = SKINS.find((s) => s.id === a.equipped.skin) || SKINS[0];
      room.world.spawn({
        id: socket.id,
        accountId: a.id,
        name: a.name,
        classId: CLASSES[payload?.classId] ? payload.classId : "assault",
        color: skin.color,
        cosmetics: a.equipped,
      });
      ack({ room: room.id, id: socket.id });
    });
    socket.on("input", (p) => {
      const now = Date.now();
      if (now - last >= 1000) {
        count = 0;
        last = now;
      }
      if (++count > 65) return;
      if (
        !p ||
        typeof p.angle !== "number" ||
        !Number.isFinite(p.angle) ||
        Math.abs(p.angle) > 10000 ||
        typeof p.boost !== "boolean"
      )
        return;
      const s = socket.data.room?.world.snakes.get(socket.id);
      if (!s?.alive) return;
      s.input = { angle: p.angle, boost: p.boost };
      s.lastInput = now;
      if (Number.isFinite(p.view))
        s.view = Math.max(700, Math.min(1800, p.view));
    });
    socket.on("ability", (id) => {
      if (!limit("ability:" + socket.id, 15, 1000)) return;
      const s = socket.data.room?.world.snakes.get(socket.id),
        a = store.get(socket.data.accountId);
      if (s && a.loadout.includes(id) && ABILITIES[id])
        socket.data.room.world.useAbility(s, id);
    });
    socket.on("ping-check", (ack) => {
      if (typeof ack === "function" && limit("ping:" + socket.id, 3, 1000))
        ack();
    });
    socket.on("leave", () => leave(socket));
    socket.on("disconnect", () => leave(socket));
  });
  let accumulator = 0,
    previous = performance.now(),
    broadcast = 0;
  const timer = setInterval(() => {
    const now = performance.now();
    accumulator += Math.min(0.2, (now - previous) / 1000);
    previous = now;
    while (accumulator >= 1 / TICK_RATE) {
      for (const r of rooms.rooms.values())
        for (const s of r.world.snakes.values())
          if (!s.bot && s.lastInput && Date.now() - s.lastInput > 1000)
            s.input.boost = false;
      rooms.tick(1 / TICK_RATE);
      accumulator -= 1 / TICK_RATE;
    }
    if (++broadcast % 2 === 0)
      for (const r of rooms.rooms.values())
        for (const id of r.clients) {
          const socket = io.sockets.sockets.get(id);
          if (socket?.conn.transport.writable)
            socket.volatile.emit("state", r.world.snapshot(id));
        }
  }, 1000 / TICK_RATE);
  const gc = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of limits) if (now - v.start > 120000) limits.delete(k);
  }, 60000);
  app.use(express.static(path.join(root, "dist")));
  app.get("/{*path}", (req, res) =>
    res.sendFile(path.join(root, "dist/index.html")),
  );
  app.use((err, req, res, next) =>
    res.status(400).json({ error: "Некорректный запрос" }),
  );
  return {
    app,
    http,
    io,
    store,
    rooms,
    async close() {
      clearInterval(timer);
      clearInterval(gc);
      await new Promise((r) => io.close(r));
      store.close();
    },
  };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = createGameServer();
  server.http.listen(
    Number(process.env.PORT || 3001),
    process.env.HOST || "0.0.0.0",
    () => console.log(`NEON SERPENTS server: port ${process.env.PORT || 3001}`),
  );
  for (const signal of ["SIGTERM", "SIGINT"])
    process.on(signal, async () => {
      await server.close();
      process.exit(0);
    });
}
