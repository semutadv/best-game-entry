// The game's rules and state, with no drawing and no browser in it: the player's ship,
// the waves of raiders, the boss, spawning, collisions, score, lives and power-ups.
// step() advances one fixed step and returns what happened as bit flags, so the caller
// can react (sound, announcements) without the world knowing about screens or sound.
import { BOSS, ENEMY, ENEMY_BULLET, FIELD, LIVES, PLAYER, POWERUP, START_BOMBS, MAX_BOMBS, WAVE } from './config.js';
import { range } from './random.js';
import {
  burst,
  clearSky,
  countEnemies,
  makePools,
  maybeDrop,
  pickKind,
  spawnBoss,
  spawnBullet,
  spawnEnemy,
  spawnEnemyBullet,
  spawnPowerup,
  updateBoss,
  updateBullets,
  updateEnemies,
  updateEnemyBullets,
  updateParticles,
  updatePowerups,
} from './entities.js';

export const EVENT_HIT = 1;
export const EVENT_OVER = 2;
export const EVENT_WAVE_CLEAR = 4;
export const EVENT_BOSS_DOWN = 8;
export const EVENT_POWERUP = 16;
export const EVENT_BOMB = 32;

const PLAYER_RADIUS = 20;

function distanceSquared(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function createWorld(random) {
  const pools = makePools();
  const player = {
    x: FIELD.width / 2,
    y: FIELD.height - 90,
    width: PLAYER.width,
    height: PLAYER.height,
    invulnerable: 0,
    fireTimer: 0,
    spreadTimer: 0,
    rapidTimer: 0,
    shield: false,
    bombs: START_BOMBS,
  };
  const state = {
    player,
    bullets: pools.bullets,
    enemyBullets: pools.enemyBullets,
    enemies: pools.enemies,
    particles: pools.particles,
    powerups: pools.powerups,
    boss: null,
    score: 0,
    lives: LIVES,
    wave: 1,
    waveState: 'announce',
    waveTimer: 1.6,
    spawnTimer: 0,
    spawnLeft: 0,
    elapsed: 0,
    kills: 0,
    shake: 0,
    banner: { text: 'WAVE 1', timer: 1.6 },
  };

  function reset() {
    player.x = FIELD.width / 2;
    player.y = FIELD.height - 90;
    player.invulnerable = 0;
    player.fireTimer = 0;
    player.spreadTimer = 0;
    player.rapidTimer = 0;
    player.shield = false;
    player.bombs = START_BOMBS;
    for (const pool of Object.values(pools)) for (const entry of pool) entry.active = false;
    state.boss = null;
    state.score = 0;
    state.lives = LIVES;
    state.wave = 1;
    state.waveState = 'announce';
    state.waveTimer = 1.6;
    state.spawnTimer = 0;
    state.spawnLeft = 0;
    state.elapsed = 0;
    state.kills = 0;
    state.shake = 0;
    state.banner = { text: 'WAVE 1', timer: 1.6 };
  }

  /** Jump to a wave (the screenshot scenes use it to reach the boss). */
  function beginWave(number) {
    state.wave = number;
    state.waveState = 'announce';
    state.waveTimer = 0.01;
    state.spawnTimer = 0;
    state.spawnLeft = 0;
    state.banner = { text: number % WAVE.bossEvery === 0 ? 'WARNING' : `WAVE ${number}`, timer: 1.6 };
  }

  function speedScale() {
    return Math.min(1.5, 1 + (state.wave - 1) * 0.05);
  }

  function openWave() {
    if (state.wave % WAVE.bossEvery === 0) {
      state.boss = spawnBoss();
      state.waveState = 'boss';
      state.banner = { text: `WARNING — ${BOSS.name}`, timer: 2.4 };
    } else {
      state.spawnLeft = WAVE.baseEnemies + WAVE.perWave * (state.wave - 1);
      state.spawnTimer = 0.4;
      state.waveState = 'fight';
      state.banner = { text: `WAVE ${state.wave}`, timer: 1.6 };
    }
  }

  function spawnOne() {
    const kind = pickKind(state.wave, random);
    spawnEnemy(state.enemies, kind, range(random, 50, FIELD.width - 50), speedScale(), random);
  }

  function playerHit(events, sound) {
    if (player.invulnerable > 0) return events;
    if (player.shield) {
      player.shield = false;
      player.invulnerable = 1;
      burst(state.particles, player.x, player.y, '#59d8ff', 18, 220);
      if (sound) sound.hit();
      return events;
    }
    state.lives -= 1;
    player.invulnerable = PLAYER.invulnerable;
    player.spreadTimer = 0;
    player.rapidTimer = 0;
    state.shake = 14;
    burst(state.particles, player.x, player.y, '#ff5d5d', 26, 260);
    if (sound) sound.hit();
    events |= EVENT_HIT;
    if (state.lives <= 0) events |= EVENT_OVER;
    return events;
  }

  function killEnemy(enemy, events, sound) {
    enemy.active = false;
    state.score += enemy.score;
    state.kills += 1;
    burst(state.particles, enemy.x, enemy.y, '#ffb347', 16, 200);
    if (sound) sound.explosion(false);
    maybeDrop(state.powerups, enemy.x, enemy.y, random);
    return events;
  }

  function firePlayerGuns(sound) {
    const interval = player.rapidTimer > 0 ? PLAYER.fireInterval / 2 : PLAYER.fireInterval;
    if (player.fireTimer > 0) return;
    player.fireTimer = interval;
    const y = player.y - player.height / 2;
    if (player.spreadTimer > 0) {
      spawnBullet(state.bullets, player.x, y, -140, -760);
      spawnBullet(state.bullets, player.x, y, 0, -800);
      spawnBullet(state.bullets, player.x, y, 140, -760);
    } else {
      spawnBullet(state.bullets, player.x, y, 0, -800);
    }
    if (sound) sound.laser();
  }

  function fireBossGuns(sound) {
    const boss = state.boss;
    if (boss === null || !boss.active || boss.entering) return;
    boss.burstTimer -= 1 / 60;
    boss.aimedTimer -= 1 / 60;
    boss.minionTimer -= 1 / 60;
    if (boss.burstTimer <= 0) {
      boss.burstTimer = BOSS.burstInterval;
      const count = 10;
      for (let i = 0; i < count; i += 1) {
        const angle = (i / count) * Math.PI * 2 + boss.t * 0.2;
        spawnEnemyBullet(state.enemyBullets, boss.x, boss.y + 20, Math.cos(angle) * 220, Math.sin(angle) * 220);
      }
      if (sound) sound.enemyLaser();
    }
    if (boss.aimedTimer <= 0) {
      boss.aimedTimer = BOSS.aimedInterval;
      const dx = player.x - boss.x;
      const dy = player.y - boss.y;
      const length = Math.hypot(dx, dy) || 1;
      spawnEnemyBullet(state.enemyBullets, boss.x, boss.y + 30, (dx / length) * ENEMY_BULLET.speed, (dy / length) * ENEMY_BULLET.speed);
      if (sound) sound.enemyLaser();
    }
    if (boss.minionTimer <= 0) {
      boss.minionTimer = BOSS.minionInterval;
      spawnEnemy(state.enemies, 'drifter', range(random, 60, FIELD.width - 60), speedScale(), random);
    }
  }

  function useBomb(events, sound) {
    if (player.bombs <= 0) return events;
    if (countEnemies(state.enemies) === 0 && state.boss === null) return events;
    player.bombs -= 1;
    for (const bullet of state.enemyBullets) {
      if (bullet.active) burst(state.particles, bullet.x, bullet.y, '#ff7ab8', 2, 90);
      bullet.active = false;
    }
    for (const enemy of state.enemies) {
      if (!enemy.active) continue;
      enemy.hp -= 4;
      burst(state.particles, enemy.x, enemy.y, '#ffd166', 8, 180);
      if (enemy.hp <= 0) events = killEnemy(enemy, events, null);
    }
    if (state.boss !== null && state.boss.active) {
      state.boss.hp -= 30;
      burst(state.particles, state.boss.x, state.boss.y, '#ffd166', 20, 240);
    }
    state.shake = 18;
    if (sound) sound.bomb();
    return events | EVENT_BOMB;
  }

  function applyPowerup(kind, events, sound) {
    if (kind === 'spread') player.spreadTimer = PLAYER.powerupSeconds;
    else if (kind === 'rapid') player.rapidTimer = PLAYER.powerupSeconds;
    else if (kind === 'shield') player.shield = true;
    else if (kind === 'bomb') player.bombs = Math.min(MAX_BOMBS, player.bombs + 1);
    else if (kind === 'life') {
      if (state.lives < LIVES) state.lives += 1;
      else state.score += 500;
    }
    if (sound) sound.powerup();
    return events | EVENT_POWERUP;
  }

  /**
   * One fixed step. `controls` carries steerX/steerY (-1..1), an optional mouseTarget
   * {x, y} the ship flies toward, firing and bomb. With `harmless` set (the title
   * screen's backdrop) raiders drift down but nothing collides and nothing scores.
   * `sound` is the audio object, or null when the step runs silent (screenshots).
   */
  function step(dt, controls, harmless, sound) {
    let events = 0;
    state.elapsed += dt;
    if (state.banner.timer > 0) state.banner.timer -= dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - 40 * dt);

    // The ship: keys steer it, the held mouse pulls it toward the pointer.
    if (controls.mouseTarget !== null && controls.mouseTarget !== undefined) {
      const dx = controls.mouseTarget.x - player.x;
      const dy = controls.mouseTarget.y - player.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 4) {
        const speed = Math.min(PLAYER.speed * 1.25, distance * 10);
        player.x += (dx / distance) * speed * dt;
        player.y += (dy / distance) * speed * dt;
      }
    } else {
      const length = Math.hypot(controls.steerX, controls.steerY) || 1;
      player.x += (controls.steerX / length) * PLAYER.speed * dt * (controls.steerX === 0 && controls.steerY === 0 ? 0 : 1);
      player.y += (controls.steerY / length) * PLAYER.speed * dt * (controls.steerX === 0 && controls.steerY === 0 ? 0 : 1);
    }
    player.x = Math.max(player.width / 2 + 8, Math.min(FIELD.width - player.width / 2 - 8, player.x));
    player.y = Math.max(FIELD.height * 0.3, Math.min(FIELD.height - player.height / 2 - 8, player.y));
    if (player.invulnerable > 0) player.invulnerable = Math.max(0, player.invulnerable - dt);
    if (player.spreadTimer > 0) player.spreadTimer -= dt;
    if (player.rapidTimer > 0) player.rapidTimer -= dt;
    if (player.fireTimer > 0) player.fireTimer -= dt;

    if (!harmless) {
      if (controls.firing) firePlayerGuns(sound);
      if (controls.bomb) events = useBomb(events, sound);
    }

    // Wave flow: announce, fight, boss, clear, then the next wave.
    if (state.waveState === 'announce') {
      state.waveTimer -= dt;
      if (state.waveTimer <= 0) openWave();
    } else if (state.waveState === 'fight') {
      if (state.spawnLeft > 0) {
        state.spawnTimer -= dt;
        if (state.spawnTimer <= 0) {
          spawnOne();
          state.spawnLeft -= 1;
          state.spawnTimer = WAVE.spawnInterval;
        }
      } else if (countEnemies(state.enemies) === 0) {
        state.score += WAVE.clearBonus * state.wave;
        state.waveState = 'clear';
        state.waveTimer = 1.8;
        state.banner = { text: `WAVE ${state.wave} CLEAR  +${WAVE.clearBonus * state.wave}`, timer: 1.8 };
        if (sound) sound.waveClear();
        events |= EVENT_WAVE_CLEAR;
      }
    } else if (state.waveState === 'boss') {
      fireBossGuns(sound);
      if (state.boss !== null && state.boss.hp <= 0) {
        state.boss.active = false;
        state.score += BOSS.score;
        state.waveState = 'clear';
        state.waveTimer = 2;
        state.banner = { text: `${BOSS.name} DOWN  +${BOSS.score}`, timer: 2 };
        burst(state.particles, state.boss.x, state.boss.y, '#ffb347', 60, 340);
        burst(state.particles, state.boss.x, state.boss.y, '#ff5d5d', 40, 260);
        clearSky(state.enemies, state.enemyBullets, state.particles);
        spawnPowerup(state.powerups, state.boss.x - 60, state.boss.y, random);
        spawnPowerup(state.powerups, state.boss.x + 60, state.boss.y, random);
        if (sound) sound.explosion(true);
        events |= EVENT_BOSS_DOWN;
        state.boss = null;
      }
    } else if (state.waveState === 'clear') {
      state.waveTimer -= dt;
      if (state.waveTimer <= 0) beginWave(state.wave + 1);
    }

    // The title backdrop keeps a few raiders drifting for looks.
    if (harmless) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        spawnEnemy(state.enemies, random() < 0.5 ? 'drifter' : 'weaver', range(random, 60, FIELD.width - 60), 1, random);
        state.spawnTimer = 1.4;
      }
    }

    updateEnemies(state.enemies, dt);
    updateBoss(state.boss, dt);
    updateBullets(state.bullets, dt);
    updateEnemyBullets(state.enemyBullets, dt);
    updateParticles(state.particles, dt);
    updatePowerups(state.powerups, dt);

    // Spitters shoot back, aimed at the player.
    if (!harmless) {
      for (const enemy of state.enemies) {
        if (!enemy.active || enemy.kind !== 'spitter') continue;
        enemy.fireTimer -= dt;
        if (enemy.fireTimer > 0) continue;
        enemy.fireTimer = ENEMY.spitter.fireInterval * range(random, 0.85, 1.2);
        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;
        const length = Math.hypot(dx, dy) || 1;
        spawnEnemyBullet(state.enemyBullets, enemy.x, enemy.y + enemy.radius, (dx / length) * ENEMY_BULLET.speed, (dy / length) * ENEMY_BULLET.speed);
        if (sound) sound.enemyLaser();
      }
    }

    if (harmless) return events;

    // Player bullets against raiders and the boss.
    for (const bullet of state.bullets) {
      if (!bullet.active) continue;
      for (const enemy of state.enemies) {
        if (!enemy.active) continue;
        const reach = enemy.radius + 6;
        if (distanceSquared(bullet.x, bullet.y, enemy.x, enemy.y) > reach * reach) continue;
        bullet.active = false;
        enemy.hp -= 1;
        burst(state.particles, bullet.x, bullet.y, '#8ef1ff', 4, 120);
        if (enemy.hp <= 0) events = killEnemy(enemy, events, sound);
        break;
      }
      if (!bullet.active) continue;
      const boss = state.boss;
      if (boss !== null && boss.active && !boss.entering) {
        const reach = boss.radius + 6;
        if (distanceSquared(bullet.x, bullet.y, boss.x, boss.y) <= reach * reach) {
          bullet.active = false;
          boss.hp -= 1;
          burst(state.particles, bullet.x, bullet.y, '#ffb347', 3, 120);
        }
      }
    }

    // Enemy bullets and raiders against the player.
    for (const bullet of state.enemyBullets) {
      if (!bullet.active) continue;
      const reach = ENEMY_BULLET.radius + PLAYER_RADIUS;
      if (distanceSquared(bullet.x, bullet.y, player.x, player.y) > reach * reach) continue;
      bullet.active = false;
      events = playerHit(events, sound);
      if (events & EVENT_OVER) return events;
    }
    for (const enemy of state.enemies) {
      if (!enemy.active) continue;
      const reach = enemy.radius + PLAYER_RADIUS - 4;
      if (distanceSquared(enemy.x, enemy.y, player.x, player.y) > reach * reach) continue;
      enemy.hp -= 2;
      if (enemy.hp <= 0) events = killEnemy(enemy, events, null);
      events = playerHit(events, sound);
      if (events & EVENT_OVER) return events;
    }
    if (state.boss !== null && state.boss.active && !state.boss.entering) {
      const reach = state.boss.radius + PLAYER_RADIUS - 6;
      if (distanceSquared(state.boss.x, state.boss.y, player.x, player.y) <= reach * reach) {
        events = playerHit(events, sound);
        if (events & EVENT_OVER) return events;
      }
    }

    // Power-ups for the player.
    for (const powerup of state.powerups) {
      if (!powerup.active) continue;
      const reach = POWERUP.radius + PLAYER_RADIUS;
      if (distanceSquared(powerup.x, powerup.y, player.x, player.y) > reach * reach) continue;
      powerup.active = false;
      burst(state.particles, powerup.x, powerup.y, '#ffd166', 12, 160);
      events = applyPowerup(powerup.kind, events, sound);
    }

    return events;
  }

  reset();
  return { state, reset, step, beginWave };
}
