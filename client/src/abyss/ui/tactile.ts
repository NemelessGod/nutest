import type { Run, Settings } from "../engine/types";
import { Sound } from "../audio/sound";

// Visual presentation never awaits or mutates the simulation. The next action cancels
// outstanding effects; all four speeds therefore produce exactly the same save.
export class Tactile {
  private timers: ReturnType<typeof setTimeout>[] = [];
  private nodes: HTMLElement[] = [];
  capture() {
    return Array.from(
      document.querySelectorAll<HTMLElement>(
        "#app [data-card],#app [data-joker]",
      ),
    ).map((node) => ({
      node: node.cloneNode(true) as HTMLElement,
      id: node.dataset.card || node.dataset.joker!,
      rect: node.getBoundingClientRect(),
    }));
  }
  clear() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.nodes.forEach((n) => n.remove());
    this.nodes = [];
  }
  present(
    before: Run,
    after: Run,
    snapshot: ReturnType<Tactile["capture"]>,
    settings: Settings,
    sound: Sound,
  ) {
    this.clear();
    if (
      !settings.effects ||
      settings.animation === "instant" ||
      matchMedia("(prefers-reduced-motion:reduce)").matches
    )
      return;
    const duration = { normal: 380, fast: 180, veryfast: 75 }[
      settings.animation
    ];
    const vanished = snapshot
      .filter(
        (item) =>
          !after.hand.includes(item.id) &&
          !after.jokers.some((j) => j.id === item.id),
      )
      .slice(0, 10);
    for (const item of vanished) {
      const ghost = item.node;
      ghost.classList.add("effect-ghost");
      Object.assign(ghost.style, {
        position: "fixed",
        left: item.rect.x + "px",
        top: item.rect.y + "px",
        width: item.rect.width + "px",
        height: item.rect.height + "px",
        margin: "0",
        pointerEvents: "none",
        zIndex: "31",
      });
      document.body.append(ghost);
      this.nodes.push(ghost);
      const destroyed =
        before.deck.some((c) => c.id === item.id) &&
        !after.deck.some((c) => c.id === item.id);
      const animation = ghost.animate(
        [
          { transform: "rotate(0deg)", opacity: 1 },
          {
            transform: destroyed
              ? "scale(.3) rotate(28deg)"
              : "translate(45px,-80px) rotate(10deg) scale(.6)",
            opacity: 0,
          },
        ],
        { duration, easing: "ease-in", fill: "forwards" },
      );
      void animation.finished
        .then(() => ghost.remove())
        .catch(() => ghost.remove());
    }
    for (const node of document.querySelectorAll<HTMLElement>(
      "#app [data-card],#app [data-joker]",
    )) {
      const id = node.dataset.card || node.dataset.joker!;
      const old = snapshot.find((s) => s.id === id);
      const rect = node.getBoundingClientRect();
      const changed =
        before.deck.find((c) => c.id === id) &&
        JSON.stringify(before.deck.find((c) => c.id === id)) !==
          JSON.stringify(after.deck.find((c) => c.id === id));
      if (changed) {
        node.animate(
          [
            { transform: "rotateY(0deg)" },
            { transform: "rotateY(90deg)", filter: "brightness(1.8)" },
            { transform: "rotateY(0deg)" },
          ],
          { duration, easing: "ease-out" },
        );
      } else if (old && Math.abs(old.rect.x - rect.x) > 2) {
        node.animate(
          [
            { transform: `translateX(${old.rect.x - rect.x}px) rotate(-3deg)` },
            { transform: "translateX(0) rotate(0)" },
          ],
          { duration, easing: "cubic-bezier(.2,.9,.2,1.15)" },
        );
      } else if (!old) {
        node.animate(
          [
            {
              transform: "translate(30px,-35px) rotate(8deg) scale(.85)",
              opacity: 0,
            },
            { transform: "translate(0,0) rotate(0) scale(1)", opacity: 1 },
          ],
          { duration, easing: "cubic-bezier(.2,.9,.2,1.15)" },
        );
      }
    }
    if (after.stats.plays > before.stats.plays && after.lastScore) {
      const box = document.createElement("div");
      box.className = "score-ticker";
      box.setAttribute("aria-hidden", "true");
      document.body.append(box);
      this.nodes.push(box);
      const lines = after.lastScore.lines
        .filter((l) => !["Комбинация", "Уровень", "Итог"].includes(l.stage))
        .slice(-12);
      const step = duration / 4;
      lines.forEach((line, i) =>
        this.timers.push(
          setTimeout(() => {
            box.textContent = line.source + " · " + line.operation;
            sound.play(
              line.operation.startsWith("×")
                ? "mult"
                : line.stage === "Проклятие"
                  ? "curse"
                  : "score",
            );
          }, i * step),
        ),
      );
      this.timers.push(
        setTimeout(() => box.remove(), lines.length * step + duration),
      );
    }
  }
}
