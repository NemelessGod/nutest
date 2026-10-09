import Decimal from "decimal.js";
import type { Card, Run, Joker, ScoreLine, ScoreResult, HandId } from "./types";
import { HANDS, jokerDef, SUIT_SYMBOLS } from "./catalog";
import { evaluate, cardChips, rankName } from "./poker";
import { random, choose } from "./random";
Decimal.set({
  precision: 60,
  rounding: Decimal.ROUND_HALF_UP,
  maxE: 1000000000,
  minE: -1000000000,
});
export const D = (v: Decimal.Value) => {
  const n = new Decimal(v);
  if (!n.isFinite() || n.isNaN()) throw Error("Некорректное игровое число");
  return n;
};
export function formatNumber(value: Decimal.Value) {
  const n = D(value);
  if (n.abs().lt(10000))
    return n.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  for (const [threshold, suffix] of [
    [1e12, "T"],
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"],
  ] as [number, string][])
    if (n.abs().gte(threshold) && n.abs().lt(1e15))
      return n.div(threshold).toFixed(1) + suffix;
  return n.toExponential(2);
}
export function evolve(j: Joker) {
  if (!jokerDef(j.key).evolves) return false;
  const level =
    j.activations >= 40
      ? 3
      : j.activations >= 20
        ? 2
        : j.activations >= 8
          ? 1
          : 0;
  const changed = level > j.evolution;
  j.evolution = level;
  return changed;
}
export function score(run: Run, ids: string[], dry = false): ScoreResult {
  const r = dry ? structuredClone(run) : run;
  const selected = ids
    .map((id) => r.deck.find((c) => c.id === id))
    .filter((c): c is Card => !!c);
  if (selected.length !== ids.length || new Set(ids).size !== ids.length)
    throw Error("Недопустимые карты");
  const active = r.jokers.filter((j) => !j.disabled);
  const hand = evaluate(
    selected,
    active.some((j) => j.key === "fourFingers"),
  );
  hand.scoring.sort((a, b) => r.hand.indexOf(a.id) - r.hand.indexOf(b.id));
  const base = HANDS[hand.type],
    level = r.levels[hand.type];
  let chips = D(base.chips).plus(D(level - 1).mul(base.gainChips));
  let mult = D(base.mult).plus(D(level - 1).mul(base.gainMult));
  const lines: ScoreLine[] = [];
  const log = (stage: string, source: string, operation: string) =>
    lines.push({
      stage,
      source,
      operation,
      chips: chips.toString(),
      mult: mult.toString(),
    });
  log("Комбинация", base.name, `${base.chips} фишек × ${base.mult} Mult`);
  log(
    "Уровень",
    `Уровень ${level}`,
    `+${(level - 1) * base.gainChips} фишек, +${(level - 1) * base.gainMult} Mult`,
  );
  if (r.anomalyAccepted && r.anomaly === "mult") {
    mult = mult.mul(0.75);
    log("Базовые модификаторы", "Шёпот", "×0.75 Mult");
  }
  const addChips = (
    amount: Decimal.Value,
    source: string,
    stage = "Джокеры",
  ) => {
    chips = chips.plus(amount);
    log(stage, source, `+${D(amount).toString()} фишек`);
  };
  const addMult = (
    amount: Decimal.Value,
    source: string,
    stage = "Джокеры",
  ) => {
    mult = mult.plus(amount);
    log(stage, source, `+${D(amount).toString()} Mult`);
  };
  const multiply = (
    amount: Decimal.Value,
    source: string,
    stage = "Джокеры",
  ) => {
    mult = mult.mul(amount);
    log(stage, source, `×${D(amount).toString()} Mult`);
  };
  const destroyed = new Set<string>();
  let uncertain = false;
  const echoes = active.filter((j) => j.key === "echo");

  const emitCard = (c: Card, repeat = false) => {
    const source = `${rankName(c.rank)} ${SUIT_SYMBOLS[c.suit]}${repeat ? " / повтор" : ""}`;
    const phase =
      r.boss === "abyss" ? Math.min(3, Math.floor(r.roundTypes.length) + 1) : 0;
    const debuffed =
      (r.blind === 2 &&
        ((r.boss === "ranks" && c.rank >= 11 && c.rank <= 13) ||
          (r.boss === "hearts" && c.suit === "hearts") ||
          (r.boss === "abyss" &&
            phase === 1 &&
            c.rank >= 11 &&
            c.rank <= 13))) ||
      (r.anomalyAccepted && r.anomaly === "weak" && c.suit === "hearts");
    if (debuffed) {
      log("Карты", source, "Ослаблена: эффект карты не начисляется");
      return;
    }
    addChips(cardChips(c), source, "Карты");
    if (c.edition === "foil") addChips(50, source + " / фольга", "Издание");
    if (c.edition === "holo") addMult(10, source + " / голограмма", "Издание");
    if (c.edition === "prism") multiply(1.5, source + " / призма", "Издание");
    if (c.enhancement === "bonus") addChips(30, source, "Улучшения");
    if (c.enhancement === "mult") addMult(4, source, "Улучшения");
    if (c.enhancement === "glass") {
      multiply(2, source, "Улучшения");
      uncertain = true;
      if (random(r) < 0.25) destroyed.add(c.id);
    }
    if (c.enhancement === "lucky") {
      uncertain = true;
      if (random(r) < 0.2) addMult(20, source + " / удача", "Улучшения");
      if (random(r) < 0.05) {
        r.money += 10;
        r.stats.moneyEarned += 10;
        log("Улучшения", source, "+$10");
      }
    }
    if (c.seal === "gold") {
      r.money += 3;
      r.stats.moneyEarned += 3;
      log("Печать", source, "+$3");
    }
    if (c.curse !== "none") {
      r.stats.cursed++;
      r.abyss = Math.min(30, r.abyss + 1);
      c.uses++;
      if (c.curse === "ace") {
        addChips(80, source, "Проклятие");
        if (c.uses % 3 === 0) c.blocked = 2;
      }
      if (c.curse === "king") {
        multiply(2, source, "Проклятие");
        r.money -= 2;
        log("Проклятие", source, "−$2");
      }
      if (c.curse === "seven") {
        addMult(c.uses * 4, source, "Проклятие");
        if (c.uses >= 5) destroyed.add(c.id);
      }
      if (c.curse === "queen") {
        uncertain = true;
        const held = r.hand.filter((id) => !ids.includes(id));
        if (held.length && random(r) < 0.15) {
          destroyed.add(choose(r, held));
          log("Проклятие", source, "Уничтожена случайная карта в руке");
        }
      }
    }
  };
  for (let i = 0; i < hand.scoring.length; i++) {
    const c = hand.scoring[i];
    emitCard(c);
    let repeats =
      (c.seal === "red" ? 1 : 0) +
      echoes.reduce((sum, j) => sum + 1 + j.evolution, 0) +
      (i > 0 && hand.scoring[i - 1].curse === "queen" ? 1 : 0);
    repeats = Math.min(6, repeats);
    if (c.seal === "red")
      log("Печать", rankName(c.rank), "Красная печать: +1 повтор");
    for (let j = 0; j < repeats; j++) emitCard(c, true);
  }
  const held = r.hand
    .filter((id) => !ids.includes(id))
    .map((id) => r.deck.find((c) => c.id === id)!)
    .filter(Boolean);
  for (const c of held)
    if (c.enhancement === "steel")
      multiply(1.5, rankName(c.rank) + " в руке", "Оставшиеся карты");
  const suitCount = (suit: string) =>
    hand.scoring.filter((c) => c.suit === suit || c.enhancement === "wild")
      .length;
  const effect = (
    j: Joker,
    index: number,
    visited: Set<string>,
    depth = 0,
  ): boolean => {
    if (j.disabled || visited.has(j.id) || depth > 6) return false;
    visited.add(j.id);
    const name = jokerDef(j.key).name;
    const power = 1 + j.evolution * 0.4;
    const x = (v: number) => 1 + (v - 1) * power;
    let triggered = true;
    switch (j.key) {
      case "spark":
        if (j.evolution < 2) addMult(j.evolution ? 12 : 4, name);
        else multiply(j.evolution === 2 ? 2 : 3, name);
        break;
      case "ledger":
        addChips(Math.max(0, r.money) * 2 * power, name);
        break;
      case "heart":
        if (suitCount("hearts")) addMult(suitCount("hearts") * 3 * power, name);
        else triggered = false;
        break;
      case "ember":
        if (suitCount("clubs")) addChips(suitCount("clubs") * 12 * power, name);
        else triggered = false;
        break;
      case "ace": {
        const n = hand.scoring.filter((c) => c.rank === 14).length;
        if (n) addChips(n * 30 * power, name);
        else triggered = false;
        break;
      }
      case "royal": {
        const n = hand.scoring.filter(
          (c) => c.rank >= 11 && c.rank <= 13,
        ).length;
        if (n) addMult(n * 4 * power, name);
        else triggered = false;
        break;
      }
      case "pair":
        if (
          [
            "pair",
            "twoPair",
            "three",
            "fullHouse",
            "four",
            "five",
            "flushHouse",
            "flushFive",
          ].includes(hand.type)
        )
          multiply(x(1.5), name);
        else triggered = false;
        break;
      case "straight":
        if (["straight", "straightFlush"].includes(hand.type))
          multiply(x(2), name);
        else triggered = false;
        break;
      case "flush":
        if (
          ["flush", "straightFlush", "flushHouse", "flushFive"].includes(
            hand.type,
          )
        )
          multiply(x(2), name);
        else triggered = false;
        break;
      case "variety":
        addMult(new Set([...r.history, hand.type]).size * 2 * power, name);
        break;
      case "steel": {
        const n = held.filter((c) => c.rank === 13).length;
        if (n) multiply(D(x(1.3)).pow(n), name);
        else triggered = false;
        break;
      }
      case "mirror":
      case "reverse": {
        const next = index + (j.key === "mirror" ? 1 : -1);
        const target = r.jokers[next];
        triggered =
          !!target &&
          jokerDef(target.key).trigger === "score" &&
          effect(target, next, new Set(visited), depth + 1);
        if (triggered && j.evolution) multiply(power, name + " / эволюция");
        log(
          "Копирование",
          name,
          triggered
            ? "Эффект соседа применён"
            : "Нет доступного scoring-эффекта / цикл",
        );
        break;
      }
      case "empty":
        multiply(
          1 + Math.max(0, r.jokerSlots - r.jokers.length) * 0.25 * power,
          name,
        );
        break;
      case "relic":
        addMult(
          r.jokers.filter((v) =>
            ["rare", "legendary"].includes(jokerDef(v.key).rarity),
          ).length *
            8 *
            power,
          name,
        );
        break;
      case "pyramid":
        if (selected.length <= 3) {
          j.value += 2;
          addMult(j.value * power, name);
        } else triggered = false;
        break;
      case "conductor":
        if (r.previousHand === hand.type) {
          j.value++;
          addMult(j.value * 5 * power, name);
        } else {
          j.value = 0;
          triggered = false;
        }
        break;
      case "gambler":
        if (r.money >= 2) {
          multiply(x(3), name);
          r.money -= 2;
          log("Экономика", name, "−$2");
        } else triggered = false;
        break;
      case "cerberus":
        multiply(x(3), name);
        break;
      case "archive":
        addChips(r.stats.plays * 8 * power, name);
        break;
      case "lone":
        if (selected.length === 1) multiply(x(3), name);
        else triggered = false;
        break;
      case "diamond":
        if (suitCount("diamonds"))
          addChips(suitCount("diamonds") * 15 * power, name);
        else triggered = false;
        break;
      case "spade":
        if (suitCount("spades")) addMult(suitCount("spades") * 3 * power, name);
        else triggered = false;
        break;
      case "fibonacci": {
        const n = hand.scoring.filter((c) =>
          [2, 3, 5, 8, 14].includes(c.rank),
        ).length;
        if (n) addMult(n * 5 * power, name);
        else triggered = false;
        break;
      }
      case "sacrifice":
        multiply(x(4), name);
        if (r.deck.length - destroyed.size > 10)
          destroyed.add(choose(r, hand.scoring).id);
        break;
      case "chronos":
        multiply(1.5, name, "Копирование");
        break;
      default:
        triggered = false;
    }
    if (triggered && depth === 0) {
      j.activations++;
      if (evolve(j)) r.stats.evolutions++;
    }
    return triggered;
  };
  for (let i = 0; i < r.jokers.length; i++) {
    const j = r.jokers[i];
    if (j.disabled) continue;
    if (j.key !== "chronos") effect(j, i, new Set());
    if (j.boostAnte === r.ante)
      multiply(1.5, jokerDef(j.key).name + " / энергия Бездны");
    if (j.edition === "foil") addChips(50, jokerDef(j.key).name + " / фольга");
    if (j.edition === "holo")
      addMult(10, jokerDef(j.key).name + " / голограмма");
    if (j.edition === "prism")
      multiply(1.5, jokerDef(j.key).name + " / призма");
  }
  const sequence = [...r.history.slice(-2), hand.type];
  const chain =
    sequence.join(",") === "pair,twoPair,fullHouse" ||
    sequence.slice(-2).join(",") === "straight,straightFlush" ||
    (sequence.length === 3 && new Set(sequence).size === 3)
      ? 1
      : 0;
  if (chain) {
    multiply(1.2, "Комбо-цепочка", "Глобальные эффекты");
    r.stats.chains++;
  }
  for (const j of active)
    if (j.key === "chronos") {
      multiply(1.5, "Хронос", "Повтор глобального эффекта");
      j.activations++;
    }
  if (r.difficulty > 0) {
    mult = mult.mul(1 / (1 + r.difficulty * 0.08));
    log(
      "Глобальные эффекты",
      "Сложность",
      `×${1 / (1 + r.difficulty * 0.08)} Mult`,
    );
  }
  for (const echo of echoes) {
    echo.activations++;
    if (evolve(echo)) r.stats.evolutions++;
  }
  chips = Decimal.max(chips, 0);
  mult = Decimal.max(mult, 0);
  const total = chips.mul(mult).floor();
  log(
    "Итог",
    "Очки",
    `${chips.toString()} × ${mult.toString()} = ${total.toString()}`,
  );
  if (!dry && destroyed.size) {
    r.deck = r.deck.filter((c) => !destroyed.has(c.id));
    r.hand = r.hand.filter((id) => !destroyed.has(id));
    r.draw = r.draw.filter((id) => !destroyed.has(id));
    r.discard = r.discard.filter((id) => !destroyed.has(id));
    r.events.push(`Распад: ${destroyed.size} карт`);
  }
  return {
    hand: hand.type,
    chips: chips.toString(),
    mult: mult.toString(),
    total: total.toString(),
    lines,
    scoring: hand.scoring.map((c) => c.id),
    uncertain,
    chain,
  };
}
