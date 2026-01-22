/**
 * SPRITE CONFIGURATION
 *
 * Easy reference for all game assets. Just drop your images in public/assets/
 * and update the paths here. The game will automatically use them.
 *
 * Recommended sprite sizes:
 * - Buildings: 128x128 or 256x256 (will be scaled)
 * - Units: 64x64 or 128x128
 * - Terrain: 64x32 (isometric tile)
 * - Effects: 32x32 or 64x64
 * - UI: varies
 *
 * Supported formats: PNG (recommended), JPG, WebP
 */

export const SPRITES = {
  // ============================================
  // BUILDINGS
  // ============================================
  buildings: {
    townHall: {
      path: '/assets/buildings/town-hall.png',
      // fallback to procedural if no image
      useFallback: true,
      width: 1833,
      height: 1269,
      displayWidth: 150,
      displayHeight: 104,
      anchorX: 0.5,
      anchorY: 0.7
    },
    tower_food: {
      path: '/assets/buildings/tower-food.png',
      useFallback: true,
      width: 64,
      height: 96,
      anchorX: 0.5,
      anchorY: 0.7
    },
    tower_transport: {
      path: '/assets/buildings/tower-transport.png',
      useFallback: true,
      width: 64,
      height: 96,
      anchorX: 0.5,
      anchorY: 0.7
    },
    tower_entertainment: {
      path: '/assets/buildings/tower-entertainment.png',
      useFallback: true,
      width: 64,
      height: 96,
      anchorX: 0.5,
      anchorY: 0.7
    },
    tower_utilities: {
      path: '/assets/buildings/tower-utilities.png',
      useFallback: true,
      width: 64,
      height: 96,
      anchorX: 0.5,
      anchorY: 0.7
    },
    mine_401k: {
      path: '/assets/buildings/mine-401k.png',
      useFallback: true,
      width: 80,
      height: 100,
      anchorX: 0.5,
      anchorY: 0.7
    },
    mine_roth: {
      path: '/assets/buildings/mine-roth.png',
      useFallback: true,
      width: 80,
      height: 100,
      anchorX: 0.5,
      anchorY: 0.7
    },
    debt: {
      path: '/assets/buildings/building-debt.png',
      useFallback: true,
      width: 400,
      height: 300,
      displayWidth: 100,
      displayHeight: 75,
      anchorX: 0.5,
      anchorY: 0.7
    },
    storehouse: {
      path: '/assets/buildings/building-storagehouse.png',
      useFallback: true,
      width: 400,
      height: 300,
      displayWidth: 100,
      displayHeight: 75,
      anchorX: 0.5,
      anchorY: 0.7
    },
    tower: {
      path: '/assets/buildings/building-tower.png',
      useFallback: true,
      width: 988,
      height: 1240,
      displayWidth: 100,
      displayHeight: 125,
      anchorX: 0.5,
      anchorY: 0.7
    },
    statue: {
      path: '/assets/buildings/building-statue.png',
      useFallback: true,
      width: 1002,
      height: 1227,
      displayWidth: 100,
      displayHeight: 122,
      anchorX: 0.5,
      anchorY: 0.7
    }
  },

  // ============================================
  // UNITS
  // ============================================
  units: {
    peon: {
      path: '/assets/units/peon.png',
      useFallback: true,
      width: 32,
      height: 32,
      anchorX: 0.5,
      anchorY: 0.8
    },
    peon_walk: {
      // animated sprite sheet (optional)
      path: '/assets/units/peon-walk.png',
      frames: 4,
      frameWidth: 32,
      frameHeight: 32,
      useFallback: true
    },
    enemy_small: {
      path: '/assets/units/enemy-small.png',
      useFallback: true,
      width: 32,
      height: 32,
      anchorX: 0.5,
      anchorY: 0.5
    },
    enemy_rent: {
      path: '/assets/units/enemy-rent.png',
      useFallback: true,
      width: 64,
      height: 64,
      anchorX: 0.5,
      anchorY: 0.5
    },
    enemy_debt: {
      path: '/assets/units/enemy-debt.png',
      useFallback: true,
      width: 64,
      height: 64,
      anchorX: 0.5,
      anchorY: 0.5
    }
  },

  // ============================================
  // TERRAIN
  // ============================================
  terrain: {
    grass: {
      path: '/assets/terrain/grass.png',
      useFallback: true,
      width: 64,
      height: 32
    },
    grass_variant1: {
      path: '/assets/terrain/grass-v1.png',
      useFallback: true,
      width: 64,
      height: 32
    },
    grass_variant2: {
      path: '/assets/terrain/grass-v2.png',
      useFallback: true,
      width: 64,
      height: 32
    },
    dirt: {
      path: '/assets/terrain/dirt.png',
      useFallback: true,
      width: 64,
      height: 32
    },
    creep: {
      // debt creep overlay
      path: '/assets/terrain/creep.png',
      useFallback: true,
      width: 64,
      height: 32
    }
  },

  // ============================================
  // EFFECTS
  // ============================================
  effects: {
    projectile: {
      path: '/assets/effects/projectile.png',
      useFallback: true,
      width: 16,
      height: 16
    },
    explosion: {
      path: '/assets/effects/explosion.png',
      frames: 6,
      frameWidth: 64,
      frameHeight: 64,
      useFallback: true
    },
    gold_particle: {
      path: '/assets/effects/gold-particle.png',
      useFallback: true,
      width: 16,
      height: 16
    },
    damage_number: {
      path: '/assets/effects/damage-number.png',
      useFallback: true,
      width: 32,
      height: 16
    }
  },

  // ============================================
  // UI ELEMENTS
  // ============================================
  ui: {
    health_bar_bg: {
      path: '/assets/ui/health-bar-bg.png',
      useFallback: true
    },
    health_bar_fill: {
      path: '/assets/ui/health-bar-fill.png',
      useFallback: true
    },
    gold_icon: {
      path: '/assets/ui/gold-icon.png',
      useFallback: true,
      width: 24,
      height: 24
    },
    debt_icon: {
      path: '/assets/ui/debt-icon.png',
      useFallback: true,
      width: 24,
      height: 24
    }
  }
}

/**
 * COLOR PALETTE
 * Use these for procedural fallbacks to maintain consistency
 */
export const COLORS = {
  // buildings
  townHall: { primary: 0x6a8ccc, secondary: 0x4a6ca0, roof: 0x8ab4f8 },
  tower_food: { primary: 0xff6b6b, secondary: 0xcc5555 },
  tower_transport: { primary: 0x4ecdc4, secondary: 0x3ba39c },
  tower_entertainment: { primary: 0xffe66d, secondary: 0xcbb856 },
  tower_utilities: { primary: 0x95e1d3, secondary: 0x77b4a8 },
  mine_401k: { primary: 0xffd700, secondary: 0xb8860b },
  mine_roth: { primary: 0xc0c0c0, secondary: 0x909090 },

  // units
  peon: { body: 0xffd93d, bag: 0xc9a227 },
  enemy_small: { body: 0xff6b6b },
  enemy_rent: { body: 0xff0000, shadow: 0xaa0000 },
  enemy_debt: { body: 0x800080, glow: 0xaa55aa },

  // terrain
  grass: { base: 0x2d5a27, light: 0x3d6a37, dark: 0x1d4a17 },
  creep: { base: 0x4a0050, spread: 0x6a2080 },

  // ui
  health_high: 0x00ff00,
  health_mid: 0xffff00,
  health_low: 0xff0000,
  gold: 0xffd700,
  debt: 0xff4444
}
