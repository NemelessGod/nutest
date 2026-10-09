import type {
  Run,
  Card,
  Joker,
  HandId,
  RunStats,
  Offer,
  Profile,
  Settings,
} from "./types";
import {
  SUITS,
  HAND_ORDER,
  JOKERS,
  jokerDef,
  BOSSES,
  DECKS,
  CHALLENGES,
  TAROT,
  SPECTRAL,
  VOUCHERS,
  ANOMALIES,
  HANDS,
  ACHIEVEMENTS,
} from "./catalog";
import { seedHash, random, shuffle, choose, uid } from "./random";
import { D, score, evolve } from "./score";
import { evaluate } from "./poker";
export const emptyStats = (): RunStats => ({
  plays: 0,
  discards: 0,
  wins: 0,
  bosses: 0,
  moneyEarned: 0,
  spent: 0,
  sold: 0,
  rerolls: 0,
  tarot: 0,
  planets: 0,
  spectral: 0,
  boosters: 0,
  cursed: 0,
  abyssSpent: 0,
  evolutions: 0,
  chains: 0,
  found: [],
  hands: {},
  maxJokers: 0,
});
export const defaultSettings = (): Settings => ({
  animation: "normal",
  effects: true,
  flashes: true,
  shake: false,
  contrast: false,
  symbols: true,
  uiScale: 1,
  textSize: 1,
  master: 0.65,
  music: 0.25,
  sfx: 0.6,
  ui: 0.45,
  keys: {
    play: "Enter",
    discard: "Backspace",
    sort: "KeyS",
    collection: "KeyC",
    menu: "Escape",
  },
});
export const newProfile = (): Profile => ({
  version: 2,
  achievements: [],
  collection: [],
  runs: [],
  stats: emptyStats(),
  bestScore: "0",
  bestMult: "0",
  maxAnte: 0,
  settings: defaultSettings(),
  completedChallenges: [],
});
export function newCard(r: Run, rank = 2, suit = SUITS[0]): Card {
  return {
    id: uid(r),
    rank,
    suit,
    enhancement: "none",
    seal: "none",
    curse: "none",
    uses: 0,
    blocked: 0,
    edition: "base",
  };
}
export function addJoker(
  r: Run,
  key: string,
  edition: Joker["edition"] = "base",
) {
  jokerDef(key);
  if (r.jokers.length >= r.jokerSlots) throw Error("Все слоты джокеров заняты");
  const j: Joker = {
    id: uid(r),
    key,
    edition,
    activations: 0,
    evolution: 0,
    value: 0,
    boostAnte: 0,
    disabled: false,
  };
  r.jokers.push(j);
  if (!r.stats.found.includes(key)) r.stats.found.push(key);
  r.stats.maxJokers = Math.max(r.stats.maxJokers, r.jokers.length);
  return j;
}
export function createRun(
  seed: string,
  deckId = "wanderer",
  challenge = "",
  difficulty = 0,
): Run {
  if (
    !DECKS.some((d) => d.id === deckId) ||
    (challenge && !CHALLENGES.some((c) => c.id === challenge))
  )
    throw Error("Неизвестная колода или испытание");
  const r: Run = {
    version: 2,
    seed: seed.slice(0, 80) || "ABYSS",
    rng: seedHash(seed || "ABYSS"),
    serial: 0,
    deck: [],
    draw: [],
    hand: [],
    discard: [],
    jokers: [],
    consumables: [],
    levels: Object.fromEntries(HAND_ORDER.map((id) => [id, 1])) as Record<
      HandId,
      number
    >,
    phase: "blind",
    ante: 1,
    blind: 0,
    target: "180",
    roundScore: "0",
    hands: 4,
    discards: 3,
    handSize: 8,
    maxHands: 4,
    maxDiscards: 3,
    jokerSlots: 5,
    money: 8,
    abyss: 0,
    interestCap: 5,
    rerollCost: 3,
    rerolls: 0,
    shop: [],
    booster: [],
    boss: "",
    anomaly: "",
    anomalyAccepted: false,
    roundTypes: [],
    history: [],
    lastScore: null,
    bestScore: "0",
    bestMult: "0",
    deckId,
    challenge,
    difficulty: Math.max(0, Math.min(3, difficulty)),
    endless: false,
    stats: emptyStats(),
    settledStats: emptyStats(),
    events: [],
    round: 0,
    completed: false,
    created: Date.now(),
    vouchers: [],
    previousHand: null,
    selection: [],
    pendingOutcome: null,
  };
  for (const suit of SUITS)
    for (let rank = 2; rank <= 14; rank++) r.deck.push(newCard(r, rank, suit));
  if (deckId === "scarlet") {
    r.deck.forEach((c) => {
      if (c.suit === "spades") c.suit = "hearts";
      if (c.suit === "clubs") c.suit = "diamonds";
    });
    r.maxDiscards++;
  }
  if (deckId === "oracle") {
    r.handSize++;
    r.money = 4;
  }
  if (deckId === "abyss") {
    r.abyss = 8;
    r.deck.find((c) => c.rank === 14)!.curse = "ace";
  }
  if (deckId === "gilded") {
    r.money = 20;
    r.maxHands = 3;
  }
  if (challenge === "hearts") r.deck.forEach((c) => (c.suit = "hearts"));
  if (challenge === "debt") r.money = -8;
  if (challenge === "small") r.handSize = 6;
  if (challenge === "curse")
    for (const [rank, curse] of [
      [14, "ace"],
      [13, "king"],
      [12, "queen"],
      [7, "seven"],
    ] as const)
      r.deck.find((c) => c.rank === rank)!.curse = curse;
  if (challenge === "noShop") {
    addJoker(r, "spark");
    addJoker(r, "pair");
    addJoker(r, "variety");
  }
  if (challenge === "noDiscard") r.maxDiscards = 0;
  if (challenge === "oneJoker") {
    r.jokerSlots = 1;
    const j = addJoker(r, "spark");
    j.activations = 20;
    evolve(j);
  }
  if (challenge === "poverty") {
    r.money = 3;
    r.interestCap = 0;
  }
  if (challenge === "faces") r.deck = r.deck.filter((c) => c.rank >= 11);
  if (challenge === "rapid") r.maxHands = 3;
  if (challenge === "fragile")
    for (const c of r.deck.slice(0, 10)) c.enhancement = "glass";
  if (challenge === "highOnly") {
    addJoker(r, "spark");
    addJoker(r, "lone");
  }
  prepareBlind(r);
  return r;
}
export function prepareBlind(r: Run) {
  r.phase = "blind";
  r.roundScore = "0";
  r.lastScore = null;
  r.roundTypes = [];
  r.previousHand = null;
  r.rerolls = 0;
  r.rerollCost = 3;
  r.selection = [];
  for (const j of r.jokers) j.disabled = false;
  const penalty: Record<string, number> = {
    noShop: 0.55,
    noDiscard: 0.7,
    oneJoker: 0.4,
    rapid: 0.8,
    highOnly: 0.35,
    pairOnly: 0.75,
    small: 0.8,
    debt: 0.85,
  };
  r.target = D(180)
    .mul(D(1.75).pow(r.ante - 1))
    .mul([1, 1.5, 2.1][r.blind])
    .mul(1 + r.difficulty * 0.25)
    .mul(penalty[r.challenge] || 1)
    .floor()
    .toString();
  r.boss =
    r.blind === 2
      ? r.ante === 8
        ? "abyss"
        : BOSSES[(r.ante - 1) % 10].key
      : "";
  r.anomaly = r.round > 0 && r.round % 3 === 1 ? choose(r, ANOMALIES).key : "";
  r.anomalyAccepted = false;
}
export function beginBlind(r: Run, acceptAnomaly = false) {
  if (r.phase !== "blind") throw Error("Блайнд уже начат");
  r.phase = "playing";
  r.round++;
  r.anomalyAccepted = !!r.anomaly && acceptAnomaly;
  if (r.anomalyAccepted && r.anomaly === "target")
    r.target = D(r.target).mul(1.3).floor().toString();
  if (r.boss === "keeper") disableStrongest(r);
  r.hands = r.boss === "silence" ? 2 : r.maxHands;
  r.discards = r.boss === "lock" ? 0 : r.maxDiscards;
  r.discards = Math.max(
    0,
    r.discards -
      r.jokers.filter((j) => j.key === "cerberus" && !j.disabled).length -
      (r.anomalyAccepted && r.anomaly === "discard" ? 1 : 0),
  );
  for (const c of r.deck) if (c.blocked > 0) c.blocked--;
  r.hand = [];
  r.discard = [];
  r.draw = shuffle(
    r,
    r.deck.filter((c) => c.blocked === 0).map((c) => c.id),
  );
  fillHand(r);
  if (!r.hand.length) {
    r.phase = "lost";
    r.events.push("В колоде нет доступных карт");
  }
}
function disableStrongest(r: Run) {
  for (const j of r.jokers) j.disabled = false;
  const strongest = [...r.jokers].sort(
    (a, b) =>
      jokerDef(b.key).price - jokerDef(a.key).price ||
      b.evolution - a.evolution,
  )[0];
  if (strongest) strongest.disabled = true;
}
export function fillHand(r: Run) {
  const limit = Math.max(3, r.handSize - (r.boss === "fog" ? 2 : 0));
  while (r.hand.length < limit && r.draw.length) {
    const id = r.draw.pop()!;
    if (r.deck.some((c) => c.id === id && c.blocked === 0)) r.hand.push(id);
  }
}
function selectedCards(r: Run, ids: string[]) {
  if (
    ids.length < 1 ||
    ids.length > 5 ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !r.hand.includes(id))
  )
    throw Error("Выберите от 1 до 5 карт из руки");
  const cards = ids.map((id) => r.deck.find((c) => c.id === id)!);
  if (cards.some((c) => c.blocked > 0))
    throw Error("Проклятая карта временно заблокирована");
  return cards;
}
export function allowed(r: Run, ids: string[]) {
  const cards = selectedCards(r, ids);
  const type = evaluate(
    cards,
    r.jokers.some((j) => j.key === "fourFingers" && !j.disabled),
  ).type;
  if (r.boss === "mirror" && r.previousHand === type)
    throw Error("Зеркальный король запрещает повтор предыдущей комбинации");
  if (
    r.challenge === "pairOnly" &&
    ![
      "pair",
      "twoPair",
      "three",
      "fullHouse",
      "four",
      "five",
      "flushFive",
      "flushHouse",
    ].includes(type)
  )
    throw Error("Испытание разрешает только комбинации с парой");
  if (r.challenge === "highOnly" && !["high", "pair"].includes(type))
    throw Error("Разрешены только старшая карта и пара");
  return type;
}
export function playHand(r: Run, ids: string[]) {
  if (r.phase !== "playing" || r.hands <= 0)
    throw Error("Сейчас нельзя разыграть руку");
  allowed(r, ids);
  if (r.boss === "abyss") {
    for (const j of r.jokers) j.disabled = false;
    const phase = Math.min(3, new Set(r.roundTypes).size + 1);
    if (phase === 2) disableStrongest(r);
  }
  const result = score(r, ids);
  r.lastScore = result;
  r.roundScore = D(r.roundScore).plus(result.total).toString();
  r.hands--;
  r.stats.plays++;
  r.stats.hands[result.hand] = (r.stats.hands[result.hand] || 0) + 1;
  r.history.push(result.hand);
  r.history = r.history.slice(-100);
  r.previousHand = result.hand;
  if (!r.roundTypes.includes(result.hand)) r.roundTypes.push(result.hand);
  if (D(result.total).gt(r.bestScore)) r.bestScore = result.total;
  if (D(result.mult).gt(r.bestMult)) r.bestMult = result.mult;
  if (r.boss === "tax") r.money -= 2;
  for (const j of r.jokers) {
    if (j.disabled) continue;
    if (j.key === "mint") {
      const gain = Math.ceil(
        (1 + j.evolution * 0.4) *
          ids.filter(
            (id) => r.deck.find((c) => c.id === id)?.suit === "diamonds",
          ).length,
      );
      r.money += gain;
      r.stats.moneyEarned += gain;
      if (gain) {
        j.activations++;
        if (evolve(j)) r.stats.evolutions++;
      }
    }
    if (j.key === "alchemist") {
      const cards = ids
        .map((id) => r.deck.find((c) => c.id === id))
        .filter((c): c is Card => !!c);
      if (cards.length) {
        choose(r, cards).enhancement = "bonus";
        j.activations++;
        if (evolve(j)) r.stats.evolutions++;
      }
    }
  }
  for (const id of ids) if (r.deck.some((c) => c.id === id)) r.discard.push(id);
  r.hand = r.hand.filter((id) => !ids.includes(id));
  r.selection = [];
  if (r.boss === "dealer" && r.hand.length)
    r.discard.push(r.hand.splice(Math.floor(random(r) * r.hand.length), 1)[0]);
  if (r.challenge === "chaos" || (r.anomalyAccepted && r.anomaly === "shuffle"))
    shuffle(r, r.jokers);
  const requiredTypes = r.challenge === "highOnly" ? 2 : 3;
  const diversity =
    r.boss === "collector"
      ? r.roundTypes.length >= 2
      : r.boss === "abyss"
        ? r.roundTypes.length >= requiredTypes
        : true;
  const requirement =
    r.boss === "abyss" && r.roundTypes.length >= requiredTypes
      ? D(r.target).mul(1.15)
      : D(r.target);
  if (D(r.roundScore).gte(requirement) && diversity) {
    winBlind(r);
  } else if (r.hands <= 0) {
    r.phase = "lost";
    r.events.push(
      diversity
        ? "Не хватило очков"
        : "Не выполнено условие разнообразия босса",
    );
  } else {
    fillHand(r);
    if (!r.hand.length) {
      r.phase = "lost";
      r.events.push("Колода исчерпана");
    }
  }
  r.events = r.events.slice(-80);
  return result;
}
export function discardHand(r: Run, ids: string[]) {
  if (r.phase !== "playing" || r.discards <= 0)
    throw Error("Нет доступных сбросов");
  selectedCards(r, ids);
  r.discards--;
  r.stats.discards++;
  for (const id of ids) {
    const c = r.deck.find((c) => c.id === id)!;
    if (c.seal === "purple" && r.consumables.length < 3)
      r.consumables.push({
        id: uid(r),
        type: "tarot",
        key: choose(r, TAROT).key,
      });
    r.discard.push(id);
  }
  r.hand = r.hand.filter((id) => !ids.includes(id));
  r.selection = [];
  fillHand(r);
  if (!r.hand.length) {
    r.phase = "lost";
    r.events.push("Колода исчерпана");
  }
}
function destroy(r: Run, id: string) {
  r.deck = r.deck.filter((c) => c.id !== id);
  r.hand = r.hand.filter((v) => v !== id);
  r.draw = r.draw.filter((v) => v !== id);
  r.discard = r.discard.filter((v) => v !== id);
}
function winBlind(r: Run) {
  r.stats.wins++;
  if (r.blind === 2) r.stats.bosses++;
  let interest = Math.min(
    r.interestCap +
      r.jokers
        .filter((j) => j.key === "bank" && !j.disabled)
        .reduce((sum, j) => sum + Math.ceil(3 * (1 + j.evolution * 0.4)), 0),
    Math.floor(Math.max(0, r.money) / 5),
  );
  if (r.challenge === "poverty") interest = 0;
  let reward = 4 + r.hands + interest + (r.blind === 2 ? 4 : 0);
  if (r.anomalyAccepted) {
    reward +=
      r.anomaly === "target"
        ? 8
        : r.anomaly === "weak" || r.anomaly === "mult"
          ? 6
          : 5;
    r.abyss = Math.min(30, r.abyss + (r.anomaly === "target" ? 3 : 2));
  }
  if (D(r.roundScore).lte(D(r.target).mul(1.15)))
    r.abyss = Math.min(30, r.abyss + 2);
  if (r.blind === 2) r.abyss = Math.min(30, r.abyss + 3);
  for (const id of r.hand) {
    const c = r.deck.find((c) => c.id === id);
    if (c?.enhancement === "gold") reward += 3;
    if (c?.seal === "blue" && r.consumables.length < 3)
      r.consumables.push({
        id: uid(r),
        type: "planet",
        key: r.lastScore!.hand,
      });
  }
  r.money += reward;
  r.stats.moneyEarned += reward;
  r.events.push(`Блайнд пройден: +$${reward}, проценты $${interest}`);
  for (const j of [...r.jokers]) {
    if (j.disabled) continue;
    let trigger = false;
    if (j.key === "bank") trigger = true;
    if (j.key === "gardener" && r.deck.length < 500) {
      r.deck.push(newCard(r, 2 + Math.floor(random(r) * 13), choose(r, SUITS)));
      trigger = true;
    }
    if (j.key === "executioner" && r.deck.length > 10) {
      destroy(r, [...r.deck].sort((a, b) => a.rank - b.rank)[0].id);
      trigger = true;
    }
    if (j.key === "scribe" && r.deck.length) {
      choose(r, r.deck).seal = "red";
      trigger = true;
    }
    if (
      j.key === "summoner" &&
      r.blind === 2 &&
      r.jokers.length < r.jokerSlots
    ) {
      addJoker(
        r,
        choose(
          r,
          JOKERS.filter((d) => d.rarity === "common"),
        ).key,
      );
      trigger = true;
    }
    if (trigger) {
      j.activations++;
      if (evolve(j)) r.stats.evolutions++;
    }
  }
  if (r.challenge === "noShop") for (const key of HAND_ORDER) r.levels[key]++;
  if (r.ante === 8 && r.blind === 2 && !r.endless) {
    r.phase = "won";
    r.events.push("Сердце Бездны побеждено");
  } else {
    r.phase = "shop";
    refreshShop(r);
  }
}
export function nextBlind(r: Run) {
  if (r.phase !== "shop") throw Error("Сначала завершите магазин");
  if (r.blind === 2) {
    r.blind = 0;
    r.ante++;
  } else r.blind++;
  prepareBlind(r);
}
export function enterEndless(r: Run) {
  if (r.phase !== "won") throw Error("Сначала победите финального босса");
  r.endless = true;
  r.completed = false;
  r.phase = "shop";
  refreshShop(r);
}
function rarityPick(r: Run) {
  const roll = random(r);
  const rarity =
    roll < 0.65
      ? "common"
      : roll < 0.9
        ? "uncommon"
        : roll < 0.99
          ? "rare"
          : "legendary";
  return choose(
    r,
    JOKERS.filter((j) => j.rarity === rarity),
  );
}
export function makeOffer(
  r: Run,
  type: Offer["type"],
  key?: string,
  energy = false,
): Offer {
  let price = 3;
  if (type === "joker") {
    const def = key ? jokerDef(key) : rarityPick(r);
    key = def.key;
    price = def.price;
  }
  if (type === "tarot") key ??= choose(r, TAROT).key;
  if (type === "planet") key ??= choose(r, HAND_ORDER);
  if (type === "spectral") {
    key ??= choose(r, SPECTRAL).key;
    price = 5;
  }
  if (type === "voucher") {
    const voucher = choose(r, VOUCHERS);
    key ??= voucher.key;
    price = VOUCHERS.find((v) => v.key === key)!.price;
  }
  if (type === "booster") {
    key ??= choose(r, ["celestial", "arcana", "joker", "spectral"]);
    price = 6;
  }
  if (type === "curse") {
    key ??= choose(r, ["ace", "king", "queen", "seven"]);
    price = 3;
  }
  if (r.vouchers.includes("discount")) price = Math.max(1, price - 1);
  return {
    id: uid(r),
    type,
    key: key!,
    price: energy ? Math.min(5, price) : price,
    energy,
    sold: false,
  };
}
export function refreshShop(r: Run) {
  if (r.challenge === "noShop") {
    r.shop = [];
    return;
  }
  r.shop = [
    makeOffer(r, "joker"),
    makeOffer(r, "joker"),
    makeOffer(r, "planet"),
    makeOffer(r, choose(r, ["tarot", "spectral"] as const)),
    makeOffer(r, "booster"),
    makeOffer(r, "voucher"),
  ];
  if (r.blind === 2 || random(r) < 0.2)
    r.shop.push(
      makeOffer(r, "curse", undefined, true),
      makeOffer(r, "joker", undefined, true),
    );
}
export function reroll(r: Run, abyss = false) {
  if (r.phase !== "shop" || r.challenge === "noShop")
    throw Error("Магазин сейчас недоступен");
  const cost = abyss ? 3 : r.rerollCost;
  if (abyss) {
    if (r.abyss < cost) throw Error("Нужно 3 энергии Бездны");
    r.abyss -= cost;
    r.stats.abyssSpent += cost;
  } else {
    if (r.money < cost) throw Error("Недостаточно денег");
    r.money -= cost;
    r.stats.spent += cost;
    r.rerollCost++;
  }
  r.rerolls++;
  r.stats.rerolls++;
  refreshShop(r);
}
export function buy(r: Run, id: string) {
  if (r.phase !== "shop") throw Error("Покупки доступны в магазине");
  const o = r.shop.find((o) => o.id === id);
  if (!o || o.sold) throw Error("Предложение недоступно");
  if ((o.energy ? r.abyss : r.money) < o.price)
    throw Error("Недостаточно валюты");
  if (o.type === "joker" && r.jokers.length >= r.jokerSlots)
    throw Error("Нет слота джокера");
  if (
    ["tarot", "planet", "spectral"].includes(o.type) &&
    r.consumables.length >= 3
  )
    throw Error("Нет слота расходуемой карты");
  if (o.type === "voucher" && r.vouchers.includes(o.key))
    throw Error("Ваучер уже действует");
  if (o.energy) {
    r.abyss -= o.price;
    r.stats.abyssSpent += o.price;
  } else {
    r.money -= o.price;
    r.stats.spent += o.price;
  }
  o.sold = true;
  if (o.type === "joker") {
    addJoker(r, o.key, random(r) < 0.08 ? "foil" : "base");
  }
  if (o.type === "tarot" || o.type === "planet" || o.type === "spectral")
    r.consumables.push({ id: uid(r), type: o.type, key: o.key });
  if (o.type === "voucher") {
    r.vouchers.push(o.key);
    if (o.key === "hand") r.handSize = Math.min(12, r.handSize + 1);
    if (o.key === "plays") r.maxHands = Math.min(6, r.maxHands + 1);
    if (o.key === "discards") r.maxDiscards = Math.min(5, r.maxDiscards + 1);
    if (o.key === "interest") r.interestCap += 5;
  }
  if (o.type === "curse") {
    const rank = { ace: 14, king: 13, queen: 12, seven: 7 }[o.key as "ace"];
    const c = newCard(r, rank, choose(r, SUITS));
    c.curse = o.key as Card["curse"];
    r.deck.push(c);
  }
  if (o.type === "booster") {
    r.stats.boosters++;
    r.phase = "booster";
    const type = {
      celestial: "planet",
      arcana: "tarot",
      joker: "joker",
      spectral: "spectral",
    }[o.key] as "planet" | "tarot" | "joker" | "spectral";
    r.booster = Array.from({ length: 3 }, () => makeOffer(r, type));
  }
}
export function pickBooster(r: Run, id: string | null) {
  if (r.phase !== "booster") throw Error("Бустер не открыт");
  if (id) {
    const o = r.booster.find((v) => v.id === id);
    if (!o) throw Error("Карта не найдена");
    if (o.type === "joker") addJoker(r, o.key);
    else {
      if (r.consumables.length >= 3) throw Error("Нет слота расходуемой карты");
      r.consumables.push({
        id: uid(r),
        type: o.type as "tarot" | "planet" | "spectral",
        key: o.key,
      });
    }
  }
  r.booster = [];
  r.phase = "shop";
}
export function sellJoker(r: Run, id: string) {
  if (r.phase !== "shop") throw Error("Продажа доступна между блайндами");
  if (r.challenge === "noSell") throw Error("Испытание запрещает продажу");
  const j = r.jokers.find((j) => j.id === id);
  if (!j) throw Error("Джокер не найден");
  r.jokers = r.jokers.filter((v) => v.id !== id);
  const amount = Math.floor(jokerDef(j.key).price / 2) + j.evolution;
  r.money += amount;
  r.stats.moneyEarned += amount;
  r.stats.sold++;
  if (["rare", "legendary"].includes(jokerDef(j.key).rarity))
    r.abyss = Math.min(30, r.abyss + 3);
}
export function reorderJoker(r: Run, id: string, index: number) {
  const from = r.jokers.findIndex((j) => j.id === id);
  if (from < 0 || index < 0 || index >= r.jokers.length)
    throw Error("Неверная позиция");
  r.jokers.splice(index, 0, r.jokers.splice(from, 1)[0]);
}
export function useConsumable(r: Run, id: string, targets: string[]) {
  if (!["playing", "shop", "blind"].includes(r.phase))
    throw Error("Нельзя применить карту сейчас");
  const item = r.consumables.find((c) => c.id === id);
  if (!item) throw Error("Расходуемая карта не найдена");
  const cards = targets.map((id) => r.deck.find((c) => c.id === id));
  if (new Set(targets).size !== targets.length || cards.some((c) => !c))
    throw Error("Неверные цели");
  if (item.type === "planet") {
    if (!HAND_ORDER.includes(item.key as HandId))
      throw Error("Неизвестная планета");
    r.levels[item.key as HandId] += r.jokers.some((j) => j.key === "cosmic")
      ? 2
      : 1;
    r.stats.planets++;
  } else if (item.type === "tarot") {
    const max =
      item.key === "suit"
        ? 3
        : ["glass", "steel", "wild", "gold", "copy"].includes(item.key)
          ? 1
          : 2;
    if (cards.length < 1 || cards.length > max)
      throw Error(`Выберите от 1 до ${max} карт`);
    if (item.key === "destroy" && r.deck.length - cards.length < 1)
      throw Error("Нельзя уничтожить последнюю карту");
    if (
      ["bonus", "mult", "glass", "steel", "wild", "gold", "lucky"].includes(
        item.key,
      )
    )
      for (const c of cards) c!.enhancement = item.key as Card["enhancement"];
    if (item.key === "raise")
      for (const c of cards) c!.rank = Math.min(14, c!.rank + 1);
    if (item.key === "suit") for (const c of cards) c!.suit = "hearts";
    if (item.key === "copy") r.deck.push({ ...cards[0]!, id: uid(r) });
    if (item.key === "destroy") for (const c of cards) destroy(r, c!.id);
    r.stats.tarot++;
  } else {
    if (["red", "clone", "curse"].includes(item.key) && cards.length !== 1)
      throw Error("Выберите ровно одну карту");
    if (item.key === "prism" && !r.jokers.length) throw Error("Нужен джокер");
    if (item.key === "evolve" && !r.jokers.some((j) => jokerDef(j.key).evolves))
      throw Error("Нужен эволюционирующий джокер");
    if (item.key === "red") cards[0]!.seal = "red";
    if (item.key === "prism") choose(r, r.jokers).edition = "prism";
    if (item.key === "clone") {
      const c = cards[0]!;
      r.deck.push({ ...c, id: uid(r) }, { ...c, id: uid(r) });
      destroy(r, c.id);
    }
    if (item.key === "curse") {
      const c = cards[0]!;
      c.curse =
        c.rank === 14
          ? "ace"
          : c.rank === 13
            ? "king"
            : c.rank === 12
              ? "queen"
              : "seven";
    }
    if (item.key === "evolve") {
      const j = choose(
        r,
        r.jokers.filter((j) => jokerDef(j.key).evolves),
      );
      j.activations += 8;
      if (evolve(j)) r.stats.evolutions++;
    }
    r.stats.spectral++;
  }
  r.consumables = r.consumables.filter((c) => c.id !== id);
  r.selection = [];
  if (r.phase === "playing") {
    fillHand(r);
    if (!r.hand.length) r.phase = "lost";
  }
}
export function abyssAction(
  r: Run,
  action: "reroll" | "alter" | "boost" | "reveal" | "cancel",
  id = "",
) {
  if (action === "reroll") return reroll(r, true);
  if (!["playing", "blind", "shop"].includes(r.phase))
    throw Error("Действие сейчас недоступно");
  const costs = { alter: 3, boost: 4, reveal: 5, cancel: 3 };
  const cost = costs[action];
  if (r.abyss < cost) throw Error(`Нужно ${cost} энергии Бездны`);
  if (action === "alter") {
    const c = r.deck.find((c) => c.id === id);
    if (!c) throw Error("Выберите карту");
    c.enhancement = "mult";
  }
  if (action === "boost") {
    const j = r.jokers.find((j) => j.id === id);
    if (!j) throw Error("Выберите джокера");
    if (j.boostAnte === r.ante)
      throw Error("Этот джокер уже усилен до конца Ante");
    j.boostAnte = r.ante;
  }
  if (action === "reveal") {
    if (r.consumables.length >= 3) throw Error("Нет слота расходуемой карты");
    r.consumables.push({
      id: uid(r),
      type: "spectral",
      key: choose(r, SPECTRAL).key,
    });
  }
  if (action === "cancel") {
    if (!r.anomalyAccepted) throw Error("Активной добровольной аномалии нет");
    if (r.anomaly === "target")
      r.target = D(r.target).div(1.3).ceil().toString();
    if (
      r.anomaly === "discard" &&
      r.boss !== "lock" &&
      r.maxDiscards >
        r.jokers.filter((j) => j.key === "cerberus" && !j.disabled).length
    )
      r.discards++;
    r.anomalyAccepted = false;
  }
  r.abyss -= cost;
  r.stats.abyssSpent += cost;
}
export function syncProfile(p: Profile, r: Run) {
  for (const key of r.stats.found)
    if (!p.collection.includes(key)) p.collection.push(key);
  p.maxAnte = Math.max(p.maxAnte, r.ante);
  if (D(r.bestScore).gt(p.bestScore)) p.bestScore = r.bestScore;
  if (D(r.bestMult).gt(p.bestMult)) p.bestMult = r.bestMult;
  if (["lost", "won"].includes(r.phase) && !r.completed) {
    r.completed = true;
    p.runs.unshift({
      seed: r.seed,
      ante: r.ante,
      won: r.phase === "won",
      score: r.bestScore,
      money: r.money,
      date: Date.now(),
      deck: r.deckId,
      challenge: r.challenge,
    });
    p.runs = p.runs.slice(0, 100);
    if (
      r.phase === "won" &&
      r.challenge &&
      !p.completedChallenges.includes(r.challenge)
    )
      p.completedChallenges.push(r.challenge);
    for (const key of Object.keys(p.stats) as (keyof RunStats)[]) {
      if (key === "found") {
        p.stats.found = [...new Set([...p.stats.found, ...r.stats.found])];
      } else if (key === "hands") {
        for (const h of HAND_ORDER)
          p.stats.hands[h] =
            (p.stats.hands[h] || 0) +
            (r.stats.hands[h] || 0) -
            (r.settledStats?.hands[h] || 0);
      } else if (key === "maxJokers") {
        p.stats.maxJokers = Math.max(p.stats.maxJokers, r.stats.maxJokers);
      } else {
        (p.stats[key] as number) +=
          (r.stats[key] as number) - ((r.settledStats?.[key] as number) || 0);
      }
    }
    r.settledStats = structuredClone(r.stats);
  }
  for (const ach of ACHIEVEMENTS) {
    let v: number | boolean = 0;
    if (ach.stat === "ante") v = p.maxAnte;
    if (ach.stat === "victory") v = p.runs.some((x) => x.won);
    if (ach.stat === "challenge") v = p.completedChallenges.length;
    if (ach.stat === "score") v = D(p.bestScore).gte(ach.target);
    if (ach.stat === "found") v = p.collection.length;
    if (ach.stat in p.stats && ach.stat !== "found")
      v =
        (p.stats[ach.stat as keyof RunStats] as number) +
        (r.completed
          ? 0
          : (r.stats[ach.stat as keyof RunStats] as number) -
            ((r.settledStats?.[ach.stat as keyof RunStats] as number) || 0));
    const completed = typeof v === "boolean" ? v : v >= ach.target;
    if (completed && !p.achievements.includes(ach.id))
      p.achievements.push(ach.id);
  }
}
