export class Input {
  constructor(canvas, { ability, pause, board }) {
    this.angle = 0;
    this.boost = false;
    this.enabled = false;
    this.keys = { boost: "Space", first: "KeyQ", second: "KeyE" };
    this.sources = new Set();
    this.center = { x: innerWidth / 2, y: innerHeight / 2 };
    this.joyId = null;
    canvas.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "touch")
        this.angle = Math.atan2(
          e.clientY - this.center.y,
          e.clientX - this.center.x,
        );
    });
    canvas.addEventListener("pointerdown", (e) => {
      if (this.enabled && e.pointerType !== "touch" && e.button === 0) {
        canvas.setPointerCapture(e.pointerId);
        this.sources.add("mouse");
      }
    });
    const mouseUp = () => this.sources.delete("mouse");
    canvas.addEventListener("pointerup", mouseUp);
    canvas.addEventListener("pointercancel", mouseUp);
    window.addEventListener("keydown", (e) => {
      if (["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName)) return;
      if (e.code === "Escape") {
        pause();
        return;
      }
      if (!this.enabled) return;
      if (e.code === "Tab") {
        e.preventDefault();
        board(true);
        return;
      }
      if (e.repeat) return;
      if (e.code === this.keys.boost) {
        e.preventDefault();
        this.sources.add("key");
      }
      if (e.code === this.keys.first) ability(0);
      if (e.code === this.keys.second) ability(1);
    });
    window.addEventListener("keyup", (e) => {
      if (e.code === this.keys.boost) this.sources.delete("key");
      if (e.code === "Tab") board(false);
    });
    window.addEventListener("blur", () => this.clear());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.clear();
    });
    const stick = document.querySelector("#joystick"),
      knob = document.querySelector("#joystick-knob");
    const move = (e) => {
      if (e.pointerId !== this.joyId) return;
      const r = stick.getBoundingClientRect(),
        dx = e.clientX - r.left - r.width / 2,
        dy = e.clientY - r.top - r.height / 2,
        d = Math.hypot(dx, dy),
        m = Math.min(32, d);
      if (d > 6) this.angle = Math.atan2(dy, dx);
      knob.style.transform = `translate(${d ? (dx / d) * m : 0}px,${d ? (dy / d) * m : 0}px)`;
    };
    stick.addEventListener("pointerdown", (e) => {
      if (this.joyId !== null) return;
      this.joyId = e.pointerId;
      stick.setPointerCapture(e.pointerId);
      move(e);
    });
    stick.addEventListener("pointermove", move);
    const release = (e) => {
      if (e.pointerId !== this.joyId) return;
      this.joyId = null;
      knob.style.transform = "";
    };
    stick.addEventListener("pointerup", release);
    stick.addEventListener("pointercancel", release);
    const boost = document.querySelector("#touch-boost");
    boost.addEventListener("pointerdown", (e) => {
      boost.setPointerCapture(e.pointerId);
      this.sources.add("touch");
    });
    for (const type of ["pointerup", "pointercancel"])
      boost.addEventListener(type, () => this.sources.delete("touch"));
  }
  clear() {
    this.sources.clear();
    this.boost = false;
  }
  packet(view) {
    return {
      angle: this.angle,
      boost: this.enabled && this.sources.size > 0,
      view,
    };
  }
}
