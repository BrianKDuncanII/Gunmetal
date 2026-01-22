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
        this.minimap.render(this.map, this.player, this.enemies, this.explored, this.visible);
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
        this.soundManager.play('ELEVATOR');
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
            } else {
                this.inventory.addAmmo(pickup.ammoType, pickup.amount);
                this.soundManager.play('PICKUP_AMMO');
                console.log(`Picked up ${pickup.amount} ${pickup.ammoType} ammo!`);
                this.showActionText(`+${pickup.amount} ${pickup.ammoType}`, this.player.x, this.player.y);
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
        this.currentMagazine = weapon.MAGAZINE_SIZE;
        // If picking up a weapon, start full? Or separate mechanic. For now start full.
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
        const roundsNeeded = this.activeWeapon.MAGAZINE_SIZE - this.currentMagazine;
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

        console.log(`Reloaded ${roundsToLoad} rounds! Magazine: ${this.currentMagazine}/${this.activeWeapon.MAGAZINE_SIZE}`);

        // Show floating "Reload!" text
        this.showActionText("Reload!", this.player.x, this.player.y);
        this.soundManager.play('RELOAD');

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
            if (enemy.type === CONFIG.TILE.ENEMY_RANGED && enemy.alerted) {
                if (dist <= CONFIG.ENEMY.RANGED_ATTACK_RANGE && dist > 1) {
                    // Check line of sight
                    if (this.hasLineOfSight(enemy.x, enemy.y, this.player.x, this.player.y)) {
                        // Chance to shoot
                        if (Math.random() < CONFIG.ENEMY.RANGED_ATTACK_CHANCE) {
                            this.enemyRangedAttack(enemy);
                            return; // End turn after shooting
                        }
                    }
                }
            }

            let dx = 0;
            let dy = 0;

            if (enemy.alerted) {
                // Use A* pathfinding to navigate toward player
                const nextStep = Pathfinding.getNextStep(
                    enemy.x, enemy.y,
                    this.player.x, this.player.y,
                    this.map, this.enemyMap
                );

                if (nextStep) {
                    dx = nextStep.dx;
                    dy = nextStep.dy;
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
     */
    hasLineOfSight(x0, y0, x1, y1) {
        const path = this.getLine(x0, y0, x1, y1);
        // Skip first (enemy) and last (player) positions
        for (let i = 1; i < path.length - 1; i++) {
            const p = path[i];
            if (this.map[p.y][p.x] === CONFIG.TILE.WALL) {
                return false;
            }
        }
        return true;
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
        this.player.hp -= amount;
        this.soundManager.play('PLAYER_HIT');

        // Spawn floating damage text at player position (with player damage styling)
        this.damageText.spawn(this.player.x, this.player.y, amount, this.renderer.charW, this.renderer.charH, true);

        // Show damage flash effect
        this.showDamageFlash();

        // Update HP display
        this.updateHPDisplay();

        console.log(`Player HP: ${this.player.hp}/${this.player.maxHp}`);

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

    /**
     * Restart the game from floor 1
     */
    restartGame() {
        this.floorLevel = 1;
        this.currentMagazine = this.activeWeapon.MAGAZINE_SIZE; // Reset magazine
        this.init();
        this.updateHPDisplay();
        console.log("Game restarted!");
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
            this.render(this.reticle);
            this.renderer.updatePos(this.reticle);
        }
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

        // Handle weapon types
        if (this.activeWeapon.TYPE === 'hitscan') {
            // Handle multiple projectiles (SHOTGUN)
            const pellets = this.activeWeapon.PELLETS || 1;
            const spread = this.activeWeapon.SPREAD || 0;
            const burst = this.activeWeapon.BURST || 1;

            for (let i = 0; i < pellets; i++) {
                // For spread, we slightly offset the target
                let targetX = this.reticle.x;
                let targetY = this.reticle.y;

                if (spread > 0 && pellets > 1) {
                    // Add some randomness to target
                    targetX += (Math.random() - 0.5) * spread * 10;
                    targetY += (Math.random() - 0.5) * spread * 10;
                }

                this.fireHitscan(Math.round(targetX), Math.round(targetY));
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

        const key = ty * CONFIG.MAP_WIDTH + tx;
        const enemy = this.enemyMap.get(key);
        if (enemy) {
            const damage = this.activeWeapon.DAMAGE;
            this.applyDamage(enemy, damage);
        }

        this.completePlayerAction();
    }

    fireHitscan(targetX, targetY) {
        const path = this.getLine(this.player.x, this.player.y, targetX, targetY);
        path.shift(); // Remove start

        // Max range check
        const maxRange = this.activeWeapon.RANGE;
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
                const damage = this.activeWeapon.DAMAGE;
                this.applyDamage(enemy, damage);
                break; // Stop raycast
            }

            // Check walls
            if (this.map[p.y][p.x] === CONFIG.TILE.WALL) {
                break; // Stop raycast
            }
        }

        // Render tracer
        if (hitPoint) {
            this.drawTracer(this.player, hitPoint);
        }
    }

    fireProjectile() {
        // For rockets, we want to travel to the target and explode
        const path = this.getLine(this.player.x, this.player.y, this.reticle.x, this.reticle.y);
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
        this.drawTracer(this.player, impact, '#ffaa00');
    }

    explodeRocket(x, y) {
        const radius = this.activeWeapon.AOE_RADIUS || 2;
        const centerDamage = this.activeWeapon.DAMAGE;
        const aoeDamage = this.activeWeapon.AOE_DAMAGE;

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
                }
            }
        }
    }

    applyDamage(enemy, damage) {
        console.log(`Hit Enemy! Type: ${enemy.type}, HP: ${enemy.hp} for ${damage}`);
        this.damageText.spawn(enemy.x, enemy.y, damage, this.renderer.charW, this.renderer.charH);
        this.soundManager.play('ENEMY_HIT');

        const dead = enemy.takeDamage(damage);
        if (dead) {
            console.log("Enemy Died!");
            const xpGained = this.experience.getEnemyXP(enemy.type);
            this.experience.addXP(xpGained);

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
