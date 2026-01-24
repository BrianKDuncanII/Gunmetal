import { CONFIG } from '../config.js';

export class Renderer {
    constructor(container, posDisplay) {
        this.container = container;
        this.posDisplay = posDisplay;
        this.tileElements = [];
        this.charW = 0;
        this.charH = 0;
        this.map = []; // Will be set by Game

        this.updateCharDimensions();

        // Listen for resize
        window.addEventListener('resize', () => {
            this.updateCharDimensions();
            // Game will handle camera update
        });
    }

    setMap(map) {
        this.map = map;
    }

    updateCharDimensions() {
        const charMeasure = document.createElement('span');
        charMeasure.style.fontFamily = 'var(--font-family)';
        charMeasure.style.fontSize = '2.5rem';
        charMeasure.style.lineHeight = '1.1';
        charMeasure.style.position = 'absolute';
        charMeasure.style.visibility = 'hidden';
        charMeasure.innerText = '#';
        document.body.appendChild(charMeasure);

        const rect = charMeasure.getBoundingClientRect();
        this.charW = rect.width;
        this.charH = rect.height;
        document.body.removeChild(charMeasure);
    }

    fullRender(player, visibleSet, exploredSet, reticle, enemyMap, pickupMap) {
        // Clear previous AOE highlights
        this.clearAOE();

        // Initial build if empty
        if (this.tileElements.length === 0) {
            this.container.innerHTML = "";
            for (let y = 0; y < CONFIG.MAP_HEIGHT; y++) {
                const rowDiv = document.createElement('div');
                rowDiv.style.height = `${this.charH}px`;
                rowDiv.style.whiteSpace = "nowrap";

                const elementRow = [];
                for (let x = 0; x < CONFIG.MAP_WIDTH; x++) {
                    const span = document.createElement('span');
                    span.style.display = 'inline-block';
                    span.style.width = `${this.charW}px`;
                    span.style.height = `${this.charH}px`;
                    span.style.textAlign = 'center';
                    elementRow.push(span);
                    rowDiv.appendChild(span);
                }
                this.container.appendChild(rowDiv);
                this.tileElements.push(elementRow);
            }
        }

        // Update loop (reuses DOM)
        for (let y = 0; y < CONFIG.MAP_HEIGHT; y++) {
            for (let x = 0; x < CONFIG.MAP_WIDTH; x++) {
                const span = this.tileElements[y][x];
                const key = y * CONFIG.MAP_WIDTH + x;
                const isVisible = visibleSet ? visibleSet.has(key) : true;
                const isExplored = exploredSet ? exploredSet.has(key) : true;
                const isReticle = reticle && reticle.x === x && reticle.y === y;
                const enemy = enemyMap ? enemyMap.get(key) : null;
                const isEnemy = enemy && isVisible; // Only show enemies if visible
                const pickup = pickupMap ? pickupMap.get(key) : null;
                const isPickup = pickup && isVisible; // Only show pickups if visible

                this.updateTile(span, x, y, player, isVisible, isExplored, isReticle, isEnemy ? enemy : null, isPickup ? pickup : null);
            }
        }
        this.renderTile(player.x, player.y, player);
    }

    renderProjectilePaths(paths, weaponType, callback) {
        if (!paths || paths.length === 0) {
            if (callback) callback();
            return;
        }

        const isHitscan = weaponType === 'hitscan';
        const frameDelay = isHitscan ? 15 : 40; // Bullets are much faster than rockets
        const maxFrames = Math.max(...paths.map(p => p.length));
        let frame = 0;

        const animate = () => {
            if (frame >= maxFrames) {
                // Animation complete, clean up after a tiny linger
                setTimeout(() => {
                    if (callback) callback();
                }, 50);
                return;
            }

            paths.forEach(path => {
                if (frame < path.length) {
                    const p = path[frame];
                    if (this.tileElements[p.y] && this.tileElements[p.y][p.x]) {
                        const span = this.tileElements[p.y][p.x];

                        // Briefly show projectile
                        const oldText = span.innerText;
                        const char = isHitscan ? '•' : CONFIG.TILE.PROJECTILE;
                        span.innerText = char;
                        span.classList.add('projectile');

                        // For hitscan, we leave a brief trail? 
                        // No, let's keep it clean. Revert after one frame.
                        setTimeout(() => {
                            if (span.innerText === char) {
                                span.innerText = span._text || '.'; // Revert to cached floor/wall text
                                span.classList.remove('projectile');
                            }
                        }, frameDelay * 1.5);
                    }
                }
            });

            frame++;
            setTimeout(animate, frameDelay);
        };

        animate();
    }

    renderTile(x, y, player) {
        const span = this.tileElements[y][x];
        this.updateTile(span, x, y, player, true, true);
    }

    updateTile(span, x, y, player, isVisible, isExplored, isReticle, enemy, pickup) {
        let newClassName = '';
        let newText = '';
        let newBg = '';

        if (isReticle) {
            newClassName = 'reticle';
            newText = CONFIG.TILE.RETICLE;
        } else if (enemy) {
            newClassName = enemy.type === CONFIG.TILE.ENEMY_MELEE ? 'enemy-melee' : 'enemy-ranged';
            newText = enemy.type;
        } else if (pickup) {
            newClassName = pickup.type === 'weapon' ? 'pickup-weapon' : (pickup.type === 'mod' ? 'pickup-mod' : 'pickup-ammo');

            // Map ammo types to their tiles
            if (pickup.type === 'mod') {
                newText = CONFIG.TILE.MOD_DROP;
            } else if (pickup.type === 'weapon') {
                newText = CONFIG.TILE.WEAPON_DROP;
            } else {
                switch (pickup.ammoType) {
                    case 'shells': newText = CONFIG.TILE.AMMO_SHELLS; break;
                    case '7.62mm': newText = CONFIG.TILE.AMMO_762; break;
                    case 'rocket': newText = CONFIG.TILE.AMMO_ROCKET; break;
                    case 'grenade': newText = CONFIG.TILE.AMMO_GRENADE; break;
                    default: newText = CONFIG.TILE.AMMO_9MM;
                }
            }
        } else if (!isExplored && !isVisible) {
            newClassName = 'empty';
            newText = ' ';
            newBg = 'transparent';
        } else if (isExplored && !isVisible) {
            newClassName = 'explored';
            const tile = this.map[y][x];
            if (tile === CONFIG.TILE.WALL) {
                newText = CONFIG.TILE.WALL;
            } else if (tile === CONFIG.TILE.FLOOR) {
                newText = CONFIG.TILE.FLOOR;
            } else if (tile === CONFIG.TILE.ELEVATOR) {
                newText = CONFIG.TILE.ELEVATOR;
            } else {
                newText = CONFIG.TILE.EMPTY;
            }
        } else {
            // Visible
            if (x === player.x && y === player.y) {
                newClassName = "player";
                newText = CONFIG.TILE.PLAYER;
            } else {
                const tile = this.map[y][x];
                if (tile === CONFIG.TILE.WALL) {
                    newClassName = 'wall';
                } else if (tile === CONFIG.TILE.FLOOR) {
                    newClassName = 'floor';
                } else if (tile === CONFIG.TILE.ELEVATOR) {
                    newClassName = 'elevator';
                } else if (tile === CONFIG.TILE.BARREL) {
                    newClassName = 'barrel';
                } else if (tile === CONFIG.TILE.BOX) {
                    newClassName = 'box';
                } else if (tile === CONFIG.TILE.GENERATOR) {
                    newClassName = 'generator';
                } else if (tile === CONFIG.TILE.PIPE_V || tile === CONFIG.TILE.PIPE_H) {
                    newClassName = 'pipe';
                } else {
                    newClassName = 'empty';
                }
                newText = tile;
            }
        }

        if (span._className !== newClassName) {
            span.className = newClassName;
            span._className = newClassName;
        }

        if (span._text !== newText) {
            span.innerText = newText;
            span._text = newText;
        }

        if (span._bg !== newBg) {
            span.style.backgroundColor = newBg;
            span._bg = newBg;
        }

    }

    updatePos(player) {
        this.posDisplay.innerText = `${player.x}, ${player.y}`;
    }

    renderAOE(centerX, centerY, radius) {
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const tx = centerX + dx;
                const ty = centerY + dy;

                // Simple circular radius
                const dSquared = dx * dx + dy * dy;
                if (dSquared <= radius * radius) {
                    if (this.tileElements[ty] && this.tileElements[ty][tx]) {
                        this.tileElements[ty][tx].classList.add('aoe-highlight');
                    }
                }
            }
        }
    }

    clearAOE() {
        const highlights = this.container.querySelectorAll('.aoe-highlight');
        highlights.forEach(el => el.classList.remove('aoe-highlight'));
    }

    updateCamera(player, instant = false) {
        // Calculate center of screen
        const viewportW = window.innerWidth;
        const viewportH = window.innerHeight;

        // Target pixel position to center the player using cached dimensions
        const targetX = (viewportW / 2) - (player.x * this.charW) - (this.charW / 2);
        const targetY = (viewportH / 2) - (player.y * this.charH) - (this.charH / 2);

        if (instant) {
            this.container.style.transition = 'none';
        } else {
            this.container.style.transition = 'transform 0.15s ease-out';
        }

        this.container.style.transform = `translate(${targetX}px, ${targetY}px)`;
    }
}
