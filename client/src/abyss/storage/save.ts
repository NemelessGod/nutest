import type { Run, Profile, Card } from "../engine/types";
import { newProfile, createRun, emptyStats } from "../engine/run";
import { D } from "../engine/score";
import {
  HANDS,
  JOKERS,
  SUITS,
  DECKS,
  CHALLENGES,
  ACHIEVEMENTS,
  TAROT,
  SPECTRAL,
  VOUCHERS,
  BOSSES,
  ANOMALIES,
} from "../engine/catalog";
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export const KEY = "jokers-abyss.save.v2";
const BACKUP = KEY + ".backup";
export function checksum(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++)
    h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16);
}
const validInteger = (n: unknown, min: number, max: number) =>
  typeof n === "number" && Number.isSafeInteger(n) && n >= min && n <= max;
function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw Error(message);
}
const identifier = (v: unknown) =>
  typeof v === "string" && /^[a-zA-Z0-9_-]{1,40}$/.test(v);
function validKey(type: string, key: string) {
  return type === "joker"
    ? JOKERS.some((v) => v.key === key)
    : type === "planet"
      ? Object.hasOwn(HANDS, key)
      : type === "tarot"
        ? TAROT.some((v) => v.key === key)
        : type === "spectral"
          ? SPECTRAL.some((v) => v.key === key)
          : type === "voucher"
            ? VOUCHERS.some((v) => v.key === key)
            : type === "booster"
              ? ["celestial", "arcana", "joker", "spectral"].includes(key)
              : type === "curse" &&
                ["ace", "king", "queen", "seven"].includes(key);
}
function validStats(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const stats = value as Record<string, unknown>;
  return Object.keys(emptyStats()).every((k) =>
    k === "found"
      ? Array.isArray(stats[k]) &&
        stats[k].every((x) => JOKERS.some((j) => j.key === x))
      : k === "hands"
        ? !!stats[k] &&
          typeof stats[k] === "object" &&
          Object.entries(stats[k]).every(
            ([h, n]) => Object.hasOwn(HANDS, h) && validInteger(n, 0, 1e9),
          )
        : validInteger(stats[k], 0, 1e9),
  );
}
export function validateRun(value: unknown): Run {
  check(!!value && typeof value === "object", "Сохранение не содержит забега");
  const r = value as Run;
  check(r.version === 2, "Неподдерживаемая версия забега");
  check(typeof r.seed === "string" && r.seed.length <= 80, "Некорректный seed");
  check(
    validInteger(r.rng, 0, 4294967295) && validInteger(r.serial, 0, 1e9),
    "Повреждён генератор случайности",
  );
  for (const [key, min, max] of [
    ["ante", 1, 10000],
    ["blind", 0, 2],
    ["hands", 0, 10],
    ["discards", 0, 10],
    ["handSize", 3, 12],
    ["maxHands", 1, 6],
    ["maxDiscards", 0, 5],
    ["jokerSlots", 1, 8],
    ["money", -1e9, 1e9],
    ["abyss", 0, 30],
    ["round", 0, 30000],
    ["difficulty", 0, 3],
  ] as const)
    check(validInteger(r[key], min, max), "Некорректный параметр: " + key);
  check(
    ["blind", "playing", "shop", "booster", "won", "lost"].includes(r.phase),
    "Неизвестная фаза",
  );
  check(
    DECKS.some((d) => d.id === r.deckId) &&
      (!r.challenge || CHALLENGES.some((c) => c.id === r.challenge)),
    "Неизвестная колода/испытание",
  );
  for (const key of [
    "target",
    "roundScore",
    "bestScore",
    "bestMult",
  ] as const) {
    check(
      typeof r[key] === "string" && r[key].length < 1000 && D(r[key]).gte(0),
      "Повреждены очки",
    );
  }
  check(
    Array.isArray(r.deck) && r.deck.length <= 500,
    "Некорректный размер колоды",
  );
  const ids = new Set<string>();
  for (const c of r.deck) {
    check(identifier(c.id) && !ids.has(c.id), "Повреждены идентификаторы карт");
    ids.add(c.id);
    check(
      validInteger(c.rank, 2, 14) && SUITS.includes(c.suit),
      "Некорректная карта",
    );
    check(
      [
        "none",
        "bonus",
        "mult",
        "glass",
        "steel",
        "wild",
        "gold",
        "lucky",
      ].includes(c.enhancement) &&
        ["none", "red", "gold", "blue", "purple"].includes(c.seal) &&
        ["none", "ace", "king", "queen", "seven"].includes(c.curse) &&
        ["base", "foil", "holo", "prism"].includes(c.edition),
      "Неизвестное свойство карты",
    );
    check(
      validInteger(c.uses, 0, 1e9) && validInteger(c.blocked, 0, 100),
      "Некорректный счётчик карты",
    );
  }
  const areas = new Set<string>();
  for (const key of ["hand", "draw", "discard"] as const) {
    check(Array.isArray(r[key]), "Повреждена зона карт");
    for (const id of r[key]) {
      check(
        ids.has(id) && !areas.has(id),
        "Одна карта находится в нескольких зонах",
      );
      areas.add(id);
    }
  }
  check(
    Array.isArray(r.jokers) && r.jokers.length <= r.jokerSlots,
    "Некорректные джокеры",
  );
  const js = new Set<string>();
  for (const j of r.jokers) {
    check(
      JOKERS.some((d) => d.key === j.key) && identifier(j.id) && !js.has(j.id),
      "Неизвестный/повторный джокер",
    );
    js.add(j.id);
    check(
      validInteger(j.evolution, 0, 3) &&
        validInteger(j.activations, 0, 1e9) &&
        Number.isFinite(j.value) &&
        typeof j.disabled === "boolean" &&
        ["base", "foil", "holo", "prism"].includes(j.edition),
      "Повреждён джокер",
    );
  }
  check(
    r.levels &&
      Object.keys(HANDS).every((k) =>
        validInteger(r.levels[k as keyof typeof HANDS], 1, 1e6),
      ),
    "Повреждены уровни комбинаций",
  );
  check(
    r.stats &&
      Object.entries(r.stats).every(([k, v]) =>
        k === "found"
          ? Array.isArray(v) && v.every((x) => JOKERS.some((j) => j.key === x))
          : k === "hands"
            ? v &&
              typeof v === "object" &&
              Object.values(v).every((n) => validInteger(n, 0, 1e9))
            : validInteger(v, 0, 1e9),
      ),
    "Повреждена статистика",
  );
  check(
    Array.isArray(r.history) &&
      r.history.length <= 100 &&
      r.history.every((h) => Object.hasOwn(HANDS, h)) &&
      Array.isArray(r.roundTypes) &&
      r.roundTypes.every((h) => Object.hasOwn(HANDS, h)),
    "Повреждена история комбинаций",
  );
  check(
    Array.isArray(r.consumables) &&
      r.consumables.length <= 3 &&
      r.consumables.every(
        (c) =>
          typeof c.id === "string" &&
          ["tarot", "planet", "spectral"].includes(c.type) &&
          typeof c.key === "string",
      ),
    "Повреждены расходуемые карты",
  );
  check(
    Array.isArray(r.shop) &&
      r.shop.length <= 10 &&
      Array.isArray(r.booster) &&
      r.booster.length <= 3,
    "Повреждён магазин",
  );
  check(
    Array.isArray(r.events) &&
      r.events.length <= 100 &&
      r.events.every((e) => typeof e === "string" && e.length <= 300),
    "Повреждён журнал",
  );
  check(
    Array.isArray(r.selection) &&
      r.selection.length <= 5 &&
      r.selection.every((id) => ids.has(id)),
    "Повреждено выделение",
  );
  check(
    validStats(r.stats) && (!r.settledStats || validStats(r.settledStats)),
    "Повреждена полная статистика",
  );
  check(
    r.consumables.every((c) => identifier(c.id) && validKey(c.type, c.key)),
    "Неизвестная расходуемая карта",
  );
  check(
    [...r.shop, ...r.booster].every(
      (o) =>
        identifier(o.id) &&
        validKey(o.type, o.key) &&
        validInteger(o.price, 0, 100) &&
        typeof o.energy === "boolean" &&
        typeof o.sold === "boolean",
    ),
    "Неизвестное предложение",
  );
  check(
    Array.isArray(r.vouchers) &&
      r.vouchers.every((k) => VOUCHERS.some((v) => v.key === k)),
    "Неизвестный ваучер",
  );
  check(
    (!r.boss || BOSSES.some((b) => b.key === r.boss)) &&
      (!r.anomaly || ANOMALIES.some((a) => a.key === r.anomaly)) &&
      typeof r.anomalyAccepted === "boolean",
    "Неизвестный босс/аномалия",
  );
  check(
    validInteger(r.interestCap, 0, 100) &&
      validInteger(r.rerollCost, 0, 1e6) &&
      validInteger(r.rerolls, 0, 1e6) &&
      typeof r.endless === "boolean" &&
      typeof r.completed === "boolean" &&
      Number.isFinite(r.created),
    "Повреждены параметры забега",
  );
  check(
    r.jokers.every((j) => validInteger(j.boostAnte, 0, 10000)),
    "Повреждено усиление",
  );
  check(
    r.previousHand === null || Object.hasOwn(HANDS, r.previousHand),
    "Неизвестная предыдущая рука",
  );
  check(
    r.selection.length === new Set(r.selection).size,
    "Повторное выделение",
  );
  if (r.lastScore) {
    const result = r.lastScore;
    check(
      Object.hasOwn(HANDS, result.hand) &&
        [result.chips, result.mult, result.total].every(
          (v) => typeof v === "string" && v.length < 1000 && D(v).gte(0),
        ) &&
        Array.isArray(result.lines) &&
        result.lines.length <= 600 &&
        result.lines.every((l) =>
          [l.stage, l.source, l.operation, l.chips, l.mult].every(
            (v) => typeof v === "string" && v.length <= 1000,
          ),
        ) &&
        Array.isArray(result.scoring) &&
        result.scoring.every(identifier) &&
        typeof result.uncertain === "boolean" &&
        validInteger(result.chain, 0, 1),
      "Повреждён журнал начисления",
    );
  }
  return structuredClone(r);
}
function validateProfile(value: unknown): Profile {
  check(!!value && typeof value === "object", "Профиль повреждён");
  const p = value as Profile;
  check(p.version === 2, "Версия профиля не поддерживается");
  check(
    Array.isArray(p.achievements) &&
      Array.isArray(p.collection) &&
      p.collection.every((x) => JOKERS.some((j) => j.key === x)) &&
      p.achievements.every((x) => ACHIEVEMENTS.some((a) => a.id === x)),
    "Повреждена коллекция",
  );
  check(
    Array.isArray(p.runs) &&
      p.runs.length <= 100 &&
      p.runs.every(
        (r) =>
          typeof r.seed === "string" &&
          validInteger(r.ante, 1, 10000) &&
          typeof r.won === "boolean" &&
          D(r.score).gte(0),
      ),
    "Повреждена история",
  );
  check(
    validInteger(p.maxAnte, 0, 10000) &&
      D(p.bestScore).gte(0) &&
      D(p.bestMult).gte(0),
    "Повреждён рекорд",
  );
  check(
    p.stats &&
      typeof p.stats.plays === "number" &&
      Array.isArray(p.completedChallenges),
    "Повреждена статистика профиля",
  );
  check(
    p.settings &&
      ["normal", "fast", "veryfast", "instant"].includes(
        p.settings.animation,
      ) &&
      Number.isFinite(p.settings.uiScale) &&
      p.settings.uiScale >= 0.75 &&
      p.settings.uiScale <= 1.3 &&
      Number.isFinite(p.settings.textSize) &&
      p.settings.textSize >= 0.9 &&
      p.settings.textSize <= 1.3,
    "Повреждены настройки",
  );
  for (const v of [
    p.settings.master,
    p.settings.music,
    p.settings.sfx,
    p.settings.ui,
  ])
    check(Number.isFinite(v) && v >= 0 && v <= 1, "Некорректная громкость");
  check(
    p.settings.keys &&
      Object.values(p.settings.keys).every(
        (k) =>
          typeof k === "string" &&
          /^(Key[A-Z]|Digit[0-9]|Enter|Space|Escape|Backspace|Tab)$/.test(k),
      ),
    "Некорректные клавиши",
  );
  check(
    validStats(p.stats) &&
      p.completedChallenges.every((k) => CHALLENGES.some((c) => c.id === k)),
    "Повреждена полная статистика профиля",
  );
  check(
    p.runs.every(
      (r) =>
        r.seed.length <= 80 &&
        DECKS.some((d) => d.id === r.deck) &&
        (!r.challenge || CHALLENGES.some((c) => c.id === r.challenge)) &&
        Number.isFinite(r.date) &&
        validInteger(r.money, -1e9, 1e9),
    ),
    "Повреждены параметры истории",
  );
  check(
    ["effects", "flashes", "shake", "contrast", "symbols"].every(
      (k) => typeof p.settings[k as keyof typeof p.settings] === "boolean",
    ),
    "Повреждены переключатели",
  );
  check(
    ["play", "discard", "sort", "collection", "menu"].every(
      (k) =>
        typeof p.settings.keys[k as keyof typeof p.settings.keys] === "string",
    ) && new Set(Object.values(p.settings.keys)).size === 5,
    "Повреждены привязки клавиш",
  );
  return structuredClone(p);
}
export function serialize(run: Run | null, profile: Profile) {
  const payload = JSON.stringify({ run, profile });
  return JSON.stringify({ version: 2, payload, checksum: checksum(payload) });
}
export function parseSave(text: string): { run: Run | null; profile: Profile } {
  if (text.length > 2_000_000) throw Error("Файл слишком большой");
  const envelope = JSON.parse(text);
  if (envelope.version === 1) {
    const p = newProfile();
    const base =
      typeof envelope.seed === "string" ? createRun(envelope.seed) : null;
    if (envelope.run) {
      const defaults = createRun(envelope.run.seed || "MIGRATED");
      const r = { ...defaults, ...envelope.run, version: 2 };
      r.stats = { ...defaults.stats, ...r.stats };
      return {
        run: validateRun(r),
        profile: validateProfile({
          ...p,
          ...envelope.profile,
          version: 2,
          settings: {
            ...p.settings,
            ...envelope.profile?.settings,
            keys: { ...p.settings.keys, ...envelope.profile?.settings?.keys },
          },
        }),
      };
    }
    return { run: base, profile: p };
  }
  check(
    envelope.version === 2 &&
      typeof envelope.payload === "string" &&
      checksum(envelope.payload) === envelope.checksum,
    "Контрольная сумма сохранения не совпадает",
  );
  const data = JSON.parse(envelope.payload);
  return {
    run: data.run === null ? null : validateRun(data.run),
    profile: validateProfile(data.profile),
  };
}
export class Saves {
  constructor(private storage: StorageLike) {}
  load() {
    const current = this.storage.getItem(KEY);
    if (!current) return { run: null, profile: newProfile(), recovered: false };
    try {
      return { ...parseSave(current), recovered: false };
    } catch (error) {
      const backup = this.storage.getItem(BACKUP);
      if (backup) {
        try {
          return { ...parseSave(backup), recovered: true };
        } catch {
          throw Error(
            "Основное сохранение и резервная копия повреждены. Исходные данные сохранены; используйте импорт проверенной копии.",
          );
        }
      }
      throw Error(
        "Сохранение повреждено, исходные данные не удалены: " + String(error),
      );
    }
  }
  save(run: Run | null, profile: Profile) {
    const current = this.storage.getItem(KEY);
    if (current) {
      try {
        parseSave(current);
        this.storage.setItem(BACKUP, current);
      } catch {
        this.storage.setItem(KEY + ".corrupt." + Date.now(), current);
      }
    }
    this.storage.setItem(KEY, serialize(run, profile));
  }
  import(text: string) {
    const data = parseSave(text);
    this.save(data.run, data.profile);
    return data;
  }
  export(run: Run | null, profile: Profile) {
    return serialize(run, profile);
  }
}
