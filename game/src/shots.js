// The screenshot scenes behind ?shot=start|play|boss|end. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a simple autopilot
// (dodge the nearest thing falling at the ship, drift toward the nearest raider and keep
// firing), so the frame is what a short game really looks like and the same seed always
// gives the same frame. The play and boss scenes keep the densest frame they reach, so
// the screenshot shows the action at its busiest rather than a gap between waves.
import { FIELD, STEP } from './config.js';
import { EVENT_OVER } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 24;
const BOSS_SECONDS = 16;
const END_LIMIT_SECONDS = 600;
/** How far ahead, in seconds, the autopilot looks for a threat. */
const HORIZON_PLAY = 0.7;
const HORIZON_END = 0.2;

function countActive(pool) {
  let count = 0;
  for (const entry of pool) if (entry.active) count += 1;
  return count;
}

/** The ship's steering for one step: dodge, chase, and (usually) fire. */
function autopilot(state, horizon, firing) {
  const player = state.player;
  let steerX = 0;

  // The nearest thing about to reach the ship's height, by time to impact.
  let threat = null;
  for (const bullet of state.enemyBullets) {
    if (!bullet.active || bullet.vy <= 0) continue;
    const dy = player.y - bullet.y;
    if (dy < 0 || dy > 340) continue;
    if (Math.abs(bullet.x - player.x) > 70) continue;
    const time = dy / bullet.vy;
    if (time < horizon && (threat === null || time < threat.time)) threat = { x: bullet.x, time };
  }
  for (const enemy of state.enemies) {
    if (!enemy.active) continue;
    const dy = player.y - enemy.y;
    if (dy < 0 || dy > 260) continue;
    if (Math.abs(enemy.x - player.x) > enemy.radius + 36) continue;
    const time = dy / Math.max(1, enemy.vy);
    if (time < horizon && (threat === null || time < threat.time)) threat = { x: enemy.x, time };
  }
  if (threat !== null) {
    steerX = player.x <= threat.x ? -1 : 1;
    if (player.x < 70) steerX = 1;
    if (player.x > FIELD.width - 70) steerX = -1;
  } else {
    // Chase the nearest raider (or the boss) so the shots land.
    let target = state.boss !== null && state.boss.active && !state.boss.entering ? state.boss : null;
    let nearest = Infinity;
    for (const enemy of state.enemies) {
      if (!enemy.active) continue;
      const distance = Math.abs(enemy.x - player.x) + Math.abs(enemy.y - player.y);
      if (distance < nearest) {
        nearest = distance;
        target = enemy;
      }
    }
    if (target !== null) {
      const dx = target.x - player.x;
      steerX = dx > 8 ? 1 : dx < -8 ? -1 : 0;
    }
  }
  return { steerX, steerY: 0, mouseTarget: null, firing, bomb: false };
}

/** A plain-data copy of the world's state, for keeping the busiest frame. */
function snapshotState(state) {
  return structuredClone(state);
}

/** Copy a snapshot back into the live state object, keeping its identity. */
function restoreState(state, snap) {
  for (const key of Object.keys(snap)) {
    const value = snap[key];
    if (value === null) {
      state[key] = null;
    } else if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i += 1) Object.assign(state[key][i], value[i]);
    } else if (typeof value === 'object') {
      if (state[key] === null || typeof state[key] !== 'object') state[key] = {};
      Object.assign(state[key], value);
    } else {
      state[key] = value;
    }
  }
}

/** How busy a frame is: raiders and bullets on screen, the ship visible. */
function frameDensity(state) {
  let density = countActive(state.enemies) * 2 + countActive(state.bullets) + countActive(state.enemyBullets) + countActive(state.powerups) * 2;
  if (state.boss !== null && state.boss.active) density += 12;
  if (state.player.invulnerable > 0) density -= 50;
  return density;
}

/**
 * Play `seconds` of the game with the autopilot and leave the world at its busiest
 * frame. Returns whether the pilot survived the whole stretch.
 */
function runScene(world, seconds, horizon, firing, setup) {
  world.reset();
  if (setup) setup();
  const state = world.state;
  const total = Math.floor(seconds / STEP);
  let best = null;
  let bestDensity = -1;
  for (let i = 0; i < total; i += 1) {
    const events = world.step(STEP, autopilot(state, horizon, firing), false, null);
    if (events & EVENT_OVER) break;
    const density = frameDensity(state);
    if (density > bestDensity) {
      bestDensity = density;
      best = snapshotState(state);
    }
  }
  const survived = state.lives > 0;
  if (best !== null) restoreState(state, best);
  return survived;
}

/**
 * Set `world` to the named scene (start, play, boss or end; any other name is start)
 * and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  const state = world.state;
  if (name !== 'play' && name !== 'boss' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) {
      world.step(STEP, autopilot(state, HORIZON_PLAY, false), true, null);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'boss') {
    let survived = runScene(world, BOSS_SECONDS, 0.9, true, () => world.beginWave(5));
    if (!survived) survived = runScene(world, BOSS_SECONDS, 1.3, true, () => world.beginWave(5));
    return { screen: SCREEN_PLAY, best: state.score };
  }
  if (name === 'end') {
    for (let index = 0; index < END_LIMIT_SECONDS / STEP; index += 1) {
      if (world.step(STEP, autopilot(state, HORIZON_END, false), false, null) & EVENT_OVER) break;
    }
    return { screen: SCREEN_OVER, best: state.score };
  }
  let survived = runScene(world, PLAY_SECONDS, HORIZON_PLAY, true, null);
  if (!survived) survived = runScene(world, PLAY_SECONDS, 1.2, true, null);
  return { screen: SCREEN_PLAY, best: state.score };
}
