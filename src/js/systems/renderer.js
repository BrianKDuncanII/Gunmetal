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

    fullRender(player, visibleSet, exploredSet, reticle, enemyMap) {
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

                this.updateTile(span, x, y, player, isVisible, isExplored, isReticle, isEnemy ? enemy : null);
            }
        }
        this.renderTile(player.x, player.y, player);
    }

    renderProjectileAnimation(path, callback) {
        // Draw projectile chars along the path
        path.forEach(p => {
            if (this.tileElements[p.y] && this.tileElements[p.y][p.x]) {
                const span = this.tileElements[p.y][p.x];
                span.innerText = CONFIG.TILE.PROJECTILE;
                span.classList.add('projectile'); // For styling (e.g. bright yellow)
                span._text = CONFIG.TILE.PROJECTILE; // Update cache to avoid dirty check reverting it immediately if we were using a loop
            }
        });

        // Clear after short delay
        setTimeout(() => {
            // We ideally want to revert to previous state.
            // Simplest way is to just trigger a full re-render of the view.
            if (callback) callback();
        }, 100); // 100ms flash
    }

    renderTile(x, y, player) {
        const span = this.tileElements[y][x];
        this.updateTile(span, x, y, player, true, true);
    }

    updateTile(span, x, y, player, isVisible, isExplored, isReticle, enemy) {
        let newClassName = '';
        let newText = '';
        let newBg = '';

        if (isReticle) {
            newClassName = 'reticle';
            newText = CONFIG.TILE.RETICLE;
        } else if (enemy) {
            newClassName = enemy.type === CONFIG.TILE.ENEMY_MELEE ? 'enemy-melee' : 'enemy-ranged';
            newText = enemy.type;
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
