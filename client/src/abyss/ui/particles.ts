import type { Settings } from "../engine/types";
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
  kind: string;
}
export class Particles {
  private ctx: CanvasRenderingContext2D;
  private pool: Particle[] = [];
  private previous = 0;
  public fps = 60;
  constructor(
    private canvas: HTMLCanvasElement,
    public settings: Settings,
  ) {
    this.ctx = canvas.getContext("2d")!;
    this.resize();
    addEventListener("resize", () => this.resize());
    requestAnimationFrame((t) => this.frame(t));
  }
  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = innerWidth * dpr;
    this.canvas.height = innerHeight * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  burst(x: number, y: number, kind = "spark", color = "#f5ca73") {
    if (!this.settings.effects) return;
    const n = matchMedia("(pointer:coarse)").matches ? 12 : 30;
    for (let i = 0; i < n && this.pool.length < 180; i++) {
      const a = Math.random() * Math.PI * 2,
        s = 30 + Math.random() * 180;
      this.pool.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.6 + Math.random() * 0.5,
        max: 1.1,
        color,
        size: kind === "smoke" ? 12 : 2 + Math.random() * 4,
        kind,
      });
    }
  }
  private frame(t: number) {
    const dt = Math.min(0.05, (t - this.previous) / 1000);
    this.previous = t;
    this.fps = this.fps * 0.95 + (1 / Math.max(0.001, dt)) * 0.05;
    this.ctx.clearRect(0, 0, innerWidth, innerHeight);
    this.pool = this.pool.filter((p) => p.life > 0);
    for (const p of this.pool) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.kind === "coin" ? 180 : 0;
      this.ctx.globalAlpha = Math.max(0, p.life / p.max);
      this.ctx.fillStyle = p.color;
      if (p.kind === "wave") {
        this.ctx.strokeStyle = p.color;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, 30 * (1 - p.life / p.max), 0, Math.PI * 2);
        this.ctx.stroke();
      } else {
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
    this.ctx.globalAlpha = 1;
    requestAnimationFrame((time) => this.frame(time));
  }
}
