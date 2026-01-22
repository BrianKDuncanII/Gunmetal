import { CONFIG } from '../config.js';

export class SoundManager {
    constructor() {
        this.sounds = {};
        this.enabled = true;
        this.loadSounds();
    }

    loadSounds() {
        // Load SFX
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

    play(soundKey) {
        if (!this.enabled) return;

        const sound = this.sounds[soundKey];
        if (sound) {
            const id = sound.play();

            // Randomize pitch (rate) slightly to avoid repetition fatigue
            // Range: 0.9 to 1.1
            const rate = 0.9 + Math.random() * 0.2;
            sound.rate(rate, id);
        } else {
            console.warn(`Sound not found: ${soundKey}`);
        }
    }

    playWeaponSound(weaponName) {
        // Map weapon names to SFX keys
        // config.js keys are upper case weapon types usually, but weapon.NAME is like 'Shotgun'
        // Let's check config keys again.
        // PISTOL, SHOTGUN, RIFLE, SNIPER, ROCKET, MINIGUN, MELEE

        let key = null;
        const name = weaponName.toUpperCase();

        if (name.includes('PISTOL')) key = 'PISTOL';
        else if (name.includes('SHOTGUN')) key = 'SHOTGUN';
        else if (name.includes('RIFLE')) key = 'RIFLE'; // Assualt Rifle
        else if (name.includes('SNIPER')) key = 'SNIPER';
        else if (name.includes('ROCKET')) key = 'ROCKET';
        else if (name.includes('MINIGUN')) key = 'MINIGUN';
        else if (name.includes('KNIFE') || name.includes('MELEE')) key = 'MELEE';

        if (key) {
            this.play(key);
        } else {
            // Fallback
            this.play('PISTOL');
        }
    }
}
