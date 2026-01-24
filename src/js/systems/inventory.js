import { SoundManager } from './sound-manager.js';
import { CONFIG } from '../config.js';

export class Inventory {
    constructor() {
        this.items = [];
        this.isOpen = false;
        this.selectedIndex = 0;
        this.container = document.getElementById('inventory-container');

        // UI element for ammo display
        this.ammoDisplay = document.getElementById('ammo-display');

        this.soundManager = new SoundManager();

        // Setup keyboard handler
        this.keyHandler = this.handleKeydown.bind(this);

        // Add starting ammo as an inventory item
        this.items.push({ name: '9mm Ammo', type: 'ammo', ammoType: '9mm', amount: 12 });

        // Initial render to ensure it's empty/ready
        this.render();
        this.render();
        this.updateAmmoUI();

        this.onEquip = null; // Callback for equipping weapons
        this.onUse = null;   // Callback for using items (medkits)
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
        const normalizedItem = typeof item === 'string' ? { name: item, type: 'misc' } : { ...item };

        // Assign unique ID
        normalizedItem.id = Date.now() + Math.random().toString(36).substr(2, 9);

        // Initialize mods array for weapons
        if (normalizedItem.type === 'weapon' || normalizedItem.damage) {
            normalizedItem.mods = normalizedItem.mods || [];
        }

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

        // Sub-mode for weapon selection (when using a mod)
        if (this.isSelectingWeapon) {
            this.handleWeaponSelectionInput(e);
            return;
        }

        switch (e.key) {
            case 'ArrowUp':
                e.preventDefault();
                this.selectedIndex = Math.max(0, this.selectedIndex - 1);
                this.soundManager.play('UI_NAV');
                this.render();
                break;
            case 'ArrowDown':
                e.preventDefault();
                this.selectedIndex = Math.min(this.items.length - 1, this.selectedIndex + 1);
                this.soundManager.play('UI_NAV');
                this.render();
                break;
            case 'Enter':
                e.preventDefault();
                if (this.items[this.selectedIndex]) {
                    const item = this.items[this.selectedIndex];
                    this.soundManager.play('UI_EQUIP');

                    if (item.type === 'mod') {
                        // Mod usage: show weapon selection
                        this.startWeaponSelection(item);
                    } else if (item.type === 'health' && this.onUse) {
                        this.onUse(item);
                        this.removeItem(item);
                        this.toggle();
                    } else if ((item.type === 'weapon' || item.damage) && this.onEquip) {
                        this.onEquip(item);
                        this.toggle();
                    }
                }
                break;
        }
    }

    startWeaponSelection(mod) {
        // Find all weapons
        this.eligibleWeapons = this.items.filter(i => i.type === 'weapon' || i.damage);

        if (this.eligibleWeapons.length === 0) {
            this.soundManager.play('DRY_FIRE');
            return;
        }

        this.isSelectingWeapon = true;
        this.selectedWeaponIndex = 0;
        this.pendingMod = mod;
        this.render();
    }

    handleWeaponSelectionInput(e) {
        switch (e.key) {
            case 'ArrowUp':
                this.selectedWeaponIndex = Math.max(0, this.selectedWeaponIndex - 1);
                this.soundManager.play('UI_NAV');
                this.render();
                break;
            case 'ArrowDown':
                this.selectedWeaponIndex = Math.min(this.eligibleWeapons.length - 1, this.selectedWeaponIndex + 1);
                this.soundManager.play('UI_NAV');
                this.render();
                break;
            case 'Enter':
                const weapon = this.eligibleWeapons[this.selectedWeaponIndex];
                this.attachModToWeapon(weapon, this.pendingMod);
                this.isSelectingWeapon = false;
                this.pendingMod = null;
                this.render();
                break;
            case 'Escape':
                this.isSelectingWeapon = false;
                this.pendingMod = null;
                this.render();
                break;
        }
    }

    attachModToWeapon(weapon, mod) {
        // Move mod into weapon
        weapon.mods.push(mod);

        // Remove mod from main inventory
        const modIdx = this.items.indexOf(mod);
        if (modIdx > -1) this.items.splice(modIdx, 1);

        // Adjust selected index if it was at the end
        if (this.selectedIndex >= this.items.length) {
            this.selectedIndex = Math.max(0, this.items.length - 1);
        }

        this.soundManager.play('UI_EQUIP');
        console.log(`Attached ${mod.name} to ${weapon.name || weapon.NAME}`);
    }

    getItemArt(item) {
        if (!CONFIG.IMAGES) return null;

        const name = (item.name || item.NAME || "").toUpperCase();
        if (name.includes('PISTOL')) return CONFIG.IMAGES.PISTOL;
        if (name.includes('SHOTGUN')) return CONFIG.IMAGES.SHOTGUN;
        if (name.includes('ASSERT') || name.includes('RIFLE')) {
            if (name.includes('SNIPER')) return CONFIG.IMAGES.SNIPER;
            return CONFIG.IMAGES.RIFLE;
        }
        if (name.includes('ROCKET')) return CONFIG.IMAGES.ROCKET;
        if (name.includes('GRENADE')) return CONFIG.IMAGES.GRENADE;
        if (name.includes('MINIGUN')) return CONFIG.IMAGES.MINIGUN;
        if (name.includes('HEALTH') || item.type === 'health') return CONFIG.IMAGES.MEDKIT;

        if (item.type === 'mod') return CONFIG.IMAGES.MOD;
        if (item.type === 'ammo') return CONFIG.IMAGES.AMMO;

        return null;
    }

    getItemInfo(item) {
        // Build info string based on item properties
        const info = [];

        info.push(`Name: ${item.name || item.NAME || 'Unknown'}`);

        // Item type
        const type = item.type || (item.damage ? 'weapon' : 'misc');
        info.push(`Type: ${type.charAt(0).toUpperCase() + type.slice(1)}`);

        // Weapon stats
        if (item.damage !== undefined || item.DAMAGE !== undefined) {
            // Include MOD bonuses in view? 
            // Or show base + mods separately for clarity.
            const baseDamage = item.DAMAGE || item.damage;
            const damageBonus = (item.mods || []).reduce((sum, m) => sum + (m.DAMAGE_BONUS || 0), 0);

            if (item.PELLETS) {
                info.push(`Damage: ${baseDamage}${damageBonus > 0 ? ` (+${damageBonus})` : ''}x${item.PELLETS}`);
            } else {
                info.push(`Damage: ${baseDamage}${damageBonus > 0 ? ` (+${damageBonus})` : ''}`);
            }
        }

        if (item.RANGE || item.range !== undefined) {
            const baseRange = item.RANGE || item.range;
            const rangeBonus = (item.mods || []).reduce((sum, m) => sum + (m.RANGE_BONUS || 0), 0);
            info.push(`Range: ${baseRange}${rangeBonus > 0 ? ` (+${rangeBonus})` : ''}`);
        }

        if (item.MAGAZINE_SIZE !== undefined) {
            info.push(`Mag: ${item.MAGAZINE_SIZE}`);
        }

        if (item.mods && item.mods.length > 0) {
            info.push('');
            info.push('MODS:');
            item.mods.forEach(m => info.push(`- ${m.name || m.NAME}`));
        }

        // Description
        if (item.description || item.DESCRIPTION) {
            info.push('');
            info.push(item.description || item.DESCRIPTION);
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
        header.innerText = this.isSelectingWeapon ? 'SELECT WEAPON' : 'INVENTORY';
        listSection.appendChild(header);

        const currentList = this.isSelectingWeapon ? this.eligibleWeapons : this.items;

        if (currentList.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'inventory-empty';
            emptyMsg.innerText = '[ NO ITEMS ]';
            listSection.appendChild(emptyMsg);
        } else {
            const list = document.createElement('ul');
            list.className = 'inventory-list';

            currentList.forEach((item, index) => {
                const li = document.createElement('li');
                li.innerText = item.name || item.NAME || item;

                const activeIdx = this.isSelectingWeapon ? this.selectedWeaponIndex : this.selectedIndex;
                if (index === activeIdx) {
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

        const activeItem = this.isSelectingWeapon ?
            this.eligibleWeapons[this.selectedWeaponIndex] :
            this.items[this.selectedIndex];

        if (activeItem) {
            // ASCII Art Section
            const art = this.getItemArt(activeItem);
            if (art) {
                const artEl = document.createElement('img');
                artEl.className = 'item-art-image';
                artEl.src = art;
                artEl.alt = activeItem.name || activeItem.NAME || 'Item';
                infoSection.appendChild(artEl);

                const artSpacer = document.createElement('div');
                artSpacer.className = 'info-spacer';
                infoSection.appendChild(artSpacer);
            }

            const infoLines = this.getItemInfo(activeItem);

            infoLines.forEach(line => {
                const p = document.createElement('p');
                p.innerText = line;
                if (line === '') p.className = 'info-spacer';
                infoSection.appendChild(p);
            });
        }

        layout.appendChild(infoSection);
        this.container.appendChild(layout);

        // Controls hint
        const hint = document.createElement('div');
        hint.className = 'inventory-hint';
        if (this.isSelectingWeapon) {
            hint.innerText = '↑/↓ Choose Weapon | Enter Attach | Esc Cancel';
        } else {
            hint.innerText = '↑/↓ Navigate | Enter Use/Equip | I Close';
        }
        this.container.appendChild(hint);
    }
}
