import "./style.css";
import type { Run, Profile, Settings, Offer, Card } from "./engine/types";
import {
  HANDS,
  HAND_ORDER,
  JOKERS,
  jokerDef,
  BOSSES,
  DECKS,
  CHALLENGES,
  ACHIEVEMENTS,
  ANOMALIES,
  TAROT,
  SPECTRAL,
  SUIT_NAMES,
  VOUCHERS,
} from "./engine/catalog";
import {
  createRun,
  beginBlind,
  playHand,
  discardHand,
  buy,
  reroll,
  pickBooster,
  sellJoker,
  reorderJoker,
  useConsumable,
  abyssAction,
  nextBlind,
  enterEndless,
  syncProfile,
  newProfile,
  addJoker,
  newCard,
  prepareBlind,
} from "./engine/run";
import { evaluate } from "./engine/poker";
import { D, formatNumber, evolve } from "./engine/score";
import { Saves, validateRun, serialize, KEY, parseSave } from "./storage/save";
import {
  playingCard,
  jokerCard,
  offerInfo,
  cardDescription,
  esc,
} from "./ui/cards";
import { jokerArt, sigil } from "./ui/art";
import { Sound } from "./audio/sound";
import { Particles } from "./ui/particles";
import { Tactile } from "./ui/tactile";
const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
const $$ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  Array.from(document.querySelectorAll<T>(selector));
let run: Run | null = null,
  profile: Profile = newProfile(),
  menu = true,
  dialogType = "",
  saveWarning = "",
  pendingConsumable = "",
  sortBy = "rank",
  dragged = "",
  touchStart: { id: string; x: number; y: number; time: number } | null = null,
  longPress: ReturnType<typeof setTimeout> | null = null;
let saves: Saves;
let volatileSave = false;
let rebindListener: ((event: KeyboardEvent) => void) | null = null;
function toast(message: string) {
  const node = document.createElement("div");
  node.className = "notification";
  node.textContent = message;
  $("#notifications").append(node);
  setTimeout(() => node.remove(), 4000);
}
try {
  saves = new Saves(localStorage);
  const loaded = saves.load();
  run = loaded.run;
  profile = loaded.profile;
  if (loaded.recovered)
    saveWarning =
      "Основное сохранение повреждено: загружена резервная копия. Исходные данные сохранены.";
} catch (error) {
  volatileSave = true;
  saveWarning = String(error);
  const memory = new Map<string, string>();
  saves = new Saves({
    getItem: (key) => memory.get(key) || null,
    setItem: (key, value) => {
      memory.set(key, value);
    },
  });
  saveWarning +=
    " Автосохранение для этой сессии временное. Используйте экспорт JSON для сохранения прогресса.";
}
const sound = new Sound(profile.settings),
  particles = new Particles($("#effects"), profile.settings);
const tactile = new Tactile();
function persist() {
  try {
    saves.save(run, profile);
  } catch (error) {
    saveWarning = "Не удалось сохранить: " + String(error);
    toast(saveWarning);
  }
}
function applySettings() {
  const s = profile.settings;
  document.documentElement.style.setProperty(
    "--anim",
    { normal: ".35s", fast: ".18s", veryfast: ".07s", instant: "0s" }[
      s.animation
    ],
  );
  document.documentElement.style.setProperty(
    "--text-scale",
    String(s.textSize),
  );
  document.documentElement.style.setProperty("--ui-scale", String(s.uiScale));
  document.documentElement.style.setProperty(
    "--card-width",
    `${104 * s.uiScale}px`,
  );
  document.body.classList.toggle("high-contrast", s.contrast);
  document.body.classList.toggle("reduced", !s.effects);
  document.body.classList.toggle("reduced-flashes", !s.flashes);
  document.body.classList.toggle("instant", s.animation === "instant");
  document.body.classList.toggle("suit-labels", s.symbols);
  document.body.classList.toggle("table-shake", s.shake);
  sound.update(s);
  particles.settings = s;
}
function action(fn: (r: Run) => void, tone = "ui", effect = "spark") {
  if (!run) return;
  try {
    sound.unlock();
    const before = run,
      snapshot = tactile.capture();
    const clone = structuredClone(run);
    const old = new Set(profile.achievements),
      evolutions = clone.stats.evolutions;
    fn(clone);
    validateRun(clone);
    run = clone;
    syncProfile(profile, run);
    persist();
    render();
    tactile.present(before, run, snapshot, profile.settings, sound);
    sound.play(run.stats.evolutions > evolutions ? "evolve" : tone);
    for (const id of profile.achievements)
      if (!old.has(id))
        toast("Достижение: " + ACHIEVEMENTS.find((a) => a.id === id)!.name);
    const center = $(".table-center") || $(".shop-grid");
    if (center) {
      const r = center.getBoundingClientRect();
      particles.burst(r.x + r.width / 2, r.y + r.height / 2, effect);
    }
    if (run.phase === "won") sound.play("win");
    if (run.phase === "lost") sound.play("lose");
  } catch (error) {
    toast(error instanceof Error ? error.message : String(error));
  }
}
function header() {
  return `<header class="site-header"><button class="wordmark text-button" data-menu>${sigil()}<span>JOKER'S ABYSS<small>THE HOUSE BETWEEN WORLDS</small></span></button><div class="header-links"><a href="/serpents.html">NEON SERPENTS ↗</a><span class="version">ULTIMATE EVOLUTION / 2.0</span><button class="icon-btn" data-panel="settings" aria-label="Настройки">⚙</button></div></header>`;
}
function render() {
  applySettings();
  $("#tooltip").hidden = true;
  $("#app").innerHTML = header() + (menu ? landing() : table());
  bind();
}
function landing() {
  const completed = profile.runs.filter((r) => r.won).length;
  return `<main class="landing"><section class="landing-copy"><div class="eyebrow">A POKER ROGUELIKE / BEYOND THE VEIL</div><h1>Joker's<br/><span>Abyss.</span></h1><p class="lead">За пределами удачи — только выбор.<br/>Собери невозможную комбинацию, пробуди своих джокеров и брось вызов самой Бездне.</p><div class="feature-line"><span><b>36</b>УНИКАЛЬНЫХ ДЖОКЕРОВ</span><span><b>11</b>ХРАНИТЕЛЕЙ БЕЗДНЫ</span><span><b>∞</b>ПУТЕЙ К ПОБЕДЕ</span></div><section class="setup-card">${saveWarning ? `<div class="save-warning">${esc(saveWarning)}</div>` : ""}<div class="setup-heading">НОВЫЙ ПАКТ<span>SEED / DETERMINISTIC</span></div><div class="form-row"><label class="field">СТАРТОВАЯ КОЛОДА<select id="deck-select">${DECKS.map((d) => `<option value="${d.id}" ${profile.maxAnte < d.unlock ? "disabled" : ""}>${d.name}${profile.maxAnte < d.unlock ? " · Ante " + d.unlock : ""}</option>`).join("")}</select></label><label class="field">СЛОЖНОСТЬ<select id="difficulty"><option value="0">Странник</option><option value="1" ${completed < 1 ? "disabled" : ""}>Искатель</option><option value="2" ${completed < 3 ? "disabled" : ""}>Проводник</option><option value="3" ${completed < 5 ? "disabled" : ""}>Бездна</option></select></label></div><div class="form-row"><label class="field">ИСПЫТАНИЕ<select id="challenge-select"><option value="">Свободный забег</option>${CHALLENGES.map((c) => `<option value="${c.id}">${c.name}${profile.completedChallenges.includes(c.id) ? " ✓" : ""}</option>`).join("")}</select></label><label class="field">SEED<input id="seed" maxlength="80" placeholder="Случайный мир" aria-label="Seed забега"></label></div><button class="primary" id="new-run">НОВАЯ ИГРА <span>→</span></button>${run ? '<button class="secondary" id="continue-run">Продолжить сохранённый забег</button>' : ""}<div class="seed-note" id="challenge-description"></div><div class="seed-note" id="deck-description">${DECKS[0].description}</div></section></section><section class="landing-art" aria-hidden="true"><div class="orbit"></div><div class="art-cards"><div class="art-card">${sigil("eye")}<span>THE VEIL</span></div><div class="art-card">${jokerArt("chronos")}<span>ABYSS</span></div><div class="art-card"><strong>A</strong>${sigil("vortex")}<span>♠</span></div></div><div class="art-caption">УДАЧА ЛЮБИТ СМЕЛЫХ.<small>Но Бездна предпочитает тех, кто умеет считать.</small></div></section><footer class="landing-footer"><nav><button class="text-button" data-panel="collection">Коллекция ${profile.collection.length} / 36</button><button class="text-button" data-panel="achievements">Достижения</button><button class="text-button" data-panel="stats">Статистика</button><button class="text-button" data-panel="saves">Сохранения</button><button class="text-button" data-panel="help">Как играть</button></nav><small>ОРИГИНАЛЬНАЯ ГРАФИКА • БЕЗ ПЛАТЕЖЕЙ • ОДИНОЧНАЯ ИГРА</small></footer></main>`;
}
function table() {
  if (!run) return "";
  const r = run;
  const progress = Math.min(
    100,
    D(r.roundScore).div(r.target).mul(100).toNumber(),
  );
  return `<main class="table-shell"><aside class="run-sidebar"><div class="eyebrow">ПАКТ С БЕЗДНОЙ</div><div class="ante-number">ANTE <b>${r.ante}<span class="small-text"> / ${r.endless ? "∞" : "8"}</span></b></div><div class="blind-target"><span>${["МАЛЫЙ БЛАЙНД", "БОЛЬШОЙ БЛАЙНД", "ХРАНИТЕЛЬ"][r.blind]}</span><b>${formatNumber(r.target)}</b></div><div class="round-score"><span>НАБРАНО ОЧКОВ</span><b>${formatNumber(r.roundScore)}</b><progress max="100" value="${progress}"></progress></div><div class="resource-grid"><div><span>РУКИ</span><b>${r.hands}</b></div><div><span>СБРОСЫ</span><b>${r.discards}</b></div><div class="money"><span>БАЛАНС</span><b>$${r.money}</b></div><div class="abyss"><span>ABYSS ENERGY</span><b>${r.abyss} ◆</b></div></div><div class="sidebar-actions"><button class="secondary" data-panel="history">Журнал</button><button class="secondary" data-panel="deck">Колода</button><button class="secondary" data-panel="help">Правила</button></div><div class="seed-label">SEED / ${esc(r.seed)}<br>${DECKS.find((d) => d.id === r.deckId)!.name}${r.challenge ? " · " + CHALLENGES.find((c) => c.id === r.challenge)!.name : ""}</div></aside><section class="game-content"><div class="joker-row-heading"><span>ДЖОКЕРЫ / ${r.jokers.length} ИЗ ${r.jokerSlots}</span><span>ЭФФЕКТЫ СЛЕВА НАПРАВО</span></div><div class="joker-row">${r.jokers.map((j, i) => jokerCard(j, i, r)).join("")}${Array.from({ length: Math.max(0, r.jokerSlots - r.jokers.length) }, () => '<div class="joker-slot">◇</div>').join("")}</div>${r.phase === "blind" ? blindPanel(r) : r.phase === "shop" ? shopPanel(r) : r.phase === "booster" ? boosterPanel(r) : r.phase === "lost" || r.phase === "won" ? endPanel(r) : playingPanel(r)}${inventory(r)}<div class="status-foot"><span>АВТОСОХРАНЕНИЕ / ${saveWarning ? "ЕСТЬ ПРЕДУПРЕЖДЕНИЕ" : "АКТИВНО"} · ${r.deck.length} КАРТ</span><span id="abyss-fps">— FPS</span></div></section></main>`;
}
function blindPanel(r: Run) {
  const boss = BOSSES.find((b) => b.key === r.boss),
    anomaly = ANOMALIES.find((a) => a.key === r.anomaly);
  return `<section class="blind-panel">${sigil(boss?.icon || "eye")}<div class="eyebrow" style="justify-content:center">${boss ? "ХРАНИТЕЛЬ БЕЗДНЫ" : "СЛЕДУЮЩИЙ ПАКТ"}</div><h2>${boss?.name || ["Малый блайнд", "Большой блайнд"][r.blind]}</h2><p>Наберите <b>${formatNumber(r.target)}</b> очков.<br>Каждая комбинация — шаг в неизвестность.</p>${boss ? `<div class="boss-warning">${boss.description}</div>` : ""}${anomaly ? `<label class="anomaly-card"><input type="checkbox" id="accept-anomaly"><span><b>Добровольная аномалия / ${anomaly.name}</b><br>${anomaly.description}</span></label>` : ""}<button id="begin-blind" class="primary">НАЧАТЬ БЛАЙНД →</button></section>`;
}
function playingPanel(r: Run) {
  const cards = r.selection
    .map((id) => r.deck.find((c) => c.id === id)!)
    .filter(Boolean);
  const result = cards.length
    ? evaluate(
        cards,
        r.jokers.some((j) => j.key === "fourFingers" && !j.disabled),
      )
    : null;
  const hand = result?.type || r.lastScore?.hand;
  const b = hand ? HANDS[hand] : null;
  const level = hand ? r.levels[hand] : 1;
  const chips = cards.length
      ? b!.chips + (level - 1) * b!.gainChips
      : r.lastScore?.chips || "0",
    mult = cards.length
      ? b!.mult + (level - 1) * b!.gainMult
      : r.lastScore?.mult || "0";
  const boss = BOSSES.find((b) => b.key === r.boss);
  return `<section class="table-center ${r.lastScore ? "score-pop" : ""}"><div class="table-watermark">${sigil()}</div><div class="chain-indicator">${
    r.lastScore?.chain
      ? "ЦЕПОЧКА ×1.2"
      : r.history.length
        ? "ЦЕПОЧКА / " +
          r.history
            .slice(-2)
            .map((h) => HANDS[h].name)
            .join(" → ")
        : "СОЗДАЙ СВОЮ СИНЕРГИЮ"
  }</div><h2 class="combo-title">${b?.name || "Выберите свою руку"}</h2><div class="score-pair"><div><small>CHIPS / ФИШКИ</small><b>${formatNumber(chips)}</b></div><span>×</span><div class="mult"><small>MULT / МНОЖИТЕЛЬ</small><b>${D(mult).toDecimalPlaces(2).toString()}</b></div></div><div class="score-total">${cards.length ? `Уровень ${level} · базовые значения до эффектов` : r.lastScore ? `+ ${formatNumber(r.lastScore.total)} очков` : "От 1 до 5 карт. Любой шанс можно превратить в силу."}</div><div class="score-subtitle">${boss ? boss.name + " · " + boss.description : cards.length ? "Итог зависит от улучшений, джокеров и случайных эффектов." : "Порядок джокеров имеет значение."}</div></section><section class="hand-zone"><div class="zone-heading"><span>ВАША РУКА <span class="card-count">${r.hand.length} КАРТ</span></span><span>ВЫБРАНО ${r.selection.length} / 5</span></div><div class="hand-row">${r.hand
    .map((id) => r.deck.find((c) => c.id === id)!)
    .filter(Boolean)
    .map((c) => playingCard(c, r.selection.includes(c.id)))
    .join(
      "",
    )}</div><div class="hand-actions"><button class="primary" id="play-hand" ${r.selection.length ? "" : "disabled"}>РАЗЫГРАТЬ <span class="key-badge">${profile.settings.keys.play.replace("Key", "")}</span></button><button class="primary discard-btn" id="discard-hand" ${r.selection.length && r.discards ? "" : "disabled"}>СБРОСИТЬ <span class="key-badge">${profile.settings.keys.discard === "Backspace" ? "⌫" : profile.settings.keys.discard.replace("Key", "")}</span></button><div class="sort-controls">${[
    ["rank", "Ранг"],
    ["suit", "Масть"],
    ["enhancement", "Улучшения"],
  ]
    .map(
      ([id, name]) =>
        `<button data-sort="${id}" class="${sortBy === id ? "active" : ""}">${name}</button>`,
    )
    .join("")}</div></div></section>${abyssControls(r)}`;
}
function abyssControls(r: Run) {
  return `<div class="abyss-actions"><button class="secondary" data-abyss="alter" ${r.abyss >= 3 && r.selection.length === 1 ? "" : "disabled"} data-tip="Выбранная карта получает +4 Mult за 3 энергии.">Изменить карту / 3 ◆</button><button class="secondary" data-abyss="reveal" ${r.abyss >= 5 ? "" : "disabled"} data-tip="Создать случайную спектральную карту за 5 энергии.">Открыть спектр / 5 ◆</button>${r.anomalyAccepted ? '<button class="secondary" data-abyss="cancel">Отменить аномалию / 3 ◆</button>' : ""}</div>`;
}
function shopPanel(r: Run) {
  return `<section class="shop-header"><div><div class="eyebrow">THE DEALER'S SANCTUM</div><h2>${r.shop.some((o) => o.energy) ? "Магазин Бездны" : "Убежище дилера"}</h2><p>Новые возможности. Старые искушения. Баланс: $${r.money} / ${r.abyss} ◆</p></div></section><div class="shop-grid">${r.shop.map((o) => offerCard(o)).join("") || '<div class="empty-state">Испытание закрывает магазин. Уровни всех рук повышены после победы.</div>'}</div><p class="rarity-note">Джокеры: обычный 65% · необычный 25% · редкий 9% · легендарный 1%. Предложения действуют до ухода из магазина.</p><div class="shop-actions"><button class="secondary" id="reroll" ${r.money >= r.rerollCost && r.challenge !== "noShop" ? "" : "disabled"}>Переброс / $${r.rerollCost}</button><button class="secondary" data-abyss="reroll" ${r.abyss >= 3 && r.challenge !== "noShop" ? "" : "disabled"}>Переосмыслить / 3 ◆</button><button class="primary" id="next-blind">СЛЕДУЮЩИЙ БЛАЙНД →</button></div>${abyssControls(r)}`;
}
function offerCard(o: Offer, booster = false) {
  const info = offerInfo(o);
  return `<article class="offer-card ${o.sold ? "sold" : ""}" style="--item-color:${info.color}">${info.art}<h3>${esc(info.name)}</h3><p>${esc(info.description)}</p><button class="secondary" data-${booster ? "pick" : "buy"}="${o.id}" ${o.sold ? "disabled" : ""}>${o.sold ? "Куплено" : booster ? "Выбрать" : `${o.energy ? o.price + " ◆" : "$" + o.price} / ${o.type === "booster" ? "Открыть" : "Купить"}`}</button></article>`;
}
function boosterPanel(r: Run) {
  return `<div class="shop-header"><div><div class="eyebrow">BREAK THE SEAL</div><h2>Выберите одну судьбу</h2><p>Одна карта отправится в ваш инвентарь.</p></div></div><div class="shop-grid">${r.booster.map((o) => offerCard(o, true)).join("")}</div><div class="shop-actions"><button id="skip-booster" class="secondary">Отказаться от бустера</button></div>`;
}
function endPanel(r: Run) {
  return `<section class="end-screen">${sigil(r.phase === "won" ? "vortex" : "moon")}<div class="eyebrow" style="justify-content:center">${r.phase === "won" ? "THE ABYSS REMEMBERS" : "THE HOUSE ALWAYS WAITS"}</div><h2>${r.phase === "won" ? "Бездна покорена." : "Пакт завершён."}</h2><p>${r.phase === "won" ? "Сердце Бездны остановилось. Но за ним — ещё тысячи миров." : esc(r.events.at(-1) || "Новый путь начинается с первого выбора.")}</p><div class="end-stats"><span>ANTE<b>${r.ante}</b></span><span>ЛУЧШАЯ РУКА<b>${formatNumber(r.bestScore)}</b></span><span>БЛАЙДЫ<b>${r.stats.wins}</b></span></div>${r.phase === "won" ? '<button class="primary" id="endless">БЕСКОНЕЧНЫЙ РЕЖИМ →</button>' : ""}<button class="secondary" data-menu>Вернуться в главное меню</button></section>`;
}
function inventory(r: Run) {
  return `<section class="inventory"><div class="inventory-title">РАСХОДУЕМЫЕ<br>КАРТЫ / ${r.consumables.length} ИЗ 3</div>${
    r.consumables
      .map((c) => {
        const o: Offer = { ...c, price: 0, energy: false, sold: false };
        const info = offerInfo(o);
        return `<div class="consumable" data-tip="${esc(info.description)}">${sigil(c.type === "planet" ? "moon" : "eye")}<span>${esc(info.name)}</span><button data-use="${c.id}">Применить</button></div>`;
      })
      .join("") ||
    '<span class="inventory-empty">Здесь появятся ваши арканы.</span>'
  }<button class="text-button deck-pile" data-panel="deck"><b>${r.draw.length}</b>В КОЛОДЕ / ${r.discard.length} СБРОШЕНО</button></section>`;
}
function showDialog(content: string, type: string) {
  if (rebindListener)
    window.removeEventListener("keydown", rebindListener, true);
  rebindListener = null;
  dialogType = type;
  $("#dialog-content").innerHTML = content;
  $("#dialog").hidden = false;
  bindDialog();
}
function closeDialog() {
  if (rebindListener)
    window.removeEventListener("keydown", rebindListener, true);
  rebindListener = null;
  dialogType = "";
  pendingConsumable = "";
  $("#dialog").hidden = true;
  $("#tooltip").hidden = true;
}
function title(kicker: string, name: string) {
  return `<div class="eyebrow">${kicker}</div><h2>${name}</h2>`;
}
function achievementText(stat: string, target: number) {
  const names: Record<string, string> = {
    ante: "Достигнутое Ante",
    victory: "Победа над финальным боссом",
    challenge: "Пройденные испытания",
    score: "Очки за одну руку",
    found: "Найденные джокеры",
    plays: "Сыгранные руки",
    discards: "Использованные сбросы",
    wins: "Пройденные блайнды",
    bosses: "Побеждённые боссы",
    moneyEarned: "Заработанные доллары",
    spent: "Потраченные доллары",
    sold: "Проданные джокеры",
    rerolls: "Перебросы магазина",
    tarot: "Применённые Таро",
    planets: "Применённые планеты",
    spectral: "Применённые спектры",
    boosters: "Открытые бустеры",
    cursed: "Активации проклятий",
    abyssSpent: "Потраченная энергия",
    evolutions: "Эволюции джокеров",
    chains: "Комбо-цепочки",
    maxJokers: "Джокеры одновременно",
  };
  return (names[stat] || stat) + " / " + formatNumber(target);
}
function panel(type: string) {
  sound.play("ui");
  if (type === "collection")
    showDialog(
      title("THE ARCHIVE", "Коллекция") +
        `<p>Найдено ${profile.collection.length} / 36 джокеров. Показаны точные базовые эффекты; текущую эволюцию видно в забеге.</p><div class="collection-grid">${JOKERS.map((j) => `<article class="collection-card ${profile.collection.includes(j.key) ? "" : "locked"}">${jokerArt(j.key)}<h3>${j.name}</h3><p>${j.description}</p><small class="small-text">${j.rarity} / ${j.evolves ? "Эволюция 0 → 3" : "Особая механика"}</small></article>`).join("")}</div>`,
      "collection",
    );
  if (type === "achievements")
    showDialog(
      title("YOUR LEGACY", "Достижения") +
        `<p>${profile.achievements.length} / 32 открыто. Достижения проверяются после действий и сохраняются автоматически.</p><div class="collection-grid">${ACHIEVEMENTS.map((a) => `<article class="collection-card ${profile.achievements.includes(a.id) ? "" : "locked"}">${sigil(profile.achievements.includes(a.id) ? "vortex" : "keys")}<h3>${a.name}</h3><p>${achievementText(a.stat, a.target)}</p></article>`).join("")}</div>`,
      "achievements",
    );
  if (type === "stats") {
    const stats = profile.stats;
    showDialog(
      title("A LIFE IN THE ABYSS", "Статистика") +
        `<div class="statistics-grid">${[
          ["Забеги", profile.runs.length],
          ["Лучший результат", formatNumber(profile.bestScore)],
          ["Максимум Ante", profile.maxAnte],
          ["Наибольший Mult", formatNumber(profile.bestMult)],
          ["Сыграно рук", stats.plays],
          ["Боссы", stats.bosses],
          ["Коллекция", profile.collection.length],
          ["Испытания", profile.completedChallenges.length],
        ]
          .map(
            ([label, value]) =>
              `<div class="stat-tile">${label}<b>${value}</b></div>`,
          )
          .join("")}</div><h3>Любимые комбинации</h3><p>${
          Object.entries(stats.hands)
            .sort((a, b) => b[1]! - a[1]!)
            .map(([id, n]) => `${HANDS[id as keyof typeof HANDS].name}: ${n}`)
            .join(" · ") || "История появится после завершённого забега."
        }</p><table class="data-table"><thead><tr><th>SEED</th><th>ANTE</th><th>РЕЗУЛЬТАТ</th><th>ЛУЧШАЯ РУКА</th></tr></thead><tbody>${profile.runs.map((r) => `<tr><td>${esc(r.seed)}</td><td>${r.ante}</td><td>${r.won ? "Победа" : "Завершён"}</td><td>${formatNumber(r.score)}</td></tr>`).join("")}</tbody></table>`,
      "stats",
    );
  }
  if (type === "history") {
    showDialog(
      title("EVERY TRIGGER MATTERS", "Журнал подсчёта") +
        (run?.lastScore
          ? `<p>${HANDS[run.lastScore.hand].name}: ${formatNumber(run.lastScore.total)} очков. Случайные эффекты: ${run.lastScore.uncertain ? "присутствуют" : "нет"}.</p><div class="score-log">${run.lastScore.lines.map((line) => `<div class="score-line"><span>${esc(line.source)}<small>${esc(line.stage)}</small></span><span>${esc(line.operation)}</span><span>${formatNumber(line.chips)} × ${D(line.mult).toDecimalPlaces(2).toString()}</span></div>`).join("")}</div>`
          : "<p>Разыграйте руку, чтобы увидеть подробный конвейер начисления.</p>") +
        `<h3>События забега</h3><p>${run?.events.map(esc).join("<br>") || "Нет событий"}</p>`,
      "history",
    );
  }
  if (type === "deck") deckPanel();
  if (type === "settings") settingsPanel();
  if (type === "saves") savesPanel();
  if (type === "help")
    showDialog(
      title("THE RULES OF THE PACT", "Как играть") +
        `<p>Соберите от 1 до 5 карт и разыграйте покерную комбинацию. Фишки × Mult дают очки. Блайнд нужно пройти до окончания рук. Сброс позволяет заменить до 5 карт, пока в колоде остаются карты.</p><p>Джокеры срабатывают <b>слева направо</b>. Перетаскивайте их или используйте стрелки. Покупайте планеты для повышения уровней рук, Таро для улучшения колоды и спектральные карты для особых эффектов. После каждого блайнда — магазин. После восьмого Ante вас ждёт финальный босс и бесконечный режим.</p><p>20 джокеров эволюционируют после 8 / 20 / 40 активаций. Энергия Бездны (максимум 30) даётся за проклятия, близкую победу, боссов и продажу редких джокеров. Ею можно менять карты, усиливать джокеров до конца Ante, менять магазин, открывать спектральные карты и отменять принятую аномалию.</p><p>На телефоне: коснитесь карты для выбора, удерживайте для описания. Передвигайте джокеров пальцем или стрелками. Меню не удаляет сохранённый забег.</p><table class="data-table"><thead><tr><th>КОМБИНАЦИЯ</th><th>CHIPS</th><th>MULT</th></tr></thead><tbody>${HAND_ORDER.map((id) => `<tr><td>${HANDS[id].name}</td><td>${HANDS[id].chips}</td><td>${HANDS[id].mult}</td></tr>`).join("")}</tbody></table><div class="button-row"><button class="secondary" id="fullscreen">Полноэкранный режим</button></div>`,
      "help",
    );
  if (type === "dev" && import.meta.env.DEV) devPanel();
}
function deckPanel() {
  if (!run) return;
  showDialog(
    title(
      "YOUR POSSIBILITIES",
      pendingConsumable ? "Выберите цели карты" : "Ваша колода",
    ) +
      `<p>${run.deck.length} карт. ${pendingConsumable ? "Выберите нужные карты, затем нажмите «Применить»." : "Выбранные карты можно изменить картами Таро/спектра."}</p><div class="deck-browser">${[
        ...run.deck,
      ]
        .sort((a, b) => b.rank - a.rank)
        .map((c) => playingCard(c, run!.selection.includes(c.id), true))
        .join(
          "",
        )}</div>${pendingConsumable ? '<div class="button-row"><button id="apply-consumable" class="primary">ПРИМЕНИТЬ</button><button class="secondary" id="cancel-consumable">Отмена</button></div>' : ""}`,
    "deck",
  );
}
function savesPanel() {
  showDialog(
    title("KEEP YOUR STORY", "Сохранения") +
      `<p>Автосохранение хранится в этом браузере. Экспортируйте JSON перед очисткой браузера или для переноса на другое устройство. Контрольная сумма обнаруживает случайное повреждение; это не защита от редактирования одиночного забега.</p>${saveWarning ? `<div class="save-warning">${esc(saveWarning)}</div>` : ""}<div class="button-row"><button class="primary" id="export-save">ЭКСПОРТ JSON</button><label class="secondary">Импорт JSON<input id="import-save" type="file" accept="application/json,.json" hidden></label></div><p>Импорт сначала проверяет формат и данные. Текущее валидное сохранение становится резервной копией. Старые данные не удаляются автоматически.</p>`,
    "saves",
  );
}
function settingsPanel() {
  const s = profile.settings;
  showDialog(
    title("MAKE THE TABLE YOURS", "Настройки") +
      `<div class="settings-grid"><label class="setting-row">Скорость анимаций<select id="animation">${[
        ["normal", "Нормальная"],
        ["fast", "Быстрая"],
        ["veryfast", "Очень быстрая"],
        ["instant", "Мгновенная"],
      ]
        .map(
          ([v, n]) =>
            `<option value="${v}" ${s.animation === v ? "selected" : ""}>${n}</option>`,
        )
        .join("")}</select></label>${[
        ["effects", "Частицы и фон"],
        ["flashes", "Свечение и вспышки"],
        ["shake", "Мягкая реакция стола"],
        ["contrast", "Повышенный контраст"],
        ["symbols", "Буквенные обозначения мастей"],
      ]
        .map(
          ([key, label]) =>
            `<label class="setting-row">${label}<input type="checkbox" id="setting-${key}" ${s[key as keyof Settings] ? "checked" : ""}></label>`,
        )
        .join("")}${[
        ["uiScale", "Масштаб интерфейса", 0.75, 1.3],
        ["textSize", "Размер текста", 0.9, 1.3],
        ["master", "Общая громкость", 0, 1],
        ["music", "Музыка", 0, 1],
        ["sfx", "Эффекты", 0, 1],
        ["ui", "Звуки интерфейса", 0, 1],
      ]
        .map(
          ([key, label, min, max]) =>
            `<label class="setting-row">${label}<input type="range" id="setting-${key}" min="${min}" max="${max}" step=".05" value="${s[key as keyof Settings]}"></label>`,
        )
        .join("")}${Object.entries({
        play: "Разыграть",
        discard: "Сбросить",
        sort: "Сортировать",
        collection: "Коллекция",
        menu: "Меню",
      })
        .map(
          ([key, label]) =>
            `<div class="setting-row"><span>${label}</span><button class="secondary" data-rebind="${key}">${esc(s.keys[key as keyof Settings["keys"]])}</button></div>`,
        )
        .join(
          "",
        )}</div><div class="button-row"><button class="primary" id="save-settings">СОХРАНИТЬ</button><button class="secondary" id="fullscreen">Полный экран</button></div>`,
    "settings",
  );
  const keys = { ...s.keys };
  $$<HTMLButtonElement>("[data-rebind]").forEach(
    (b) =>
      (b.onclick = () => {
        if (rebindListener)
          window.removeEventListener("keydown", rebindListener, true);
        b.textContent = "Нажмите клавишу";
        const listener = (e: KeyboardEvent) => {
          e.preventDefault();
          e.stopImmediatePropagation();
          if (
            !/^(Key[A-Z]|Digit[0-9]|Enter|Space|Escape|Backspace|Tab)$/.test(
              e.code,
            )
          ) {
            toast("Используйте букву, цифру или стандартную игровую клавишу");
            return;
          }
          keys[b.dataset.rebind as keyof typeof keys] = e.code;
          b.textContent = e.code;
          window.removeEventListener("keydown", listener, true);
          rebindListener = null;
        };
        rebindListener = listener;
        window.addEventListener("keydown", listener, true);
      }),
  );
  $("#save-settings").onclick = () => {
    if (new Set(Object.values(keys)).size !== 5)
      return toast("Для действий нужны разные клавиши");
    const next: Settings = {
      ...s,
      keys,
      animation: $<HTMLSelectElement>("#animation")
        .value as Settings["animation"],
    };
    for (const key of [
      "effects",
      "flashes",
      "shake",
      "contrast",
      "symbols",
    ] as const)
      next[key] = $<HTMLInputElement>("#setting-" + key).checked;
    for (const key of [
      "uiScale",
      "textSize",
      "master",
      "music",
      "sfx",
      "ui",
    ] as const)
      next[key] = Number($<HTMLInputElement>("#setting-" + key).value);
    profile.settings = next;
    applySettings();
    persist();
    closeDialog();
    render();
    toast("Настройки сохранены");
  };
}
function devPanel() {
  if (!import.meta.env.DEV || !run) return;
  showDialog(
    title("DEVELOPMENT ONLY", "Пульт дилера") +
      `<p>Только dev-сборка. Изменения сохраняются в текущем забеге.</p><div class="dev-grid"><label class="field">ДЖОКЕР<select id="dev-joker">${JOKERS.map((j) => `<option value="${j.key}">${j.name}</option>`).join("")}</select><button class="secondary" id="dev-add-joker">Выдать</button></label><label class="field">РАНГ КАРТЫ<input id="dev-rank" type="number" min="2" max="14" value="14"><button class="secondary" id="dev-add-card">Создать карту</button></label><label class="field">ДЕНЬГИ<input id="dev-money" type="number" value="100"><button class="secondary" id="dev-set-money">Установить</button></label><label class="field">ANTE<input id="dev-ante" type="number" min="1" max="10000" value="${run.ante}"><button class="secondary" id="dev-set-ante">Перейти</button></label><label class="field">БОСС<select id="dev-boss">${BOSSES.map((b) => `<option value="${b.key}">${b.name}</option>`).join("")}</select><button class="secondary" id="dev-set-boss">Запустить</button></label><label class="field">УРОВНИ РУК<input id="dev-level" type="number" min="1" max="1000000" value="10"><button class="secondary" id="dev-set-level">Применить ко всем</button></label><label class="field">НОВЫЙ SEED<input id="dev-seed" maxlength="80" value="DEV"><button class="secondary" id="dev-set-seed">Новый dev-забег</button></label><div><button class="secondary" id="dev-diagnostic">Экспорт диагностики</button></div></div><details><summary>Внутреннее состояние</summary><pre style="max-height:250px;overflow:auto;font-size:9px">${esc(JSON.stringify(run, null, 2))}</pre></details>`,
    "dev",
  );
  const applyDev = (fn: (r: Run) => void) => {
    action(fn);
    closeDialog();
  };
  $("#dev-add-joker").onclick = () =>
    applyDev((r) => addJoker(r, $<HTMLSelectElement>("#dev-joker").value));
  $("#dev-add-card").onclick = () =>
    applyDev((r) => {
      const rank = Number($<HTMLInputElement>("#dev-rank").value);
      r.deck.push(newCard(r, rank));
    });
  $("#dev-set-money").onclick = () =>
    applyDev((r) => {
      r.money = Number($<HTMLInputElement>("#dev-money").value);
    });
  $("#dev-set-ante").onclick = () =>
    applyDev((r) => {
      r.ante = Number($<HTMLInputElement>("#dev-ante").value);
      r.blind = 0;
      prepareBlind(r);
    });
  $("#dev-set-boss").onclick = () =>
    applyDev((r) => {
      r.boss = $<HTMLSelectElement>("#dev-boss").value;
      r.blind = 2;
      r.phase = "blind";
      beginBlind(r);
    });
  $("#dev-set-level").onclick = () =>
    applyDev((r) => {
      for (const h of HAND_ORDER)
        r.levels[h] = Number($<HTMLInputElement>("#dev-level").value);
    });
  $("#dev-set-seed").onclick = () => {
    run = createRun($<HTMLInputElement>("#dev-seed").value);
    menu = false;
    persist();
    closeDialog();
    render();
  };
  $("#dev-diagnostic").onclick = () =>
    download(
      "abyss-diagnostic.json",
      JSON.stringify(
        { version: 2, run, profile, events: run?.events },
        null,
        2,
      ),
    );
}
function download(name: string, content: string) {
  const blob = new Blob([content], { type: "application/json" }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function fullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen)
      await document.documentElement.requestFullscreen();
    else toast("Полный экран недоступен в этом браузере");
  } catch (error) {
    toast("Браузер не разрешил полный экран: " + String(error));
  }
}
function bindDialog() {
  bindCards("#dialog-content");
  const full = document.querySelector<HTMLElement>("#fullscreen");
  if (full) full.onclick = () => void fullscreen();
  const exported = document.querySelector<HTMLElement>("#export-save");
  if (exported)
    exported.onclick = () =>
      download("jokers-abyss-save.json", saves.export(run, profile));
  const importer = document.querySelector<HTMLInputElement>("#import-save");
  if (importer)
    importer.onchange = async () => {
      const file = importer.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = parseSave(text);
        showDialog(
          title("RESTORE YOUR PACT", "Загрузить сохранение?") +
            `<p>Seed: ${esc(parsed.run?.seed || "Нет активного забега")}. Текущие данные будут сохранены в резервной копии.</p><button class="primary" id="confirm-import">ЗАГРУЗИТЬ</button>`,
          "import",
        );
        $("#confirm-import").onclick = () => {
          try {
            const destination = volatileSave ? new Saves(localStorage) : saves;
            const loaded = destination.import(text);
            saves = destination;
            volatileSave = false;
            saveWarning = "";
            run = loaded.run;
            profile = loaded.profile;
            menu = true;
            closeDialog();
            render();
            toast("Сохранение импортировано");
          } catch (error) {
            toast(String(error));
          }
        };
      } catch (error) {
        toast("Импорт отклонён: " + String(error));
      }
    };
  const applying = document.querySelector<HTMLElement>("#apply-consumable");
  if (applying)
    applying.onclick = () => {
      const id = pendingConsumable;
      action((r) => useConsumable(r, id, r.selection), "rare");
      if (run && !run.consumables.some((c) => c.id === id)) closeDialog();
    };
  const cancel = document.querySelector<HTMLElement>("#cancel-consumable");
  if (cancel) cancel.onclick = closeDialog;
}
function bind() {
  $$("[data-menu]").forEach(
    (b) =>
      (b.onclick = () => {
        menu = true;
        closeDialog();
        persist();
        render();
      }),
  );
  $$("[data-panel]").forEach(
    (b) => (b.onclick = () => panel(b.dataset.panel!)),
  );
  const newRun = document.querySelector<HTMLElement>("#new-run");
  if (newRun)
    newRun.onclick = () => {
      sound.unlock();
      const seed =
        $<HTMLInputElement>("#seed").value.trim() ||
        crypto
          .getRandomValues(new Uint32Array(1))[0]
          .toString(36)
          .toUpperCase();
      const start = () => {
        run = createRun(
          seed,
          $<HTMLSelectElement>("#deck-select").value,
          $<HTMLSelectElement>("#challenge-select").value,
          Number($<HTMLSelectElement>("#difficulty").value),
        );
        menu = false;
        closeDialog();
        persist();
        render();
        sound.play("boss");
      };
      if (run && !["lost", "won"].includes(run.phase)) {
        showDialog(
          title("A NEW PACT", "Начать заново?") +
            '<p>Текущий незавершённый забег станет резервной копией. Экспорт JSON позволяет сохранить его отдельно.</p><button class="primary" id="confirm-new">НАЧАТЬ НОВЫЙ ЗАБЕГ</button>',
          "new",
        );
        $("#confirm-new").onclick = start;
      } else start();
    };
  const continued = document.querySelector<HTMLElement>("#continue-run");
  if (continued)
    continued.onclick = () => {
      sound.unlock();
      menu = false;
      render();
    };
  const decks = document.querySelector<HTMLSelectElement>("#deck-select");
  if (decks)
    decks.onchange = () => {
      $("#deck-description").textContent = DECKS.find(
        (d) => d.id === decks.value,
      )!.description;
    };
  const challenges =
    document.querySelector<HTMLSelectElement>("#challenge-select");
  if (challenges)
    challenges.onchange = () => {
      $("#challenge-description").textContent =
        CHALLENGES.find((c) => c.id === challenges.value)?.description || "";
    };
  const begin = document.querySelector<HTMLElement>("#begin-blind");
  if (begin)
    begin.onclick = () =>
      action(
        (r) =>
          beginBlind(
            r,
            document.querySelector<HTMLInputElement>("#accept-anomaly")
              ?.checked,
          ),
        "booster",
      );
  const play = document.querySelector<HTMLElement>("#play-hand");
  if (play)
    play.onclick = () =>
      action((r) => playHand(r, r.selection), "score", "wave");
  const discard = document.querySelector<HTMLElement>("#discard-hand");
  if (discard)
    discard.onclick = () =>
      action((r) => discardHand(r, r.selection), "sell", "smoke");
  const next = document.querySelector<HTMLElement>("#next-blind");
  if (next) next.onclick = () => action(nextBlind, "ui");
  const endless = document.querySelector<HTMLElement>("#endless");
  if (endless) endless.onclick = () => action(enterEndless, "win");
  const roll = document.querySelector<HTMLElement>("#reroll");
  if (roll) roll.onclick = () => action((r) => reroll(r), "booster");
  const skip = document.querySelector<HTMLElement>("#skip-booster");
  if (skip) skip.onclick = () => action((r) => pickBooster(r, null));
  $$("[data-buy]").forEach(
    (b) =>
      (b.onclick = () => action((r) => buy(r, b.dataset.buy!), "buy", "coin")),
  );
  $$("[data-pick]").forEach(
    (b) =>
      (b.onclick = () =>
        action((r) => pickBooster(r, b.dataset.pick!), "rare")),
  );
  $$("[data-sell]").forEach(
    (b) =>
      (b.onclick = () =>
        action((r) => sellJoker(r, b.dataset.sell!), "sell", "coin")),
  );
  $$("[data-boost]").forEach(
    (b) =>
      (b.onclick = () =>
        action((r) => abyssAction(r, "boost", b.dataset.boost!), "evolve")),
  );
  $$("[data-move]").forEach(
    (b) =>
      (b.onclick = () =>
        action((r) => {
          const index = r.jokers.findIndex((j) => j.id === b.dataset.move);
          reorderJoker(r, b.dataset.move!, index + Number(b.dataset.direction));
        })),
  );
  $$("[data-abyss]").forEach(
    (b) =>
      (b.onclick = () =>
        action(
          (r) => abyssAction(r, b.dataset.abyss as "alter", r.selection[0]),
          "curse",
        )),
  );
  $$("[data-use]").forEach(
    (b) =>
      (b.onclick = () => {
        if (!run) return;
        const item = run.consumables.find((c) => c.id === b.dataset.use)!;
        if (
          item.type === "planet" ||
          (item.type === "spectral" && ["prism", "evolve"].includes(item.key))
        )
          return action((r) => useConsumable(r, item.id, []), "rare");
        if (run.phase === "playing" && run.selection.length)
          return action((r) => useConsumable(r, item.id, r.selection), "rare");
        pendingConsumable = item.id;
        run.selection = [];
        deckPanel();
      }),
  );
  $$("[data-sort]").forEach(
    (b) => (b.onclick = () => sortHand(b.dataset.sort!)),
  );
  bindCards("#app");
  $$("[data-joker]").forEach((b) => {
    b.ondragstart = (e) => {
      dragged = b.dataset.joker!;
      b.classList.add("dragging");
      e.dataTransfer?.setData("text/plain", dragged);
    };
    b.ondragover = (e) => e.preventDefault();
    b.ondrop = (e) => {
      e.preventDefault();
      if (!run) return;
      const to = run.jokers.findIndex((j) => j.id === b.dataset.joker);
      action((r) => reorderJoker(r, dragged, to));
      dragged = "";
    };
    b.ondragend = () => {
      b.classList.remove("dragging");
      dragged = "";
    };
    b.addEventListener("pointerdown", (e) => {
      if (
        e.pointerType !== "touch" ||
        (e.target as HTMLElement).closest("button")
      )
        return;
      touchStart = {
        id: b.dataset.joker!,
        x: e.clientX,
        y: e.clientY,
        time: performance.now(),
      };
      b.setPointerCapture(e.pointerId);
      const row = b.closest<HTMLElement>(".joker-row")!;
      b.dataset.startScroll = String(row.scrollLeft);
    });
    b.addEventListener("pointermove", (e) => {
      if (!touchStart || touchStart.id !== b.dataset.joker) return;
      const dx = e.clientX - touchStart.x;
      if (performance.now() - touchStart.time < 350)
        b.closest<HTMLElement>(".joker-row")!.scrollLeft =
          Number(b.dataset.startScroll) - dx;
      else b.style.transform = `translateX(${dx}px) rotate(3deg)`;
    });
    b.addEventListener("pointerup", (e) => {
      if (!touchStart || touchStart.id !== b.dataset.joker) return;
      const dx = e.clientX - touchStart.x;
      b.style.transform = "";
      if (
        Math.abs(dx) > 35 &&
        run &&
        performance.now() - touchStart.time >= 350
      ) {
        const from = run.jokers.findIndex((j) => j.id === touchStart!.id),
          to = Math.max(
            0,
            Math.min(run.jokers.length - 1, from + (dx > 0 ? 1 : -1)),
          );
        action((r) => reorderJoker(r, touchStart!.id, to));
      }
      touchStart = null;
    });
    b.addEventListener("pointercancel", () => {
      touchStart = null;
      b.style.transform = "";
    });
  });
  bindTips();
}
function bindCards(scope: string) {
  $$<HTMLButtonElement>(scope + " [data-card]").forEach((b) => {
    let pressX = 0,
      pressY = 0,
      suppressClick = false;
    let touchDrag = false;
    let startScroll = 0;
    if (scope === "#app") {
      b.draggable = true;
      b.ondragstart = (e) => {
        dragged = b.dataset.card!;
        e.dataTransfer?.setData("text/plain", dragged);
      };
      b.ondragover = (e) => e.preventDefault();
      b.ondrop = (e) => {
        e.preventDefault();
        if (!run || !run.hand.includes(dragged)) return;
        const to = run.hand.indexOf(b.dataset.card!);
        action((r) => {
          const from = r.hand.indexOf(dragged);
          r.hand.splice(to, 0, r.hand.splice(from, 1)[0]);
        });
        dragged = "";
      };
      b.ondragend = () => {
        dragged = "";
      };
    }
    b.onclick = (e) => {
      if (suppressClick) {
        suppressClick = false;
        return;
      }
      if (!run) return;
      const id = b.dataset.card!;
      const wasSelected = run.selection.includes(id);
      if (run.selection.includes(id))
        run.selection = run.selection.filter((c) => c !== id);
      else {
        if (run.selection.length >= 5)
          return toast("Можно выбрать максимум 5 карт");
        run.selection.push(id);
      }
      sound.play("select");
      if (dialogType === "deck") deckPanel();
      else {
        const scroll = $(".hand-row").scrollLeft;
        render();
        $(".hand-row").scrollLeft = scroll;
        const selectedNode = document.querySelector<HTMLButtonElement>(
          `#app [data-card="${CSS.escape(id)}"]`,
        );
        if (
          selectedNode &&
          profile.settings.effects &&
          profile.settings.animation !== "instant"
        )
          selectedNode.animate(
            [
              {
                transform: wasSelected ? "translateY(-16px)" : "translateY(0)",
              },
              { transform: getComputedStyle(selectedNode).transform },
            ],
            { duration: 180, easing: "ease-out" },
          );
        if (e.detail === 0)
          document
            .querySelector<HTMLButtonElement>(`[data-card="${CSS.escape(id)}"]`)
            ?.focus({ preventScroll: true });
      }
      persist();
    };
    b.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "touch") return;
      pressX = e.clientX;
      pressY = e.clientY;
      suppressClick = false;
      startScroll = b.closest<HTMLElement>(".hand-row")?.scrollLeft || 0;
      longPress = setTimeout(() => {
        suppressClick = true;
        if (scope === "#app") {
          touchDrag = true;
          b.setPointerCapture(e.pointerId);
        }
        showTip(b, e.clientX, e.clientY);
      }, 500);
    });
    b.addEventListener("pointermove", (e) => {
      if (touchDrag) {
        b.style.transform = `translate(${e.clientX - pressX}px,-15px) rotate(3deg)`;
        return;
      }
      if (
        Math.abs(e.clientX - pressX) + Math.abs(e.clientY - pressY) > 12 &&
        longPress
      ) {
        clearTimeout(longPress);
        longPress = null;
        suppressClick = true;
      }
      if (
        e.pointerType === "touch" &&
        suppressClick &&
        Math.abs(e.clientX - pressX) > Math.abs(e.clientY - pressY)
      ) {
        const row = b.closest<HTMLElement>(".hand-row");
        if (row) row.scrollLeft = startScroll - (e.clientX - pressX);
      }
    });
    b.addEventListener("pointerup", (e) => {
      b.style.transform = "";
      if (touchDrag && Math.abs(e.clientX - pressX) > 35 && run) {
        const id = b.dataset.card!,
          from = run.hand.indexOf(id),
          to = Math.max(
            0,
            Math.min(
              run.hand.length - 1,
              from + Math.round((e.clientX - pressX) / (b.offsetWidth + 7)),
            ),
          );
        if (from >= 0 && from !== to)
          setTimeout(
            () =>
              action((r) => {
                const index = r.hand.indexOf(id);
                r.hand.splice(to, 0, r.hand.splice(index, 1)[0]);
              }),
            0,
          );
      }
      touchDrag = false;
    });
    b.addEventListener("pointercancel", () => {
      touchDrag = false;
      b.style.transform = "";
    });
    for (const event of ["pointerup", "pointercancel"])
      b.addEventListener(event, () => {
        if (longPress) {
          clearTimeout(longPress);
          longPress = null;
        }
      });
  });
}
function sortHand(type: string) {
  if (!run) return;
  sortBy = type;
  run.hand.sort((a, b) => {
    const ca = run!.deck.find((c) => c.id === a)!,
      cb = run!.deck.find((c) => c.id === b)!;
    return type === "rank"
      ? cb.rank - ca.rank
      : type === "suit"
        ? ca.suit.localeCompare(cb.suit) || cb.rank - ca.rank
        : ca.enhancement.localeCompare(cb.enhancement) || cb.rank - ca.rank;
  });
  persist();
  render();
  sound.play("ui");
}
function showTip(element: HTMLElement, x: number, y: number) {
  const text = element.dataset.tip;
  if (!text) return;
  const tip = $("#tooltip");
  tip.textContent = text;
  tip.hidden = false;
  const width = Math.min(280, innerWidth - 24);
  tip.style.maxWidth = width + "px";
  tip.style.left =
    Math.max(12, Math.min(innerWidth - width - 12, x + 15)) + "px";
  tip.style.top =
    Math.max(12, Math.min(innerHeight - tip.offsetHeight - 12, y + 18)) + "px";
}
function bindTips() {
  $$("[data-tip]").forEach((b) => {
    b.addEventListener("pointerenter", (e) => {
      if (e.pointerType !== "touch") showTip(b, e.clientX, e.clientY);
    });
    b.addEventListener("pointerleave", () => {
      $("#tooltip").hidden = true;
    });
    b.addEventListener("focus", () => {
      const rect = b.getBoundingClientRect();
      showTip(b, rect.left, rect.bottom);
    });
    b.addEventListener("blur", () => {
      $("#tooltip").hidden = true;
    });
  });
}
$("#close-dialog").onclick = closeDialog;
$("#dialog").addEventListener("pointerdown", (e) => {
  if (e.target === e.currentTarget) closeDialog();
});
window.addEventListener("keydown", (e) => {
  if (
    ["INPUT", "SELECT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)
  )
    return;
  if (import.meta.env.DEV && e.ctrlKey && e.shiftKey && e.code === "KeyD") {
    e.preventDefault();
    panel("dev");
    return;
  }
  const keys = profile.settings.keys;
  if (e.code === keys.menu) {
    e.preventDefault();
    if (!$("#dialog").hidden) closeDialog();
    else if (!menu) {
      menu = true;
      persist();
      render();
    } else panel("settings");
    return;
  }
  if (!$("#dialog").hidden) return;
  if (e.code === keys.collection) {
    e.preventDefault();
    panel("collection");
  }
  if (!menu && run?.phase === "playing") {
    if (e.code === keys.play) {
      e.preventDefault();
      action((r) => playHand(r, r.selection), "score", "wave");
    }
    if (e.code === keys.discard) {
      e.preventDefault();
      action((r) => discardHand(r, r.selection), "sell", "smoke");
    }
    if (e.code === keys.sort) {
      e.preventDefault();
      sortHand(sortBy === "rank" ? "suit" : "rank");
    }
  }
});
window.addEventListener("pagehide", persist);
setInterval(() => {
  const fps = document.querySelector("#abyss-fps");
  if (fps) fps.textContent = Math.round(particles.fps) + " FPS";
}, 1000);
render();
