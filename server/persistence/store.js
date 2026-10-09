import { DatabaseSync } from "node:sqlite";
import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import {
  ACHIEVEMENTS,
  QUESTS,
  SKINS,
  COSMETICS,
} from "../../shared/catalog.js";
export const hashToken = (t) => createHash("sha256").update(t).digest("hex");
const day = () => new Date().toISOString().slice(0, 10);
const emptyStats = () => ({
  matches: 0,
  collected: 0,
  kills: 0,
  survival: 0,
  boosts: 0,
  abilities: 0,
  bosses: 0,
  bestMass: 0,
  wins: 0,
});
export class Store {
  constructor(file) {
    if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS accounts(id INTEGER PRIMARY KEY,username TEXT UNIQUE,password TEXT,profile TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,account_id INTEGER REFERENCES accounts(id),expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS matches(id INTEGER PRIMARY KEY,account_id INTEGER REFERENCES accounts(id),created INTEGER,result TEXT);`);
  }
  create(name = "Пилот", username = null, password = null) {
    const profile = {
      name: name.slice(0, 20),
      xp: 0,
      coins: 0,
      owned: ["cyan", "violet"],
      equipped: { skin: "cyan" },
      achievements: [],
      stats: emptyStats(),
      quests: { day: day(), daily: emptyStats(), claimed: {}, repeat: {} },
      settings: {
        quality: "high",
        sound: true,
        telemetry: true,
        keys: { boost: "Space", first: "KeyQ", second: "KeyE" },
      },
      loadout: ["dash", "shield"],
    };
    const r = this.db
      .prepare("INSERT INTO accounts(username,password,profile) VALUES(?,?,?)")
      .run(username, password, JSON.stringify(profile));
    return this.session(Number(r.lastInsertRowid));
  }
  session(id) {
    const token = randomBytes(32).toString("hex");
    this.db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
    this.db
      .prepare("INSERT INTO sessions VALUES(?,?,?)")
      .run(hashToken(token), id, Date.now() + 30 * 86400000);
    return { token, account: this.get(id) };
  }
  resolve(token) {
    if (typeof token !== "string" || token.length !== 64) return null;
    const s = this.db
      .prepare("SELECT account_id FROM sessions WHERE token=? AND expires>?")
      .get(hashToken(token), Date.now());
    return s ? this.get(s.account_id) : null;
  }
  get(id) {
    const a = this.db
      .prepare("SELECT id,username,profile FROM accounts WHERE id=?")
      .get(id);
    if (!a) return null;
    return { id: a.id, registered: !!a.username, ...JSON.parse(a.profile) };
  }
  save(a) {
    const { id, registered, ...profile } = a;
    this.db
      .prepare("UPDATE accounts SET profile=? WHERE id=?")
      .run(JSON.stringify(profile), id);
    return this.get(id);
  }
  register(account, username, password) {
    if (
      !/^[a-zA-Z0-9_]{3,24}$/.test(username) ||
      typeof password !== "string" ||
      password.length < 10 ||
      password.length > 128
    )
      throw new Error(
        "Логин: 3–24 латинских символа. Пароль: 10–128 символов.",
      );
    if (account.registered) throw new Error("Аккаунт уже зарегистрирован");
    const salt = randomBytes(16).toString("hex");
    const hash = scryptSync(password, salt, 64).toString("hex");
    try {
      this.db
        .prepare("UPDATE accounts SET username=?,password=? WHERE id=?")
        .run(username, salt + ":" + hash, account.id);
    } catch {
      throw new Error("Этот логин уже занят");
    }
    return this.get(account.id);
  }
  login(username, password) {
    if (
      typeof username !== "string" ||
      typeof password !== "string" ||
      password.length > 128
    )
      throw new Error("Неверные данные");
    const a = this.db
      .prepare("SELECT id,password FROM accounts WHERE username=?")
      .get(username);
    const [salt, hash] = (
      a?.password || "00000000000000000000000000000000:" + "0".repeat(128)
    ).split(":");
    const ok = timingSafeEqual(
      scryptSync(password, salt, 64),
      Buffer.from(hash, "hex"),
    );
    if (!a || !ok) throw new Error("Неверный логин или пароль");
    return this.session(a.id);
  }
  logout(token) {
    this.db.prepare("DELETE FROM sessions WHERE token=?").run(hashToken(token));
  }
  rollover(a) {
    if (a.quests.day !== day()) {
      a.quests.day = day();
      a.quests.daily = emptyStats();
      for (const q of QUESTS) if (q.daily) delete a.quests.claimed[q.id];
    }
  }
  settle(id, result) {
    const a = this.get(id);
    if (!a) return;
    this.rollover(a);
    const xp = Math.max(
      0,
      Math.floor(
        result.collected +
          result.survival * 0.5 +
          result.kills * 45 +
          result.bosses * 250,
      ),
    );
    const coins = Math.floor(xp / 12);
    a.xp += xp;
    a.coins += coins;
    a.stats.matches++;
    a.quests.daily.matches++;
    for (const key of [
      "collected",
      "kills",
      "survival",
      "boosts",
      "abilities",
      "bosses",
      "wins",
    ]) {
      a.stats[key] += result[key] || 0;
      a.quests.daily[key] += result[key] || 0;
    }
    a.stats.bestMass = Math.max(a.stats.bestMass, result.mass || 0);
    const unlocked = [];
    for (const ach of ACHIEVEMENTS)
      if (a.stats[ach.stat] >= ach.target && !a.achievements.includes(ach.id)) {
        a.achievements.push(ach.id);
        a.coins += ach.reward;
        unlocked.push(ach.name);
      }
    this.db
      .prepare("INSERT INTO matches(account_id,created,result) VALUES(?,?,?)")
      .run(id, Date.now(), JSON.stringify(result));
    this.save(a);
    return { xp, coins, unlocked, profile: this.get(id) };
  }
  quest(id, qid) {
    const a = this.get(id);
    this.rollover(a);
    const q = QUESTS.find((q) => q.id === qid);
    if (!q) throw new Error("Задание не найдено");
    const progress = q.daily
      ? a.quests.daily[q.stat]
      : a.stats[q.stat] - (a.quests.repeat[q.id] || 0);
    if (progress < q.target || (q.daily && a.quests.claimed[q.id]))
      throw new Error("Условия ещё не выполнены");
    a.coins += q.reward;
    if (q.daily) a.quests.claimed[q.id] = true;
    else a.quests.repeat[q.id] = (a.quests.repeat[q.id] || 0) + q.target;
    return this.save(a);
  }
  buy(id, itemId) {
    const a = this.get(id),
      item = [...SKINS, ...COSMETICS].find((i) => i.id === itemId);
    if (!item) throw new Error("Предмет не найден");
    if (!a.owned.includes(itemId)) {
      if (a.coins < item.cost) throw new Error("Недостаточно кредитов");
      a.coins -= item.cost;
      a.owned.push(itemId);
    }
    if (item.type) a.equipped[item.type] = item.id;
    else a.equipped.skin = item.id;
    return this.save(a);
  }
  update(id, p) {
    const a = this.get(id);
    if (typeof p.name === "string")
      a.name = p.name.trim().slice(0, 20) || "Пилот";
    if (
      Array.isArray(p.loadout) &&
      p.loadout.length === 2 &&
      p.loadout.every((x) =>
        ["dash", "shield", "magnet", "pulse", "ghost"].includes(x),
      ) &&
      p.loadout[0] !== p.loadout[1]
    )
      a.loadout = p.loadout;
    if (p.settings) {
      const s = p.settings;
      if (["low", "medium", "high"].includes(s.quality))
        a.settings.quality = s.quality;
      for (const k of ["sound", "telemetry"])
        if (typeof s[k] === "boolean") a.settings[k] = s[k];
      if (
        s.keys &&
        ["boost", "first", "second"].every((k) =>
          /^(Key[A-Z]|Digit[0-9]|Space|ShiftLeft|ShiftRight)$/.test(s.keys[k]),
        ) &&
        new Set(Object.values(s.keys)).size === 3
      )
        a.settings.keys = s.keys;
    }
    return this.save(a);
  }
  records() {
    return this.db
      .prepare("SELECT profile FROM accounts")
      .all()
      .map((a) => JSON.parse(a.profile))
      .filter((a) => a.stats.matches > 0)
      .sort((a, b) => b.stats.bestMass - a.stats.bestMass)
      .slice(0, 20)
      .map((a) => ({
        name: a.name,
        mass: a.stats.bestMass,
        kills: a.stats.kills,
        level: 1 + Math.floor(Math.sqrt(a.xp / 200)),
      }));
  }
  close() {
    this.db.close();
  }
}
