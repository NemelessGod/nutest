import "./style.css";
import { io } from "socket.io-client";
import {
  CLASSES,
  SKINS,
  ABILITIES,
  QUESTS,
  MODES,
} from "../../shared/catalog.js";
import { Renderer } from "./rendering/renderer.js";
import { Input } from "./input/controller.js";
import { Synth } from "./audio/synth.js";
import { Panels } from "./ui/panels.js";
import { api, escapeHTML as esc } from "./networking/api.js";
const $ = (s) => document.querySelector(s);
let profile = null,
  classId = "assault",
  socket = null,
  playing = false,
  ping = 0,
  joining = false,
  lastHUD = 0,
  lastPing = 0,
  previousMass = 0,
  lastPickup = 0,
  reconnecting = false;
const renderer = new Renderer($("#arena")),
  audio = new Synth();
function toast(message) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = message;
  $("#toasts").append(t);
  setTimeout(() => t.remove(), 4000);
}
function setProfile(p) {
  const prior = profile;
  const draftName = $("#nickname").value;
  const changedAccount = !prior || prior.id !== p.id;
  profile = p;
  if (changedAccount || draftName === prior.name || p.name !== prior.name)
    $("#nickname").value = p.name;
  $("#pilot-level").textContent =
    `LVL ${String(1 + Math.floor(Math.sqrt(p.xp / 200))).padStart(2, "0")}`;
  renderer.quality = p.settings.quality;
  renderer.resize();
  audio.enabled = p.settings.sound;
  input.keys = p.settings.keys;
  if (changedAccount || prior.loadout.join(",") !== p.loadout.join(",")) {
    $("#ability-first").value = p.loadout[0];
    $("#ability-second").value = p.loadout[1];
  }
  $("#telemetry").hidden = !p.settings.telemetry;
  $("#quest-dot").style.display = QUESTS.some((q) =>
    q.daily
      ? !p.quests.claimed[q.id] && p.quests.daily[q.stat] >= q.target
      : p.stats[q.stat] - (p.quests.repeat[q.id] || 0) >= q.target,
  )
    ? "block"
    : "none";
  skinPicker();
  abilityButtons();
}
function skinPicker() {
  $("#skin-picker").innerHTML = SKINS.map(
    (s) =>
      `<button class="skin-swatch ${profile.equipped.skin === s.id ? "active" : ""} ${profile.owned.includes(s.id) ? "" : "locked"}" style="--skin:${s.color}" data-skin="${s.id}" aria-label="${s.name}" title="${s.name}${profile.owned.includes(s.id) ? "" : " • " + s.cost + " кредитов"}">${profile.owned.includes(s.id) ? "" : "⌑"}</button>`,
  ).join("");
  document.querySelectorAll("[data-skin]").forEach(
    (b) =>
      (b.onclick = () => {
        if (!profile.owned.includes(b.dataset.skin)) return panels.garage();
        panels.action(async () =>
          setProfile(await api("shop", { id: b.dataset.skin })),
        );
      }),
  );
}
function abilityButtons() {
  $("#abilities").innerHTML = profile.loadout
    .map(
      (id, i) =>
        `<button class="ability-button" data-ability="${i}" aria-label="${ABILITIES[id].name}"><span class="key">${profile.settings.keys[i ? "second" : "first"].replace("Key", "")}</span><strong>${ABILITIES[id].icon}</strong><small>${ABILITIES[id].name}</small><span class="cooldown" hidden></span></button>`,
    )
    .join("");
  document
    .querySelectorAll("[data-ability]")
    .forEach((b) => (b.onclick = () => useAbility(Number(b.dataset.ability))));
}
function useAbility(i) {
  if (!playing || !input.enabled) return;
  audio.unlock();
  socket?.emit("ability", profile.loadout[i]);
  audio.play("ability");
}
function pause() {
  if (!playing) {
    panels.open("settings");
    return;
  }
  if (!$("#modal").hidden) {
    panels.close();
    return;
  }
  input.clear();
  input.enabled = false;
  panels.pause();
}
function leave() {
  const wasPlaying = playing;
  playing = false;
  input.enabled = false;
  input.clear();
  renderer.playing = false;
  $("#hud").hidden = true;
  $("#lobby").hidden = false;
  document.body.classList.remove("playing");
  if (wasPlaying) socket?.emit("leave");
  setTimeout(async () => {
    try {
      setProfile(await api("me"));
    } catch {}
  }, 150);
}
async function fullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen)
      await document.documentElement.requestFullscreen();
    else toast("Этот браузер не поддерживает полноэкранный режим");
  } catch {
    toast("Браузер не разрешил полноэкранный режим");
  }
}
const input = new Input($("#arena"), {
  ability: useAbility,
  pause,
  board: (show) => {
    if (playing)
      document.querySelector(".leaderboard").classList.toggle("expanded", show);
  },
});
const panels = new Panels({
  profile: () => profile,
  setProfile,
  toast,
  resume: () => {
    input.enabled = playing;
  },
  leave,
  play,
  fullscreen,
});
function connect() {
  socket?.disconnect();
  socket = io({
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 700,
    reconnectionDelayMax: 3000,
    transports: ["websocket", "polling"],
  });
  socket.on("connect", () => {
    $("#connection").hidden = true;
    $("#network-status").textContent = "АРЕНА ОНЛАЙН";
    if (playing && reconnecting) {
      reconnecting = false;
      toast("Соединение восстановлено. Начинаем новый полёт.");
      join();
    }
  });
  socket.on("disconnect", () => {
    $("#network-status").textContent = "СЕТЬ ОТКЛЮЧЕНА";
    if (playing) {
      $("#connection").hidden = false;
      input.clear();
      reconnecting = true;
    }
  });
  socket.on("connect_error", (e) => {
    if (playing) $("#connection").hidden = false;
    else toast("Нет соединения с сервером: " + e.message);
  });
  socket.on("state", (s) => {
    renderer.state(s);
    if (!playing) return;
    const me = s.snakes.find((x) => x.id === s.you);
    if (
      me &&
      previousMass &&
      me.mass > previousMass &&
      performance.now() - lastPickup > 220
    ) {
      audio.play("pickup");
      lastPickup = performance.now();
    }
    if (me) previousMass = me.mass;
  });
  socket.on("death", (r) => {
    if (!playing) return;
    input.enabled = false;
    input.clear();
    audio.play("death");
    setProfile(r.profile);
    panels.death(r);
  });
}
function join() {
  socket
    .timeout(6000)
    .emit("join", { classId, mode: $("#mode").value }, (err, result) => {
      joining = false;
      $("#play").disabled = false;
      if (err || result?.error) {
        toast(result?.error || "Сервер не ответил. Попробуйте снова");
        leave();
        return;
      }
      playing = true;
      input.enabled = true;
      renderer.playing = true;
      renderer.current = null;
      renderer.previous = null;
      renderer.particles = [];
      renderer.seen.clear();
      previousMass = 0;
      $("#lobby").hidden = true;
      $("#hud").hidden = false;
      document.body.classList.add("playing");
      $("#room-label").textContent =
        result.room.toUpperCase() + " / " + MODES[$("#mode").value].name;
    });
}
async function play() {
  if (joining) return;
  joining = true;
  $("#play").disabled = true;
  try {
    audio.unlock();
    const first = $("#ability-first").value,
      second = $("#ability-second").value;
    if (first === second) throw Error("Выберите две разные способности");
    setProfile(
      await api(
        "profile",
        { name: $("#nickname").value, loadout: [first, second] },
        "PATCH",
      ),
    );
    if (!socket?.connected) throw Error("Дождитесь соединения с сервером");
    join();
  } catch (e) {
    joining = false;
    $("#play").disabled = false;
    toast(e.message);
  }
}
$("#class-picker").innerHTML = Object.entries(CLASSES)
  .map(
    ([id, c], i) =>
      `<button data-class="${id}" class="class-option ${i ? "" : "active"}"><span>${["↯", "⬡", "◇"][i]}</span>${c.name}</button>`,
  )
  .join("");
document.querySelectorAll("[data-class]").forEach(
  (b) =>
    (b.onclick = () => {
      classId = b.dataset.class;
      document
        .querySelectorAll("[data-class]")
        .forEach((v) => v.classList.toggle("active", v === b));
      $("#class-hint").textContent = CLASSES[classId].description;
    }),
);
for (const s of ["#ability-first", "#ability-second"])
  $(s).innerHTML = Object.entries(ABILITIES)
    .map(([id, a]) => `<option value="${id}">${a.icon} ${a.name}</option>`)
    .join("");
$("#mode").innerHTML = Object.entries(MODES)
  .map(([id, m]) => `<option value="${id}">${m.name}</option>`)
  .join("");
$("#play").onclick = play;
$("#settings-open").onclick = () => profile && panels.open("settings");
$("#garage-link").onclick = () => profile && panels.open("garage");
$("#pause").onclick = pause;
document
  .querySelectorAll("[data-panel]")
  .forEach((b) => (b.onclick = () => profile && panels.open(b.dataset.panel)));
$(".brand").onclick = (e) => {
  e.preventDefault();
  if (!$("#modal").hidden) panels.close();
};
window.addEventListener("account-changed", connect);
function hud(now) {
  const s = renderer.current;
  if (!s) return;
  const me = s.snakes.find((x) => x.id === s.you);
  if (me) {
    $("#mass").textContent = me.mass;
    $("#kills").textContent = me.kills;
    $("#energy-value").textContent = Math.floor(me.energy);
    $("#energy").value = me.energy;
    document.querySelectorAll(".ability-button").forEach((b, i) => {
      const cooldown = me.cooldowns[profile.loadout[i]] || 0;
      b.querySelector(".cooldown").hidden = cooldown <= 0;
      b.querySelector(".cooldown").textContent = Math.ceil(cooldown);
      b.style.opacity =
        me.energy < ABILITIES[profile.loadout[i]].cost ? ".55" : "1";
    });
  }
  $("#rank").textContent = "#" + s.rank;
  $("#survival").textContent =
    `${String(Math.floor(s.survival / 60)).padStart(2, "0")}:${String(s.survival % 60).padStart(2, "0")}`;
  $("#leaders").innerHTML = s.leaderboard
    .map(
      (l, i) =>
        `<li class="${l.id === s.you ? "me" : ""}"><span>${String(i + 1).padStart(2, "0")}</span><span>${esc(l.name)}</span><b>${l.mass}</b></li>`,
    )
    .join("");
  $("#event-banner").hidden = !s.event;
  if (s.event)
    $("#event-banner").textContent =
      s.event.title +
      " • " +
      Math.max(0, Math.ceil(s.event.ends - s.time)) +
      "с";
  $("#boss-bar").hidden = !s.boss;
  if (s.boss) {
    $("#boss-health").value = s.boss.hp;
    $("#boss-phase").textContent = s.boss.phase;
  }
  renderer.minimap($("#minimap"));
  $("#telemetry").textContent = `${Math.round(renderer.fps)} FPS / ${ping} MS`;
}
function frame(now) {
  renderer.frame(now);
  if (playing && now - lastHUD > 120) {
    hud(now);
    lastHUD = now;
  }
  if (socket?.connected && now - lastPing > 3000) {
    lastPing = now;
    socket.timeout(2000).emit("ping-check", (err) => {
      if (!err) ping = Math.round(performance.now() - now);
    });
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
setInterval(() => {
  if (playing && socket?.connected) {
    const me = renderer.current?.snakes.find(
      (s) => s.id === renderer.current.you,
    );
    if (me) {
      const zoom = renderer.camera.zoom;
      input.center = {
        x: innerWidth / 2 + (me.x - renderer.camera.x) * zoom,
        y: innerHeight / 2 + (me.y - renderer.camera.y) * zoom,
      };
    }
    socket.emit(
      "input",
      input.packet(
        Math.min(
          1800,
          Math.hypot(innerWidth, innerHeight) / (2 * renderer.camera.zoom) +
            140,
        ),
      ),
    );
  }
}, 1000 / 30);
async function boot() {
  try {
    setProfile(await api("guest", {}));
    connect();
  } catch (e) {
    toast("Не удалось подключиться: " + e.message);
    $("#play").disabled = true;
    setTimeout(boot, 3000);
  }
}
boot();
