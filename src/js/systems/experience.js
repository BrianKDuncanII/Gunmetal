/**
 * Experience - Manages player XP and leveling
 */
export class Experience {
    constructor() {
        this.level = 1;
        this.xp = 0;
        this.xpToLevel = 100; // XP needed to reach next level
        this.xpMultiplier = 1.5; // Each level requires 1.5x more XP

        // Cache DOM elements
        this.levelDisplay = document.getElementById('player-level');
        this.xpDisplay = document.getElementById('player-xp');
        this.xpMaxDisplay = document.getElementById('player-xp-max');

        this.updateUI();
    }

    /**
     * Add XP to the player
     * @param {number} amount - Amount of XP to add
     * @returns {boolean} - True if player leveled up
     */
    addXP(amount) {
        this.xp += amount;
        let leveledUp = false;

        // Check for level up (can level up multiple times)
        while (this.xp >= this.xpToLevel) {
            this.xp -= this.xpToLevel;
            this.level++;
            this.xpToLevel = Math.floor(this.xpToLevel * this.xpMultiplier);
            leveledUp = true;
            console.log(`Level Up! Now level ${this.level}`);
        }

        this.updateUI();
        return leveledUp;
    }

    /**
     * Get XP value for killing an enemy
     * @param {string} enemyType - Type of enemy killed
     * @returns {number} - XP amount
     */
    getEnemyXP(enemyType) {
        switch (enemyType) {
            case 'M': return 15; // Melee enemies
            case 'R': return 20; // Ranged enemies (harder)
            default: return 10;
        }
    }

    /**
     * Update the UI display
     */
    updateUI() {
        if (this.levelDisplay) this.levelDisplay.innerText = this.level;
        if (this.xpDisplay) this.xpDisplay.innerText = this.xp;
        if (this.xpMaxDisplay) this.xpMaxDisplay.innerText = this.xpToLevel;
    }

    /**
     * Reset to level 1 (for new game)
     */
    reset() {
        this.level = 1;
        this.xp = 0;
        this.xpToLevel = 100;
        this.updateUI();
    }
}
