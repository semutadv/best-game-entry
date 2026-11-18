// The things that fly: bullets, raiders, the boss, power-ups and particles. The pools
// are allocated once and reused, so the game never allocates while it plays. This file
// owns spawning and movement; the world owns the schedule, the firing and the collisions.
import { BOSS, ENEMY, FIELD, POOL, POWERUP } from './config.js';
import { chance, pick, range } from './random.js';

export const KIND_DRIFTER = 'drifter';
export const KIND_WEAVER = 'weaver';
export const KIND_SPITTER = 'spitter';
export const KIND_BRUTE = 'brute';

/** All pools, each entry carrying an `active` flag. */
export function makePools() {
  const bullets = [];
  for (let i = 0; i < POOL.bullets; i += 1) bullets.push({ active: false, x: 0, y: 0, vx: 0, vy: 0 });
  const enemyBullets = [];
  for (let i = 0; i < POOL.enemyBullets; i += 1) enemyBullets.push({ active: false, x: 0, y: 0, vx: 0, vy: 0 });
  const enemies = [];
  for (let i = 0; i < POOL.enemies; i += 1) {
    enemies.push({ active: false, kind: KIND_DRIFTER, x: 0, y: 0, vx: 0, vy: 0, hp: 1, maxHp: 1, radius: 20, score: 0, fireTimer: 0, t: 0, seed: 0, baseX: 0 });
  }
  const particles = [];
  for (let i = 0; i < POOL.particles; i += 1) {
    particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#ffffff' });
  }
  const powerups = [];
  for (let i = 0; i < POOL.powerups; i += 1) powerups.push({ active: false, kind: 'spread', x: 0, y: 0, vy: 0 });
  return { bullets, enemyBullets, enemies, particles, powerups };
}

function freeSlot(pool) {
  for (let i = 0; i < pool.length; i += 1) if (!pool[i].active) return pool[i];
  return null;
}

/** One player bullet, straight up or at a slight angle for the spread shot. */
export function spawnBullet(bullets, x, y, vx, vy) {
  const bullet = freeSlot(bullets);
  if (bullet === null) return;
  bullet.active = true;
  bullet.x = x;
  bullet.y = y;
  bullet.vx = vx;
  bullet.vy = vy;
}

/** One enemy bullet, aimed. */
export function spawnEnemyBullet(enemyBullets, x, y, vx, vy) {
  const bullet = freeSlot(enemyBullets);
  if (bullet === null) return;
  bullet.active = true;
  bullet.x = x;
  bullet.y = y;
  bullet.vx = vx;
  bullet.vy = vy;
}

/** One raider of `kind`, entering from the top at x. */
export function spawnEnemy(enemies, kind, x, speedScale, random) {
  const enemy = freeSlot(enemies);
  if (enemy === null) return null;
  const def = ENEMY[kind];
  enemy.active = true;
  enemy.kind = kind;
  enemy.x = x;
  enemy.y = -def.radius;
  enemy.vx = 0;
  enemy.vy = def.speed * speedScale * range(random, 0.9, 1.15);
  enemy.hp = def.hp;
  enemy.maxHp = def.hp;
  enemy.radius = def.radius;
  enemy.score = def.score;
  enemy.fireTimer = range(random, 1, def.fireInterval ?? 2);
  enemy.t = 0;
  enemy.seed = random() * Math.PI * 2;
  enemy.baseX = x;
  return enemy;
}

/** Which kind the next raider is, weighted by what the wave has unlocked. */
export function pickKind(wave, random) {
  const table = [['drifter', 10]];
  if (wave >= 2) table.push(['weaver', 6]);
  if (wave >= 3) table.push(['spitter', 5]);
  if (wave >= 4) table.push(['brute', 3 + wave * 0.2]);
  let total = 0;
  for (const [, weight] of table) total += weight;
  let roll = random() * total;
  for (const [kind, weight] of table) {
    roll -= weight;
    if (roll <= 0) return kind;
  }
  return 'drifter';
}

/** The boss, entering from the top centre. */
export function spawnBoss() {
  return {
    active: true,
    x: FIELD.width / 2,
    y: -BOSS.radius,
    vx: 0,
    hp: BOSS.hp,
    maxHp: BOSS.hp,
    radius: BOSS.radius,
    t: 0,
    burstTimer: 2,
    aimedTimer: 1,
    minionTimer: BOSS.minionInterval,
    entering: true,
  };
}

/** A falling power-up of a random kind. */
export function spawnPowerup(powerups, x, y, random) {
  const powerup = freeSlot(powerups);
  if (powerup === null) return;
  powerup.active = true;
  powerup.kind = pick(random, POWERUP.kinds);
  powerup.x = x;
  powerup.y = y;
  powerup.vy = POWERUP.fallSpeed;
}

/** Maybe drop a power-up where an enemy died. */
export function maybeDrop(powerups, x, y, random) {
  if (chance(random, POWERUP.dropChance)) spawnPowerup(powerups, x, y, random);
}

/** A burst of sparks at a point, in one colour. */
export function burst(particles, x, y, color, count, speed) {
  for (let i = 0; i < count; i += 1) {
    const particle = freeSlot(particles);
    if (particle === null) return;
    const angle = Math.random() * Math.PI * 2;
    const velocity = speed * (0.3 + Math.random() * 0.7);
    particle.active = true;
    particle.x = x;
    particle.y = y;
    particle.vx = Math.cos(angle) * velocity;
    particle.vy = Math.sin(angle) * velocity;
    particle.life = 0.45 + Math.random() * 0.35;
    particle.maxLife = particle.life;
    particle.size = 2 + Math.random() * 3;
    particle.color = color;
  }
}

/** Move the player's bullets; drop the ones that leave the top. */
export function updateBullets(bullets, dt) {
  for (const bullet of bullets) {
    if (!bullet.active) continue;
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    if (bullet.y < -24 || bullet.x < -24 || bullet.x > FIELD.width + 24) bullet.active = false;
  }
}

/** Move the enemy bullets; drop the ones that leave the field. */
export function updateEnemyBullets(enemyBullets, dt) {
  for (const bullet of enemyBullets) {
    if (!bullet.active) continue;
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    if (bullet.y > FIELD.height + 24 || bullet.y < -24 || bullet.x < -24 || bullet.x > FIELD.width + 24) bullet.active = false;
  }
}

/** Move the raiders: drifters fall straight, weavers sine, spitters and brutes fall slow. */
export function updateEnemies(enemies, dt) {
  for (const enemy of enemies) {
    if (!enemy.active) continue;
    enemy.t += dt;
    if (enemy.kind === KIND_WEAVER) {
      enemy.x = enemy.baseX + Math.sin(enemy.t * 2.4 + enemy.seed) * 90;
    }
    enemy.y += enemy.vy * dt;
    if (enemy.y - enemy.radius > FIELD.height) enemy.active = false;
  }
}

/** Move the boss: slide in, then strafe across the top third, slowly descending. */
export function updateBoss(boss, dt) {
  if (boss === null || !boss.active) return;
  boss.t += dt;
  if (boss.entering) {
    boss.y += 90 * dt;
    if (boss.y >= 130) {
      boss.y = 130;
      boss.entering = false;
    }
    return;
  }
  boss.x += Math.sin(boss.t * 0.7) * 170 * dt;
  boss.x = Math.max(BOSS.radius, Math.min(FIELD.width - BOSS.radius, boss.x));
}

/** Fade the sparks out. */
export function updateParticles(particles, dt) {
  for (const particle of particles) {
    if (!particle.active) continue;
    particle.life -= dt;
    if (particle.life <= 0) {
      particle.active = false;
      continue;
    }
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= 1 - 2.4 * dt;
    particle.vy *= 1 - 2.4 * dt;
  }
}

/** Power-ups drift down; drop the ones that leave the bottom. */
export function updatePowerups(powerups, dt) {
  for (const powerup of powerups) {
    if (!powerup.active) continue;
    powerup.y += powerup.vy * dt;
    if (powerup.y > FIELD.height + 30) powerup.active = false;
  }
}

/** How many raiders are still flying. */
export function countEnemies(enemies) {
  let count = 0;
  for (const enemy of enemies) if (enemy.active) count += 1;
  return count;
}

/** Switch every enemy and enemy bullet off (the boss's death clears the sky). */
export function clearSky(enemies, enemyBullets, particles) {
  for (const enemy of enemies) {
    if (!enemy.active) continue;
    burst(particles, enemy.x, enemy.y, '#ffb347', 6, 140);
    enemy.active = false;
  }
  for (const bullet of enemyBullets) bullet.active = false;
}
