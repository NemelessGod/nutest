export type Suit = "hearts" | "diamonds" | "clubs" | "spades";
export type Enhancement =
  "none" | "bonus" | "mult" | "glass" | "steel" | "wild" | "gold" | "lucky";
export type Curse = "none" | "ace" | "king" | "queen" | "seven";
export type HandId =
  | "high"
  | "pair"
  | "twoPair"
  | "three"
  | "straight"
  | "flush"
  | "fullHouse"
  | "four"
  | "straightFlush"
  | "five"
  | "flushHouse"
  | "flushFive";
export type Phase = "blind" | "playing" | "shop" | "booster" | "won" | "lost";
export interface Card {
  id: string;
  rank: number;
  suit: Suit;
  enhancement: Enhancement;
  seal: "none" | "red" | "gold" | "blue" | "purple";
  curse: Curse;
  uses: number;
  blocked: number;
  edition: "base" | "foil" | "holo" | "prism";
}
export interface Joker {
  id: string;
  key: string;
  edition: "base" | "foil" | "holo" | "prism";
  activations: number;
  evolution: number;
  value: number;
  boostAnte: number;
  disabled: boolean;
}
export interface Offer {
  id: string;
  type:
    "joker" | "tarot" | "planet" | "spectral" | "voucher" | "booster" | "curse";
  key: string;
  price: number;
  energy: boolean;
  sold: boolean;
}
export interface ScoreLine {
  stage: string;
  source: string;
  operation: string;
  chips: string;
  mult: string;
}
export interface ScoreResult {
  hand: HandId;
  chips: string;
  mult: string;
  total: string;
  lines: ScoreLine[];
  scoring: string[];
  uncertain: boolean;
  chain: number;
}
export interface Run {
  version: 2;
  seed: string;
  rng: number;
  serial: number;
  deck: Card[];
  draw: string[];
  hand: string[];
  discard: string[];
  jokers: Joker[];
  consumables: {
    id: string;
    type: "tarot" | "planet" | "spectral";
    key: string;
  }[];
  levels: Record<HandId, number>;
  phase: Phase;
  ante: number;
  blind: number;
  target: string;
  roundScore: string;
  hands: number;
  discards: number;
  handSize: number;
  maxHands: number;
  maxDiscards: number;
  jokerSlots: number;
  money: number;
  abyss: number;
  interestCap: number;
  rerollCost: number;
  rerolls: number;
  shop: Offer[];
  booster: Offer[];
  boss: string;
  anomaly: string;
  anomalyAccepted: boolean;
  roundTypes: HandId[];
  history: HandId[];
  lastScore: ScoreResult | null;
  bestScore: string;
  bestMult: string;
  deckId: string;
  challenge: string;
  difficulty: number;
  endless: boolean;
  stats: RunStats;
  settledStats?: RunStats;
  events: string[];
  round: number;
  completed: boolean;
  created: number;
  vouchers: string[];
  previousHand: HandId | null;
  selection: string[];
  pendingOutcome: "win" | "lose" | null;
}
export interface RunStats {
  plays: number;
  discards: number;
  wins: number;
  bosses: number;
  moneyEarned: number;
  spent: number;
  sold: number;
  rerolls: number;
  tarot: number;
  planets: number;
  spectral: number;
  boosters: number;
  cursed: number;
  abyssSpent: number;
  evolutions: number;
  chains: number;
  found: string[];
  hands: Partial<Record<HandId, number>>;
  maxJokers: number;
}
export interface Settings {
  animation: "normal" | "fast" | "veryfast" | "instant";
  effects: boolean;
  flashes: boolean;
  shake: boolean;
  contrast: boolean;
  symbols: boolean;
  uiScale: number;
  textSize: number;
  master: number;
  music: number;
  sfx: number;
  ui: number;
  keys: {
    play: string;
    discard: string;
    sort: string;
    collection: string;
    menu: string;
  };
}
export interface Profile {
  version: 2;
  achievements: string[];
  collection: string[];
  runs: {
    seed: string;
    ante: number;
    won: boolean;
    score: string;
    money: number;
    date: number;
    deck: string;
    challenge: string;
  }[];
  stats: RunStats;
  bestScore: string;
  bestMult: string;
  maxAnte: number;
  settings: Settings;
  completedChallenges: string[];
}
