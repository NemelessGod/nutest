import type { Card, Joker, Offer, Run } from "../engine/types";
import {
  SUIT_SYMBOLS,
  SUIT_NAMES,
  jokerDef,
  HANDS,
  TAROT,
  SPECTRAL,
  VOUCHERS,
} from "../engine/catalog";
import { rankName } from "../engine/poker";
import { jokerArt, rarityColor, sigil } from "./art";
export const esc = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function cardDescription(c: Card) {
  const improvements = {
    none: "Без улучшения",
    bonus: "+30 фишек",
    mult: "+4 Mult",
    glass: "×2 Mult; 25% риск распада",
    steel: "×1.5 Mult, пока остаётся в руке",
    wild: "Любая масть",
    gold: "+$3 в конце блайнда, если в руке",
    lucky: "20% +20 Mult; 5% +$10",
  };
  const curses = {
    none: "",
    ace: "Проклятие: +80 фишек; после каждых 3 активаций блокируется на следующий блайнд",
    king: "Проклятие: ×2 Mult; −$2 за активацию",
    queen:
      "Проклятие: повтор следующей карты; 15% уничтожить случайную карту в руке",
    seven: `Проклятие: +${(c.uses + 1) * 4} Mult; распад после 5 активаций`,
  };
  const seals = {
    none: "",
    red: "Красная печать: 1 повтор",
    gold: "Золотая печать: +$3 за активацию",
    blue: "Синяя печать: планета сыгранной руки после победы, если карта в руке",
    purple: "Фиолетовая печать: Таро при сбросе, если есть слот",
  };
  return `${rankName(c.rank)} · ${SUIT_NAMES[c.suit]}. ${improvements[c.enhancement]}. ${curses[c.curse]}. ${seals[c.seal]}. ${c.edition !== "base" ? "Особое издание: " + c.edition : ""}`;
}
export function playingCard(c: Card, selected = false, mini = false) {
  const suit = SUIT_SYMBOLS[c.suit],
    rank = rankName(c.rank);
  const color = c.suit === "hearts" || c.suit === "diamonds" ? "red" : "black";
  const art =
    c.rank >= 11
      ? `<div class="royal-art">${sigil(c.rank === 14 ? "vortex" : c.rank === 13 ? "mirror" : "eye")}<span>${rank}</span></div>`
      : `<div class="pips">${Array.from({ length: Math.min(10, c.rank) }, () => `<span>${suit}</span>`).join("")}</div>`;
  return `<button class="playing-card ${color} ${selected ? "selected" : ""} ${mini ? "mini" : ""} enhanced-${c.enhancement} edition-${c.edition} ${c.curse !== "none" ? "cursed" : ""}" data-suit-label="${SUIT_NAMES[c.suit]}" data-card="${esc(c.id)}" aria-label="${esc(cardDescription(c))}" aria-pressed="${selected}" data-tip="${esc(cardDescription(c))}"><span class="corner"><b>${rank}</b>${suit}</span>${art}<span class="corner bottom"><b>${rank}</b>${suit}</span>${c.enhancement !== "none" || c.curse !== "none" ? `<span class="card-badge">${c.curse !== "none" ? "ПРОКЛЯТИЕ" : c.enhancement.toUpperCase()}</span>` : ""}${c.seal !== "none" ? `<span class="seal seal-${c.seal}"></span>` : ""}</button>`;
}
export function jokerCard(j: Joker, index: number, r: Run) {
  const d = jokerDef(j.key),
    description = `${d.description}${d.evolves ? ` Эволюция ${j.evolution}/3: ${j.activations} активаций (пороги 8 / 20 / 40). Эффект +${j.evolution * 40}%; Искра и Эхо используют собственные шкалы.` : ""}${j.value ? " Накоплено: " + j.value + "." : ""}${j.boostAnte === r.ante ? " Усилен до конца Ante: ×1.5 Mult." : ""}`;
  return `<article class="joker-card edition-${j.edition} ${j.disabled ? "disabled" : ""} ${d.rarity === "legendary" ? "legendary" : ""}" style="--rarity:${rarityColor[d.rarity]}" draggable="true" data-joker="${j.id}" data-tip="${esc(description)}" tabindex="0"><div class="joker-number">${String(index + 1).padStart(2, "0")}<span>${d.rarity.toUpperCase()}</span></div>${jokerArt(j.key)}<h3>${d.name}</h3><div class="evolution">${d.evolves ? `<span>ЭВОЛЮЦИЯ ${j.evolution} / 3</span><progress max="${j.evolution === 0 ? 8 : j.evolution === 1 ? 20 : 40}" value="${j.activations}"></progress>` : "<span>ОСОБЫЙ ЭФФЕКТ</span>"}</div><div class="joker-controls"><button data-move="${j.id}" data-direction="-1" aria-label="Переместить влево">←</button><button data-boost="${j.id}" aria-label="Усилить энергией Бездны">+4 ◆</button><button data-move="${j.id}" data-direction="1" aria-label="Переместить вправо">→</button>${r.phase === "shop" ? `<button data-sell="${j.id}">Продать $${Math.floor(d.price / 2) + j.evolution}</button>` : ""}</div></article>`;
}
export function offerInfo(o: Offer) {
  if (o.type === "joker") {
    const d = jokerDef(o.key);
    return {
      name: d.name,
      description: d.description,
      art: jokerArt(o.key),
      color: rarityColor[d.rarity],
    };
  }
  if (o.type === "planet") {
    const d = HANDS[o.key as keyof typeof HANDS];
    return {
      name: "Планета / " + d.name,
      description: "+1 уровень комбинации; Астроном даёт +2.",
      art: sigil("moon"),
      color: "#70aafa",
    };
  }
  if (o.type === "voucher") {
    const d = VOUCHERS.find((v) => v.key === o.key)!;
    return {
      name: d.name,
      description: d.description,
      art: sigil("keys"),
      color: "#eac477",
    };
  }
  if (o.type === "booster") {
    return {
      name: {
        celestial: "Небесный бустер",
        arcana: "Бустер Аркана",
        joker: "Маски Бездны",
        spectral: "Спектральный бустер",
      }[o.key]!,
      description: "Выберите 1 карту из 3. Можно отказаться.",
      art: sigil("vortex"),
      color: "#b89bff",
    };
  }
  if (o.type === "curse") {
    return {
      name:
        "Проклятая карта / " +
        { ace: "Туз", king: "Король", queen: "Дама", seven: "Семёрка" }[o.key]!,
      description: "Мощный эффект с ценой; добавляется в колоду.",
      art: sigil("heart"),
      color: "#ea7e97",
    };
  }
  const d = (o.type === "tarot" ? TAROT : SPECTRAL).find(
    (d) => d.key === o.key,
  )!;
  return {
    name: d.name,
    description: d.description,
    art: sigil(o.type === "tarot" ? "eye" : "vortex"),
    color: o.type === "tarot" ? "#b694e7" : "#86dfd0",
  };
}
