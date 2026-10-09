import { api, escapeHTML as esc } from "../networking/api.js";
import {
  SKINS,
  COSMETICS,
  QUESTS,
  ACHIEVEMENTS,
} from "../../../shared/catalog.js";
const $ = (s) => document.querySelector(s);
export class Panels {
  constructor({ profile, setProfile, toast, resume, leave, play, fullscreen }) {
    Object.assign(this, {
      profile,
      setProfile,
      toast,
      resume,
      leave,
      play,
      fullscreen,
    });
    this.current = null;
    $("#modal-close").onclick = () => this.close();
    $("#modal").addEventListener("pointerdown", (e) => {
      if (e.target.id === "modal") this.close();
    });
  }
  get account() {
    return this.profile();
  }
  show(content, type) {
    this.current = type;
    $("#modal-body").innerHTML = content;
    $("#modal").hidden = false;
  }
  close() {
    if (this.current === "death") return;
    $("#modal").hidden = true;
    this.current = null;
    this.resume();
  }
  async action(fn) {
    try {
      await fn();
    } catch (e) {
      this.toast(e.message);
    }
  }
  open(type) {
    if (type === "garage") this.garage();
    if (type === "quests") this.quests();
    if (type === "achievements") this.achievements();
    if (type === "settings") this.settings();
    if (type === "account") this.accountPanel();
    if (type === "records") this.records();
    if (type === "pause") this.pause();
  }
  heading(kicker, title, description = "") {
    return `<div class="eyebrow">${kicker}</div><h2>${title}</h2>${description ? `<p>${description}</p>` : ""}`;
  }
  garage() {
    const a = this.account;
    this.show(
      this.heading(
        "CUSTOMIZE YOUR ENERGY",
        "Гараж",
        "Косметика меняет облик, но не даёт преимущества в бою.",
      ) +
        `<div class="wallet">◈ ${a.coins.toLocaleString("ru")} кредитов</div><div class="grid-cards">` +
        [...SKINS, ...COSMETICS]
          .map((item) => {
            const owned = a.owned.includes(item.id),
              equipped = Object.values(a.equipped).includes(item.id);
            return `<article class="item-card">${item.color ? `<div class="skin-preview" style="--skin:${item.color}"><span></span></div>` : `<div class="achievement-icon">${{ trail: "✧", head: "♜", death: "✺", motion: "≈" }[item.type]}</div>`}<h3>${item.name}</h3><p>${owned ? "В вашей коллекции" : item.cost + " кредитов"}</p><button data-buy="${item.id}" ${equipped ? "disabled" : ""}>${equipped ? "Выбрано" : owned ? "Выбрать" : "Открыть"}</button></article>`;
          })
          .join("") +
        "</div>",
      "garage",
    );
    document.querySelectorAll("[data-buy]").forEach(
      (b) =>
        (b.onclick = () =>
          this.action(async () => {
            this.setProfile(await api("shop", { id: b.dataset.buy }));
            this.toast("Облик обновлён");
            this.garage();
          })),
    );
  }
  quests() {
    const a = this.account;
    this.show(
      this.heading(
        "MISSION CONTROL",
        "Задания",
        "Прогресс и награды фиксируются после окончания полёта. Ежедневные задания обновляются в 00:00 UTC.",
      ) +
        QUESTS.map((q) => {
          const v = q.daily
              ? a.quests.daily[q.stat]
              : a.stats[q.stat] - (a.quests.repeat[q.id] || 0),
            claimed = q.daily && a.quests.claimed[q.id],
            ready = v >= q.target && !claimed;
          return `<div class="quest-card"><div><h3>${q.name}</h3><small>${q.daily ? "Ежедневное" : "Повторяемое"} • ${Math.floor(v)} / ${q.target}</small><progress max="${q.target}" value="${v}"></progress></div><button data-quest="${q.id}" ${ready ? "" : "disabled"}>${claimed ? "Получено" : ready ? "Забрать" : "◈ " + q.reward}</button></div>`;
        }).join(""),
      "quests",
    );
    document.querySelectorAll("[data-quest]").forEach(
      (b) =>
        (b.onclick = () =>
          this.action(async () => {
            this.setProfile(await api("quest", { id: b.dataset.quest }));
            this.toast("Награда получена");
            this.quests();
          })),
    );
  }
  achievements() {
    const a = this.account;
    this.show(
      this.heading(
        "YOUR LEGACY",
        "Достижения",
        `${a.achievements.length} / ${ACHIEVEMENTS.length} открыто. Каждое достижение приносит 75 кредитов.`,
      ) +
        `<div class="grid-cards">` +
        ACHIEVEMENTS.map(
          (h) =>
            `<article class="item-card ${a.achievements.includes(h.id) ? "" : "locked"}"><div class="achievement-icon">${a.achievements.includes(h.id) ? "✦" : "◇"}</div><h3>${h.name}</h3><p>${Math.floor(a.stats[h.stat])} / ${h.target} ${{ matches: "матчей", collected: "энергии", kills: "убийств", survival: "секунд жизни", boosts: "ускорений", abilities: "способностей", bosses: "боссов", bestMass: "массы", wins: "финишей на первом месте" }[h.stat]}</p><progress max="${h.target}" value="${a.stats[h.stat]}"></progress></article>`,
        ).join("") +
        "</div>",
      "achievements",
    );
  }
  async records() {
    this.show(
      this.heading("HALL OF LIGHT", "Рекорды") + "<p>Загрузка…</p>",
      "records",
    );
    try {
      const list = await api("records");
      if (this.current !== "records") return;
      this.show(
        this.heading(
          "HALL OF LIGHT",
          "Рекорды",
          "Лучшие полёты на этом сервере.",
        ) +
          (list.length
            ? `<table class="records-table"><thead><tr><th>#</th><th>ПИЛОТ</th><th>МАССА</th><th>УБИЙСТВА</th><th>УРОВЕНЬ</th></tr></thead><tbody>${list.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.name)}</td><td>${Math.floor(r.mass)}</td><td>${r.kills}</td><td>${r.level}</td></tr>`).join("")}</tbody></table>`
            : "<p>Первый рекорд может стать вашим. Завершите полёт на арене.</p>"),
        "records",
      );
    } catch (e) {
      this.toast(e.message);
    }
  }
  settings() {
    const s = this.account.settings;
    this.show(
      this.heading(
        "SYSTEM CONFIGURATION",
        "Настройки",
        "Настройки сохраняются в аккаунте. Онлайн-арена продолжает жить, пока меню открыто.",
      ) +
        `<div class="settings-row"><label for="quality">Качество эффектов</label><select id="quality">${["low", "medium", "high"].map((q, i) => `<option value="${q}" ${s.quality === q ? "selected" : ""}>${["Низкое", "Среднее", "Высокое"][i]}</option>`).join("")}</select></div><div class="settings-row"><label for="sound">Звуки</label><input id="sound" type="checkbox" ${s.sound ? "checked" : ""}/></div><div class="settings-row"><label for="show-telemetry">FPS и задержка</label><input id="show-telemetry" type="checkbox" ${s.telemetry ? "checked" : ""}/></div>` +
        Object.entries({
          boost: "Ускорение",
          first: "Первая способность",
          second: "Вторая способность",
        })
          .map(
            ([id, label]) =>
              `<div class="settings-row"><span>${label}</span><button class="secondary-button key-rebind" data-key="${id}">${esc(s.keys[id].replace("Key", ""))}</button></div>`,
          )
          .join("") +
        `<div class="settings-row"><span>Полноэкранный режим</span><button class="secondary-button" id="fullscreen">Развернуть ↗</button></div><button id="save-settings" class="play-button">СОХРАНИТЬ</button>`,
      "settings",
    );
    const keys = { ...s.keys };
    document.querySelectorAll("[data-key]").forEach(
      (b) =>
        (b.onclick = () => {
          b.textContent = "Нажмите…";
          const listen = (e) => {
            e.preventDefault();
            e.stopImmediatePropagation();
            if (e.code === "Escape") {
              b.textContent = keys[b.dataset.key];
              window.removeEventListener("keydown", listen, true);
              return;
            }
            if (
              !/^(Key[A-Z]|Digit[0-9]|Space|ShiftLeft|ShiftRight)$/.test(e.code)
            ) {
              this.toast("Используйте букву, цифру, Space или Shift");
              return;
            }
            keys[b.dataset.key] = e.code;
            b.textContent = e.code.replace("Key", "");
            window.removeEventListener("keydown", listen, true);
          };
          window.addEventListener("keydown", listen, true);
        }),
    );
    $("#fullscreen").onclick = this.fullscreen;
    $("#save-settings").onclick = () =>
      this.action(async () => {
        if (new Set(Object.values(keys)).size < 3)
          throw Error("Для действий нужны разные клавиши");
        this.setProfile(
          await api(
            "profile",
            {
              settings: {
                quality: $("#quality").value,
                sound: $("#sound").checked,
                telemetry: $("#show-telemetry").checked,
                keys,
              },
            },
            "PATCH",
          ),
        );
        this.toast("Настройки сохранены");
        this.close();
      });
  }
  accountPanel() {
    const a = this.account;
    this.show(
      this.heading(
        "PILOT IDENTITY",
        a.registered ? "Ваш аккаунт" : "Сохраните свой позывной",
        a.registered
          ? "Прогресс хранится на сервере. Войдите с другого устройства тем же логином."
          : "Гостевой прогресс сохраняется в этом браузере. Зарегистрируйтесь для входа с другого устройства.",
      ) +
        `<div class="wallet">Уровень ${1 + Math.floor(Math.sqrt(a.xp / 200))} • ${a.xp} XP • ${a.coins} кредитов</div><div class="account-form"><label>Логин<input id="username" maxlength="24" autocomplete="username" placeholder="3–24 латинских символа"/></label><label>Пароль<input id="password" type="password" maxlength="128" autocomplete="current-password" placeholder="Минимум 10 символов"/></label><div class="account-actions">${!a.registered ? '<button id="register" class="play-button">РЕГИСТРАЦИЯ</button>' : ""}<button id="login" class="secondary-button">Войти</button></div><button id="logout" class="secondary-button">Выйти из аккаунта</button></div>`,
      "account",
    );
    for (const kind of ["register", "login"])
      if ($("#" + kind))
        $("#" + kind).onclick = () =>
          this.action(async () => {
            this.leave();
            const p = await api(kind, {
              username: $("#username").value,
              password: $("#password").value,
            });
            this.setProfile(p);
            this.toast(
              kind === "register"
                ? "Аккаунт зарегистрирован"
                : "Вы вошли в аккаунт",
            );
            this.close();
            window.dispatchEvent(new Event("account-changed"));
          });
    $("#logout").onclick = () =>
      this.action(async () => {
        this.leave();
        await api("logout", {});
        this.setProfile(await api("guest", {}));
        window.dispatchEvent(new Event("account-changed"));
        this.accountPanel();
      });
  }
  pause() {
    this.show(
      this.heading(
        "FLIGHT CONTROL",
        "Меню полёта",
        "Мир не приостанавливается. Змея продолжает движение; ускорение отключено.",
      ) +
        `<button id="resume" class="play-button">ПРОДОЛЖИТЬ ↗</button><div class="account-actions" style="margin-top:15px"><button id="in-game-settings" class="secondary-button">Настройки</button><button id="leave-arena" class="secondary-button">Завершить полёт</button></div>`,
      "pause",
    );
    $("#resume").onclick = () => this.close();
    $("#in-game-settings").onclick = () => this.settings();
    $("#leave-arena").onclick = () => {
      this.leave();
      this.close();
    };
  }
  death(r) {
    this.show(
      `<div class="death-symbol">◇</div><div class="death-title">${this.heading("SIGNAL LOST", "Полёт завершён", esc(r.reason))}</div><div class="result-grid"><div>МАССА<b>${r.mass}</b></div><div>ВРЕМЯ<b>${Math.floor(r.survival / 60)}:${String(r.survival % 60).padStart(2, "0")}</b></div><div>УБИЙСТВА<b>${r.kills}</b></div></div><div class="rewards"><span>+ ${r.xp} XP</span><span>◈ + ${r.coins} кредитов</span></div>${r.unlocked?.length ? `<p style="text-align:center">Открыто: ${r.unlocked.map(esc).join(", ")}</p>` : ""}<button id="retry" class="play-button"><span>ЕЩЁ ОДИН ПОЛЁТ</span><span>↗</span></button><button id="back-menu" class="secondary-button" style="width:100%;margin-top:12px">Вернуться в меню</button>`,
      "death",
    );
    $("#retry").onclick = () => {
      $("#modal").hidden = true;
      this.current = null;
      this.play();
    };
    $("#back-menu").onclick = () => {
      $("#modal").hidden = true;
      this.current = null;
      this.leave();
    };
  }
}
