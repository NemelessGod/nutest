import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { simulate } from "../../scripts/simulate-abyss.ts";
import {
  createRun,
  beginBlind,
  playHand,
  addJoker,
  useConsumable,
  newProfile,
  syncProfile,
  emptyStats,
} from "../../client/src/abyss/engine/run.ts";
import { score, D } from "../../client/src/abyss/engine/score.ts";
import {
  JOKERS,
  TAROT,
  CHALLENGES,
} from "../../client/src/abyss/engine/catalog.ts";
import {
  parseSave,
  serialize,
  validateRun,
} from "../../client/src/abyss/storage/save.ts";
import type { Run } from "../../client/src/abyss/engine/types.ts";

const evidence = JSON.parse(
  readFileSync(
    new URL("../../docs/simulation-2.0.json", import.meta.url),
    "utf8",
  ),
);
for (const challenge of CHALLENGES)
  test("full campaign is winnable: " + challenge.id, () => {
    const row = evidence.challenges.find((r: any) => r.id === challenge.id);
    assert(row?.winningSeed, "Missing winning seed");
    const run = simulate(row.winningSeed, challenge.id);
    assert.equal(run.won, true, JSON.stringify(run));
    assert.deepEqual(run.errors, []);
    assert.equal(run.blinds, 24);
  });

function fixture(key: string) {
  const r = createRun("JOKER-AUDIT");
  beginBlind(r);
  r.target = "1e50";
  r.money = 100;
  r.history = ["pair", "flush"];
  r.stats.plays = 10;
  r.previousHand = "pair";
  let ranks = [14, 14, 13],
    suits = ["hearts", "clubs", "diamonds"];
  let chosen = 2;
  if (key === "royal") ranks = [13, 13, 14];
  if (key === "diamond") suits = ["diamonds", "diamonds", "clubs"];
  if (key === "spade") suits = ["spades", "spades", "clubs"];
  if (key === "straight") {
    ranks = [2, 3, 4, 5, 6];
    suits = ["hearts", "clubs", "diamonds", "spades", "hearts"];
    chosen = 5;
  }
  if (key === "flush") {
    ranks = [2, 4, 7, 9, 14];
    suits = Array(5).fill("hearts");
    chosen = 5;
  }
  if (key === "lone") chosen = 1;
  ranks.forEach((rank, i) => {
    r.deck[i].rank = rank;
    r.deck[i].suit = suits[i] as any;
  });
  r.hand = r.deck.slice(0, ranks.length).map((c) => c.id);
  r.draw = r.deck.slice(ranks.length).map((c) => c.id);
  r.discard = [];
  return { r, ids: r.hand.slice(0, chosen) };
}
for (const def of JOKERS.filter(
  (d) =>
    ![
      "bank",
      "mint",
      "gardener",
      "executioner",
      "alchemist",
      "scribe",
      "summoner",
      "fourFingers",
      "cosmic",
    ].includes(d.key),
))
  test("joker has an observable scoring effect: " + def.key, () => {
    const { r, ids } = fixture(def.key);
    if (def.key === "reverse") addJoker(r, "spark");
    addJoker(r, def.key);
    if (def.key === "mirror") addJoker(r, "spark");
    const control = structuredClone(r);
    control.jokers = control.jokers.filter((j) => j.key !== def.key);
    const baseline = score(control, ids, true),
      result = score(r, ids);
    assert(D(result.total).gt(baseline.total), def.key);
    assert(r.jokers.find((j) => j.key === def.key)!.activations > 0, def.key);
    validateRun(r);
  });
for (const key of [
  "bank",
  "mint",
  "gardener",
  "executioner",
  "alchemist",
  "scribe",
  "summoner",
])
  test("joker has an observable event effect: " + key, () => {
    const { r, ids } = fixture(key);
    r.target = "1";
    if (key === "summoner") {
      r.blind = 2;
      r.boss = "mirror";
      r.previousHand = null;
    }
    if (key === "mint")
      ids.forEach((id) => (r.deck.find((c) => c.id === id)!.suit = "diamonds"));
    const control = structuredClone(r);
    addJoker(r, key);
    playHand(control, ids);
    playHand(r, ids);
    const changed =
      key === "summoner"
        ? r.jokers.length > 1
        : key === "bank" || key === "mint"
          ? r.money > control.money
          : key === "gardener" || key === "executioner"
            ? r.deck.length !== control.deck.length
            : key === "scribe"
              ? r.deck.some((c) => c.seal === "red")
              : r.deck.some((c) => c.enhancement === "bonus");
    assert(changed, key);
    assert(r.jokers[0].activations > 0, key);
    validateRun(r);
  });
test("rule jokers change combination and planet level", () => {
  const { r } = fixture("straight");
  addJoker(r, "fourFingers");
  assert.equal(score(r, r.hand.slice(0, 4), true).hand, "straight");
  addJoker(r, "cosmic");
  r.consumables = [{ id: "planet", type: "planet", key: "pair" }];
  useConsumable(r, "planet", []);
  assert.equal(r.levels.pair, 3);
});
for (const tarot of TAROT)
  test("every tarot changes real cards: " + tarot.key, () => {
    const { r } = fixture("royal");
    r.consumables = [{ id: "tarot", type: "tarot", key: tarot.key }];
    if (tarot.key === "suit") r.deck[0].suit = "spades";
    const before = JSON.stringify(r.deck);
    useConsumable(r, "tarot", [r.deck[0].id]);
    assert.notEqual(JSON.stringify(r.deck), before, tarot.key);
    assert.equal(r.stats.tarot, 1);
    assert.equal(r.consumables.length, 0);
    validateRun(r);
  });
test("keeper, silence, lock and fog enforce actual starting state", () => {
  for (const [boss, hands, discards, size] of [
    ["keeper", 4, 3, 8],
    ["silence", 2, 3, 8],
    ["lock", 4, 0, 8],
    ["fog", 4, 3, 6],
  ] as const) {
    const r = createRun(boss);
    r.blind = 2;
    r.boss = boss;
    addJoker(r, "spark");
    addJoker(r, "chronos");
    beginBlind(r);
    assert.equal(r.hands, hands);
    assert.equal(r.discards, discards);
    assert.equal(r.hand.length, size);
    if (boss === "keeper")
      assert.equal(r.jokers.find((j) => j.key === "chronos")!.disabled, true);
  }
});
test("ranks and hearts suppress card chips, dealer removes extra, tax charges debt", () => {
  for (const boss of ["ranks", "hearts"]) {
    const { r, ids } = fixture("royal");
    r.blind = 2;
    r.boss = boss;
    if (boss === "hearts")
      ids.forEach((id) => (r.deck.find((c) => c.id === id)!.suit = "hearts"));
    assert.equal(score(r, ids, true).chips, "10");
  }
  const { r, ids } = fixture("spark");
  r.boss = "dealer";
  playHand(r, ids.slice(0, 1));
  assert.equal(r.discard.length, 2);
  const { r: tax, ids: taxIds } = fixture("spark");
  tax.boss = "tax";
  tax.money = 0;
  playHand(tax, taxIds);
  assert.equal(tax.money, -2);
});
test("save validator rejects valid-checksum malformed offers, logs and missing stats", () => {
  for (const edit of [
    (r: Run) => {
      r.shop = [
        {
          id: "bad",
          type: "planet",
          key: "unknown",
          price: 3,
          energy: false,
          sold: false,
        },
      ];
    },
    (r: Run) => {
      delete (r.stats as any).plays;
    },
    (r: Run) => {
      r.jokers = [
        {
          id: '"><img',
          key: "spark",
          evolution: 0,
          activations: 0,
          value: 0,
          boostAnte: 0,
          disabled: false,
          edition: "base",
        },
      ];
    },
  ]) {
    const r = createRun("DAMAGED");
    edit(r);
    assert.throws(() => parseSave(serialize(r, newProfile())));
  }
});
test("endless settlement counts hands once across two outcomes", () => {
  const r = createRun("STATS"),
    p = newProfile();
  r.phase = "won";
  r.stats.plays = 10;
  r.stats.hands.pair = 6;
  syncProfile(p, r);
  assert.equal(p.stats.hands.pair, 6);
  r.phase = "lost";
  r.completed = false;
  r.stats.plays = 15;
  r.stats.hands.pair = 8;
  syncProfile(p, r);
  assert.equal(p.stats.plays, 15);
  assert.equal(p.stats.hands.pair, 8);
});
test("300 seeded scoring cases are deterministic, finite and do not mutate previews", () => {
  for (let i = 0; i < 300; i++) {
    const r = createRun("PROPERTY-" + i);
    beginBlind(r);
    for (const key of ["spark", "echo", "fibonacci"]) addJoker(r, key);
    const before = serialize(r, newProfile()),
      ids = r.hand.slice(0, (i % 5) + 1);
    const a = score(r, ids, true),
      b = score(r, ids, true);
    assert.deepEqual(a, b);
    assert(D(a.total).gte(0));
    assert.equal(serialize(r, newProfile()), before);
  }
});
