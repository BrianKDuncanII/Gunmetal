/**
 * DamageText - Manages floating damage numbers
 */
export class DamageText {
    constructor(container) {
        this.container = container;
        this.activeTexts = [];
    }

    /**
     * Spawn a floating damage number at a specific tile position
     * @param {number} x - Tile X coordinate
     * @param {number} y - Tile Y coordinate
     * @param {number} damage - Damage amount to display
     * @param {number} charW - Character width in pixels
     * @param {number} charH - Character height in pixels
     */
    spawn(x, y, damage, charW, charH) {
        const textEl = document.createElement('div');
        textEl.className = 'damage-text';
        textEl.innerText = `-${damage}`;

        // Position at tile location
        textEl.style.left = `${x * charW + charW / 2}px`;
        textEl.style.top = `${y * charH}px`;

        this.container.appendChild(textEl);
        this.activeTexts.push(textEl);

        // Remove after animation completes
        setTimeout(() => {
            textEl.remove();
            const idx = this.activeTexts.indexOf(textEl);
            if (idx > -1) this.activeTexts.splice(idx, 1);
        }, 800); // Match animation duration
    }

    /**
     * Clear all active damage texts
     */
    clear() {
        this.activeTexts.forEach(el => el.remove());
        this.activeTexts = [];
    }
}
