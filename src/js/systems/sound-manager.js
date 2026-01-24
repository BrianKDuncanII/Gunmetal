import { CONFIG } from '../config.js';

export class SoundManager {
    constructor() {
        this.sounds = {};
        this.ambientSounds = {};
        this.emitters = []; // [{x, y, key, id}]
        this.enabled = true;

        // Browser Autoplay workaround: listen for any interaction
        this.unlockAudio = () => {
            this.resumeContext();
            document.removeEventListener('click', this.unlockAudio);
            document.removeEventListener('keydown', this.unlockAudio);
        };
        document.addEventListener('click', this.unlockAudio);
        document.addEventListener('keydown', this.unlockAudio);

        this.loadSounds();
        this.loadAmbient();
    }

    loadAmbient() {
        if (CONFIG.AUDIO && CONFIG.AUDIO.AMBIENT) {
            for (const [key, path] of Object.entries(CONFIG.AUDIO.AMBIENT)) {
                this.ambientSounds[key] = new Howl({
                    src: [path],
                    volume: 0, // Start silent
                    loop: true,
                    onloaderror: (id, err) => {
                        console.warn(`Failed to load ambient: ${key} at ${path}`, err);
                    }
                });
            }
        }
    }

    loadSounds() {
        // ... (existing code for SFX)
        if (CONFIG.AUDIO && CONFIG.AUDIO.SFX) {
            for (const [key, path] of Object.entries(CONFIG.AUDIO.SFX)) {
                this.sounds[key] = new Howl({
                    src: [path],
                    volume: 0.5,
                    onloaderror: (id, err) => {
                        console.warn(`Failed to load sound: ${key} at ${path}`, err);
                    }
                });
            }
        }
    }

    addEmitter(x, y, soundKey) {
        this.resumeContext();
        if (this.ambientSounds[soundKey]) {
            const id = this.ambientSounds[soundKey].play();
            this.emitters.push({ x, y, key: soundKey, id });
            console.log(`Registered emitter: ${soundKey} at ${x},${y} (ID: ${id})`);
        }
    }

    resumeContext() {
        if (Howler.ctx && Howler.ctx.state === 'suspended') {
            Howler.ctx.resume().then(() => {
                console.log("Audio Context Resumed");
            });
        }
    }

    clearEmitters() {
        this.emitters.forEach(e => {
            if (this.ambientSounds[e.key]) {
                this.ambientSounds[e.key].stop(e.id);
            }
        });
        this.emitters = [];
    }

    updateAmbient(playerX, playerY, map) {
        if (!this.enabled) return;

        const setts = CONFIG.AMBIENT_SETTINGS;

        this.emitters.forEach(e => {
            const dx = e.x - playerX;
            const dy = e.y - playerY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            let vol = 0;

            if (dist < setts.MAX_DISTANCE) {
                // Calculate basic falloff
                vol = 1 - (dist / setts.MAX_DISTANCE);
                vol = Math.pow(vol, setts.FALLOFF); // Sharper falloff

                // Apply Occlusion (Occlusion check is expensive, maybe count walls in direct line)
                const occlusionCount = this.checkOcclusion(playerX, playerY, e.x, e.y, map);
                if (occlusionCount > 0) {
                    vol *= Math.pow(setts.OCCLUSION_DAMPING, occlusionCount);
                }
            }

            if (this.ambientSounds[e.key]) {
                this.ambientSounds[e.key].volume(vol, e.id);
                // Log only if volume changed significantly and it's interesting
                if (vol > 0.05 && Math.random() < 0.01) {
                    console.log(`Ambient Vol: ${e.key} at ${vol.toFixed(2)}`);
                }
            }
        });
    }

    checkOcclusion(x0, y0, x1, y1, map) {
        // Simple raycast to count walls
        let count = 0;
        let dx = Math.abs(x1 - x0);
        let dy = Math.abs(y1 - y0);
        let sx = (x0 < x1) ? 1 : -1;
        let sy = (y0 < y1) ? 1 : -1;
        let err = dx - dy;

        let curX = x0;
        let curY = y0;

        while (true) {
            if (curX === x1 && curY === y1) break;

            // Don't count the emitter's own tile if it's special
            if (curX !== x0 || curY !== y0) {
                if (map[curY] && map[curY][curX] === CONFIG.TILE.WALL) {
                    count++;
                }
            }

            let e2 = 2 * err;
            if (e2 > -dy) { err -= dy; curX += sx; }
            if (e2 < dx) { err += dx; curY += sy; }
        }
        return count;
    }

    play(soundKey) {
        // ... (existing code for play)
        this.resumeContext();
        if (!this.enabled) return;

        const sound = this.sounds[soundKey];
        if (sound) {
            const id = sound.play();
            const rate = 0.9 + Math.random() * 0.2;
            sound.rate(rate, id);
        }
    }

    playWeaponSound(weaponName) {
        // ... (existing code for weapon sounds)
        let key = null;
        const name = weaponName.toUpperCase();

        if (name.includes('PISTOL')) key = 'PISTOL';
        else if (name.includes('SHOTGUN')) key = 'SHOTGUN';
        else if (name.includes('RIFLE')) key = 'RIFLE';
        else if (name.includes('SNIPER')) key = 'SNIPER';
        else if (name.includes('ROCKET')) key = 'ROCKET';
        else if (name.includes('MINIGUN')) key = 'MINIGUN';
        else if (name.includes('KNIFE') || name.includes('MELEE')) key = 'MELEE';

        if (key) {
            this.play(key);
        } else {
            this.play('PISTOL');
        }
    }
}
