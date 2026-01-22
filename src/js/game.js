import { CONFIG } from './config.js';
import { LevelGenerator } from './systems/level-generator.js';
import { Renderer } from './systems/renderer.js';
import { Inventory } from './systems/inventory.js';
import { Enemy } from './systems/enemy.js';
import { DamageText } from './systems/damage-text.js';
import { Experience } from './systems/experience.js';

class Game {
    constructor() {
        this.container = document.getElementById('game-container');
        this.posDisplay = document.getElementById('pos');
        this.fpsDisplay = document.getElementById('fps');

        this.renderer = new Renderer(this.container, this.posDisplay);
        this.levelGenerator = new LevelGenerator();
        this.inventory = new Inventory();
        this.damageText = new DamageText(this.container);
        this.experience = new Experience();

        this.map = [];
        this.rooms = [];
        this.player = { x: 0, y: 0 };
        this.aiming = false;
        this.reticle = { x: 0, y: 0 };

        this.inventory.addItem({ name: 'Pistol', damage: 1 });

        this.explored = new Set();
        this.visible = new Set();
        this.enemies = [];
        this.enemyMap = new Map();
        this.pickups = [];
        this.pickupMap = new Map();

        // FPS Tracking
        this.lastTime = performance.now();
        this.frames = 0;
        this.fps = 0;

        this.floorLevel = 1;

        this.setupEventListeners();
        this.init();
        this.loop();
    }

    init() {
        const level = this.levelGenerator.generate();
        this.map = level.map;
        this.rooms = level.rooms;
        this.player = { x: level.playerStart.x, y: level.playerStart.y };

        // Initialize Enemies
        this.enemies = level.enemies.map(e => new Enemy(e.x, e.y, e.type));
        this.enemyMap.clear();
        this.enemies.forEach(e => {
            this.enemyMap.set(e.y * CONFIG.MAP_WIDTH + e.x, e);
        });

        // Initialize Pickups
        this.pickups = level.pickups || [];
        this.pickupMap.clear();
        this.pickups.forEach(p => {
            this.pickupMap.set(p.y * CONFIG.MAP_WIDTH + p.x, p);
        });

        this.renderer.setMap(this.map);
        this.explored.clear();
        this.visible.clear();
        this.calculateFOV();
        this.renderer.fullRender(this.player, this.visible, this.explored, null, this.enemyMap, this.pickupMap);

        // Initial camera position
        setTimeout(() => this.renderer.updateCamera(this.player, true), 100);

    }

    loop() {
        this.updateFPS();
        requestAnimationFrame(() => this.loop());
    }

    updateFPS() {
        const now = performance.now();
        this.frames++;
        if (now >= this.lastTime + 1000) {
            this.fps = Math.round((this.frames * 1000) / (now - this.lastTime));
            this.fpsDisplay.innerText = this.fps;
            this.frames = 0;
            this.lastTime = now;
        }
    }

    setupEventListeners() {
        window.addEventListener('keydown', (e) => {
            // Allow closing inventory with I key, but block other actions when open
            if (e.key === 'i' || e.key === 'I') {
                this.inventory.toggle();
                return;
            }

            // Block all other input when inventory is open
            if (this.inventory.isOpen) return;

            let dx = 0;
            let dy = 0;
            switch (e.key) {
                case 'ArrowUp': dy = -1; break;
                case 'ArrowDown': dy = 1; break;
                case 'ArrowLeft': dx = -1; break;
                case 'ArrowRight': dx = 1; break;
                case 'f':
                case 'F':
                    this.toggleAim();
                    return;
                case 'g':
                case 'G':
                    this.tryPickup();
                    return;
                default: return;
            }

            // Simple throttling/debouncing
            const now = performance.now();
            if (this.lastMoveTime && now - this.lastMoveTime < 50) return; // Limit to 20 moves/sec

            this.lastMoveTime = now;

            if (this.aiming) {
                this.moveReticle(dx, dy);
            } else {
                this.movePlayer(dx, dy);
            }
        });
    }

    nextLevel() {
        this.floorLevel++;
        console.log(`Descended to floor ${this.floorLevel}`);
        this.init();
    }

    movePlayer(dx, dy) {
        const oldX = this.player.x;
        const oldY = this.player.y;
        const newX = oldX + dx;
        const newY = oldY + dy;

        if (this.isWalkable(newX, newY)) {
            this.player.x = newX;
            this.player.y = newY;

            // Only update the tiles that changed
            this.calculateFOV();
            this.renderer.fullRender(this.player, this.visible, this.explored, null, this.enemyMap, this.pickupMap);

            this.renderer.updatePos(this.player);
            this.renderer.updateCamera(this.player);

            if (this.map[newY][newX] === CONFIG.TILE.ELEVATOR) {
                this.nextLevel();
            }

            // Enemy turn after player moves
            this.processTurn();
        }
    }

    /**
     * Try to pick up item at player's current position
     */
    tryPickup() {
        const pickupKey = this.player.y * CONFIG.MAP_WIDTH + this.player.x;
        const pickup = this.pickupMap.get(pickupKey);

        if (pickup) {
            this.inventory.addAmmo(pickup.type, pickup.amount);
            console.log(`Picked up ${pickup.amount} ${pickup.type} ammo!`);
            this.pickupMap.delete(pickupKey);
            const idx = this.pickups.indexOf(pickup);
            if (idx > -1) this.pickups.splice(idx, 1);

            this.renderer.fullRender(this.player, this.visible, this.explored, null, this.enemyMap, this.pickupMap);
        } else {
            console.log("Nothing to pick up here.");
        }
    }

    // Called after each player action (turn-based)
    processTurn() {
        this.updateEnemies();
    }

    updateEnemies() {
        this.enemies.forEach(enemy => {
            if (!enemy.alive) return; // Skip dead enemies

            const dist = Math.abs(enemy.x - this.player.x) + Math.abs(enemy.y - this.player.y);
            if (dist < 8) enemy.alerted = true; // Wake up if close

            let dx = 0;
            let dy = 0;

            if (enemy.alerted) {
                // Chase player when alerted
                if (Math.abs(this.player.x - enemy.x) > Math.abs(this.player.y - enemy.y)) {
                    dx = (this.player.x > enemy.x) ? 1 : -1;
                } else {
                    dy = (this.player.y > enemy.y) ? 1 : -1;
                }
            } else {
                // Wander randomly when not alerted
                // Only move sometimes (70% chance to stay still for more natural wandering)
                if (Math.random() < 0.3) {
                    const directions = [
                        { dx: 0, dy: -1 },  // up
                        { dx: 0, dy: 1 },   // down
                        { dx: -1, dy: 0 },  // left
                        { dx: 1, dy: 0 }    // right
                    ];
                    const dir = directions[Math.floor(Math.random() * directions.length)];
                    dx = dir.dx;
                    dy = dir.dy;
                }
            }

            // Only try to move if there's a direction
            if (dx !== 0 || dy !== 0) {
                const nx = enemy.x + dx;
                const ny = enemy.y + dy;

                // Check for valid move
                if (this.isWalkable(nx, ny) && !(nx === this.player.x && ny === this.player.y)) {
                    // Check no other enemy at target position
                    const targetKey = ny * CONFIG.MAP_WIDTH + nx;
                    if (!this.enemyMap.has(targetKey)) {
                        // Update Map
                        this.enemyMap.delete(enemy.y * CONFIG.MAP_WIDTH + enemy.x);
                        enemy.x = nx;
                        enemy.y = ny;
                        this.enemyMap.set(targetKey, enemy);
                        needsRender = true;
                    }
                } else if (nx === this.player.x && ny === this.player.y && enemy.alerted) {
                    console.log("Player hit by enemy!");
                    // TODO: Player Take Damage
                }
            }
        });

        // Always re-render after enemy turn
        this.renderer.fullRender(this.player, this.visible, this.explored, this.aiming ? this.reticle : null, this.enemyMap, this.pickupMap);
    }

    toggleAim() {
        if (!this.aiming) {
            this.aiming = true;

            // Try to auto-target nearest visible enemy
            const target = this.findNearestVisibleEnemy();
            if (target) {
                this.reticle.x = target.x;
                this.reticle.y = target.y;
                console.log("Aiming mode: ON (auto-targeted enemy)");
            } else {
                this.reticle.x = this.player.x;
                this.reticle.y = this.player.y;
                console.log("Aiming mode: ON");
            }
        } else {
            // Fire!
            this.fireWeapon();
            this.aiming = false;
        }
        this.renderer.fullRender(this.player, this.visible, this.explored, this.aiming ? this.reticle : null, this.enemyMap, this.pickupMap);
    }

    findNearestVisibleEnemy() {
        let nearest = null;
        let nearestDist = Infinity;

        for (const enemy of this.enemies) {
            if (!enemy.alive) continue;

            // Check if enemy is visible
            const key = enemy.y * CONFIG.MAP_WIDTH + enemy.x;
            if (!this.visible.has(key)) continue;

            // Calculate Manhattan distance
            const dist = Math.abs(enemy.x - this.player.x) + Math.abs(enemy.y - this.player.y);

            if (dist < nearestDist) {
                nearestDist = dist;
                nearest = enemy;
            }
        }

        return nearest;
    }

    moveReticle(dx, dy) {
        const newX = this.reticle.x + dx;
        const newY = this.reticle.y + dy;

        if (newX >= 0 && newX < CONFIG.MAP_WIDTH && newY >= 0 && newY < CONFIG.MAP_HEIGHT) {
            this.reticle.x = newX;
            this.reticle.y = newY;
            this.renderer.fullRender(this.player, this.visible, this.explored, this.reticle, this.enemyMap, this.pickupMap);
            this.renderer.updatePos(this.reticle);
        }
    }

    fireWeapon() {
        // Check if we have ammo
        if (!this.inventory.hasAmmo('9mm')) {
            console.log("Click! Out of ammo!");
            return;
        }

        // Consume ammo
        this.inventory.useAmmo('9mm');

        console.log(`Firing at ${this.reticle.x}, ${this.reticle.y}`);

        const path = this.getLine(this.player.x, this.player.y, this.reticle.x, this.reticle.y);

        // Remove start point (player) from path
        path.shift();

        // Check for hits
        const validPath = [];

        for (let p of path) {
            validPath.push(p);

            // Check enemies
            const key = p.y * CONFIG.MAP_WIDTH + p.x;
            const enemy = this.enemyMap.get(key);
            if (enemy) {
                const damage = this.player.damage || 1;
                console.log(`Hit Enemy! Type: ${enemy.type}, HP: ${enemy.hp}`);

                // Spawn floating damage text
                this.damageText.spawn(p.x, p.y, damage, this.renderer.charW, this.renderer.charH);

                const dead = enemy.takeDamage(damage); // Pistol dmg 1
                if (dead) {
                    console.log("Enemy Died!");
                    // Award XP for the kill
                    const xpGained = this.experience.getEnemyXP(enemy.type);
                    this.experience.addXP(xpGained);

                    // Chance to drop ammo (40%)
                    if (Math.random() < 0.4) {
                        const dropAmount = Math.floor(Math.random() * 4) + 2; // 2-5 ammo
                        const drop = { x: enemy.x, y: enemy.y, type: '9mm', amount: dropAmount };
                        this.pickups.push(drop);
                        this.pickupMap.set(key, drop);
                        console.log(`Enemy dropped ${dropAmount} 9mm ammo!`);
                    }

                    this.enemyMap.delete(key);
                    const idx = this.enemies.indexOf(enemy);
                    if (idx > -1) this.enemies.splice(idx, 1);
                } else {
                    enemy.alerted = true;
                }
                break; // Stop projectile
            }

            // Check walls
            if (this.map[p.y][p.x] === CONFIG.TILE.WALL) {
                console.log("Hit Wall!");
                break; // Stop raycast
            }
        }

        // Render projectile trail
        this.renderer.renderProjectileAnimation(validPath, () => {
            this.renderer.fullRender(this.player, this.visible, this.explored, this.aiming ? this.reticle : null, this.enemyMap, this.pickupMap);
            // Enemy turn after player shoots
            this.processTurn();
        });
    }

    getLine(x0, y0, x1, y1) {
        const points = [];
        let dx = Math.abs(x1 - x0);
        let dy = Math.abs(y1 - y0);
        let sx = (x0 < x1) ? 1 : -1;
        let sy = (y0 < y1) ? 1 : -1;
        let err = dx - dy;

        while (true) {
            points.push({ x: x0, y: y0 });
            if (x0 === x1 && y0 === y1) break;
            let e2 = 2 * err;
            if (e2 > -dy) { err -= dy; x0 += sx; }
            if (e2 < dx) { err += dx; y0 += sy; }
        }
        return points;
    }

    isWalkable(x, y) {
        if (y < 0 || y >= CONFIG.MAP_HEIGHT || x < 0 || x >= CONFIG.MAP_WIDTH) return false;
        return this.map[y][x] === CONFIG.TILE.FLOOR || this.map[y][x] === CONFIG.TILE.ELEVATOR;
    }

    calculateFOV() {
        this.visible.clear();
        const startX = this.player.x;
        const startY = this.player.y;



        // Always see player tile
        const startKey = startY * CONFIG.MAP_WIDTH + startX;
        this.visible.add(startKey);
        this.explored.add(startKey);

        const radius = CONFIG.FOV_RADIUS;

        // Recursive Shadowcasting
        // Based on typical roguelike algorithms (Octants)
        for (let octant = 0; octant < 8; octant++) {
            this.castLight(octant, 1, 1.0, 0.0, radius, startX, startY);
        }
    }

    castLight(octant, row, start, end, radius, startX, startY) {
        if (start < end) return;

        let radiusSq = radius * radius;

        // Octant transforms
        // xx, xy, yx, yy
        const transforms = [
            [1, 0, 0, -1], [0, 1, -1, 0], [0, 1, 1, 0], [1, 0, 0, 1],
            [-1, 0, 0, 1], [0, -1, 1, 0], [0, -1, -1, 0], [-1, 0, 0, -1]
        ];

        const [xx, xy, yx, yy] = transforms[octant];

        for (let j = row; j <= radius; j++) {
            let dx = -j - 1;
            let dy = -j;
            let blocked = false;
            let newStart = 0;

            // Scan rows
            while (dx <= 0) {
                dx += 1;
                // Translate relative coordinates to map coordinates
                const X = startX + dx * xx + dy * xy;
                const Y = startY + dx * yx + dy * yy;

                // Slope calculations
                let l_slope = (dx - 0.5) / (dy + 0.5);
                let r_slope = (dx + 0.5) / (dy - 0.5);

                if (start < r_slope) {
                    continue;
                } else if (end > l_slope) {
                    break;
                } else {
                    // Check bounds and distance
                    if (dx * dx + dy * dy <= radiusSq) {
                        if (X >= 0 && X < CONFIG.MAP_WIDTH && Y >= 0 && Y < CONFIG.MAP_HEIGHT) {
                            const key = Y * CONFIG.MAP_WIDTH + X;
                            this.visible.add(key);
                            this.explored.add(key);
                        }
                    }

                    if (blocked) {
                        if (this.blocksLight(X, Y)) {
                            newStart = r_slope;
                            continue;
                        } else {
                            blocked = false;
                            start = newStart;
                        }
                    } else {
                        if (this.blocksLight(X, Y) && j < radius) {
                            blocked = true;
                            this.castLight(octant, j + 1, start, l_slope, radius, startX, startY);
                            newStart = r_slope;
                        }
                    }
                }
            }
            if (blocked) break;
        }
    }

    blocksLight(x, y) {
        if (x < 0 || y < 0 || x >= CONFIG.MAP_WIDTH || y >= CONFIG.MAP_HEIGHT) return true;
        return this.map[y][x] === CONFIG.TILE.WALL || this.map[y][x] === CONFIG.TILE.EMPTY;
    }
}

new Game();
