export class SpatialGrid {
  constructor(size = 100) {
    this.size = size;
    this.cells = new Map();
  }
  clear() {
    this.cells.clear();
  }
  key(x, y) {
    return `${Math.floor(x / this.size)},${Math.floor(y / this.size)}`;
  }
  insert(item) {
    const k = this.key(item.x, item.y);
    let c = this.cells.get(k);
    if (!c) this.cells.set(k, (c = []));
    c.push(item);
  }
  query(x, y, r) {
    const out = [];
    for (
      let i = Math.floor((x - r) / this.size);
      i <= Math.floor((x + r) / this.size);
      i++
    )
      for (
        let j = Math.floor((y - r) / this.size);
        j <= Math.floor((y + r) / this.size);
        j++
      ) {
        const c = this.cells.get(`${i},${j}`);
        if (c)
          for (const v of c)
            if ((v.x - x) ** 2 + (v.y - y) ** 2 <= r * r) out.push(v);
      }
    return out;
  }
}
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const angleDelta = (a, b) =>
  Math.atan2(Math.sin(a - b), Math.cos(a - b));
export function segmentCircle(a, b, c, r) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    l = dx * dx + dy * dy;
  const t = l
    ? Math.max(0, Math.min(1, ((c.x - a.x) * dx + (c.y - a.y) * dy) / l))
    : 0;
  return Math.hypot(a.x + t * dx - c.x, a.y + t * dy - c.y) < r;
}
