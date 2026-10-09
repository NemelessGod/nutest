import type { Settings } from "../engine/types";
export class Sound {
  private ctx: AudioContext | null = null;
  private active = 0;
  private music: OscillatorNode | null = null;
  private musicGain: GainNode | null = null;
  constructor(public settings: Settings) {}
  unlock() {
    this.ctx ??= new AudioContext();
    void this.ctx.resume();
    this.startMusic();
  }
  private startMusic() {
    if (!this.ctx || this.music) return;
    const o = this.ctx.createOscillator(),
      g = this.ctx.createGain();
    o.type = "sine";
    o.frequency.value = 55;
    g.gain.value = this.settings.master * this.settings.music * 0.016;
    o.connect(g).connect(this.ctx.destination);
    o.start();
    this.music = o;
    this.musicGain = g;
  }
  update(settings: Settings) {
    this.settings = settings;
    if (this.musicGain && this.ctx)
      this.musicGain.gain.setTargetAtTime(
        settings.master * settings.music * 0.016,
        this.ctx.currentTime,
        0.1,
      );
  }
  play(type: string) {
    if (!this.ctx || this.active >= 12 || !this.settings.master) return;
    this.active++;
    const ctx = this.ctx,
      o = ctx.createOscillator(),
      g = ctx.createGain();
    const tones: Record<string, number> = {
      select: 500,
      score: 640,
      mult: 900,
      rare: 1200,
      evolve: 1500,
      curse: 95,
      booster: 300,
      buy: 760,
      sell: 420,
      win: 1040,
      lose: 160,
      boss: 65,
      ui: 420,
    };
    const frequency = tones[type] || 440;
    o.type = type === "curse" || type === "boss" ? "triangle" : "sine";
    o.frequency.setValueAtTime(frequency, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(
      type === "lose" ? 60 : frequency * 1.5,
      ctx.currentTime + 0.17,
    );
    g.gain.setValueAtTime(
      this.settings.master *
        (type === "ui" || type === "select"
          ? this.settings.ui
          : this.settings.sfx) *
        0.07,
      ctx.currentTime,
    );
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.23);
    o.connect(g).connect(ctx.destination);
    o.onended = () => {
      this.active--;
      o.disconnect();
      g.disconnect();
    };
    o.start();
    o.stop(ctx.currentTime + 0.25);
  }
}
