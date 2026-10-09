import { writeFileSync, mkdirSync } from "node:fs";
import { performance } from "node:perf_hooks";
import {
  createRun,
  beginBlind,
  allowed,
  playHand,
  discardHand,
  buy,
  reroll,
  useConsumable,
  nextBlind,
  pickBooster,
  sellJoker,
} from "../client/src/abyss/engine/run.ts";
import { score, D } from "../client/src/abyss/engine/score.ts";
import { evaluate } from "../client/src/abyss/engine/poker.ts";
import {
  HANDS,
  CHALLENGES,
  JOKERS,
} from "../client/src/abyss/engine/catalog.ts";
import { validateRun } from "../client/src/abyss/storage/save.ts";
import type { Run } from "../client/src/abyss/engine/types.ts";

// The agent uses only visible cards, shop offers and the same public actions as the UI.
// It never edits money, targets, cards, RNG or progression.
const priority: Record<string, number> = {
  spark: 10,
  pair: 7,
  heart: 5,
  ember: 4,
  ace: 4,
  royal: 5,
  ledger: 6,
  straight: 6,
  flush: 6,
  variety: 8,
  echo: 8,
  steel: 5,
  mirror: 7,
  reverse: 7,
  empty: 3,
  relic: 6,
  pyramid: 9,
  conductor: 5,
  bank: 2,
  mint: 2,
  gardener: 1,
  executioner: 3,
  alchemist: 4,
  scribe: 7,
  gambler: 7,
  cerberus: 8,
  archive: 9,
  lone: 5,
  fourFingers: 6,
  cosmic: 3,
  chronos: 10,
  summoner: 8,
  diamond: 4,
  spade: 5,
  fibonacci: 8,
  sacrifice: 6,
};
export function candidates(r: Run) {
  const entries: { ids: string[]; heuristic: number; type: string }[] = [];
  const four = r.jokers.some((j) => j.key === "fourFingers" && !j.disabled);
  function visit(start: number, ids: string[]) {
    if (ids.length) {
      try {
        const type = allowed(r, ids),
          cards = ids.map((id) => r.deck.find((c) => c.id === id)!);
        const base = HANDS[type],
          level = r.levels[type];
        let heuristic =
          (base.chips +
            (level - 1) * base.gainChips +
            cards.reduce(
              (s, c) =>
                s +
                (c.rank > 10 ? 10 : c.rank) +
                (["bonus"].includes(c.enhancement) ? 30 : 0),
              0,
            )) *
          (base.mult + (level - 1) * base.gainMult);
        if (
          (r.boss === "abyss" || r.boss === "collector") &&
          !r.roundTypes.includes(type)
        )
          heuristic *= 3;
        entries.push({ ids: [...ids], heuristic, type });
      } catch (error) {
        if (
          !(error instanceof Error) ||
          !/запрещает|Испытание|Разрешены/.test(error.message)
        )
          throw error;
        // A boss/challenge can legitimately exclude this candidate.
      }
    }
    if (ids.length === 5) return;
    for (let i = start; i < r.hand.length; i++)
      visit(i + 1, [...ids, r.hand[i]]);
  }
  visit(0, []);
  entries.sort((a, b) => b.heuristic - a.heuristic);
  const shortlist = entries.slice(0, 10);
  for (const type of Object.keys(HANDS)) {
    const entry = entries.find((e) => e.type === type);
    if (entry && !shortlist.includes(entry)) shortlist.push(entry);
  }
  return shortlist
    .map((e) => {
      const result = score(r, e.ids, true);
      let utility = D(result.total).toNumber();
      if (
        (r.boss === "abyss" || r.boss === "collector") &&
        !r.roundTypes.includes(result.hand)
      )
        utility *= 10;
      if (
        r.boss === "abyss" &&
        r.roundTypes.includes(result.hand) &&
        r.hands <= 3 - r.roundTypes.length
      )
        utility = 0;
      return { ...e, result, utility };
    })
    .sort((a, b) => b.utility - a.utility);
}
function useInventory(r: Run, rejectedActions: Record<string, number>) {
  for (const item of [...r.consumables]) {
    try {
      const cards = [...r.deck].sort((a, b) => b.rank - a.rank);
      let target = cards.find((c) => c.enhancement === "none") || cards[0];
      if (item.key === "steel")
        target =
          cards.find((c) => c.rank === 13 && c.enhancement === "none") ||
          target;
      useConsumable(
        r,
        item.id,
        item.type === "planet" || ["prism", "evolve"].includes(item.key)
          ? []
          : [target.id],
      );
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !/Нужен|Нельзя уничтожить последнюю/.test(error.message)
      )
        throw error;
      rejectedActions[error.message] =
        (rejectedActions[error.message] || 0) + 1;
    }
  }
}
function shop(
  r: Run,
  observe: (r: Run) => void,
  rejectedActions: Record<string, number>,
) {
  if (r.challenge === "noShop") {
    nextBlind(r);
    return;
  }
  useInventory(r, rejectedActions);
  for (let pass = 0; pass < 3; pass++) {
    observe(r);
    const offers = [...r.shop]
      .filter((o) => !o.sold)
      .sort(
        (a, b) =>
          (b.type === "joker"
            ? (priority[b.key] || 0) + 10
            : b.type === "planet"
              ? 6
              : 2) -
          (a.type === "joker"
            ? (priority[a.key] || 0) + 10
            : a.type === "planet"
              ? 6
              : 2),
      );
    for (const o of offers) {
      if ((o.energy ? r.abyss : r.money) < o.price) continue;
      try {
        if (o.type === "joker") {
          if (r.jokers.length === r.jokerSlots) {
            const worst = [...r.jokers].sort(
              (a, b) =>
                (priority[a.key] || 0) +
                a.evolution * 3 -
                ((priority[b.key] || 0) + b.evolution * 3),
            )[0];
            if (
              r.challenge === "noSell" ||
              (priority[o.key] || 0) <=
                (priority[worst.key] || 0) + worst.evolution * 3
            )
              continue;
            sellJoker(r, worst.id);
          }
          buy(r, o.id);
        } else if (
          o.type === "planet" ||
          o.type === "tarot" ||
          o.type === "spectral"
        ) {
          buy(r, o.id);
          useInventory(r, rejectedActions);
        } else if (
          o.type === "voucher" &&
          !r.vouchers.includes(o.key) &&
          r.money >= o.price + 5
        ) {
          buy(r, o.id);
        } else if (o.type === "booster" && r.money >= o.price + 10) {
          buy(r, o.id);
          const pick = [...r.booster]
            .sort(
              (a, b) =>
                (b.type === "joker" ? priority[b.key] || 0 : 5) -
                (a.type === "joker" ? priority[a.key] || 0 : 5),
            )
            .find((p) => p.type !== "joker" || r.jokers.length < r.jokerSlots);
          pickBooster(r, pick?.id || null);
          useInventory(r, rejectedActions);
        }
      } catch (error) {
        if (
          !(error instanceof Error) ||
          !/Нет слота|Все слоты|Недостаточно валюты/.test(error.message)
        )
          throw error;
        rejectedActions[error.message] =
          (rejectedActions[error.message] || 0) + 1;
      }
    }
    if (
      pass < 2 &&
      r.jokers.length < r.jokerSlots &&
      r.money > r.rerollCost + 6
    )
      reroll(r);
    else break;
  }
  nextBlind(r);
}
export function simulate(seed: string, challenge = "") {
  const start = performance.now(),
    r = createRun(seed, "wanderer", challenge);
  let ticks = 0,
    errors: string[] = [],
    scoreMs: number[] = [];
  const rejectedActions: Record<string, number> = {};
  const seenOffers = new Set<string>(),
    rarities: Record<string, number> = {
      common: 0,
      uncommon: 0,
      rare: 0,
      legendary: 0,
    };
  const observe = (r: Run) => {
    for (const o of r.shop)
      if (o.type === "joker" && !seenOffers.has(o.id)) {
        seenOffers.add(o.id);
        rarities[JOKERS.find((j) => j.key === o.key)!.rarity]++;
      }
  };
  while (!["lost", "won"].includes(r.phase) && ticks++ < 250) {
    try {
      if (r.phase === "blind") beginBlind(r, false);
      else if (r.phase === "shop") shop(r, observe, rejectedActions);
      else if (r.phase === "playing") {
        useInventory(r, rejectedActions);
        const start = performance.now();
        let choices = candidates(r);
        scoreMs.push(performance.now() - start);
        const best = choices[0];
        if (
          r.discards > 0 &&
          (!best ||
            D(best.result.total).lt(
              D(r.target).minus(r.roundScore).div(r.hands),
            ))
        ) {
          const keep = best?.ids || [];
          let discard = r.hand.filter((id) => !keep.includes(id)).slice(0, 5);
          if (!discard.length) discard = r.hand.slice(0, 3);
          discardHand(r, discard);
        } else if (best) {
          playHand(r, best.ids);
        } else if (r.discards) {
          discardHand(r, r.hand.slice(0, 5));
        } else {
          r.phase = "lost";
          r.events.push("Бот не нашёл допустимую комбинацию");
        }
      }
      validateRun(r);
    } catch (e) {
      errors.push(String(e));
      break;
    }
  }
  return {
    rejectedActions,
    seed,
    challenge,
    elapsedMs: performance.now() - start,
    moneyEarned: r.stats.moneyEarned,
    found: r.stats.found,
    rarities,
    won: r.phase === "won",
    ante: r.ante,
    blinds: r.stats.wins,
    plays: r.stats.plays,
    money: r.money,
    jokers: r.jokers.map((j) => j.key),
    best: r.bestScore,
    reason: r.events.at(-1),
    errors,
    scoreMs,
  };
}
if (process.argv[1]?.endsWith("simulate-abyss.ts")) {
  const suppliedSeed =
    process.argv.indexOf("--seed") >= 0
      ? process.argv[process.argv.indexOf("--seed") + 1]
      : undefined;
  const count = suppliedSeed ? 1 : Number(process.env.SIM_RUNS || 200),
    start = performance.now(),
    results = [];
  for (let i = 0; i < count; i++) {
    results.push(simulate(suppliedSeed || "RELEASE-2-" + i));
    if (i % 25 === 0) process.stdout.write(`Simulation ${i}/${count}\n`);
  }
  const challenges = CHALLENGES.map((c) => {
    let best: ReturnType<typeof simulate> | null = null,
      win: null | ReturnType<typeof simulate> = null;
    for (let i = 0; i < 24; i++) {
      const result = simulate("CHALLENGE-" + c.id + "-" + i, c.id);
      if (!best || result.blinds > best.blinds) best = result;
      if (result.won) {
        win = result;
        break;
      }
    }
    return {
      id: c.id,
      winningSeed: win?.seed || null,
      bestAnte: best?.ante,
      bestBlinds: best?.blinds,
      errors: best?.errors,
    };
  });
  const latencies = results.flatMap((r) => r.scoreMs).sort((a, b) => a - b),
    wins = results.filter((r) => r.won).length;
  const jokerUsage = Object.fromEntries(
    JOKERS.map((j) => [
      j.key,
      {
        acquired: results.filter((r) => r.found.includes(j.key)).length,
        final: results.filter((r) => r.jokers.includes(j.key)).length,
        winRateWhenAcquired: results.some((r) => r.found.includes(j.key))
          ? results.filter((r) => r.found.includes(j.key) && r.won).length /
            results.filter((r) => r.found.includes(j.key)).length
          : null,
      },
    ]),
  );
  const report = {
    averageEarnedMoney: results.reduce((s, r) => s + r.moneyEarned, 0) / count,
    averageFinalMoney: results.reduce((s, r) => s + r.money, 0) / count,
    averageSimulationMs: results.reduce((s, r) => s + r.elapsedMs, 0) / count,
    jokerUsage,
    rarityOffers: results.reduce(
      (acc, r) => {
        for (const k of Object.keys(acc)) acc[k] += r.rarities[k];
        return acc;
      },
      { common: 0, uncommon: 0, rare: 0, legendary: 0 } as Record<
        string,
        number
      >,
    ),
    outlierScores: [...results]
      .sort((a, b) => D(b.best).cmp(a.best))
      .slice(0, 10)
      .map((r) => ({ seed: r.seed, score: r.best, jokers: r.jokers })),
    notes:
      "Heuristic bot on base difficulty; acquisition and success are biased by its policy, not a human balance estimate. Timing is CPU simulation, not player session length or Android FPS.",
    runs: count,
    wins,
    winRate: wins / count,
    averageAnte: results.reduce((s, r) => s + r.ante, 0) / count,
    averagePlays: results.reduce((s, r) => s + r.plays, 0) / count,
    scoringSearchMs: {
      p50: latencies[Math.floor(latencies.length * 0.5)],
      p95: latencies[Math.floor(latencies.length * 0.95)],
    },
    seconds: (performance.now() - start) / 1000,
    errors: results.flatMap((r) => r.errors),
    challenges,
    results: results.map(({ scoreMs, ...r }) => r),
  };
  mkdirSync("docs", { recursive: true });
  writeFileSync("docs/simulation-2.0.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, results: undefined }, null, 2));
  if (report.errors.length || challenges.some((c) => !c.winningSeed))
    process.exitCode = 1;
}
