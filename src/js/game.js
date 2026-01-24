import { CONFIG } from './config.js';
import { LevelGenerator } from './systems/level-generator.js';
import { Renderer } from './systems/renderer.js';
import { Inventory } from './systems/inventory.js';
import { Enemy } from './systems/enemy.js';
import { DamageText } from './systems/damage-text.js';
import { Experience } from './systems/experience.js';
import { Pathfinding } from './systems/pathfinding.js';
import { Minimap } from './systems/minimap.js';
import { SoundManager } from './systems/sound-manager.js';
import { ParticleSystem } from './systems/particles.js';
import { Logger } from './systems/logger.js';

class Game {
    constructor() {
        this.container = document.getElementById('game-container');
        this.posDisplay = document.getElementById('pos');
        this.fpsDisplay = document.getElementById('fps');

        this.renderer = new Renderer(this.container, this.posDisplay);
        this.levelGenerator = new LevelGenerator();
        this.inventory = new Inventory();
        this.inventory.onEquip = (weapon) => {
            console.log("Equipping from inventory:", weapon.NAME);
            this.equipWeapon(weapon);
        };
        this.damageText = new DamageText(this.container);
        this.experience = new Experience();
        this.minimap = new Minimap();
        this.soundManager = new SoundManager();
        this.particleSystem = new ParticleSystem(document.getElementById('game-container'));
        this.logger = new Logger();

        this.map = [];
        this.rooms = [];
        this.player = { x: 0, y: 0, hp: CONFIG.PLAYER.START_HP, maxHp: CONFIG.PLAYER.MAX_HP };
        this.aiming = false;
        this.reticle = { x: 0, y: 0 };
        this.gameOver = false;
        this.hpDisplay = document.getElementById('hp');

        // Weapon system
        this.activeWeapon = CONFIG.WEAPON.PISTOL;
        this.currentMagazine = this.activeWeapon.MAGAZINE_SIZE;

        // Add starting weapon
        this.inventory.addItem({ ...this.activeWeapon, type: 'weapon' });

        this.explored = new Set();
        this.visible = new Set();
        this.enemies = [];
        this.enemyMap = new Map();
        this.pickups = [];
        this.pickupMap = new Map();

        // Visual effects queue
        this.pendingTracers = [];

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
        this.player = {
            x: level.playerStart.x,
            y: level.playerStart.y,
            hp: CONFIG.PLAYER.START_HP,
            maxHp: CONFIG.PLAYER.MAX_HP
        };
        this.gameOver = false;
        this.hideGameOver();

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

        // Update ammo display
        this.updateAmmoDisplay();
    }

    render(reticle = null) {
        this.renderer.fullRender(this.player, this.visible, this.explored, reticle, this.enemyMap, this.pickupMap);

        // Highlight AOE if applicable
        if (this.aiming && this.activeWeapon.AOE_RADIUS) {
            this.renderer.renderAOE(this.reticle.x, this.reticle.y, this.activeWeapon.AOE_RADIUS);
        }

        this.minimap.render(this.map, this.player, this.enemies, this.explored, this.visible);
    }



    loop() {
        this.updateFPS();
        const now = performance.now();
        const dt = (now - this.lastTime) / 1000 || 0.016;
        this.particleSystem.update(dt);

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
            // Block all input during game over
            if (this.gameOver) return;

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
                case 'r':
                case 'R':
                    this.reload();
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

    init() {
        // Generate Level
        const levelData = this.levelGenerator.generate(CONFIG.MAP_WIDTH, CONFIG.MAP_HEIGHT, this.floorLevel);
        this.map = levelData.map;
        this.rooms = levelData.rooms;

        // Player Start
        this.player.x = levelData.playerStart.x;
        this.player.y = levelData.playerStart.y;

        // Update renderer map reference
        this.renderer.setMap(this.map);

        // Reset lists
        this.explored.clear();
        this.visible.clear();
        this.enemies = [];
        this.enemyMap.clear();
        this.pickups = [];
        this.pickupMap.clear();

        // Spawn Enemies
        levelData.enemies.forEach(e => {
            const enemy = new Enemy(e.x, e.y, e.type);
            this.enemies.push(enemy);
            this.enemyMap.set(e.y * CONFIG.MAP_WIDTH + e.x, enemy);
        });

        // Spawn Pickups
        levelData.pickups.forEach(p => {
            this.pickups.push(p);
            this.pickupMap.set(p.y * CONFIG.MAP_WIDTH + p.x, p);
        });

        // Initial Update
        this.calculateFOV();
        this.render();
        this.renderer.updateCamera(this.player);
        this.updateHPDisplay();
        this.updateAmmoDisplay();

        console.log("Level Initialized. Minimap ready.");
    }

    nextLevel() {
        this.floorLevel++;
        console.log(`Descended to floor ${this.floorLevel}`);
        this.logger.important(`Descended to Floor ${this.floorLevel}`);
        this.soundManager.play('ELEVATOR');
        this.init();
    }

    movePlayer(dx, dy) {
        const oldX = this.player.x;
        const oldY = this.player.y;
        const newX = oldX + dx;
        const newY = oldY + dy;

        if (this.isWalkable(newX, newY)) {
            // Check for entity collision
            const key = newY * CONFIG.MAP_WIDTH + newX;
            if (this.enemyMap.has(key)) {
                // Block movement
                // Optional: We could trigger a melee attack here if we wanted player bump-attack
                // For now, just block as requested
                return;
            }

            this.player.x = newX;
            this.player.y = newY;

            // Only update the tiles that changed
            this.calculateFOV();
            this.render();

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
            if (pickup.type === 'weapon') {
                this.inventory.addItem(pickup);
                this.soundManager.play('PICKUP_WEAPON');
                console.log(`Picked up ${pickup.NAME}!`);

                // Optional: Auto-equip if better? For now just add to inventory.
                // Or maybe we should equip it to test it? Let's equip it.
                this.equipWeapon(pickup);

                this.showActionText(`Got ${pickup.NAME}!`, this.player.x, this.player.y);
                this.logger.loot(`Picked up ${pickup.NAME}`);
            } else if (pickup.type === 'mod') {
                this.inventory.addItem(pickup);
                this.soundManager.play('UI_EQUIP');
                this.showActionText(`Got ${pickup.name}!`, this.player.x, this.player.y);
                this.logger.loot(`Found ${pickup.name} mod`);
            } else {
                this.inventory.addAmmo(pickup.ammoType, pickup.amount);
                this.soundManager.play('PICKUP_AMMO');
                console.log(`Picked up ${pickup.amount} ${pickup.ammoType} ammo!`);
                this.showActionText(`+${pickup.amount} ${pickup.ammoType}`, this.player.x, this.player.y);
                this.logger.loot(`Picked up ${pickup.amount} ${pickup.ammoType} ammo`);
            }
            this.pickupMap.delete(pickupKey);
            const idx = this.pickups.indexOf(pickup);
            if (idx > -1) this.pickups.splice(idx, 1);

            this.render();
            this.updateAmmoDisplay();
        } else {
            console.log("Nothing to pick up here.");
        }
    }

    /**
     * Equip a new weapon
     */
    equipWeapon(weapon) {
        this.activeWeapon = weapon;
        const stats = this.getEffectiveStats();
        this.currentMagazine = stats.magazineSize;
        this.updateAmmoDisplay();
    }

    /**
     * Reload the current weapon from reserve ammo
     */
    reload() {
        if (!this.activeWeapon.MAGAZINE_SIZE) return; // No magazine (melee)

        // Already full?
        if (this.currentMagazine >= this.activeWeapon.MAGAZINE_SIZE) {
            console.log("Magazine already full!");
            return;
        }

        // Calculate how many rounds we need
        const stats = this.getEffectiveStats();
        const roundsNeeded = stats.magazineSize - this.currentMagazine;
        const ammoType = this.activeWeapon.AMMO_TYPE;
        const reserveAmmo = this.inventory.getAmmo(ammoType);

        if (reserveAmmo <= 0) {
            console.log("No reserve ammo!");
            this.showActionText("NO AMMO!", this.player.x, this.player.y);
            return;
        }

        // Take what we can get
        const roundsToLoad = Math.min(roundsNeeded, reserveAmmo);

        // Consume from reserve
        this.inventory.useAmmo(ammoType, roundsToLoad);

        // Add to magazine
        this.currentMagazine += roundsToLoad;

        console.log(`Reloaded ${roundsToLoad} rounds! Magazine: ${this.currentMagazine}/${stats.magazineSize}`);

        // Show floating "Reload!" text
        this.showActionText("Reload!", this.player.x, this.player.y);
        this.soundManager.play('RELOAD');

        // Spawn Magazine Particle
        const px = this.player.x * this.renderer.charW + this.renderer.charW / 2;
        const py = this.player.y * this.renderer.charH + this.renderer.charH / 2;
        this.particleSystem.spawnMag(px, py);

        // Update ammo display
        this.updateAmmoDisplay();

        // Reloading takes a turn!
        this.processTurn();
    }

    /**
     * Update the ammo display to show magazine / reserve
     */
    updateAmmoDisplay() {
        const ammoDisplay = document.getElementById('ammo-display');
        if (ammoDisplay) {
            if (this.activeWeapon.AMMO_TYPE) {
                const reserve = this.inventory.getAmmo(this.activeWeapon.AMMO_TYPE);
                ammoDisplay.innerText = `${this.activeWeapon.NAME}: ${this.currentMagazine}/${reserve}`;
            } else {
                ammoDisplay.innerText = `${this.activeWeapon.NAME}: -/-`;
            }
        }
    }

    /**
     * Show floating action text (like "Reload!") at a position
     */
    showActionText(text, x, y) {
        const textEl = document.createElement('div');
        textEl.className = 'action-text';
        textEl.innerText = text;

        // Position at tile location
        textEl.style.left = `${x * this.renderer.charW + this.renderer.charW / 2}px`;
        textEl.style.top = `${y * this.renderer.charH}px`;

        this.container.appendChild(textEl);

        // Remove after animation
        setTimeout(() => {
            textEl.remove();
        }, 1000);
    }

    // Called after each player action (turn-based)
    processTurn() {
        this.updateEnemies();
    }

    updateEnemies() {
        this.enemies.forEach(enemy => {
            if (!enemy.alive || this.gameOver) return; // Skip dead enemies or if game over

            const dist = Math.abs(enemy.x - this.player.x) + Math.abs(enemy.y - this.player.y);
            if (dist < 8) enemy.alerted = true; // Wake up if close

            // Ranged enemies: Try to attack from distance first
            // Ranged Attack Logic moved to Tactical AI block below


            let dx = 0;
            let dy = 0;

            if (enemy.alerted) {
                const hasLoS = this.hasLineOfSight(enemy.x, enemy.y, this.player.x, this.player.y, true);
                const inCover = this.getCoverStatus(enemy.x, enemy.y, this.player.x, this.player.y);

                // Explicit Melee Attack Check
                const distToPlayer = Math.abs(enemy.x - this.player.x) + Math.abs(enemy.y - this.player.y);
                if (enemy.type === CONFIG.TILE.ENEMY_MELEE && distToPlayer <= 1) {
                    this.enemyMeleeAttack(enemy);
                    return;
                }

                // Ranged AI: Tactical
                if (enemy.type === CONFIG.TILE.ENEMY_RANGED) {

                    // 1. If in cover and can shoot -> Shoot (High Chance)
                    if (inCover && hasLoS && dist <= CONFIG.ENEMY.RANGED_ATTACK_RANGE) {
                        if (Math.random() < 0.8) {
                            this.enemyRangedAttack(enemy);
                            return;
                        } else if (Math.random() < 0.3) {
                            // 30% chance (of the remaining 20%) to peep out
                            // By not returning here, the AI falls through to the chase logic
                            // which will move it out of cover.
                        } else {
                            return; // Stay in cover
                        }
                    }
                    // 2. If exposed but can shoot -> Shoot (Medium Chance) or Move
                    else if (hasLoS && dist <= CONFIG.ENEMY.RANGED_ATTACK_RANGE) {
                        if (Math.random() < 0.4) {
                            this.enemyRangedAttack(enemy);
                            return;
                        }
                    }

                    // 3. If not in cover, try to find cover
                    if (!inCover) {
                        const coverPos = this.findTacticalPosition(enemy);
                        if (coverPos) {
                            const step = Pathfinding.getNextStep(enemy.x, enemy.y, coverPos.x, coverPos.y, this.map, this.enemyMap);
                            if (step) {
                                dx = step.dx;
                                dy = step.dy;
                            }
                        }
                    }
                }

                // Default Chase (if no tactical move decided)
                if (dx === 0 && dy === 0) {
                    // IF we are in cover but can't see player, stay put sometimes for an ambush
                    // But don't stay forever (lowered chance to 30% to prevent stalemates)
                    if (inCover && !hasLoS && Math.random() < 0.3) {
                        return; // Wait in cover
                    }

                    const nextStep = Pathfinding.getNextStep(
                        enemy.x, enemy.y,
                        this.player.x, this.player.y,
                        this.map, this.enemyMap
                    );
                    if (nextStep) {
                        dx = nextStep.dx;
                        dy = nextStep.dy;
                    }
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

                // Check if trying to move into player (melee attack)
                // If enemy moves into player, it attacks regardless of prior alert status
                if (nx === this.player.x && ny === this.player.y) {
                    this.enemyMeleeAttack(enemy);
                    return;
                }

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
                    }
                }
            }
        });

        // Always re-render after enemy turn
        this.render(this.aiming ? this.reticle : null);
    }

    /**
     * Check if there is clear line of sight between two points
     * @param {number} x0 - Start X
     * @param {number} y0 - Start Y
     * @param {number} x1 - Target X
     * @param {number} y1 - Target Y
     * @param {boolean} allowPeek - If true, allow checking from adjacent peek tiles
     */
    hasLineOfSight(x0, y0, x1, y1, allowPeek = false) {
        // Direct LoS
        if (this.checkLine(x0, y0, x1, y1)) return true;

        // Peek LoS
        if (allowPeek) {
            const peekSpots = this.getPeekNeighbors(x0, y0);
            for (const spot of peekSpots) {
                if (this.checkLine(spot.x, spot.y, x1, y1)) return true;
            }
        }
        return false;
    }

    /**
     * Internal helper to check direct line
     */
    checkLine(x0, y0, x1, y1) {
        const path = this.getLine(x0, y0, x1, y1);
        // Skip first (source) and last (target) positions
        for (let i = 1; i < path.length - 1; i++) {
            const p = path[i];
            if (this.map[p.y][p.x] === CONFIG.TILE.WALL) {
                return false;
            }
        }
        return true;
    }

    /**
     * Get valid peek neighbors (empty tiles adjacent to me AND a wall)
     */
    getPeekNeighbors(x, y) {
        const spots = [];
        const neighbors = [
            { dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }
        ];

        // Check each direction for a WALL
        for (const dir of neighbors) {
            const wx = x + dir.dx;
            const wy = y + dir.dy;
            if (!this.isWalkable(wx, wy)) { // It's a wall (or empty void)
                // Check perpendiculars relative to this wall
                // If wall is North (0, -1). Perp is East (1, 0) / West (-1, 0)
                // We want to peek from (x+1, y) IF that spot is open.

                // Simplified: Just iterate neighbors again. If neighbor is WALKABLE, add it.
                // But we only peek if we are NEXT TO A WALL.
                // Yes, this loop confirms we are next to a wall.
                // So now gather walkable neighbors.

                for (const peekDir of neighbors) {
                    const px = x + peekDir.dx;
                    const py = y + peekDir.dy;
                    if (this.isWalkable(px, py)) {
                        // Avoid duplicates
                        if (!spots.some(s => s.x === px && s.y === py)) {
                            spots.push({ x: px, y: py });
                        }
                    }
                }
            }
        }
        return spots;
    }

    getCoverStatus(targetX, targetY, sourceX, sourceY) {
        // 1. Check if adjacent to any wall
        const walls = [];
        const neighbors = [
            { dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }
        ];

        for (const dir of neighbors) {
            if (!this.isWalkable(targetX + dir.dx, targetY + dir.dy)) {
                walls.push(dir);
            }
        }

        if (walls.length === 0) return false;

        // 2. Vector from Target to Source
        const toSourceX = sourceX - targetX;
        const toSourceY = sourceY - targetY;

        // Normalize roughly (Manhattan is fine for sign check)

        // 3. Check if any wall is roughly in the direction of the source
        // Dot product: WallDir * ToSourceDir > 0
        // WallDir is vector from Target to Wall. (dir.dx, dir.dy)

        for (const wallDir of walls) {
            const dot = wallDir.dx * toSourceX + wallDir.dy * toSourceY;
            if (dot > 0) return true; // Wall is somewhat towards the enemy
        }

        return false;
    }

    /**
     * Enemy performs a melee attack on the player
     */
    enemyMeleeAttack(enemy) {
        const damage = CONFIG.ENEMY.MELEE_DAMAGE;
        console.log(`Melee enemy attacks for ${damage} damage!`);
        this.playerTakeDamage(damage, enemy.x, enemy.y);
    }

    /**
     * Enemy performs a ranged attack on the player
     */
    enemyRangedAttack(enemy) {
        const damage = CONFIG.ENEMY.RANGED_DAMAGE;
        console.log(`Ranged enemy shoots for ${damage} damage!`);
        this.playerTakeDamage(damage, enemy.x, enemy.y);
    }

    /**
     * Player takes damage from an enemy
     */
    playerTakeDamage(amount, sourceX, sourceY) {
        const inCover = this.getCoverStatus(this.player.x, this.player.y, sourceX, sourceY);
        let finalDamage = amount;

        if (inCover) {
            finalDamage = Math.floor(amount * 0.5); // 50% damage reduction
            this.logger.info("Cover absorbed damage!");
        }

        this.player.hp -= finalDamage;
        this.soundManager.play('PLAYER_HIT');

        // Spawn floating damage text
        let color = inCover ? '#aaaaff' : null; // bluish for blocked?
        this.damageText.spawn(this.player.x, this.player.y, finalDamage, this.renderer.charW, this.renderer.charH, true);

        console.log(`Player HP: ${this.player.hp}/${this.player.maxHp}`);

        // Update UI
        this.updateHPDisplay();
        this.showDamageFlash();

        // Check for game over
        if (this.player.hp <= 0) {
            this.player.hp = 0;
            this.updateHPDisplay();
            this.triggerGameOver();
        }
    }

    /**
     * Update the HP display in the UI
     */
    updateHPDisplay() {
        if (this.hpDisplay) {
            this.hpDisplay.innerText = this.player.hp;
        }
    }

    /**
     * Show a red screen flash when player takes damage
     */
    showDamageFlash() {
        const flash = document.createElement('div');
        flash.className = 'damage-flash';
        document.body.appendChild(flash);

        // Remove after animation completes
        setTimeout(() => {
            flash.remove();
        }, 300);
    }

    /**
     * Trigger game over state
     */
    triggerGameOver() {
        this.gameOver = true;
        console.log("GAME OVER!");
        this.showGameOver();
    }

    /**
     * Show the game over screen
     */
    showGameOver() {
        // Create game over overlay if it doesn't exist
        let overlay = document.getElementById('game-over-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'game-over-overlay';
            overlay.innerHTML = `
                <div class="game-over-content">
                    <h2>GAME OVER</h2>
                    <p>You have been defeated.</p>
                    <button id="restart-btn">RESTART</button>
                </div>
            `;
            document.body.appendChild(overlay);

            // Add restart button listener
            // Use arrow function in listener to capture 'this' correctly
            document.getElementById('restart-btn').addEventListener('click', () => {
                this.restartGame();
            });
        }
        overlay.classList.remove('hidden');
    }

    /**
     * Hide the game over screen
     */
    hideGameOver() {
        const overlay = document.getElementById('game-over-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    }

    resetInventory() {
        // Helper to reset inventory state
        this.inventory.items = [];
        this.inventory.addItem({ name: '9mm Ammo', type: 'ammo', ammoType: '9mm', amount: 12 });
        // Restore starting weapon
        this.activeWeapon = CONFIG.WEAPON.PISTOL;
        this.inventory.addItem({ ...this.activeWeapon, type: 'weapon' });

        this.inventory.render();
        this.inventory.updateAmmoUI();
    }

    restartGame() {
        console.log("Restarting game...");
        this.hideGameOver();
        this.gameOver = false;

        // Reset Logic
        this.player.hp = CONFIG.PLAYER.START_HP;
        this.experience.reset();
        this.floorLevel = 1;
        this.resetInventory();

        // Reset magazine for the pistol
        this.currentMagazine = this.activeWeapon.MAGAZINE_SIZE;

        this.init();
        this.updateHPDisplay();
        this.updateAmmoDisplay();
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
        this.render(this.aiming ? this.reticle : null);
    }

    findNearestVisibleEnemy() {
        let nearest = null;
        let nearestDist = Infinity;

        for (const enemy of this.enemies) {
            if (!enemy.alive) continue;

            // Check if enemy is visible (including peek)
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
            this.render(this.reticle);
            this.renderer.updatePos(this.reticle);
        }
    }

    getEffectiveStats() {
        const weapon = this.activeWeapon;
        const mods = weapon.mods || [];

        let damage = weapon.DAMAGE || 0;
        let range = weapon.RANGE || 0;
        let spread = weapon.SPREAD || 0;
        let magazineSize = weapon.MAGAZINE_SIZE || 0;
        let pellets = weapon.PELLETS || 1;

        mods.forEach(mod => {
            if (mod.DAMAGE_BONUS) damage += mod.DAMAGE_BONUS;
            if (mod.RANGE_BONUS) range += mod.RANGE_BONUS;
            if (mod.SPREAD_MULT) spread *= mod.SPREAD_MULT;
            if (mod.MAG_MULT) magazineSize = Math.ceil(magazineSize * mod.MAG_MULT);
        });

        return { damage, range, spread, magazineSize, pellets };
    }

    fireWeapon() {
        // Special case for melee
        if (this.activeWeapon.TYPE === 'melee') {
            this.fireMelee();
            return;
        }

        // Check if magazine is empty
        if (this.currentMagazine <= 0) {
            console.log("Click! Magazine empty - press R to reload!");
            this.showActionText("EMPTY!", this.player.x, this.player.y);
            this.soundManager.play('DRY_FIRE');
            return;
        }

        // Consume ammo
        this.currentMagazine--;
        this.updateAmmoDisplay();

        console.log(`Firing ${this.activeWeapon.NAME} at ${this.reticle.x}, ${this.reticle.y}`);
        this.soundManager.playWeaponSound(this.activeWeapon.NAME);

        // Spawn Shell Particle
        const px = this.player.x * this.renderer.charW + this.renderer.charW / 2;
        const py = this.player.y * this.renderer.charH + this.renderer.charH / 2;
        this.particleSystem.spawnShell(px, py);

        const stats = this.getEffectiveStats();

        // Handle weapon types
        if (this.activeWeapon.TYPE === 'hitscan') {
            const pellets = stats.pellets;
            const spread = stats.spread;

            for (let i = 0; i < pellets; i++) {
                // For spread, we slightly offset the target
                let targetX = this.reticle.x;
                let targetY = this.reticle.y;

                if (spread > 0 && pellets > 1) {
                    // Add some randomness to target
                    targetX += (Math.random() - 0.5) * spread * 10;
                    targetY += (Math.random() - 0.5) * spread * 10;
                }

                this.fireHitscan(Math.round(targetX), Math.round(targetY), stats);
            }

        } else if (this.activeWeapon.TYPE === 'projectile') {
            this.fireProjectile();
        }

        // Process turn after effects
        this.completePlayerAction();
    }

    completePlayerAction() {
        if (this.pendingTracers.length > 0) {
            // Flatten paths if needed or renderer handles list of paths?
            // Renderer.renderProjectileAnimation handles a single path array.
            // We need to merge them or update renderer.
            // For now, let's just flatten all points into one "path" for the animation frame.
            const allPoints = [].concat(...this.pendingTracers);

            this.renderer.renderProjectileAnimation(allPoints, () => {
                this.pendingTracers = [];
                this.render(this.aiming ? this.reticle : null); // Updates view removes tracers
                // Enemy turn after player shoots
                this.processTurn();
            });
        } else {
            // Enemy turn immediately
            this.processTurn();
        }
    }

    fireMelee() {
        const dx = Math.sign(this.reticle.x - this.player.x);
        const dy = Math.sign(this.reticle.y - this.player.y);
        const tx = this.player.x + dx;
        const ty = this.player.y + dy;

        // Check distance
        const dist = Math.abs(this.reticle.x - this.player.x) + Math.abs(this.reticle.y - this.player.y);
        if (dist > 1.5) {
            console.log("Too far for melee!");
            return;
        }

        console.log(`Melee attack at ${tx}, ${ty}`);

        // Show visual
        this.damageText.spawn(tx, ty, "SLASH", this.renderer.charW, this.renderer.charH, '#ffffff');

        const stats = this.getEffectiveStats();
        const key = ty * CONFIG.MAP_WIDTH + tx;
        const enemy = this.enemyMap.get(key);
        if (enemy) {
            const damage = stats.damage;
            this.applyDamage(enemy, damage);
        } else if (this.map[ty][tx] === CONFIG.TILE.BOX) {
            this.breakObject(tx, ty);
        }

        this.completePlayerAction();
    }

    fireHitscan(targetX, targetY, stats = null) {
        if (!stats) stats = this.getEffectiveStats();

        // Determine BEST source position (Player or Peek Spot)
        let source = { x: this.player.x, y: this.player.y };

        // ... (peek logic same)
        if (!this.checkLine(source.x, source.y, targetX, targetY)) {
            const peekSpots = this.getPeekNeighbors(this.player.x, this.player.y);
            for (const spot of peekSpots) {
                if (this.checkLine(spot.x, spot.y, targetX, targetY)) {
                    source = spot;
                    break;
                }
            }
        }

        const path = this.getLine(source.x, source.y, targetX, targetY);
        path.shift(); // Remove start

        // Max range check
        const maxRange = stats.range;
        if (path.length > maxRange) {
            path.splice(maxRange);
        }

        let hitPoint = null;

        for (let p of path) {
            hitPoint = p;

            // Check enemies
            const key = p.y * CONFIG.MAP_WIDTH + p.x;
            const enemy = this.enemyMap.get(key);
            if (enemy) {
                const damage = stats.damage;
                this.applyDamage(enemy, damage);
                break; // Stop raycast
            }

            // Check walls / boxes
            const tile = this.map[p.y][p.x];
            if (tile === CONFIG.TILE.WALL) {
                break; // Stop raycast
            } else if (tile === CONFIG.TILE.BOX) {
                this.breakObject(p.x, p.y);
                break; // Stop raycast
            }
        }

        // Render tracer
        if (hitPoint) {
            // Visualize ray from ACTUAL player pos for clarity, or from source?
            // From source is more accurate to physics.
            this.drawTracer(source, hitPoint);
        }
    }

    fireProjectile() {
        // Determine BEST source position
        let source = { x: this.player.x, y: this.player.y };

        // Try direct line
        if (!this.checkLine(source.x, source.y, this.reticle.x, this.reticle.y)) {
            const peekSpots = this.getPeekNeighbors(this.player.x, this.player.y);
            for (const spot of peekSpots) {
                if (this.checkLine(spot.x, spot.y, this.reticle.x, this.reticle.y)) {
                    source = spot;
                    break;
                }
            }
        }

        const path = this.getLine(source.x, source.y, this.reticle.x, this.reticle.y);
        path.shift();

        // Find impact point (wall or enemy or max range)
        let impact = { x: this.reticle.x, y: this.reticle.y };

        for (let p of path) {
            const key = p.y * CONFIG.MAP_WIDTH + p.x;
            if (this.enemyMap.has(key) || this.map[p.y][p.x] === CONFIG.TILE.WALL) {
                impact = p;
                break;
            }
        }

        // Determine explosion center
        console.log(`Rocket impact at ${impact.x}, ${impact.y}`);
        this.explodeRocket(impact.x, impact.y);
        this.drawTracer(source, impact, '#ffaa00');
    }

    explodeRocket(x, y, stats = null) {
        if (!stats) stats = this.getEffectiveStats();
        const radius = this.activeWeapon.AOE_RADIUS || 2;
        const centerDamage = stats.damage;
        const aoeDamage = this.activeWeapon.AOE_DAMAGE || Math.floor(centerDamage * 0.5);

        // Visual for explosion
        this.showActionText("BOOM!", x, y);

        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const tx = x + dx;
                const ty = y + dy;

                if (tx < 0 || tx >= CONFIG.MAP_WIDTH || ty < 0 || ty >= CONFIG.MAP_HEIGHT) continue;

                if (tx === this.player.x && ty === this.player.y) {
                    // Check player damage
                    const dist = Math.abs(dx) + Math.abs(dy);
                    const damage = (dx === 0 && dy === 0) ? centerDamage : aoeDamage;
                    console.log(`Player hit by explosion for ${damage}!`);
                    this.playerTakeDamage(damage, tx, ty);
                    continue;
                }

                // Check for enemies
                const key = ty * CONFIG.MAP_WIDTH + tx;
                const enemy = this.enemyMap.get(key);
                if (enemy) {
                    // Direct hit vs splash
                    const dist = Math.abs(dx) + Math.abs(dy);
                    const damage = (dx === 0 && dy === 0) ? centerDamage : aoeDamage;
                    this.applyDamage(enemy, damage);
                } else if (this.map[ty][tx] === CONFIG.TILE.BOX) {
                    this.breakObject(tx, ty);
                }
            }
        }
    }

    breakObject(x, y) {
        if (this.map[y][x] === CONFIG.TILE.BOX) {
            this.map[y][x] = CONFIG.TILE.FLOOR;
            this.logger.info("Box shattered!");
            this.soundManager.play('ENEMY_HIT'); // Placeholder sound

            // Loot chance
            if (Math.random() < 0.3) {
                const ammoTypes = ['9mm', 'shells', '7.62mm', 'rocket', 'grenade'];
                const dropType = ammoTypes[Math.floor(Math.random() * ammoTypes.length)];
                const amount = Math.floor(Math.random() * 5) + 1;

                const drop = { x, y, type: 'ammo', ammoType: dropType, amount: amount };
                this.pickups.push(drop);
                this.pickupMap.set(y * CONFIG.MAP_WIDTH + x, drop);
                this.logger.loot(`Found ${amount} ${dropType} inside!`);
            }

            this.render();
        }
    }

    applyDamage(enemy, damage) {
        const inCover = this.getCoverStatus(enemy.x, enemy.y, this.player.x, this.player.y);
        let finalDamage = damage;

        if (inCover) {
            finalDamage = Math.floor(damage * 0.5);
            this.showActionText("Cover!", enemy.x, enemy.y);
        }

        console.log(`Hit Enemy! Type: ${enemy.type}, HP: ${enemy.hp} for ${finalDamage}`);
        this.damageText.spawn(enemy.x, enemy.y, finalDamage, this.renderer.charW, this.renderer.charH);
        this.soundManager.play('ENEMY_HIT');

        const dead = enemy.takeDamage(finalDamage);
        if (dead) {
            console.log("Enemy Died!");
            this.logger.log("Enemy eliminated");

            const xpGained = this.experience.getEnemyXP(enemy.type);
            const leveledUp = this.experience.addXP(xpGained);
            if (leveledUp) {
                this.soundManager.play('LEVEL_UP');
                this.logger.levelUp(`Level Up! Reached Level ${this.experience.level}`);
            }

            // Chance to drop something
            if (Math.random() < 0.4) {
                // Reuse level gen logic essentially, or simple drop
                // Ensure we drop ammo for current weapon sometimes
                const dropType = (Math.random() < 0.3) ? this.activeWeapon.AMMO_TYPE : '9mm';
                const drop = { x: enemy.x, y: enemy.y, type: 'ammo', ammoType: dropType, amount: 5 };
                this.pickups.push(drop);
                this.pickupMap.set(enemy.y * CONFIG.MAP_WIDTH + enemy.x, drop);
            }

            this.enemyMap.delete(enemy.y * CONFIG.MAP_WIDTH + enemy.x);
            const idx = this.enemies.indexOf(enemy);
            if (idx > -1) this.enemies.splice(idx, 1);
        } else {
            enemy.alerted = true;
        }
    }

    drawTracer(start, end, color = '#ffff00') {
        const path = this.getLine(start.x, start.y, end.x, end.y);
        this.pendingTracers.push(path);
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
        const tile = this.map[y][x];
        return tile === CONFIG.TILE.FLOOR ||
            tile === CONFIG.TILE.ELEVATOR ||
            tile === CONFIG.TILE.PIPE_V ||
            tile === CONFIG.TILE.PIPE_H;
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

        // Recursive Shadowcasting with Peeking

        // 1. Cast from Player
        for (let octant = 0; octant < 8; octant++) {
            this.castLight(octant, 1, 1.0, 0.0, radius, startX, startY);
        }

        // 2. Cast from Peek Spots (if at corner)
        const peekSpots = this.getPeekNeighbors(startX, startY);
        for (const spot of peekSpots) {
            // Visualize peek spots? Maybe separate color. For now just reveal.
            for (let octant = 0; octant < 8; octant++) {
                this.castLight(octant, 1, 1.0, 0.0, radius, spot.x, spot.y);
            }
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

    /**
     * Find a tactical position for ranged enemy (Cover + LoS)
     */
    findTacticalPosition(enemy) {
        let bestPos = null;
        let minDist = Infinity;
        const scanRadius = 6;

        for (let ry = -scanRadius; ry <= scanRadius; ry++) {
            for (let rx = -scanRadius; rx <= scanRadius; rx++) {
                const tx = enemy.x + rx;
                const ty = enemy.y + ry;

                if (!this.isWalkable(tx, ty)) continue;
                if (this.enemyMap.has(ty * CONFIG.MAP_WIDTH + tx)) continue;

                // Check Cover
                if (this.getCoverStatus(tx, ty, this.player.x, this.player.y)) {
                    // Check LoS (Peek allowed)
                    if (this.hasLineOfSight(tx, ty, this.player.x, this.player.y, true)) {
                        // Score by distance to enemy (minimize travel time)
                        const d = Math.abs(rx) + Math.abs(ry);
                        if (d < minDist) {
                            minDist = d;
                            bestPos = { x: tx, y: ty };
                        }
                    }
                }
            }
        }
        return bestPos;
    }

    blocksLight(x, y) {
        if (x < 0 || y < 0 || x >= CONFIG.MAP_WIDTH || y >= CONFIG.MAP_HEIGHT) return true;
        const tile = this.map[y][x];
        return tile === CONFIG.TILE.WALL ||
            tile === CONFIG.TILE.EMPTY ||
            tile === CONFIG.TILE.BOX ||
            tile === CONFIG.TILE.BARREL ||
            tile === CONFIG.TILE.GENERATOR;
    }
}

new Game();
