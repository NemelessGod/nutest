import { COLORS } from "../../../shared/catalog.js";
const lerp = (a, b, t) => a + (b - a) * t;
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.camera = { x: 2100, y: 2100, zoom: 1 };
    this.quality = "high";
    this.current = null;
    this.previous = null;
    this.received = 0;
    this.playing = false;
    this.particles = [];
    this.seen = new Set();
    this.lastFrame = performance.now();
    this.fps = 60;
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }
  resize() {
    this.w = innerWidth;
    this.h = innerHeight;
    this.dpr = Math.min(devicePixelRatio || 1, this.quality === "low" ? 1 : 2);
    this.canvas.width = this.w * this.dpr;
    this.canvas.height = this.h * this.dpr;
  }
  state(s) {
    const first = !this.current;
    this.previous = this.current;
    this.current = s;
    if (first) {
      const me = s.snakes.find((p) => p.id === s.you);
      if (me) {
        this.camera.x = me.x;
        this.camera.y = me.y;
      }
    }
    this.received = performance.now();
    for (const e of s.effects) {
      if (this.seen.has(e.id)) continue;
      this.seen.add(e.id);
      if (e.type === "death") {
        const n = this.quality === "high" ? 38 : 12;
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2;
          this.particles.push({
            x: e.x,
            y: e.y,
            vx: Math.cos(a) * (40 + Math.random() * 130),
            vy: Math.sin(a) * (40 + Math.random() * 130),
            life: 1.2,
            color: e.color,
            nova: e.style === "death-nova",
          });
        }
      }
    }
    if (this.seen.size > 500) this.seen = new Set(s.effects.map((e) => e.id));
  }
  frame(now) {
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.fps = lerp(this.fps, 1 / Math.max(0.001, dt), 0.05);
    const c = this.ctx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.fillStyle = "#080d17";
    c.fillRect(0, 0, this.w, this.h);
    if (!this.playing || !this.current) {
      this.lobby(now / 1000);
      return;
    }
    const state = this.current,
      me = state.snakes.find((s) => s.id === state.you);
    const alpha = Math.min(1, (now - this.received) / 65);
    if (me) {
      this.camera.x = lerp(this.camera.x, me.x, 1 - Math.exp(-dt * 7));
      this.camera.y = lerp(this.camera.y, me.y, 1 - Math.exp(-dt * 7));
      const zoom = Math.max(
        0.48,
        Math.min(1.25, (this.w < 700 ? 0.85 : 1.12) - me.mass / 5500),
      );
      this.camera.zoom = lerp(this.camera.zoom, zoom, dt * 3);
    }
    const { x, y, zoom } = this.camera;
    c.save();
    c.translate(this.w / 2, this.h / 2);
    c.scale(zoom, zoom);
    c.translate(-x, -y);
    this.grid(c, x, y, zoom);
    c.strokeStyle = "#4df5dc55";
    c.lineWidth = 5;
    c.strokeRect(0, 0, state.size, state.size);
    c.fillStyle = "#121023";
    for (const wall of state.walls) {
      const g = c.createRadialGradient(
        wall.x,
        wall.y,
        0,
        wall.x,
        wall.y,
        wall.r,
      );
      g.addColorStop(0, "#27314b");
      g.addColorStop(1, "#121a2b");
      c.fillStyle = g;
      c.beginPath();
      c.arc(wall.x, wall.y, wall.r, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "#a78bfa88";
      c.lineWidth = 2;
      c.stroke();
      c.beginPath();
      c.arc(wall.x, wall.y, wall.r - 10, 0, Math.PI * 2);
      c.strokeStyle = "#a78bfa33";
      c.stroke();
    }
    const event = state.event;
    if (event?.type === "gold")
      this.zone(c, event.x, event.y, event.r, "#ffca6b", now);
    if (event?.type === "storm")
      for (const z of event.zones)
        this.zone(c, z.x, z.y, z.r, "#ff69c4", now, true);
    const margin = 40;
    const hw = this.w / zoom / 2 + margin,
      hh = this.h / zoom / 2 + margin;
    for (const f of state.food) {
      if (Math.abs(f.x - x) > hw || Math.abs(f.y - y) > hh) continue;
      const r = 2 + Math.min(5, Math.sqrt(f.value));
      if (this.quality === "high") {
        c.fillStyle = f.color + "13";
        c.beginPath();
        c.arc(f.x, f.y, r * 3, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = f.color;
      c.beginPath();
      c.arc(f.x, f.y, r, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#ffffffbb";
      c.beginPath();
      c.arc(f.x - 1, f.y - 1, r * 0.3, 0, Math.PI * 2);
      c.fill();
    }
    const prior = new Map(this.previous?.snakes.map((s) => [s.id, s]) || []);
    for (const s of state.snakes) {
      const p = prior.get(s.id);
      const body = s.body.map((b, i) =>
        p?.body[i]
          ? {
              x: lerp(p.body[i].x, b.x, alpha),
              y: lerp(p.body[i].y, b.y, alpha),
            }
          : b,
      );
      this.snake(
        c,
        { ...s, x: body[0].x, y: body[0].y, body },
        now / 1000,
        s.id === state.you,
      );
    }
    for (const e of state.effects)
      if (e.type !== "death") {
        const age = state.time - e.time;
        const r =
          (e.type === "pulse" ? 170 : e.type === "magnet" ? 160 : 50) *
          Math.min(1, age * 2 + 0.2);
        c.globalAlpha = Math.max(0, 1 - age);
        c.strokeStyle = e.color;
        c.lineWidth = 2;
        c.beginPath();
        c.arc(e.x, e.y, r, 0, Math.PI * 2);
        c.stroke();
        c.globalAlpha = 1;
      }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      c.globalAlpha = Math.max(0, p.life / 1.2);
      c.fillStyle = p.color;
      c.fillRect(p.x, p.y, p.nova ? 7 : 3, p.nova ? 7 : 3);
    }
    c.globalAlpha = 1;
    c.restore();
  }
  grid(c, x, y, zoom) {
    const left = x - this.w / zoom / 2,
      right = x + this.w / zoom / 2,
      top = y - this.h / zoom / 2,
      bottom = y + this.h / zoom / 2;
    c.lineWidth = 0.6 / zoom;
    c.strokeStyle = "#2c40551c";
    c.beginPath();
    for (let i = Math.floor(left / 70) * 70; i < right; i += 70) {
      c.moveTo(i, top);
      c.lineTo(i, bottom);
    }
    for (let i = Math.floor(top / 70) * 70; i < bottom; i += 70) {
      c.moveTo(left, i);
      c.lineTo(right, i);
    }
    c.stroke();
    c.fillStyle = "#34526930";
    for (let i = Math.floor(left / 280) * 280; i < right; i += 280)
      for (let j = Math.floor(top / 280) * 280; j < bottom; j += 280)
        c.fillRect(i - 1, j - 1, 2, 2);
  }
  snake(c, s, time, own = false) {
    if (!s.body.length) return;
    const r = s.radius;
    const ghost = s.active?.ghost > 0;
    const phantom = s.classId === "phantom";
    c.save();
    c.globalAlpha = ghost ? 0.35 : phantom && s.boosting ? 0.72 : 1;
    c.lineCap = "round";
    c.lineJoin = "round";
    const path = () => {
      c.beginPath();
      s.body.forEach((p, i) => {
        const wave =
          s.cosmetics?.motion === "motion-wave"
            ? Math.sin(time * 5 + i * 0.35) * 2
            : 0;
        if (i === 0) c.moveTo(p.x, p.y);
        else c.lineTo(p.x + wave, p.y - wave);
      });
    };
    if (this.quality === "high") {
      path();
      c.strokeStyle = s.color + "15";
      c.lineWidth = r * 3.9;
      c.stroke();
      path();
      c.strokeStyle = s.color + "22";
      c.lineWidth = r * 2.9;
      c.stroke();
    }
    path();
    c.strokeStyle = s.color;
    c.lineWidth = r * 2;
    c.stroke();
    path();
    c.strokeStyle = "#07162166";
    c.lineWidth = r * 1.4;
    c.stroke();
    for (let i = s.body.length - 1; i > 0; i -= 2) {
      const p = s.body[i];
      c.fillStyle = i % 4 === 0 ? s.color + "99" : s.color + "55";
      c.beginPath();
      c.arc(p.x, p.y, r * 0.75, 0, Math.PI * 2);
      c.fill();
    }
    if (s.boosting) {
      c.globalAlpha = 0.5;
      for (let i = 1; i < 8; i++) {
        const p = s.body[s.body.length - i * 2];
        if (!p) continue;
        c.fillStyle = s.color;
        c.beginPath();
        c.arc(
          p.x + Math.sin(time * 15 + i) * 12,
          p.y + Math.cos(time * 15 + i) * 12,
          Math.max(1, 4 - i * 0.4),
          0,
          Math.PI * 2,
        );
        c.fill();
      }
      c.globalAlpha = ghost ? 0.35 : 1;
    }
    if (s.cosmetics?.trail === "trail-stars") {
      const p = s.body.at(-1);
      for (let i = 0; i < 6; i++) {
        c.fillStyle = s.color + "99";
        c.fillRect(
          p.x + Math.cos(time + i * 2) * 18,
          p.y + Math.sin(time + i * 2) * 18,
          3,
          3,
        );
      }
    }
    c.translate(s.x, s.y);
    c.rotate(s.angle);
    c.fillStyle = s.color;
    c.beginPath();
    c.ellipse(0, 0, r * 1.2, r, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#07101d";
    for (const sign of [-1, 1]) {
      c.beginPath();
      c.ellipse(r * 0.3, sign * r * 0.5, r * 0.29, r * 0.22, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#fff";
      c.beginPath();
      c.arc(r * 0.43, sign * r * 0.5, r * 0.1, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#07101d";
    }
    if (s.cosmetics?.head === "head-crown") {
      c.fillStyle = "#ffca6b";
      c.beginPath();
      c.moveTo(-r, -r);
      c.lineTo(-r * 1.4, -r * 1.9);
      c.lineTo(-r * 0.3, -r * 1.3);
      c.lineTo(0, -r * 2.2);
      c.lineTo(r * 0.6, -r * 1.2);
      c.lineTo(r, -r * 1.7);
      c.lineTo(r, -r);
      c.fill();
    }
    c.rotate(-s.angle);
    if (s.active?.shield > 0) {
      c.strokeStyle = "#b8f4ff";
      c.lineWidth = 2;
      c.beginPath();
      c.arc(0, 0, r + 9, 0, Math.PI * 2);
      c.stroke();
    }
    if (s.active?.magnet > 0) {
      c.strokeStyle = s.color + "88";
      c.setLineDash([8, 8]);
      c.beginPath();
      c.arc(0, 0, 42 + Math.sin(time * 5) * 4, 0, Math.PI * 2);
      c.stroke();
      c.setLineDash([]);
    }
    c.globalAlpha = 1;
    if (this.playing) {
      c.textAlign = "center";
      c.font = "10px system-ui";
      c.fillStyle = own ? "#fff" : "#a9bfd7";
      c.fillText(s.name, 0, -r - 17);
      if (own) {
        c.fillStyle = s.color;
        c.beginPath();
        c.moveTo(-4, -r - 30);
        c.lineTo(4, -r - 30);
        c.lineTo(0, -r - 25);
        c.fill();
      }
    }
    c.restore();
  }
  zone(c, x, y, r, color, now, storm = false) {
    c.fillStyle = color + "0d";
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = color + "55";
    c.lineWidth = 2;
    c.setLineDash([10, 10]);
    c.stroke();
    c.setLineDash([]);
    if (storm) {
      c.strokeStyle = color + "99";
      c.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = i * 0.64 + now * 0.0002;
        const px = x + Math.cos(a) * r * 0.75,
          py = y + Math.sin(a) * r * 0.75;
        i ? c.lineTo(px, py) : c.moveTo(px, py);
      }
      c.stroke();
    }
  }
  lobby(t) {
    const c = this.ctx;
    this.grid(c, this.w / 2, this.h / 2, 1);
    const baseX = this.w * 0.73,
      baseY = this.h * 0.45;
    const scale = Math.min(this.w / 1400, this.h / 900);
    c.save();
    c.translate(baseX, baseY);
    c.scale(scale, scale);
    const halo = c.createRadialGradient(0, 0, 0, 0, 0, 450);
    halo.addColorStop(0, "#13423c50");
    halo.addColorStop(0.6, "#15313f18");
    halo.addColorStop(1, "#080d1700");
    c.fillStyle = halo;
    c.fillRect(-500, -500, 1000, 1000);
    for (let i = 0; i < 100; i++) {
      const px = Math.sin(i * 123.43) * 470,
        py = Math.cos(i * 67.13) * 390;
      c.fillStyle = COLORS[i % 6] + (i % 3 ? "77" : "cc");
      c.beginPath();
      c.arc(
        px,
        py,
        1.5 + Math.sin(t + i) * 0.5 + (i % 4 === 0 ? 2 : 0),
        0,
        Math.PI * 2,
      );
      c.fill();
    }
    c.strokeStyle = "#4df5dc0b";
    c.lineWidth = 1;
    for (const r of [150, 275, 390]) {
      c.beginPath();
      c.arc(0, 0, r, 0, Math.PI * 2);
      c.stroke();
    }
    const body = [];
    for (let i = 0; i < 115; i++) {
      const a = i * 0.053 + t * 0.09;
      const r = 180 + Math.sin(i * 0.035 + t * 0.2) * 60;
      body.push({ x: Math.cos(a) * r, y: Math.sin(a) * r * 0.8 });
    }
    const head = body[0],
      next = body[1];
    this.snake(
      c,
      {
        x: head.x,
        y: head.y,
        angle: Math.atan2(head.y - next.y, head.x - next.x),
        radius: 18,
        color: "#4df5dc",
        body,
        active: {},
        cosmetics: {},
        name: "",
      },
      t,
    );
    const other = [];
    for (let i = 0; i < 60; i++) {
      const a = i * 0.032 + t * 0.14 + 2.1;
      other.push({ x: Math.cos(a) * 310 + 80, y: Math.sin(a) * 280 - 30 });
    }
    this.snake(
      c,
      {
        ...other[0],
        angle: Math.atan2(other[0].y - other[1].y, other[0].x - other[1].x),
        radius: 10,
        color: "#a78bfa",
        body: other,
        active: {},
        cosmetics: {},
        name: "",
      },
      t,
    );
    c.restore();
  }
  minimap(canvas) {
    if (!this.current) return;
    const c = canvas.getContext("2d"),
      s = this.current,
      size = canvas.width;
    c.clearRect(0, 0, size, size);
    c.fillStyle = "#0c1624";
    c.fillRect(0, 0, size, size);
    c.strokeStyle = "#2a3d54";
    c.strokeRect(5, 5, size - 10, size - 10);
    for (const w of s.walls) {
      c.fillStyle = "#697398";
      c.beginPath();
      c.arc(
        (w.x / s.size) * size,
        (w.y / s.size) * size,
        (w.r / s.size) * size,
        0,
        Math.PI * 2,
      );
      c.fill();
    }
    for (const p of s.minimap) {
      c.fillStyle = p.id === s.you ? "#4df5dc" : p.boss ? "#ffca6b" : "#60798f";
      c.beginPath();
      c.arc(
        (p.x / s.size) * size,
        (p.y / s.size) * size,
        p.id === s.you ? 3 : 1.5,
        0,
        Math.PI * 2,
      );
      c.fill();
    }
  }
}
