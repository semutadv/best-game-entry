// Every tuning number and colour of Starfall Defender in one place. The playfield is a
// fixed 1280x720 logical area; the renderer scales it to the window, so no rule below
// depends on the screen size.
export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  width: 54,
  height: 42,
  speed: 560,
  /** Seconds of blinking safety after a hit. */
  invulnerable: 2,
  /** Seconds between shots (halved while Rapid fire lasts). */
  fireInterval: 0.17,
  /** How long a power-up lasts, in seconds. */
  powerupSeconds: 12,
};

export const LIVES = 3;
export const START_BOMBS = 1;
export const MAX_BOMBS = 3;

export const BULLET = { speed: 780, width: 6, height: 18 };
export const ENEMY_BULLET = { speed: 300, radius: 6 };

/** Enemy kinds, by key: hit points, speed, radius, score, and how they behave. */
export const ENEMY = {
  drifter: { hp: 1, speed: 150, radius: 20, score: 50 },
  weaver: { hp: 2, speed: 175, radius: 20, score: 100 },
  spitter: { hp: 2, speed: 120, radius: 22, score: 150, fireInterval: 2.4 },
  brute: { hp: 9, speed: 68, radius: 34, score: 300 },
};

/** The boss that closes every fifth wave. */
export const BOSS = {
  name: 'RAIDER PRIME',
  hp: 240,
  radius: 72,
  score: 5000,
  /** Seconds between radial bullet bursts. */
  burstInterval: 2.6,
  /** Seconds between aimed shots. */
  aimedInterval: 0.9,
  /** Seconds between minion spawns. */
  minionInterval: 5,
};

export const POWERUP = {
  fallSpeed: 140,
  radius: 15,
  /** Drop chance per destroyed enemy. */
  dropChance: 0.09,
  /** Kinds in the drop table, in order. */
  kinds: ['spread', 'rapid', 'shield', 'bomb', 'life'],
};

/** Waves: how many raiders a wave holds, and how fast they arrive. */
export const WAVE = {
  baseEnemies: 6,
  perWave: 3,
  spawnInterval: 0.85,
  /** Every Nth wave is a boss wave. */
  bossEvery: 5,
  /** Score bonus for clearing a wave, times the wave number. */
  clearBonus: 250,
};

/** How many of each thing can exist at once; the pools are allocated once, at boot. */
export const POOL = { bullets: 96, enemyBullets: 160, enemies: 48, particles: 320, powerups: 12 };

export const PALETTE = {
  backdrop: '#04060f',
  skyTop: '#070b1d',
  skyBottom: '#0d1530',
  star: '#cdd8ff',
  player: '#59d8ff',
  playerCore: '#e8fbff',
  bullet: '#8ef1ff',
  enemyBullet: '#ff7ab8',
  drifter: '#ff8a5c',
  weaver: '#e06bff',
  spitter: '#b78cff',
  brute: '#ff5d5d',
  boss: '#ffb347',
  powerSpread: '#ffd166',
  powerRapid: '#6bff9e',
  powerShield: '#59d8ff',
  powerBomb: '#ff7ab8',
  powerLife: '#ff5d7a',
  panel: '#0d1526',
  panelEdge: '#2a3a5f',
  text: '#eef1f5',
  muted: '#93a0bd',
  gold: '#ffd166',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'starfall-defender.best';
