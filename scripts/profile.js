import { World } from "../server/game/world.js";
const w = new World({ bots: 40 });
const samples = [];
for (let i = 0; i < 1800; i++) {
  const t = performance.now();
  w.tick(1 / 30);
  samples.push(performance.now() - t);
}
samples.sort((a, b) => a - b);
const snapshot = w.snapshot("bot-0");
console.log(
  JSON.stringify(
    {
      bots: 40,
      simulatedSeconds: 60,
      ticks: samples.length,
      meanTickMs: samples.reduce((a, b) => a + b) / samples.length,
      p95TickMs: samples[Math.floor(samples.length * 0.95)],
      maxTickMs: samples.at(-1),
      snapshotBytes: Buffer.byteLength(JSON.stringify(snapshot)),
      visibleFood: snapshot.food.length,
      visibleSnakes: snapshot.snakes.length,
    },
    null,
    2,
  ),
);
