export class Logger {
    constructor() {
        this.container = document.getElementById('log-container');
        this.maxEntries = 8;
    }

    log(message, type = 'normal') {
        if (!this.container) return; // robustness

        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.innerText = `> ${message}`;

        this.container.appendChild(entry);

        // Prune old
        while (this.container.children.length > this.maxEntries) {
            this.container.removeChild(this.container.children[0]);
        }

        // Auto fade out after time? Or just keep recent history. 
        // Let's keep recent history visible.
    }

    // Shortcuts
    info(msg) { this.log(msg, 'normal'); }
    important(msg) { this.log(msg, 'important'); }
    danger(msg) { this.log(msg, 'danger'); }
    loot(msg) { this.log(msg, 'loot'); }
    levelUp(msg) { this.log(msg, 'level-up'); }
}
