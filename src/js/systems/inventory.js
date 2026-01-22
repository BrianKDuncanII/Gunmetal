export class Inventory {
    constructor() {
        this.items = [];
        this.isOpen = false;
        this.selectedIndex = 0;
        this.container = document.getElementById('inventory-container');

        // UI element for ammo display
        this.ammoDisplay = document.getElementById('ammo-display');

        // Setup keyboard handler
        this.keyHandler = this.handleKeydown.bind(this);

        // Add starting ammo as an inventory item
        this.items.push({ name: '9mm Ammo', type: 'ammo', ammoType: '9mm', amount: 12 });

        // Initial render to ensure it's empty/ready
        this.render();
        this.render();
        this.updateAmmoUI();

        this.onEquip = null; // Callback for equipping weapons
    }

    /**
     * Find an ammo item by type
     */
    findAmmoItem(type) {
        return this.items.find(item => item.type === 'ammo' && item.ammoType === type);
    }

    /**
     * Add ammo of a specific type (stacks with existing)
     */
    addAmmo(type, amount) {
        const existingAmmo = this.findAmmoItem(type);
        if (existingAmmo) {
            existingAmmo.amount += amount;
        } else {
            this.items.push({ name: `${type} Ammo`, type: 'ammo', ammoType: type, amount: amount });
        }
        this.render();
        this.updateAmmoUI();
    }

    /**
     * Use ammo of a specific type
     * @returns {boolean} True if ammo was available and used
     */
    useAmmo(type, amount = 1) {
        const ammoItem = this.findAmmoItem(type);
        if (!ammoItem || ammoItem.amount < amount) {
            return false;
        }
        ammoItem.amount -= amount;

        // Remove item if depleted
        if (ammoItem.amount <= 0) {
            const idx = this.items.indexOf(ammoItem);
            if (idx > -1) this.items.splice(idx, 1);
        }

        this.render();
        this.updateAmmoUI();
        return true;
    }

    /**
     * Check if ammo is available
     */
    hasAmmo(type, amount = 1) {
        const ammoItem = this.findAmmoItem(type);
        return ammoItem && ammoItem.amount >= amount;
    }

    /**
     * Get current ammo count for a type
     */
    getAmmo(type) {
        const ammoItem = this.findAmmoItem(type);
        return ammoItem ? ammoItem.amount : 0;
    }

    /**
     * Update the ammo display in the UI
     */
    updateAmmoUI() {
        if (this.ammoDisplay) {
            this.ammoDisplay.innerText = this.getAmmo('9mm');
        }
    }

    addItem(item) {
        // Ensure item has proper structure
        const normalizedItem = typeof item === 'string' ? { name: item, type: 'misc' } : item;
        this.items.push(normalizedItem);
        this.render();
    }

    removeItem(item) {
        const index = this.items.indexOf(item);
        if (index > -1) {
            this.items.splice(index, 1);
            if (this.selectedIndex >= this.items.length) {
                this.selectedIndex = Math.max(0, this.items.length - 1);
            }
            this.render();
        }
    }

    toggle() {
        this.isOpen = !this.isOpen;
        if (this.isOpen) {
            this.container.classList.remove('hidden');
            this.selectedIndex = 0;
            this.render();
            window.addEventListener('keydown', this.keyHandler);
        } else {
            this.container.classList.add('hidden');
            window.removeEventListener('keydown', this.keyHandler);
        }
    }

    handleKeydown(e) {
        if (!this.isOpen) return;

        switch (e.key) {
            case 'ArrowUp':
                e.preventDefault();
                this.selectedIndex = Math.max(0, this.selectedIndex - 1);
                this.render();
                break;
            case 'ArrowDown':
                e.preventDefault();
                this.selectedIndex = Math.min(this.items.length - 1, this.selectedIndex + 1);
                this.render();
                break;
            case 'Enter':
                e.preventDefault();
                if (this.items[this.selectedIndex]) {
                    const item = this.items[this.selectedIndex];
                    if ((item.type === 'weapon' || item.damage) && this.onEquip) {
                        this.onEquip(item);
                        // Optional: close inventory?
                        this.toggle();
                    }
                }
                break;
        }
    }

    getItemInfo(item) {
        // Build info string based on item properties
        const info = [];

        info.push(`Name: ${item.name || item.NAME || 'Unknown'}`);

        // Item type
        const type = item.type || (item.damage ? 'weapon' : 'misc');
        info.push(`Type: ${type.charAt(0).toUpperCase() + type.slice(1)}`);

        // Weapon stats
        if (item.damage !== undefined) {
            // Handle shotgun pellets
            if (item.PELLETS) {
                info.push(`Damage: ${item.DAMAGE}x${item.PELLETS}`);
            } else {
                info.push(`Damage: ${item.DAMAGE || item.damage}`);
            }
        }
        if (item.RANGE || item.range !== undefined) {
            info.push(`Range: ${item.RANGE || item.range}`);
        }
        if (item.MAGAZINE_SIZE !== undefined) {
            info.push(`Mag: ${item.MAGAZINE_SIZE}`);
        }
        if (item.AMMO_TYPE) {
            info.push(`Ammo: ${item.AMMO_TYPE}`);
        }

        // Ammo item stats
        if (item.type === 'ammo' && item.amount !== undefined) {
            info.push(`Rounds: ${item.amount}`);
        }

        // Armor stats
        if (item.defense !== undefined) {
            info.push(`Defense: ${item.defense}`);
        }

        // Consumable stats
        if (item.heal !== undefined) {
            info.push(`Heals: ${item.heal} HP`);
        }

        // Description
        if (item.description) {
            info.push('');
            info.push(item.description);
        }

        return info;
    }

    render() {
        this.container.innerHTML = '';

        // Create main layout
        const layout = document.createElement('div');
        layout.className = 'inventory-layout';

        // Left side: item list
        const listSection = document.createElement('div');
        listSection.className = 'inventory-list-section';

        const header = document.createElement('h2');
        header.innerText = 'INVENTORY';
        listSection.appendChild(header);

        if (this.items.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'inventory-empty';
            emptyMsg.innerText = '[ NO ITEMS ]';
            listSection.appendChild(emptyMsg);
        } else {
            const list = document.createElement('ul');
            list.className = 'inventory-list';

            this.items.forEach((item, index) => {
                const li = document.createElement('li');
                li.innerText = item.name || item.NAME || item;
                if (index === this.selectedIndex) {
                    li.classList.add('selected');
                }
                list.appendChild(li);
            });

            listSection.appendChild(list);
        }

        layout.appendChild(listSection);

        // Right side: item info panel
        const infoSection = document.createElement('div');
        infoSection.className = 'inventory-info-section';

        const infoHeader = document.createElement('h3');
        infoHeader.innerText = 'ITEM INFO';
        infoSection.appendChild(infoHeader);

        if (this.items.length > 0 && this.items[this.selectedIndex]) {
            const selectedItem = this.items[this.selectedIndex];
            const infoLines = this.getItemInfo(selectedItem);

            infoLines.forEach(line => {
                const p = document.createElement('p');
                p.innerText = line;
                if (line === '') p.className = 'info-spacer';
                infoSection.appendChild(p);
            });
        } else {
            const noItem = document.createElement('p');
            noItem.className = 'no-item-selected';
            noItem.innerText = 'No item selected';
            infoSection.appendChild(noItem);
        }

        layout.appendChild(infoSection);
        this.container.appendChild(layout);

        // Controls hint
        const hint = document.createElement('div');
        hint.className = 'inventory-hint';
        hint.innerText = '↑/↓ Navigate | Enter Equip | I Close';
        this.container.appendChild(hint);
    }
}
