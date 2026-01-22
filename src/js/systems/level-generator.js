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

                    // Choose a random hallway style
                    this.createHallway(prevCenter, currCenter);
                }
                this.rooms.push(newRoom);
            }
        }

        if (this.rooms.length > 0) {
            const lastRoom = this.rooms[this.rooms.length - 1];
            const center = lastRoom.center();
            this.map[center.y][center.x] = CONFIG.TILE.ELEVATOR;
        }

        const enemies = [];
        // Spawn enemies in rooms (skipping first room)
        for (let i = 1; i < this.rooms.length; i++) {
            const room = this.rooms[i];
            const numEnemies = Math.floor(Math.random() * 2) + 1; // 1-2 enemies
            for (let j = 0; j < numEnemies; j++) {
                const ex = Math.floor(Math.random() * (room.w - 2)) + room.x1 + 1;
                const ey = Math.floor(Math.random() * (room.h - 2)) + room.y1 + 1;

                if (ey >= 0 && ey < CONFIG.MAP_HEIGHT && ex >= 0 && ex < CONFIG.MAP_WIDTH) {
                    if (this.map[ey][ex] === CONFIG.TILE.FLOOR) { // Ensure floor
                        const type = Math.random() < 0.6 ? CONFIG.TILE.ENEMY_MELEE : CONFIG.TILE.ENEMY_RANGED;
                        enemies.push({ x: ex, y: ey, type: type });
                    }
                }
            }
        }

        // Spawn ammo pickups
        const pickups = [];
        for (let i = 0; i < this.rooms.length; i++) {
            const room = this.rooms[i];
            // 40% chance to spawn ammo in each room
            if (Math.random() < 0.4) {
                const ax = Math.floor(Math.random() * (room.w - 2)) + room.x1 + 1;
                const ay = Math.floor(Math.random() * (room.h - 2)) + room.y1 + 1;

                if (ay >= 0 && ay < CONFIG.MAP_HEIGHT && ax >= 0 && ax < CONFIG.MAP_WIDTH) {
                    if (this.map[ay][ax] === CONFIG.TILE.FLOOR) {
                        // Random ammo amount 3-8
                        const amount = Math.floor(Math.random() * 6) + 3;
                        pickups.push({ x: ax, y: ay, type: '9mm', amount: amount });
                    }
                }
            }
        }

        this.generateWalls();

        return {
            map: this.map,
            rooms: this.rooms,
            enemies: enemies,
            pickups: pickups,
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

    /**
     * Create a hallway between two points with random variation
     */
    createHallway(from, to) {
        const style = Math.random();

        if (style < 0.25) {
            // Basic L-shaped corridor
            this.createBasicLCorridor(from, to);
        } else if (style < 0.45) {
            // Wide corridor (2-3 tiles)
            this.createWideCorridor(from, to);
        } else if (style < 0.65) {
            // Zigzag corridor
            this.createZigzagCorridor(from, to);
        } else if (style < 0.85) {
            // Winding organic corridor
            this.createWindingCorridor(from, to);
        } else {
            // Corridor with alcoves
            this.createCorridorWithAlcoves(from, to);
        }
    }

    /**
     * Basic L-shaped corridor (original style)
     */
    createBasicLCorridor(from, to) {
        if (Math.random() < 0.5) {
            this.createHTunnel(from.x, to.x, from.y, 1);
            this.createVTunnel(from.y, to.y, to.x, 1);
        } else {
            this.createVTunnel(from.y, to.y, from.x, 1);
            this.createHTunnel(from.x, to.x, to.y, 1);
        }
    }

    /**
     * Wide corridor (2-3 tiles wide)
     */
    createWideCorridor(from, to) {
        const width = Math.random() < 0.5 ? 2 : 3;

        if (Math.random() < 0.5) {
            this.createHTunnel(from.x, to.x, from.y, width);
            this.createVTunnel(from.y, to.y, to.x, width);
        } else {
            this.createVTunnel(from.y, to.y, from.x, width);
            this.createHTunnel(from.x, to.x, to.y, width);
        }
    }

    /**
     * Zigzag corridor with multiple turns
     */
    createZigzagCorridor(from, to) {
        const numSegments = 3 + Math.floor(Math.random() * 3); // 3-5 segments
        const dx = to.x - from.x;
        const dy = to.y - from.y;

        let currentX = from.x;
        let currentY = from.y;
        let horizontal = Math.random() < 0.5;

        for (let i = 0; i < numSegments; i++) {
            const isLast = i === numSegments - 1;
            const progress = (i + 1) / numSegments;

            if (horizontal) {
                const targetX = isLast ? to.x : from.x + Math.floor(dx * progress) + Math.floor((Math.random() - 0.5) * 4);
                const clampedX = Math.max(1, Math.min(CONFIG.MAP_WIDTH - 2, targetX));
                this.createHTunnel(currentX, clampedX, currentY, 1);
                currentX = clampedX;
            } else {
                const targetY = isLast ? to.y : from.y + Math.floor(dy * progress) + Math.floor((Math.random() - 0.5) * 4);
                const clampedY = Math.max(1, Math.min(CONFIG.MAP_HEIGHT - 2, targetY));
                this.createVTunnel(currentY, clampedY, currentX, 1);
                currentY = clampedY;
            }
            horizontal = !horizontal;
        }

        // Ensure we connect to the destination
        this.createHTunnel(currentX, to.x, currentY, 1);
        this.createVTunnel(currentY, to.y, to.x, 1);
    }

    /**
     * Winding organic corridor with gradual curves
     */
    createWindingCorridor(from, to) {
        let x = from.x;
        let y = from.y;
        const maxIterations = 200;
        let iterations = 0;

        while ((x !== to.x || y !== to.y) && iterations < maxIterations) {
            iterations++;
            this.setFloor(x, y);

            // Add some randomness to the path
            const towardsX = to.x > x ? 1 : (to.x < x ? -1 : 0);
            const towardsY = to.y > y ? 1 : (to.y < y ? -1 : 0);

            // 70% chance to move towards target, 30% chance to wander
            if (Math.random() < 0.7) {
                // Move towards target
                if (Math.random() < 0.5 && towardsX !== 0) {
                    x += towardsX;
                } else if (towardsY !== 0) {
                    y += towardsY;
                } else if (towardsX !== 0) {
                    x += towardsX;
                }
            } else {
                // Random wander (but stay within bounds and towards target)
                const wanderDir = Math.floor(Math.random() * 4);
                switch (wanderDir) {
                    case 0: if (x < CONFIG.MAP_WIDTH - 2) x++; break;
                    case 1: if (x > 1) x--; break;
                    case 2: if (y < CONFIG.MAP_HEIGHT - 2) y++; break;
                    case 3: if (y > 1) y--; break;
                }
            }

            // Sometimes widen the corridor
            if (Math.random() < 0.3) {
                const widthDir = Math.floor(Math.random() * 4);
                const wx = x + (widthDir === 0 ? 1 : widthDir === 1 ? -1 : 0);
                const wy = y + (widthDir === 2 ? 1 : widthDir === 3 ? -1 : 0);
                this.setFloor(wx, wy);
            }
        }

        // Ensure destination is connected
        this.setFloor(to.x, to.y);
    }

    /**
     * Corridor with alcoves/niches along the sides
     */
    createCorridorWithAlcoves(from, to) {
        // Create base L-shaped corridor
        const horizontal = Math.random() < 0.5;
        const midX = horizontal ? to.x : from.x;
        const midY = horizontal ? from.y : to.y;

        // First segment
        if (horizontal) {
            this.createHTunnelWithAlcoves(from.x, midX, from.y);
            this.createVTunnelWithAlcoves(midY, to.y, midX);
        } else {
            this.createVTunnelWithAlcoves(from.y, midY, from.x);
            this.createHTunnelWithAlcoves(midX, to.x, midY);
        }
    }

    createHTunnelWithAlcoves(x1, x2, y) {
        const minX = Math.min(x1, x2);
        const maxX = Math.max(x1, x2);

        for (let x = minX; x <= maxX; x++) {
            this.setFloor(x, y);

            // Random alcove (15% chance on each side)
            if (Math.random() < 0.15 && y > 2) {
                this.setFloor(x, y - 1);
                if (Math.random() < 0.5) this.setFloor(x, y - 2);
            }
            if (Math.random() < 0.15 && y < CONFIG.MAP_HEIGHT - 3) {
                this.setFloor(x, y + 1);
                if (Math.random() < 0.5) this.setFloor(x, y + 2);
            }
        }
    }

    createVTunnelWithAlcoves(y1, y2, x) {
        const minY = Math.min(y1, y2);
        const maxY = Math.max(y1, y2);

        for (let y = minY; y <= maxY; y++) {
            this.setFloor(x, y);

            // Random alcove (15% chance on each side)
            if (Math.random() < 0.15 && x > 2) {
                this.setFloor(x - 1, y);
                if (Math.random() < 0.5) this.setFloor(x - 2, y);
            }
            if (Math.random() < 0.15 && x < CONFIG.MAP_WIDTH - 3) {
                this.setFloor(x + 1, y);
                if (Math.random() < 0.5) this.setFloor(x + 2, y);
            }
        }
    }

    /**
     * Safe floor placement with bounds checking
     */
    setFloor(x, y) {
        if (y >= 1 && y < CONFIG.MAP_HEIGHT - 1 && x >= 1 && x < CONFIG.MAP_WIDTH - 1) {
            this.map[y][x] = CONFIG.TILE.FLOOR;
        }
    }

    createHTunnel(x1, x2, y, width = 1) {
        const halfWidth = Math.floor(width / 2);
        for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
            for (let w = -halfWidth; w <= halfWidth; w++) {
                this.setFloor(x, y + w);
            }
        }
    }

    createVTunnel(y1, y2, x, width = 1) {
        const halfWidth = Math.floor(width / 2);
        for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
            for (let w = -halfWidth; w <= halfWidth; w++) {
                this.setFloor(x + w, y);
            }
        }
    }
}

