export const CONFIG = {
    MAP_WIDTH: 80,
    MAP_HEIGHT: 40,
    MAX_ROOMS: 10,
    ROOM_MIN_SIZE: 6,
    ROOM_MAX_SIZE: 12,
    FOV_RADIUS: 15,
    PLAYER: {
        MAX_HP: 100,
        START_HP: 100
    },
    ENEMY: {
        MELEE_DAMAGE: 10,
        RANGED_DAMAGE: 5,
        RANGED_ATTACK_RANGE: 6,
        RANGED_ATTACK_CHANCE: 0.5  // 50% chance to shoot per turn when in range
    },
    WEAPON: {
        PISTOL: {
            NAME: 'Pistol',
            MAGAZINE_SIZE: 12,
            DAMAGE: 1,
            RANGE: 8,
            AMMO_TYPE: '9mm',
            DESCRIPTION: 'Reliable sidearm.',
            TYPE: 'hitscan'
        },
        SHOTGUN: {
            NAME: 'Shotgun',
            MAGAZINE_SIZE: 6,
            DAMAGE: 1, // Per pellet
            PELLETS: 5,
            SPREAD: 0.3, // Spread angle factor
            RANGE: 4,
            AMMO_TYPE: 'shells',
            DESCRIPTION: 'Close quarters devastation.',
            TYPE: 'hitscan'
        },
        RIFLE: {
            NAME: 'Assault Rifle',
            MAGAZINE_SIZE: 30,
            DAMAGE: 2,
            RANGE: 10,
            AMMO_TYPE: '7.62mm',
            BURST: 3, // Shoots 3 times per action? Or just reliable single shot. Let's make it single for now but higher damage/range than pistol.
            DESCRIPTION: 'Versatile automatic rifle.',
            TYPE: 'hitscan'
        },
        SNIPER: {
            NAME: 'Sniper Rifle',
            MAGAZINE_SIZE: 4,
            DAMAGE: 10,
            RANGE: 20,
            AMMO_TYPE: '7.62mm',
            DESCRIPTION: 'High caliber precision.',
            TYPE: 'hitscan'
        },
        ROCKET: {
            NAME: 'Rocket Launcher',
            MAGAZINE_SIZE: 1,
            DAMAGE: 10, // Direct hit
            AOE_DAMAGE: 5,
            AOE_RADIUS: 2,
            RANGE: 12,
            AMMO_TYPE: 'rocket',
            DESCRIPTION: 'Explosive crowd control.',
            TYPE: 'projectile'
        },
        MINIGUN: {
            NAME: 'Minigun',
            MAGAZINE_SIZE: 100,
            DAMAGE: 1,
            RANGE: 8,
            BURST: 5, // Fires multiple shots per turn
            AMMO_TYPE: '7.62mm',
            DESCRIPTION: 'Lead rain.',
            TYPE: 'hitscan'
        },
        MELEE: {
            NAME: 'Combat Knife',
            MAGAZINE_SIZE: 0,
            DAMAGE: 5,
            RANGE: 1,
            AMMO_TYPE: null,
            DESCRIPTION: 'Silent and deadly.',
            TYPE: 'melee'
        }
    },
    TILE: {
        WALL: '#',
        FLOOR: '.',
        PLAYER: '@',
        ELEVATOR: 'E',
        EMPTY: ' ',
        RETICLE: '+',
        PROJECTILE: '*',
        ENEMY_MELEE: 'M',
        ENEMY_RANGED: 'R',
        // Ammo
        AMMO_9MM: 'o',
        AMMO_SHELLS: 's',
        AMMO_762: 'i',
        AMMO_ROCKET: 'r',
        // Weapons (generic char for now, or specific)
        WEAPON_DROP: 'W'
    }
};
