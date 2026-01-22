import { CONFIG } from '../config.js';

export class Minimap {
    constructor() {
        this.canvas = document.getElementById('minimap');
        this.ctx = this.canvas.getContext('2d');
        this.width = this.canvas.width;
        this.height = this.canvas.height;

        // Calculate tile size
        this.tileW = this.width / CONFIG.MAP_WIDTH;
        this.tileH = this.height / CONFIG.MAP_HEIGHT;
    }

    render(map, player, enemies, explored, visible) {
        if (!map || map.length === 0) return;

        // Clear canvas
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Draw background
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Optimization: Lock redraws if performance is bad, but for small canvas it's fine.

        for (let y = 0; y < CONFIG.MAP_HEIGHT; y++) {
            for (let x = 0; x < CONFIG.MAP_WIDTH; x++) {
                const key = y * CONFIG.MAP_WIDTH + x;

                // Only draw explored tiles
                if (explored.has(key)) {
                    const tile = map[y][x];

                    if (tile === CONFIG.TILE.WALL) {
                        this.ctx.fillStyle = '#444';
                        this.ctx.fillRect(x * this.tileW, y * this.tileH, this.tileW, this.tileH);
                    } else if (tile === CONFIG.TILE.FLOOR || tile === CONFIG.TILE.EMPTY) {
                        this.ctx.fillStyle = '#222';
                        // Only draw floor if visible or just dark grey for explored?
                        // Let's make visible floor brighter
                        if (visible.has(key)) {
                            this.ctx.fillStyle = '#333';
                        }
                        this.ctx.fillRect(x * this.tileW, y * this.tileH, this.tileW, this.tileH);
                    } else if (tile === CONFIG.TILE.ELEVATOR) {
                        this.ctx.fillStyle = '#f1c40f'; // Yellow
                        this.ctx.fillRect(x * this.tileW, y * this.tileH, this.tileW, this.tileH);
                    }
                }
            }
        }

        // Draw Player
        this.ctx.fillStyle = '#ffffff'; // White
        this.ctx.fillRect(player.x * this.tileW, player.y * this.tileH, this.tileW, this.tileH);

        // Draw Visible Enemies
        enemies.forEach(enemy => {
            const key = enemy.y * CONFIG.MAP_WIDTH + enemy.x;
            if (visible.has(key)) {
                this.ctx.fillStyle = '#ff0000'; // Red
                this.ctx.fillRect(enemy.x * this.tileW, enemy.y * this.tileH, this.tileW, this.tileH);
            }
        });
    }
}
