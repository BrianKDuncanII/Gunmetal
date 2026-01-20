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

    fullRender(player) {
        this.container.innerHTML = "";
        this.tileElements = [];

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

                this.updateTile(span, x, y, player);
            }
            this.container.appendChild(rowDiv);
            this.tileElements.push(elementRow);
        }
        this.updatePos(player);
    }

    renderTile(x, y, player) {
        const span = this.tileElements[y][x];
        this.updateTile(span, x, y, player);
    }

    updateTile(span, x, y, player) {
        if (x === player.x && y === player.y) {
            span.className = "player";
            span.innerText = CONFIG.TILE.PLAYER;
        } else {
            const tile = this.map[y][x];
            if (tile === CONFIG.TILE.WALL) {
                span.className = 'wall';
            } else if (tile === CONFIG.TILE.FLOOR) {
                span.className = 'floor';
            } else {
                span.className = 'empty';
            }
            span.innerText = tile;
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
