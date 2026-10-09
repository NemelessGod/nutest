import { jokerDef } from "../engine/catalog";
export const rarityColor = {
  common: "#63cfb9",
  uncommon: "#61a9ff",
  rare: "#b991ff",
  legendary: "#f5ca73",
};
export function jokerArt(key: string) {
  const d = jokerDef(key),
    i = d.symbol,
    color = rarityColor[d.rarity];
  const n = 3 + (i % 6);
  const spokes = Array.from({ length: n }, (_, j) => {
    const a = (j / n) * Math.PI * 2 - i * 0.12;
    const x = 60 + Math.cos(a) * 32,
      y = 57 + Math.sin(a) * 32;
    return `<path d="M60 57 L${x} ${y}"/><circle cx="${x}" cy="${y}" r="${3 + (i % 4)}"/>`;
  }).join("");
  const inner =
    i % 4 === 0
      ? '<path d="M60 30 81 68 39 68Z"/>'
      : i % 4 === 1
        ? '<path d="M30 57Q60 24 90 57Q60 90 30 57Z"/><circle cx="60" cy="57" r="8"/>'
        : i % 4 === 2
          ? '<path d="M60 28 86 57 60 86 34 57Z"/><path d="M45 44 75 70M75 44 45 70"/>'
          : '<path d="M34 75V38L48 57 60 33 72 57 86 38V75Z"/>';
  return `<svg viewBox="0 0 120 112" class="joker-art" aria-hidden="true"><defs><radialGradient id="g-${key}"><stop stop-color="${color}" stop-opacity=".24"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient></defs><rect width="120" height="112" fill="#11101f"/><circle cx="60" cy="57" r="54" fill="url(#g-${key})"/><g stroke="${color}" stroke-width=".5" fill="none" opacity=".3"><path d="M0 20H120M0 92H120M16 0V112M104 0V112"/><circle cx="60" cy="57" r="44"/><circle cx="60" cy="57" r="38"/>${spokes}</g><g stroke="${color}" stroke-width="2" fill="${color}" fill-opacity=".08">${inner}</g><circle cx="60" cy="57" r="3" fill="${color}"/><path d="M8 8H20M8 8V20M100 8H112V20M8 92V104H20M100 104H112V92" stroke="${color}" opacity=".6" fill="none"/></svg>`;
}
export function sigil(type = "abyss") {
  const shapes: Record<string, string> = {
    mirror: "M25 20H75V80H25ZM35 70 65 30",
    eye: "M10 50Q50 10 90 50Q50 90 10 50ZM50 35A15 15 0 1 0 50 65A15 15 0 1 0 50 35",
    teeth: "M20 20 35 65 50 30 65 65 80 20M20 80H80",
    hand: "M25 75V35Q30 25 35 35V55-35Q42 10 48 20V52-25Q55 15 60 25V56-18Q70 32 75 40V75Z",
    keys: "M25 30A10 10 0 1 0 25 50A10 10 0 1 0 25 30M25 50V80H35M60 20A10 10 0 1 0 60 40A10 10 0 1 0 60 20M60 40V75H70",
    heart: "M50 80Q5 45 20 25Q40 10 50 30Q60 10 80 25Q95 45 50 80",
    coin: "M50 15A35 35 0 1 0 50 85A35 35 0 1 0 50 15M40 30H60M50 25V75M40 50H60",
    moon: "M65 15A38 38 0 1 0 80 70A40 40 0 0 1 65 15",
    chain: "M30 20H50V55H30ZM50 45H70V80H50Z",
    cloud: "M20 65Q0 35 30 30Q50 0 75 35Q100 40 85 65Z",
    vortex:
      "M50 8 88 50 50 92 12 50ZM50 22 76 50 50 78 24 50ZM50 36 62 50 50 64 38 50Z",
  };
  return `<svg viewBox="0 0 100 100" class="sigil" aria-hidden="true"><path d="${shapes[type] || shapes.vortex}" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" opacity=".2"/></svg>`;
}
