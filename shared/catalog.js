export const CLASSES = {
  assault: {
    name: "Штурмовик",
    description: "Скорость и мощный рывок",
    speed: 1.12,
    turn: 1,
    gain: 1,
    dash: 1.3,
  },
  titan: {
    name: "Титан",
    description: "Больше массы. Усиленный щит",
    speed: 0.88,
    turn: 0.83,
    gain: 1.3,
    dash: 1,
  },
  phantom: {
    name: "Фантом",
    description: "Манёвренность и долгий призрак",
    speed: 1,
    turn: 1.3,
    gain: 1,
    dash: 1,
  },
};
export const ABILITIES = {
  dash: { name: "Рывок", icon: "↯", cost: 22, cooldown: 8, duration: 0.65 },
  shield: { name: "Щит", icon: "⬡", cost: 30, cooldown: 22, duration: 4 },
  magnet: { name: "Магнит", icon: "◎", cost: 25, cooldown: 18, duration: 5 },
  pulse: { name: "Импульс", icon: "◉", cost: 35, cooldown: 16, duration: 0.6 },
  ghost: { name: "Призрак", icon: "◇", cost: 40, cooldown: 25, duration: 2.2 },
};
export const SKINS = [
  { id: "cyan", name: "ION / Бирюза", color: "#4df5dc", cost: 0 },
  { id: "violet", name: "VOID / Ультрафиолет", color: "#a78bfa", cost: 0 },
  { id: "pink", name: "PULSE / Фуксия", color: "#ff69c4", cost: 180 },
  { id: "gold", name: "SOLAR / Золото", color: "#ffca6b", cost: 320 },
  { id: "ice", name: "FROST / Лёд", color: "#b8f4ff", cost: 500 },
  { id: "ember", name: "EMBER / Пламя", color: "#ff7d54", cost: 650 },
];
export const COSMETICS = [
  { id: "trail-stars", name: "След • Звёздная пыль", type: "trail", cost: 220 },
  { id: "head-crown", name: "Голова • Корона", type: "head", cost: 380 },
  { id: "death-nova", name: "Смерть • Сверхновая", type: "death", cost: 280 },
  { id: "motion-wave", name: "Движение • Волна", type: "motion", cost: 450 },
];
export const ACHIEVEMENTS = [
  ["first", "Первый импульс", "matches", 1],
  ["ten", "Пилот арены", "matches", 10],
  ["fifty", "Ветеран", "matches", 50],
  ["collector", "Собиратель", "collected", 100],
  ["harvester", "Пожиратель света", "collected", 1000],
  ["energy", "Реактор", "collected", 10000],
  ["killer", "Первая победа", "kills", 1],
  ["hunter", "Охотник", "kills", 10],
  ["reaper", "Хищник", "kills", 100],
  ["minute", "Разогрев", "survival", 60],
  ["marathon", "Марафон", "survival", 600],
  ["immortal", "Долгожитель", "survival", 3600],
  ["boost", "Форсаж", "boosts", 20],
  ["ability", "Мастер энергии", "abilities", 50],
  ["boss", "Убийца древних", "bosses", 1],
  ["mass", "Гигант", "bestMass", 500],
  ["champion", "Вершина", "wins", 1],
].map(([id, name, stat, target]) => ({ id, name, stat, target, reward: 75 }));
export const QUESTS = [
  {
    id: "energy",
    name: "Соберите 1000 энергии",
    stat: "collected",
    target: 1000,
    reward: 120,
    daily: true,
  },
  {
    id: "hunt",
    name: "Уничтожьте 5 противников",
    stat: "kills",
    target: 5,
    reward: 150,
    daily: true,
  },
  {
    id: "survive",
    name: "Проживите 10 минут",
    stat: "survival",
    target: 600,
    reward: 100,
    daily: true,
  },
  {
    id: "boost",
    name: "Ускорьтесь 20 раз",
    stat: "boosts",
    target: 20,
    reward: 80,
    daily: false,
  },
  {
    id: "boss",
    name: "Победите древнего змея",
    stat: "bosses",
    target: 1,
    reward: 250,
    daily: false,
  },
];
export const WORLD_SIZE = 4200;
export const TICK_RATE = 30;
export const COLORS = [
  "#4df5dc",
  "#a78bfa",
  "#ff69c4",
  "#ffca6b",
  "#b8f4ff",
  "#ff7d54",
];
export const MODES = {
  classic: {
    name: "Классическая арена",
    description: "Свободная охота и события",
    speed: 1,
    gain: 1,
    boostCost: 24,
    eventInterval: 120,
    spawnShield: 2,
  },
  overdrive: {
    name: "Овердрайв",
    description: "Быстрее движение и рост",
    speed: 1.18,
    gain: 1.5,
    boostCost: 30,
    eventInterval: 75,
    spawnShield: 2,
  },
  hardcore: {
    name: "Хардкор",
    description: "Без стартового щита. Больше риска",
    speed: 1,
    gain: 1.15,
    boostCost: 34,
    eventInterval: 90,
    spawnShield: 0,
  },
};
