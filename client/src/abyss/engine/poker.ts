import type { Card, HandId, Suit } from "./types";
import { SUITS } from "./catalog";
export interface PokerResult {
  type: HandId;
  scoring: Card[];
}
function straight(cards: Card[], need: number): Card[] {
  const sorted = [...new Set(cards.map((c) => c.rank))].sort((a, b) => b - a);
  if (sorted.includes(14)) sorted.push(1);
  for (let i = 0; i < sorted.length; i++) {
    const chain = [sorted[i]];
    for (let j = i + 1; j < sorted.length && chain.length < need; j++) {
      if (sorted[j] === chain.at(-1)! - 1) chain.push(sorted[j]);
      else break;
    }
    if (chain.length === need)
      return chain.map((rank) =>
        cards.find((c) => c.rank === (rank === 1 ? 14 : rank))!,
      );
  }
  return [];
}
export function evaluate(cards: Card[], fourFingers = false): PokerResult {
  if (cards.length < 1 || cards.length > 5)
    throw Error("Выберите от 1 до 5 карт");
  const sorted = [...cards].sort((a, b) => b.rank - a.rank),
    groups = new Map<number, Card[]>();
  for (const c of sorted) {
    const g = groups.get(c.rank) || [];
    g.push(c);
    groups.set(c.rank, g);
  }
  const byCount = [...groups.values()].sort(
    (a, b) => b.length - a.length || b[0].rank - a[0].rank,
  );
  const need = fourFingers ? 4 : 5;
  const flush =
    SUITS.map((suit) =>
      sorted.filter((c) => c.suit === suit || c.enhancement === "wild"),
    ).find((c) => c.length >= need) || [];
  const str = straight(sorted, need);
  let sf: Card[] = [];
  for (const suit of SUITS) {
    sf = straight(
      sorted.filter((c) => c.suit === suit || c.enhancement === "wild"),
      need,
    );
    if (sf.length) break;
  }
  const full = byCount[0].length === 3 && byCount[1]?.length === 2;
  if (flush.length === 5 && byCount[0].length === 5)
    return { type: "flushFive", scoring: sorted };
  if (flush.length === 5 && full)
    return { type: "flushHouse", scoring: sorted };
  if (byCount[0].length === 5) return { type: "five", scoring: sorted };
  if (sf.length) return { type: "straightFlush", scoring: sf };
  if (byCount[0].length === 4) return { type: "four", scoring: byCount[0] };
  if (full) return { type: "fullHouse", scoring: sorted };
  if (flush.length) return { type: "flush", scoring: flush };
  if (str.length) return { type: "straight", scoring: str };
  if (byCount[0].length === 3) return { type: "three", scoring: byCount[0] };
  if (byCount[0].length === 2 && byCount[1]?.length === 2)
    return { type: "twoPair", scoring: [...byCount[0], ...byCount[1]] };
  if (byCount[0].length === 2) return { type: "pair", scoring: byCount[0] };
  return { type: "high", scoring: [sorted[0]] };
}
export const rankName = (rank: number) =>
  ({ 11: "J", 12: "Q", 13: "K", 14: "A" })[rank] || String(rank);
export const cardChips = (card: Card) =>
  card.rank === 14 ? 11 : Math.min(10, card.rank);
