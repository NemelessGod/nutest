import test from "node:test";
import assert from "node:assert/strict";
import {
  createRun,
  beginBlind,
  playHand,
  discardHand,
  addJoker,
  makeOffer,
  buy,
  useConsumable,
  sellJoker,
  reroll,
  pickBooster,
  abyssAction,
  nextBlind,
  enterEndless,
  newProfile,
  syncProfile,
  newCard,
} from "../../client/src/abyss/engine/run.ts";
import { evaluate } from "../../client/src/abyss/engine/poker.ts";
import {
  score,
  D,
  evolve,
  formatNumber,
} from "../../client/src/abyss/engine/score.ts";
import {
  JOKERS,
  HAND_ORDER,
  CHALLENGES,
} from "../../client/src/abyss/engine/catalog.ts";
import {
  Saves,
  parseSave,
  serialize,
  KEY,
  validateRun,
} from "../../client/src/abyss/storage/save.ts";
import type { Card, HandId, Run } from "../../client/src/abyss/engine/types.ts";
function cards(ranks: number[], suits: string[] = []): Card[] {
  return ranks.map((rank, i) => ({
    id: "c" + i,
    rank,
    suit: (suits[i] ||
      ["hearts", "clubs", "diamonds", "spades"][i % 4]) as Card["suit"],
    enhancement: "none",
    seal: "none",
    curse: "none",
    uses: 0,
    blocked: 0,
    edition: "base",
  }));
}
function hand(ranks = [10, 10, 4, 3, 2]) {
  const r = createRun("test");
  beginBlind(r);
  r.deck = cards(ranks);
  r.hand = r.deck.map((c) => c.id);
  r.draw = [];
  r.discard = [];
  r.target = "100000000000";
  return r;
}
for (const [type, ranks, suits] of [
  ["high", [2, 4, 7, 9, 14]],
  ["pair", [2, 2, 3, 4, 5]],
  ["twoPair", [2, 2, 3, 3, 5]],
  ["three", [2, 2, 2, 4, 5]],
  ["straight", [14, 2, 3, 4, 5]],
  ["flush", [2, 4, 7, 9, 14], Array(5).fill("hearts")],
  ["fullHouse", [2, 2, 2, 3, 3]],
  ["four", [2, 2, 2, 2, 3]],
  ["straightFlush", [10, 11, 12, 13, 14], Array(5).fill("spades")],
  ["five", [7, 7, 7, 7, 7]],
  ["flushHouse", [2, 2, 2, 3, 3], Array(5).fill("clubs")],
  ["flushFive", [7, 7, 7, 7, 7], Array(5).fill("diamonds")],
] as [HandId, number[], string[]?][])
  test("poker " + type, () =>
    assert.equal(evaluate(cards(ranks, suits)).type, type),
  );
test("four fingers, wild cards, ace-low and scoring subset", () => {
  assert.equal(evaluate(cards([2, 3, 4, 5]), true).type, "straight");
  const c = cards(
    [2, 4, 7, 9, 14],
    ["hearts", "hearts", "hearts", "hearts", "spades"],
  );
  c[4].enhancement = "wild";
  assert.equal(evaluate(c).type, "flush");
  assert.equal(evaluate(cards([2, 2, 14, 4, 7])).scoring.length, 2);
  assert.throws(() => evaluate([]));
});
test("deterministic shuffle and gameplay; preview does not mutate", () => {
  const a = createRun("seed"),
    b = createRun("seed");
  beginBlind(a);
  beginBlind(b);
  assert.deepEqual(a.hand, b.hand);
  const before = JSON.stringify(a);
  score(a, a.hand.slice(0, 3), true);
  assert.equal(JSON.stringify(a), before);
  assert.equal(a.deck.length, 52);
});
test("score order: base, levels, played cards, improvements, held, jokers, global", () => {
  const r = hand([10, 10, 13]);
  r.deck[2].enhancement = "steel";
  addJoker(r, "spark");
  addJoker(r, "pair");
  const result = score(r, ["c0", "c1"]);
  assert.equal(result.chips, "30");
  assert.equal(result.mult, "10.5");
  assert.equal(result.total, "315");
  assert(
    result.lines.findIndex((l) => l.stage === "Оставшиеся карты") <
      result.lines.findIndex((l) => l.stage === "Джокеры"),
  );
});
test("huge scores are finite precise strings and support scientific notation", () => {
  const r = hand([14, 14, 14, 14, 14]);
  r.levels.five = 1000000;
  for (let i = 0; i < 5; i++) addJoker(r, "spark");
  r.jokers.forEach((j) => {
    j.evolution = 3;
    j.activations = 40;
    j.edition = "prism";
  });
  const result = score(r, r.hand);
  assert(D(result.total).gt(1e12));
  assert(!result.total.includes("Infinity"));
  assert.equal(D("1e1000").mul("1e1000").toString(), "1e+2000");
  assert.match(formatNumber("1e2000"), /e\+2000/);
  assert.throws(() => D(NaN));
});
test("red seals and echo re-trigger played cards without infinite loops", () => {
  const r = hand([10]);
  r.deck[0].seal = "red";
  addJoker(r, "echo");
  const result = score(r, r.hand);
  assert.equal(result.chips, "35");
  assert.equal(result.lines.filter((l) => l.stage === "Карты").length, 3);
});
test("adjacent copies respect order, cycles are bounded, evolution persists", () => {
  const r = hand([10, 10]);
  addJoker(r, "mirror");
  addJoker(r, "spark");
  const a = score(r, r.hand);
  assert.equal(a.mult, "10");
  r.jokers[1].key = "reverse";
  const b = score(r, r.hand);
  assert.equal(b.mult, "2");
  assert(b.lines.length < 30);
  r.jokers[1].key = "spark";
  r.jokers[1].activations = 7;
  score(r, r.hand);
  assert.equal(r.jokers[1].evolution, 1);
  assert.equal(JSON.parse(JSON.stringify(r)).jokers[1].activations, 8);
});
test("all 36 joker definitions execute through score or run triggers", () => {
  assert.equal(JOKERS.length, 36);
  assert.equal(JOKERS.filter((j) => j.evolves).length, 20);
  for (const def of JOKERS) {
    const r = hand([14, 13, 8, 5, 2]);
    r.money = 40;
    r.history = ["pair", "flush"];
    addJoker(r, def.key);
    const result = score(r, r.hand);
    assert(D(result.total).gte(0), def.key);
    assert(!result.total.includes("NaN"), def.key);
  }
});
test("played cursed cards give bonuses and real drawbacks", () => {
  const r = hand([14, 13, 7]);
  r.deck[0].curse = "ace";
  r.deck[1].curse = "king";
  r.deck[2].curse = "seven";
  const money = r.money;
  score(r, ["c1"]);
  assert.equal(r.money, money - 2);
  assert(r.abyss > 0);
  for (let i = 0; i < 3; i++) score(r, ["c0"]);
  assert.equal(r.deck[0].blocked, 2);
  for (let i = 0; i < 5; i++) score(r, ["c2"]);
  assert(!r.deck.some((c) => c.id === "c2"));
});
test("play/discard advance zones, rewards and loss are authoritative in engine", () => {
  const r = createRun("play");
  beginBlind(r);
  const size = r.draw.length;
  discardHand(r, r.hand.slice(0, 2));
  assert.equal(r.discards, 2);
  assert.equal(r.draw.length, size - 2);
  r.target = "1";
  playHand(r, [r.hand[0]]);
  assert.equal(r.phase, "shop");
  assert(r.money > 8);
  nextBlind(r);
  assert.equal(r.phase, "blind");
  const l = hand();
  l.hands = 1;
  playHand(l, ["c0"]);
  assert.equal(l.phase, "lost");
});
test("shop purchases, vouchers, reroll, sale and booster change state", () => {
  const r = hand();
  r.phase = "shop";
  r.money = 100;
  r.shop = [
    makeOffer(r, "joker", "spark"),
    makeOffer(r, "voucher", "hand"),
    makeOffer(r, "booster", "celestial"),
  ];
  buy(r, r.shop[0].id);
  assert.equal(r.jokers.length, 1);
  assert.throws(() => buy(r, r.shop[0].id));
  buy(r, r.shop[1].id);
  assert.equal(r.handSize, 9);
  buy(r, r.shop[2].id);
  assert.equal(r.phase, "booster");
  pickBooster(r, r.booster[0].id);
  assert.equal(r.consumables.length, 1);
  sellJoker(r, r.jokers[0].id);
  assert.equal(r.jokers.length, 0);
  const money = r.money;
  reroll(r);
  assert.equal(r.money, money - 3);
  assert.equal(r.shop.length >= 6, true);
});
test("tarot, planets and spectral apply exactly once and reject bad targets", () => {
  const r = hand();
  r.consumables = [
    { id: "t", type: "tarot", key: "bonus" },
    { id: "p", type: "planet", key: "pair" },
    { id: "s", type: "spectral", key: "red" },
  ];
  useConsumable(r, "t", ["c0", "c1"]);
  assert.equal(r.deck[0].enhancement, "bonus");
  useConsumable(r, "p", []);
  assert.equal(r.levels.pair, 2);
  assert.throws(() => useConsumable(r, "s", []));
  useConsumable(r, "s", ["c0"]);
  assert.equal(r.deck[0].seal, "red");
  assert.equal(r.consumables.length, 0);
  assert.throws(() => useConsumable(r, "p", []));
});
test("abyss energy pays for real changes and cancels accepted anomaly", () => {
  const r = hand();
  r.abyss = 20;
  addJoker(r, "spark");
  abyssAction(r, "alter", "c0");
  assert.equal(r.deck[0].enhancement, "mult");
  abyssAction(r, "boost", r.jokers[0].id);
  assert.equal(r.jokers[0].boostAnte, r.ante);
  assert.throws(() => abyssAction(r, "boost", r.jokers[0].id));
  abyssAction(r, "reveal");
  assert.equal(r.consumables.length, 1);
  r.anomaly = "mult";
  r.anomalyAccepted = true;
  abyssAction(r, "cancel");
  assert(!r.anomalyAccepted);
  assert.equal(r.abyss, 5);
});
test("bosses enforce their unique restrictions and final boss diversity", () => {
  const r = hand([2, 2, 3, 4, 5]);
  r.boss = "mirror";
  r.previousHand = "pair";
  assert.throws(() => playHand(r, ["c0", "c1"]));
  r.boss = "collector";
  r.target = "1";
  playHand(r, ["c0", "c1"]);
  assert.equal(r.phase, "playing");
  const f = hand([2, 2, 3, 4, 5]);
  f.boss = "abyss";
  f.target = "1";
  playHand(f, ["c0", "c1"]);
  assert.equal(f.phase, "playing");
  assert.equal(f.roundTypes.length, 1);
});
test("final victory enters endless and rewards are not double-counted", () => {
  const r = hand([2, 2, 3]);
  r.ante = 8;
  r.blind = 2;
  r.boss = "abyss";
  r.roundTypes = ["high", "three"];
  r.target = "1";
  playHand(r, ["c0", "c1"]);
  assert.equal(r.phase, "won");
  const p = newProfile();
  syncProfile(p, r);
  const count = p.stats.plays;
  syncProfile(p, r);
  assert.equal(p.stats.plays, count);
  enterEndless(r);
  nextBlind(r);
  assert.equal(r.ante, 9);
  beginBlind(r);
  r.hands = 1;
  r.target = "1e100";
  playHand(r, [r.hand[0]]);
  syncProfile(p, r);
  assert.equal(p.stats.plays, count + 1);
});
test("15 challenge rule sets create valid playable runs", () => {
  assert.equal(CHALLENGES.length, 15);
  for (const c of CHALLENGES) {
    const r = createRun("challenge", "wanderer", c.id);
    beginBlind(r);
    assert(r.hand.length >= 3);
    validateRun(r);
    if (c.id === "hearts") assert(r.deck.every((c) => c.suit === "hearts"));
    if (c.id === "noShop") assert.equal(r.jokers.length, 3);
  }
});
test("combo chains are capped and real, per-card RNG is seed deterministic", () => {
  const r = hand([2, 2, 2, 3, 3]);
  r.history = ["pair", "twoPair"];
  const result = score(r, r.hand);
  assert.equal(result.chain, 1);
  assert(result.lines.some((l) => l.source === "Комбо-цепочка"));
  const a = hand([10]),
    b = structuredClone(a);
  a.deck[0].enhancement = "lucky";
  b.deck[0].enhancement = "lucky";
  assert.deepEqual(score(a, a.hand), score(b, b.hand));
});
test("save checksum, backup recovery, migration, import and export", () => {
  const memory = new Map<string, string>(),
    storage = {
      getItem: (k: string) => memory.get(k) || null,
      setItem: (k: string, v: string) => void memory.set(k, v),
    };
  const saves = new Saves(storage),
    r = createRun("save"),
    p = newProfile();
  saves.save(r, p);
  beginBlind(r);
  saves.save(r, p);
  assert.equal(saves.load().run?.phase, "playing");
  memory.set(KEY, "broken");
  assert(saves.load().recovered);
  assert.throws(() =>
    parseSave(serialize(r, p).replace("ABYSS", "XXXXX") + "x"),
  );
  const migrated = parseSave(JSON.stringify({ version: 1, seed: "old" }));
  assert.equal(migrated.run?.version, 2);
  const exported = saves.export(r, p);
  assert.equal(saves.import(exported).run?.seed, "save");
  const corrupt = structuredClone(r);
  corrupt.hand.push("unknown");
  assert.throws(() => validateRun(corrupt));
});
