export class Synth {
  constructor() {
    this.enabled = true;
    this.context = null;
  }
  unlock() {
    if (!this.enabled) return;
    this.context ??= new (window.AudioContext || window.webkitAudioContext)();
    this.context.resume();
  }
  play(type) {
    if (!this.enabled || !this.context) return;
    const c = this.context,
      o = c.createOscillator(),
      g = c.createGain();
    o.type = type === "death" ? "sawtooth" : "sine";
    const start = type === "death" ? 180 : type === "pickup" ? 720 : 480;
    o.frequency.setValueAtTime(start, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(
      type === "death" ? 35 : start * 1.5,
      c.currentTime + 0.13,
    );
    g.gain.setValueAtTime(0.035, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.18);
    o.connect(g).connect(c.destination);
    o.start();
    o.stop(c.currentTime + 0.2);
  }
}
