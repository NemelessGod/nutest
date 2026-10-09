import { angleDelta, distance, segmentCircle } from "../game/spatial.js";
export const PERSONALITIES = [
  "novice",
  "farmer",
  "hunter",
  "aggressor",
  "tactician",
  "survivor",
];
export function decide(bot, world, dt) {
  bot.think -= dt;
  if (bot.think > 0) return;
  bot.think =
    ({
      novice: 0.45,
      farmer: 0.28,
      hunter: 0.18,
      aggressor: 0.13,
      tactician: 0.2,
      survivor: 0.11,
    }[bot.personality] || 0.2) +
    world.random() * 0.1;
  const heads = [...world.snakes.values()].filter(
    (s) => s.alive && s.id !== bot.id && distance(s, bot) < 600,
  );
  const aggressive = ["hunter", "aggressor", "tactician"].includes(
    bot.personality,
  );
  const prey = heads
    .filter((s) => !s.boss && s.mass < bot.mass * 1.2)
    .sort((a, b) => distance(bot, a) - distance(bot, b))[0];
  let target;
  if (aggressive && prey) {
    const lead =
      bot.personality === "tactician"
        ? 1.3
        : bot.personality === "aggressor"
          ? 1
          : 0.45;
    target = {
      x: prey.x + Math.cos(prey.angle) * 150 * lead,
      y: prey.y + Math.sin(prey.angle) * 150 * lead,
    };
  } else {
    const food = world.foodGrid.query(bot.x, bot.y, 600);
    target = food.sort(
      (a, b) => distance(bot, a) / a.value - distance(bot, b) / b.value,
    )[0];
  }
  if (!target)
    target = {
      x: world.size / 2 + Math.cos(world.time * 0.1 + bot.seed) * 800,
      y: world.size / 2 + Math.sin(world.time * 0.1 + bot.seed) * 800,
    };
  const desired = Math.atan2(target.y - bot.y, target.x - bot.x);
  let best = desired,
    bestScore = -Infinity;
  const bodies = world.bodyGrid.query(bot.x, bot.y, 210);
  for (let i = -4; i <= 4; i++) {
    const angle = bot.angle + i * 0.55;
    const end = {
      x: bot.x + Math.cos(angle) * 150,
      y: bot.y + Math.sin(angle) * 150,
    };
    let score = 4 - Math.abs(angleDelta(angle, desired)) * 2;
    if (
      end.x < 65 ||
      end.y < 65 ||
      end.x > world.size - 65 ||
      end.y > world.size - 65
    )
      score -= 40;
    for (const wall of world.walls)
      if (segmentCircle(bot, end, wall, wall.r + bot.radius + 25)) score -= 30;
    for (const p of bodies) {
      if (p.id === bot.id && p.index < 12) continue;
      if (segmentCircle(bot, end, p, bot.radius + p.r + 15))
        score -= bot.personality === "novice" ? 8 : 28;
    }
    for (const h of heads)
      if (
        distance(end, h) <
        (bot.personality === "survivor"
          ? 160
          : bot.personality === "farmer"
            ? 110
            : 65)
      )
        score -= aggressive ? 6 : bot.personality === "survivor" ? 25 : 15;
    if (world.event?.type === "storm")
      for (const z of world.event.zones)
        if (distance(end, z) < z.r + 50) score -= 30;
    if (score > bestScore) {
      bestScore = score;
      best = angle;
    }
  }
  if (bot.personality === "novice" && world.random() < 0.08)
    best += world.random() - 0.5;
  bot.input.angle = best;
  bot.input.boost =
    bot.energy > 45 &&
    bot.mass > 45 &&
    ((aggressive &&
      prey &&
      distance(bot, prey) < (bot.personality === "aggressor" ? 450 : 250)) ||
      (bot.personality === "survivor" && bestScore < 1) ||
      bestScore < 0);
  if (bestScore < 0)
    world.useAbility(bot, bot.classId === "phantom" ? "ghost" : "shield");
  else if (prey && distance(bot, prey) < 130) world.useAbility(bot, "pulse");
  else if (world.foodGrid.query(bot.x, bot.y, 130).length > 9)
    world.useAbility(bot, "magnet");
}
