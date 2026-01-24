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
        RANGED_ATTACK_CHANCE: 0.5
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
            DAMAGE: 1,
            PELLETS: 5,
            SPREAD: 0.3,
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
            DAMAGE: 10,
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
            BURST: 5,
            AMMO_TYPE: '7.62mm',
            DESCRIPTION: 'Lead rain.',
            TYPE: 'hitscan'
        },
        FRAG_GRENADE: {
            NAME: 'Grenade',
            MAGAZINE_SIZE: 1,
            DAMAGE: 20,
            AOE_DAMAGE: 15,
            AOE_RADIUS: 3,
            RANGE: 8,
            AMMO_TYPE: 'grenade',
            DESCRIPTION: 'Frag out.',
            TYPE: 'projectile'
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
    MOD: {
        LASER_SIGHT: {
            NAME: 'Laser Sight',
            SPREAD_MULT: 0.5,
            DESCRIPTION: 'Greatly reduces weapon spread.'
        },
        EXTENDED_MAG: {
            NAME: 'Extended Mag',
            MAG_MULT: 1.5,
            DESCRIPTION: 'Increases magazine capacity.'
        },
        HEAVY_BARREL: {
            NAME: 'Heavy Barrel',
            DAMAGE_BONUS: 2,
            DESCRIPTION: 'Increases damage per shot.'
        },
        ACOG_SCOPE: {
            NAME: 'ACOG Scope',
            RANGE_BONUS: 5,
            DESCRIPTION: 'Increases effective range.'
        }
    },
    IMAGES: {
        PISTOL: 'resources/images/items/pistol.png',
        SHOTGUN: 'resources/images/items/shotgun.png',
        RIFLE: 'resources/images/items/rifle.png',
        SNIPER: 'resources/images/items/sniper.png',
        ROCKET: 'resources/images/items/rocket.png',
        MINIGUN: 'resources/images/items/minigun.png',
        GRENADE: 'resources/images/items/grenade.png',
        AMMO: 'resources/images/items/ammo.png',
        MEDKIT: 'resources/images/items/medkit.png',
        MOD: 'resources/images/items/mod.png'
    },
    AUDIO: {
        MUSIC: {
            MAIN_THEME: 'resources/audio/music/main_theme.ogg'
        },
        SFX: {
            PISTOL: 'resources/audio/sfx/pistol.ogg',
            SHOTGUN: 'resources/audio/sfx/shotgun.ogg',
            RIFLE: 'resources/audio/sfx/rifle.ogg',
            SNIPER: 'resources/audio/sfx/sniper.ogg',
            ROCKET: 'resources/audio/sfx/rocket.ogg',
            MINIGUN: 'resources/audio/sfx/minigun.ogg',
            MELEE: 'resources/audio/sfx/melee.ogg',
            DRY_FIRE: 'resources/audio/sfx/dry_fire.ogg',
            RELOAD: 'resources/audio/sfx/reload.ogg',
            PICKUP_AMMO: 'resources/audio/sfx/pickup_ammo.ogg',
            PICKUP_WEAPON: 'resources/audio/sfx/pickup_weapon.ogg',
            PICKUP_HEALTH: 'resources/audio/sfx/pickup_health.ogg',
            PLAYER_HIT: 'resources/audio/sfx/player_hit.ogg',
            ENEMY_HIT: 'resources/audio/sfx/enemy_hit.ogg',
            LEVEL_UP: 'resources/audio/sfx/level_up.ogg',
            ELEVATOR: 'resources/audio/sfx/elevator.ogg',
            UI_NAV: 'resources/audio/sfx/ui_nav.ogg',
            UI_EQUIP: 'resources/audio/sfx/ui_equip.ogg'
        },
        AMBIENT: {
            MACHINERY: 'resources/audio/ambient/machinery_hum.ogg',
            WIND: 'resources/audio/ambient/wind_hallway.ogg',
            ELECTRICAL: 'resources/audio/ambient/electrical_buzz.ogg',
            ELEVATOR_IDLE: 'resources/audio/ambient/elevator_idle.ogg'
        }
    },
    AMBIENT_SETTINGS: {
        MAX_DISTANCE: 20,
        FALLOFF: 1.5,
        OCCLUSION_DAMPING: 0.5
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
        AMMO_9MM: 'o',
        AMMO_SHELLS: 's',
        AMMO_762: 'i',
        AMMO_ROCKET: 'r',
        AMMO_GRENADE: 'g',
        BARREL: '0',
        BOX: 'X',
        GENERATOR: 'G',
        PIPE_V: '|',
        PIPE_H: '-',
        WEAPON_DROP: 'W',
        MOD_DROP: 'm',
        HEALTH_KIT: 'H'
    }
};
