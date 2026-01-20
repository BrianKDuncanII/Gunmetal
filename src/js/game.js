import { CONFIG } from './config.js';
import { LevelGenerator } from './systems/level-generator.js';
import { Renderer } from './systems/renderer.js';

class Game {
    constructor() {
        this.container = document.getElementById('game-container');
        this.posDisplay = document.getElementById('pos');
        this.fpsDisplay = document.getElementById('fps');

        this.renderer = new Renderer(this.container, this.posDisplay);
        this.levelGenerator = new LevelGenerator();

        this.map = [];
        this.rooms = [];
        this.player = { x: 0, y: 0 };

        // FPS Tracking
        this.lastTime = performance.now();
        this.frames = 0;
        this.fps = 0;

        this.init();
    }

    init() {
        const level = this.levelGenerator.generate();
        this.map = level.map;
        this.rooms = level.rooms;
        this.player = { x: level.playerStart.x, y: level.playerStart.y };

        this.renderer.setMap(this.map);
        this.renderer.fullRender(this.player);

        this.setupEventListeners();

        // Initial camera position
        setTimeout(() => this.renderer.updateCamera(this.player, true), 100);

        // Start FPS loop
        this.loop();
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
            let dx = 0;
            let dy = 0;
            switch (e.key) {
                case 'ArrowUp': dy = -1; break;
                case 'ArrowDown': dy = 1; break;
                case 'ArrowLeft': dx = -1; break;
                case 'ArrowRight': dx = 1; break;
                default: return;
            }
            this.movePlayer(dx, dy);
        });
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
            this.renderer.renderTile(oldX, oldY, this.player);
            this.renderer.renderTile(newX, newY, this.player);

            this.renderer.updatePos(this.player);
            this.renderer.updateCamera(this.player);
        }
    }

    isWalkable(x, y) {
        if (y < 0 || y >= CONFIG.MAP_HEIGHT || x < 0 || x >= CONFIG.MAP_WIDTH) return false;
        return this.map[y][x] === CONFIG.TILE.FLOOR;
    }
}

new Game();
