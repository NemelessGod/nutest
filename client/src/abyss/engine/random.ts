export function seedHash(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
export function random(state: { rng: number }) {
  let t = (state.rng = (state.rng + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export function choose<T>(state: { rng: number }, list: readonly T[]): T {
  if (!list.length) throw Error("Нет вариантов для выбора");
  return list[Math.floor(random(state) * list.length)];
}
export function shuffle<T>(state: { rng: number }, list: T[]) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random(state) * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}
export function uid(state: { serial: number }) {
  return `a${++state.serial}`;
}
