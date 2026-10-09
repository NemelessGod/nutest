import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Store } from "../server/persistence/store.js";
test("guest, registration, login and persistence survive database reopen", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "neon-"));
  const file = path.join(dir, "game.sqlite");
  let s = new Store(file);
  const guest = s.create("Alpha");
  s.register(guest.account, "alpha_1", "correct-password");
  const rewards = s.settle(guest.account.id, {
    mass: 500,
    collected: 1200,
    survival: 65,
    kills: 5,
    boosts: 20,
    abilities: 50,
    bosses: 1,
    wins: 1,
  });
  assert(rewards.xp > 1200);
  assert(rewards.profile.achievements.length >= 8);
  assert.throws(() => s.login("alpha_1", "incorrect"));
  const login = s.login("alpha_1", "correct-password");
  assert.equal(login.account.id, guest.account.id);
  s.close();
  s = new Store(file);
  const a = s.resolve(login.token);
  assert(a.coins > 0);
  assert.equal(a.stats.matches, 1);
  assert.equal(a.name, "Alpha");
  s.close();
  rmSync(dir, { recursive: true });
});
test("shop validates currency and ownership; quests reward once or repeat", () => {
  const s = new Store(":memory:"),
    a = s.create().account;
  assert.throws(() => s.buy(a.id, "gold"));
  s.settle(a.id, {
    mass: 50,
    collected: 2200,
    survival: 600,
    kills: 5,
    boosts: 40,
    bosses: 0,
  });
  const before = s.get(a.id).coins;
  const after = s.quest(a.id, "energy");
  assert.equal(after.coins, before + 120);
  assert.throws(() => s.quest(a.id, "energy"));
  s.quest(a.id, "boost");
  s.quest(a.id, "boost");
  assert.throws(() => s.quest(a.id, "boost"));
  const p = s.buy(a.id, "pink");
  assert(p.owned.includes("pink"));
  assert.equal(p.equipped.skin, "pink");
  const p2 = s.buy(a.id, "pink");
  assert.equal(p.coins, p2.coins);
  s.close();
});
test("profile ignores client supplied currency, kills and invalid settings", () => {
  const s = new Store(":memory:"),
    a = s.create().account;
  const p = s.update(a.id, {
    coins: 99999,
    stats: { kills: 999 },
    name: "<pilot>",
    loadout: ["ghost", "pulse"],
    settings: { quality: "ultra", keys: { boost: "bad" } },
  });
  assert.equal(p.coins, 0);
  assert.equal(p.stats.kills, 0);
  assert.equal(p.settings.quality, "high");
  assert.deepEqual(p.loadout, ["ghost", "pulse"]);
  s.close();
});
