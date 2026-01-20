import { CONFIG } from '../config.js';
import { Room } from '../utils/room.js';

export class LevelGenerator {
    constructor() {
        this.map = [];
        this.rooms = [];
    }

    generate() {
        // Initialize map with empty space
        this.map = Array.from({ length: CONFIG.MAP_HEIGHT }, () =>
            Array(CONFIG.MAP_WIDTH).fill(CONFIG.TILE.EMPTY)
        );
        this.rooms = [];

        for (let i = 0; i < CONFIG.MAX_ROOMS; i++) {
            const w = Math.floor(Math.random() * (CONFIG.ROOM_MAX_SIZE - CONFIG.ROOM_MIN_SIZE)) + CONFIG.ROOM_MIN_SIZE;
            const h = Math.floor(Math.random() * (CONFIG.ROOM_MAX_SIZE - CONFIG.ROOM_MIN_SIZE)) + CONFIG.ROOM_MIN_SIZE;
            const x = Math.floor(Math.random() * (CONFIG.MAP_WIDTH - w - 1)) + 1;
            const y = Math.floor(Math.random() * (CONFIG.MAP_HEIGHT - h - 1)) + 1;

            const newRoom = new Room(x, y, w, h);

            let failed = false;
            for (const otherRoom of this.rooms) {
                if (newRoom.intersects(otherRoom)) {
                    failed = true;
                    break;
                }
            }

            if (!failed) {
                this.createRoom(newRoom);

                if (this.rooms.length === 0) {
                    // Start player at first room center (handled by Game class)
                } else {
                    const prevCenter = this.rooms[this.rooms.length - 1].center();
                    const currCenter = newRoom.center();

                    if (Math.random() < 0.5) {
                        this.createHTunnel(prevCenter.x, currCenter.x, prevCenter.y);
                        this.createVTunnel(prevCenter.y, currCenter.y, currCenter.x);
                    } else {
                        this.createVTunnel(prevCenter.y, currCenter.y, prevCenter.x);
                        this.createHTunnel(prevCenter.x, currCenter.x, currCenter.y);
                    }
                }
                this.rooms.push(newRoom);
            }
        }

        this.generateWalls();

        return {
            map: this.map,
            rooms: this.rooms,
            playerStart: this.rooms.length > 0 ? this.rooms[0].center() : { x: 1, y: 1 }
        };
    }

    generateWalls() {
        for (let y = 0; y < CONFIG.MAP_HEIGHT; y++) {
            for (let x = 0; x < CONFIG.MAP_WIDTH; x++) {
                if (this.map[y][x] === CONFIG.TILE.EMPTY) {
                    if (this.hasAdjacentFloor(x, y)) {
                        this.map[y][x] = CONFIG.TILE.WALL;
                    }
                }
            }
        }
    }

    hasAdjacentFloor(x, y) {
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const ny = y + dy;
                const nx = x + dx;
                if (ny >= 0 && ny < CONFIG.MAP_HEIGHT && nx >= 0 && nx < CONFIG.MAP_WIDTH) {
                    if (this.map[ny][nx] === CONFIG.TILE.FLOOR) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    createRoom(room) {
        for (let y = room.y1 + 1; y < room.y2; y++) {
            for (let x = room.x1 + 1; x < room.x2; x++) {
                this.map[y][x] = CONFIG.TILE.FLOOR;
            }
        }
    }

    createHTunnel(x1, x2, y) {
        for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
            this.map[y][x] = CONFIG.TILE.FLOOR;
        }
    }

    createVTunnel(y1, y2, x) {
        for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
            this.map[y][x] = CONFIG.TILE.FLOOR;
        }
    }
}
