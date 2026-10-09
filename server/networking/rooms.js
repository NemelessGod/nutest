import { World } from "../game/world.js";
export class Rooms {
  constructor(options) {
    this.options = options;
    this.rooms = new Map();
    this.serial = 0;
  }
  acquire(mode = "classic") {
    for (const room of this.rooms.values())
      if (room.world.mode === mode && room.clients.size < this.options.capacity)
        return room;
    const room = {
      id: `arena-${++this.serial}`,
      clients: new Set(),
      world: new World({ ...this.options, mode }),
    };
    this.rooms.set(room.id, room);
    return room;
  }
  tick(dt) {
    for (const room of this.rooms.values()) room.world.tick(dt);
  }
  cleanup() {
    for (const [id, room] of this.rooms)
      if (!room.clients.size && this.rooms.size > 1) this.rooms.delete(id);
  }
}
