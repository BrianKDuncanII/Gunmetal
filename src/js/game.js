const CONFIG = {
    MAP_WIDTH: 80,
    MAP_HEIGHT: 40,
    MAX_ROOMS: 10,
    ROOM_MIN_SIZE: 6,
    ROOM_MAX_SIZE: 12,
    TILE: {
        WALL: '#',
        FLOOR: '.',
        PLAYER: '@'
    }
};

class Room {
    constructor(x, y, w, h) {
        this.x1 = x;
        this.y1 = y;
        this.x2 = x + w;
        this.y2 = y + h;
    }

    center() {
        return {
            x: Math.floor((this.x1 + this.x2) / 2),
            y: Math.floor((this.y1 + this.y2) / 2)
        };
    }

    intersects(other) {
        return (this.x1 <= other.x2 && this.x2 >= other.x1 &&
            this.y1 <= other.y2 && this.y2 >= other.y1);
    }
}

class Game {
    constructor() {
        this.container = document.getElementById('game-container');
        this.posDisplay = document.getElementById('pos');
        this.fpsDisplay = document.getElementById('fps');
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
        this.generateLevel();
        this.setupEventListeners();
        this.render();

        // Initial camera position
        setTimeout(() => this.updateCamera(true), 100);

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

    generateLevel() {
        this.map = Array.from({ length: CONFIG.MAP_HEIGHT }, () =>
            Array(CONFIG.MAP_WIDTH).fill(CONFIG.TILE.WALL)
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
                    const center = newRoom.center();
                    this.player.x = center.x;
                    this.player.y = center.y;
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

        window.addEventListener('resize', () => {
            this.updateCamera(true);
        });
    }

    movePlayer(dx, dy) {
        const newX = this.player.x + dx;
        const newY = this.player.y + dy;
        if (this.isWalkable(newX, newY)) {
            this.player.x = newX;
            this.player.y = newY;
            this.render();
            this.updateCamera();
        }
    }

    updateCamera(instant = false) {
        // Measure character dimensions
        const charMeasure = document.createElement('span');
        charMeasure.style.fontFamily = 'var(--font-family)';
        charMeasure.style.fontSize = '2.5rem';
        charMeasure.style.lineHeight = '1.1';
        charMeasure.style.position = 'absolute';
        charMeasure.style.visibility = 'hidden';
        charMeasure.innerText = '#';
        document.body.appendChild(charMeasure);

        const charW = charMeasure.offsetWidth;
        const charH = charMeasure.offsetHeight;
        document.body.removeChild(charMeasure);

        // Calculate center of screen
        const viewportW = window.innerWidth;
        const viewportH = window.innerHeight;

        // Target pixel position to center the player
        const targetX = (viewportW / 2) - (this.player.x * charW) - (charW / 2);
        const targetY = (viewportH / 2) - (this.player.y * charH) - (charH / 2);

        if (instant) {
            this.container.style.transition = 'none';
        } else {
            this.container.style.transition = 'transform 0.15s ease-out';
        }

        this.container.style.transform = `translate(${targetX}px, ${targetY}px)`;
    }

    isWalkable(x, y) {
        if (y < 0 || y >= CONFIG.MAP_HEIGHT || x < 0 || x >= CONFIG.MAP_WIDTH) return false;
        return this.map[y][x] === CONFIG.TILE.FLOOR;
    }

    render() {
        let output = "";
        for (let y = 0; y < CONFIG.MAP_HEIGHT; y++) {
            let rowStr = "";
            for (let x = 0; x < CONFIG.MAP_WIDTH; x++) {
                if (x === this.player.x && y === this.player.y) {
                    rowStr += CONFIG.TILE.PLAYER;
                } else {
                    rowStr += this.map[y][x];
                }
            }
            output += rowStr + "\n";
        }
        this.container.innerText = output;
        this.posDisplay.innerText = `${this.player.x}, ${this.player.y}`;
    }
}

window.onload = () => new Game();
