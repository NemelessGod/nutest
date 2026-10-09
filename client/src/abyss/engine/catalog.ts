import type { HandId, Suit } from "./types";
export const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
export const SUIT_NAMES = {
  hearts: "Черви",
  diamonds: "Бубны",
  clubs: "Трефы",
  spades: "Пики",
};
export const SUIT_SYMBOLS = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};
export const HANDS: Record<
  HandId,
  {
    name: string;
    chips: number;
    mult: number;
    gainChips: number;
    gainMult: number;
  }
> = {
  high: {
    name: "Старшая карта",
    chips: 5,
    mult: 1,
    gainChips: 10,
    gainMult: 1,
  },
  pair: { name: "Пара", chips: 10, mult: 2, gainChips: 15, gainMult: 1 },
  twoPair: { name: "Две пары", chips: 20, mult: 2, gainChips: 20, gainMult: 1 },
  three: { name: "Тройка", chips: 30, mult: 3, gainChips: 20, gainMult: 2 },
  straight: { name: "Стрит", chips: 30, mult: 4, gainChips: 30, gainMult: 3 },
  flush: { name: "Флеш", chips: 35, mult: 4, gainChips: 15, gainMult: 2 },
  fullHouse: {
    name: "Фулл-хаус",
    chips: 40,
    mult: 4,
    gainChips: 25,
    gainMult: 2,
  },
  four: { name: "Каре", chips: 60, mult: 7, gainChips: 30, gainMult: 3 },
  straightFlush: {
    name: "Стрит-флеш",
    chips: 100,
    mult: 8,
    gainChips: 40,
    gainMult: 4,
  },
  five: { name: "Пятёрка", chips: 120, mult: 12, gainChips: 35, gainMult: 3 },
  flushHouse: {
    name: "Флеш-хаус",
    chips: 140,
    mult: 14,
    gainChips: 40,
    gainMult: 4,
  },
  flushFive: {
    name: "Флеш-пятёрка",
    chips: 160,
    mult: 16,
    gainChips: 50,
    gainMult: 5,
  },
};
export const HAND_ORDER = Object.keys(HANDS) as HandId[];
export interface JokerDef {
  key: string;
  name: string;
  rarity: "common" | "uncommon" | "rare" | "legendary";
  price: number;
  description: string;
  symbol: number;
  evolves: boolean;
  trigger: "score" | "play" | "round" | "rule";
}
const defs: [
  string,
  string,
  JokerDef["rarity"],
  string,
  JokerDef["trigger"],
][] = [
  [
    "spark",
    "Искра",
    "common",
    "+4 Mult; после 8 активаций +12; после 20 ×2; после 40 ×3.",
    "score",
  ],
  [
    "ledger",
    "Казначей",
    "common",
    "+2 фишки за каждый доллар на счету.",
    "score",
  ],
  [
    "heart",
    "Кровь звёзд",
    "common",
    "+3 Mult за каждую сыгранную черву.",
    "score",
  ],
  [
    "ember",
    "Угольный сад",
    "common",
    "+12 фишек за каждую сыгранную трефу.",
    "score",
  ],
  ["ace", "Оракул", "uncommon", "+30 фишек за каждый сыгранный туз.", "score"],
  [
    "royal",
    "Лицедей",
    "common",
    "+4 Mult за каждую сыгранную фигурную карту.",
    "score",
  ],
  [
    "pair",
    "Двойник",
    "common",
    "×1.5 Mult, если комбинация содержит пару.",
    "score",
  ],
  [
    "straight",
    "Горизонт",
    "uncommon",
    "×2 Mult за стрит или стрит-флеш.",
    "score",
  ],
  [
    "flush",
    "Призма",
    "uncommon",
    "×2 Mult за флеш, стрит-флеш или флеш-руки.",
    "score",
  ],
  [
    "variety",
    "Картограф",
    "uncommon",
    "+2 Mult за каждый тип комбинации, сыгранный в забеге.",
    "score",
  ],
  [
    "echo",
    "Эхо",
    "rare",
    "Один повтор каждой сыгранной карты. Эволюция добавляет повторы.",
    "rule",
  ],
  [
    "steel",
    "Стальной трон",
    "uncommon",
    "×1.3 Mult за каждого короля, оставшегося в руке.",
    "score",
  ],
  [
    "mirror",
    "Зеркало справа",
    "rare",
    "Копирует scoring-эффект ближайшего джокера справа; циклы не срабатывают.",
    "score",
  ],
  [
    "reverse",
    "Зеркало слева",
    "rare",
    "Копирует scoring-эффект ближайшего джокера слева; циклы не срабатывают.",
    "score",
  ],
  [
    "empty",
    "Пустота",
    "uncommon",
    "×(1 + 0.25 за каждый пустой слот джокера) Mult.",
    "score",
  ],
  [
    "relic",
    "Реликварий",
    "rare",
    "+8 Mult за каждого редкого/легендарного джокера.",
    "score",
  ],
  [
    "pyramid",
    "Пирамида",
    "common",
    "При розыгрыше не более 3 карт растёт постоянный бонус: +2 Mult.",
    "score",
  ],
  [
    "conductor",
    "Дирижёр",
    "uncommon",
    "+5 Mult за каждый последовательный повтор той же комбинации.",
    "score",
  ],
  [
    "bank",
    "Банк бездны",
    "common",
    "Пока активен, повышает лимит процентов на $3; эволюция усиливает бонус.",
    "round",
  ],
  ["mint", "Монетный двор", "common", "+$1 за каждую сыгранную бубну.", "play"],
  [
    "gardener",
    "Садовник",
    "uncommon",
    "После победы создаёт одну карту со случайными рангом и мастью.",
    "round",
  ],
  [
    "executioner",
    "Жнец",
    "rare",
    "После победы уничтожает одну самую младшую карту колоды, пока их больше 10.",
    "round",
  ],
  [
    "alchemist",
    "Алхимик",
    "uncommon",
    "После каждой руки улучшает случайную сыгранную карту до Bonus.",
    "play",
  ],
  [
    "scribe",
    "Писец",
    "uncommon",
    "После победы накладывает красную печать на случайную карту.",
    "round",
  ],
  [
    "gambler",
    "Контракт крови",
    "rare",
    "×3 Mult при балансе не меньше $2, затем платит $2.",
    "score",
  ],
  [
    "cerberus",
    "Цербер",
    "rare",
    "×3 Mult; каждый блайнд начинается с одним сбросом меньше.",
    "rule",
  ],
  [
    "archive",
    "Архивариус",
    "common",
    "+8 фишек за каждую завершённую руку в забеге.",
    "score",
  ],
  [
    "lone",
    "Одинокий огонь",
    "uncommon",
    "×3 Mult, если сыграна только одна карта.",
    "score",
  ],
  [
    "fourFingers",
    "Четыре ветра",
    "rare",
    "Стрит и флеш могут состоять из четырёх карт.",
    "rule",
  ],
  [
    "cosmic",
    "Астроном",
    "uncommon",
    "Планеты повышают уровень комбинации на 2 вместо 1.",
    "rule",
  ],
  [
    "chronos",
    "Хронос",
    "legendary",
    "После глобальных эффектов повторно умножает Mult на ×1.5.",
    "score",
  ],
  [
    "summoner",
    "Призыватель",
    "legendary",
    "После победы над боссом создаёт случайного обычного джокера, если есть слот.",
    "round",
  ],
  ["diamond", "Огранщик", "common", "+15 фишек за сыгранную бубну.", "score"],
  ["spade", "Ночной дозор", "common", "+3 Mult за сыгранную пику.", "score"],
  [
    "fibonacci",
    "Золотое сечение",
    "uncommon",
    "+5 Mult за сыгранные ранги 2, 3, 5, 8 или туз.",
    "score",
  ],
  [
    "sacrifice",
    "Забытый бог",
    "legendary",
    "×4 Mult; после розыгрыша уничтожает случайную сыгранную карту, пока в колоде больше 10.",
    "play",
  ],
];
export const JOKERS: JokerDef[] = defs.map(
  ([key, name, rarity, description, trigger], i) => ({
    key,
    name,
    rarity,
    description,
    trigger,
    price: { common: 4, uncommon: 6, rare: 9, legendary: 15 }[rarity],
    symbol: i,
    evolves: i < 20,
  }),
);
export const jokerDef = (key: string) => {
  const d = JOKERS.find((j) => j.key === key);
  if (!d) throw Error("Неизвестный джокер: " + key);
  return d;
};
export const BOSSES = [
  {
    key: "mirror",
    name: "Зеркальный король",
    description: "Нельзя повторить предыдущую комбинацию.",
    icon: "mirror",
  },
  {
    key: "keeper",
    name: "Хранитель пустоты",
    description: "Самый дорогой джокер временно отключён.",
    icon: "eye",
  },
  {
    key: "ranks",
    name: "Пожиратель рангов",
    description: "Фигурные карты не приносят собственных фишек и улучшений.",
    icon: "teeth",
  },
  {
    key: "dealer",
    name: "Теневой дилер",
    description: "После каждой руки теряете ещё одну случайную карту из руки.",
    icon: "hand",
  },
  {
    key: "collector",
    name: "Коллекционер",
    description: "Для победы нужны минимум 2 разных комбинации.",
    icon: "keys",
  },
  {
    key: "hearts",
    name: "Чёрное сердце",
    description: "Червовые карты не начисляют фишки и улучшения.",
    icon: "heart",
  },
  {
    key: "tax",
    name: "Сборщик долгов",
    description: "Каждая сыгранная рука стоит $2. Можно уйти в долг.",
    icon: "coin",
  },
  {
    key: "silence",
    name: "Тишина",
    description: "Доступно всего 2 руки.",
    icon: "moon",
  },
  {
    key: "lock",
    name: "Оковы",
    description: "Сбросы запрещены.",
    icon: "chain",
  },
  {
    key: "fog",
    name: "Туман",
    description: "Размер руки уменьшен на 2.",
    icon: "cloud",
  },
  {
    key: "abyss",
    name: "Сердце Бездны",
    description:
      "Фазы: ослабленные карты → отключённый джокер → повышенные требования. Для победы нужны 3 разных комбинации (2 в испытании «Малые чудеса»).",
    icon: "vortex",
  },
];
export const DECKS = [
  {
    id: "wanderer",
    name: "Странник",
    description: "Сбалансированная колода. $8 на старте.",
    unlock: 0,
  },
  {
    id: "scarlet",
    name: "Алый орден",
    description: "Только червы и бубны; один дополнительный сброс.",
    unlock: 1,
  },
  {
    id: "oracle",
    name: "Оракул",
    description: "Рука на 1 карту больше; на $4 меньше.",
    unlock: 3,
  },
  {
    id: "abyss",
    name: "Пакт Бездны",
    description: "Старт с 8 Abyss Energy и проклятым тузом.",
    unlock: 5,
  },
  {
    id: "gilded",
    name: "Золотой круг",
    description: "$20 на старте; на одну руку меньше.",
    unlock: 8,
  },
];
export const CHALLENGES = [
  ["hearts", "Алый стол", "Только червы."],
  ["noSell", "Обет хранителя", "Нельзя продавать джокеры."],
  ["debt", "Должник", "Начните с −$8."],
  ["small", "Тесный карман", "Размер руки 6."],
  ["pairOnly", "Парный договор", "Разрешены только руки, содержащие пару."],
  ["curse", "Кровавый пакт", "В колоде четыре проклятые карты."],
  [
    "noShop",
    "Затворник",
    "Магазин закрыт; стартовые джокеры и растущие уровни рук.",
  ],
  ["noDiscard", "Без возврата", "Нет сбросов."],
  [
    "oneJoker",
    "Один свидетель",
    "Только один слот джокера; усиленный стартовый джокер.",
  ],
  ["poverty", "Скромность", "Нет процентов; старт с $3."],
  ["faces", "Королевский двор", "Только фигурные карты и тузы."],
  ["rapid", "Последний шанс", "Всего 3 руки за блайнд."],
  ["chaos", "Хаос", "Порядок джокеров меняется после каждой руки."],
  ["fragile", "Хрупкое стекло", "10 карт Glass на старте."],
  [
    "highOnly",
    "Малые чудеса",
    "Разрешены старшая карта и пара; растущие стартовые бонусы.",
  ],
].map(([id, name, description]) => ({ id, name, description }));
export const TAROT = [
  ["bonus", "Созвездие", "До 2 выбранных карт получают +30 фишек."],
  ["mult", "Пламя", "До 2 карт получают +4 Mult."],
  ["glass", "Зеркальное стекло", "1 карта: ×2 Mult, 25% риск уничтожения."],
  ["steel", "Кузнец", "1 карта: ×1.5 Mult, пока остаётся в руке."],
  ["wild", "Маска", "1 карта считается любой мастью."],
  ["gold", "Сокровище", "1 карта приносит $3 в конце блайнда, если в руке."],
  ["lucky", "Удача", "До 2 карт: 20% +20 Mult, 5% +$10."],
  ["raise", "Восхождение", "До 2 карт повышают ранг на 1; туз остаётся тузом."],
  ["copy", "Близнецы", "Скопируйте 1 выбранную карту в колоду."],
  ["destroy", "Пепел", "Уничтожьте до 2 выбранных карт."],
  ["suit", "Красная нить", "До 3 выбранных карт становятся червами."],
].map(([key, name, description]) => ({ key, name, description }));
export const SPECTRAL = [
  [
    "red",
    "Красное эхо",
    "1 выбранная карта получает красную печать: дополнительный повтор.",
  ],
  [
    "prism",
    "Разлом",
    "Случайный джокер получает призматическое издание ×1.5 Mult.",
  ],
  [
    "clone",
    "Парадокс",
    "Копирует 1 выбранную карту дважды; уничтожает её оригинал.",
  ],
  ["curse", "Проклятие", "1 выбранная карта получает проклятие своего ранга."],
  [
    "evolve",
    "Пробуждение",
    "Случайный эволюционирующий джокер получает 8 активаций.",
  ],
].map(([key, name, description]) => ({ key, name, description }));
export const VOUCHERS = [
  {
    key: "hand",
    name: "Большой карман",
    description: "+1 размер руки (максимум 12).",
    price: 10,
  },
  {
    key: "plays",
    name: "Последний танец",
    description: "+1 рука за блайнд (максимум 6).",
    price: 12,
  },
  {
    key: "discards",
    name: "Второе дыхание",
    description: "+1 сброс (максимум 5).",
    price: 10,
  },
  {
    key: "interest",
    name: "Дивиденды",
    description: "Лимит процентов +$5.",
    price: 10,
  },
  {
    key: "discount",
    name: "Знак дилера",
    description: "Предложения магазина дешевле на $1.",
    price: 8,
  },
];
export const ANOMALIES = [
  {
    key: "discard",
    name: "Тонкая грань",
    description: "−1 сброс. Награда: $5 и 2 энергии.",
  },
  {
    key: "weak",
    name: "Угасшие червы",
    description:
      "Черви не начисляют собственных фишек. Награда: $6 и 2 энергии.",
  },
  {
    key: "shuffle",
    name: "Карусель",
    description:
      "После руки перемешивается порядок джокеров. Награда: $5 и 2 энергии.",
  },
  {
    key: "mult",
    name: "Шёпот",
    description: "Базовый Mult ×0.75. Награда: $6 и 2 энергии.",
  },
  {
    key: "target",
    name: "Ненасытность",
    description: "Цель блайнда ×1.3. Награда: $8 и 3 энергии.",
  },
];
export const ACHIEVEMENTS = Array.from({ length: 32 }, (_, i) => {
  const rules: [string, string, string, number][] = [
    ["first", "Первый шаг", "plays", 1],
    ["hands10", "Десять историй", "plays", 10],
    ["hands100", "Картёжник", "plays", 100],
    ["hands500", "Легенда стола", "plays", 500],
    ["discard", "Разумный отказ", "discards", 10],
    ["round", "Первый блайнд", "wins", 1],
    ["round20", "Двадцать дверей", "wins", 20],
    ["boss", "Убийца королей", "bosses", 1],
    ["boss10", "Королевская охота", "bosses", 10],
    ["wealth", "Золотая жила", "moneyEarned", 100],
    ["wealth1000", "Магнат", "moneyEarned", 1000],
    ["spend", "Покупатель", "spent", 50],
    ["spend500", "Меценат", "spent", 500],
    ["sell", "Прощание", "sold", 10],
    ["reroll", "Иной шанс", "rerolls", 10],
    ["tarot", "Гадатель", "tarot", 10],
    ["planet", "Астроном", "planets", 10],
    ["spectral", "Спирит", "spectral", 5],
    ["booster", "Распечатано", "boosters", 10],
    ["curse", "Кровавый след", "cursed", 10],
    ["abyss", "В глубину", "abyssSpent", 20],
    ["evolve", "Метаморфоза", "evolutions", 1],
    ["evolve20", "Новая форма", "evolutions", 20],
    ["chain", "Цепная реакция", "chains", 10],
    ["found", "Коллекционер", "found", 10],
    ["all", "Хранитель масок", "found", 36],
    ["ante4", "За порогом", "ante", 4],
    ["ante8", "Сердце лабиринта", "ante", 8],
    ["win", "Победа над Бездной", "victory", 1],
    ["score", "Вспышка силы", "score", 10000],
    ["million", "Миллион искр", "score", 1000000],
    ["challenge", "Особый путь", "challenge", 1],
  ];
  const [id, name, stat, target] = rules[i];
  return { id, name, stat, target };
});
