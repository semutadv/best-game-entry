// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the backdrop
// colour. Every ship, raider and power-up is drawn on canvas; text that holds a number is
// rebuilt only when the number changes, so a frame allocates nothing.
import { BOSS, FIELD, FONT, LIVES, PALETTE, POWERUP } from './config.js';
import { createRandom } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const PANEL = { width: 640, top: 150, line: 34, bottom: 76 };
const STAR_COUNT = 110;

/** Nebula blobs, fixed in the sky, drawn as soft radial gradients. */
const NEBULAE = [
  { x: 240, y: 150, radius: 260, color: 'rgba(64, 80, 180, 0.20)' },
  { x: 1020, y: 420, radius: 300, color: 'rgba(150, 60, 140, 0.16)' },
  { x: 760, y: 90, radius: 200, color: 'rgba(40, 140, 160, 0.14)' },
];

const POWERUP_COLORS = {
  spread: PALETTE.powerSpread,
  rapid: PALETTE.powerRapid,
  shield: PALETTE.powerShield,
  bomb: PALETTE.powerBomb,
  life: PALETTE.powerLife,
};
const POWERUP_LETTERS = { spread: 'S', rapid: 'R', shield: 'H', bomb: 'B', life: '+' };

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('SCORE ');
  const bestLabel = cachedLabel('BEST ');
  const waveLabel = cachedLabel('WAVE ');
  const finalLabel = cachedLabel('SCORE ');
  const wavesLabel = cachedLabel('Waves survived: ');
  const killsLabel = cachedLabel('Raiders destroyed: ');
  const bombsLabel = cachedLabel('BOMBS ');

  const starRandom = createRandom(20261118);
  const stars = [];
  for (let i = 0; i < STAR_COUNT; i += 1) {
    stars.push({
      x: starRandom() * FIELD.width,
      y: starRandom() * FIELD.height,
      speed: 8 + starRandom() * 34,
      size: 1 + starRandom() * 1.6,
      phase: starRandom() * Math.PI * 2,
    });
  }

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `bold ${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function drawSky(elapsed) {
    const gradient = context.createLinearGradient(0, 0, 0, FIELD.height);
    gradient.addColorStop(0, PALETTE.skyTop);
    gradient.addColorStop(1, PALETTE.skyBottom);
    context.fillStyle = gradient;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    for (const nebula of NEBULAE) {
      const glow = context.createRadialGradient(nebula.x, nebula.y, 0, nebula.x, nebula.y, nebula.radius);
      glow.addColorStop(0, nebula.color);
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      context.fillStyle = glow;
      context.fillRect(nebula.x - nebula.radius, nebula.y - nebula.radius, nebula.radius * 2, nebula.radius * 2);
    }
    for (const star of stars) {
      const y = (star.y + elapsed * star.speed) % FIELD.height;
      const twinkle = 0.55 + 0.45 * Math.sin(elapsed * 2 + star.phase);
      context.globalAlpha = twinkle;
      context.fillStyle = PALETTE.star;
      context.fillRect(star.x, y, star.size, star.size);
    }
    context.globalAlpha = 1;
  }

  function drawShip(x, y, scale, elapsed, flame) {
    context.save();
    context.translate(x, y);
    context.scale(scale, scale);
    if (flame) {
      const flicker = 12 + 6 * Math.sin(elapsed * 42);
      context.fillStyle = '#ffb347';
      context.beginPath();
      context.moveTo(-6, 20);
      context.lineTo(0, 20 + flicker);
      context.lineTo(6, 20);
      context.closePath();
      context.fill();
    }
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.moveTo(0, -22);
    context.lineTo(7, -4);
    context.lineTo(26, 16);
    context.lineTo(10, 12);
    context.lineTo(5, 18);
    context.lineTo(-5, 18);
    context.lineTo(-10, 12);
    context.lineTo(-26, 16);
    context.lineTo(-7, -4);
    context.closePath();
    context.fill();
    context.fillStyle = PALETTE.playerCore;
    context.beginPath();
    context.arc(0, -6, 5, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawEnemy(enemy) {
    const color =
      enemy.kind === 'drifter'
        ? PALETTE.drifter
        : enemy.kind === 'weaver'
          ? PALETTE.weaver
          : enemy.kind === 'spitter'
            ? PALETTE.spitter
            : PALETTE.brute;
    context.save();
    context.translate(enemy.x, enemy.y);
    if (enemy.kind === 'drifter') {
      context.rotate(enemy.t * 1.4 + enemy.seed);
      context.fillStyle = color;
      context.fillRect(-enemy.radius * 0.7, -enemy.radius * 0.7, enemy.radius * 1.4, enemy.radius * 1.4);
      context.fillStyle = '#fff2e0';
      context.fillRect(-5, -5, 10, 10);
    } else if (enemy.kind === 'weaver') {
      context.fillStyle = color;
      context.beginPath();
      context.moveTo(0, enemy.radius);
      context.lineTo(enemy.radius * 0.8, -enemy.radius * 0.7);
      context.lineTo(0, -enemy.radius * 0.3);
      context.lineTo(-enemy.radius * 0.8, -enemy.radius * 0.7);
      context.closePath();
      context.fill();
      context.fillStyle = '#ffe9ff';
      context.beginPath();
      context.arc(0, 0, 5, 0, Math.PI * 2);
      context.fill();
    } else if (enemy.kind === 'spitter') {
      context.fillStyle = color;
      context.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const angle = (i / 6) * Math.PI * 2 + enemy.t * 0.8;
        const px = Math.cos(angle) * enemy.radius;
        const py = Math.sin(angle) * enemy.radius;
        if (i === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
      context.closePath();
      context.fill();
      context.fillStyle = '#efe6ff';
      context.beginPath();
      context.arc(0, 0, 7, 0, Math.PI * 2);
      context.fill();
    } else {
      context.fillStyle = color;
      context.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const angle = (i / 6) * Math.PI * 2;
        const px = Math.cos(angle) * enemy.radius;
        const py = Math.sin(angle) * enemy.radius;
        if (i === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
      context.closePath();
      context.fill();
      context.fillStyle = '#7a1010';
      context.beginPath();
      context.arc(0, 0, enemy.radius * 0.55, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#ffd9d9';
      context.beginPath();
      context.arc(0, 0, 6, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
    if (enemy.maxHp > 2) {
      const width = enemy.radius * 1.6;
      context.fillStyle = '#2a3040';
      context.fillRect(enemy.x - width / 2, enemy.y - enemy.radius - 12, width, 5);
      context.fillStyle = PALETTE.brute;
      context.fillRect(enemy.x - width / 2, enemy.y - enemy.radius - 12, width * (enemy.hp / enemy.maxHp), 5);
    }
  }

  function drawBoss(boss, elapsed) {
    context.save();
    context.translate(boss.x, boss.y);
    context.fillStyle = PALETTE.boss;
    context.beginPath();
    context.moveTo(0, 46);
    context.lineTo(34, 20);
    context.lineTo(72, 8);
    context.lineTo(58, -18);
    context.lineTo(26, -34);
    context.lineTo(0, -44);
    context.lineTo(-26, -34);
    context.lineTo(-58, -18);
    context.lineTo(-72, 8);
    context.lineTo(-34, 20);
    context.closePath();
    context.fill();
    context.fillStyle = '#5c3400';
    context.beginPath();
    context.arc(0, -8, 16, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#ff5d5d';
    const glow = 0.6 + 0.4 * Math.sin(elapsed * 6);
    context.globalAlpha = glow;
    context.beginPath();
    context.arc(0, -8, 8, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
    context.fillStyle = '#3a2200';
    context.fillRect(-52, 14, 14, 10);
    context.fillRect(38, 14, 14, 10);
    context.restore();
  }

  function drawField(state, elapsed) {
    drawSky(elapsed);
    for (const powerup of state.powerups) {
      if (!powerup.active) continue;
      const bob = Math.sin(elapsed * 5 + powerup.x) * 2;
      context.fillStyle = POWERUP_COLORS[powerup.kind];
      context.beginPath();
      context.arc(powerup.x, powerup.y + bob, POWERUP.radius, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#ffffff';
      context.lineWidth = 2;
      context.stroke();
      text(POWERUP_LETTERS[powerup.kind], powerup.x, powerup.y + bob + 7, 18, '#101018', 'center');
    }
    for (const enemy of state.enemies) if (enemy.active) drawEnemy(enemy);
    if (state.boss !== null && state.boss.active) drawBoss(state.boss, elapsed);
    for (const bullet of state.enemyBullets) {
      if (!bullet.active) continue;
      context.fillStyle = PALETTE.enemyBullet;
      context.beginPath();
      context.arc(bullet.x, bullet.y, 6, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#ffd7ea';
      context.beginPath();
      context.arc(bullet.x, bullet.y, 2.5, 0, Math.PI * 2);
      context.fill();
    }
    for (const bullet of state.bullets) {
      if (!bullet.active) continue;
      context.fillStyle = PALETTE.bullet;
      context.fillRect(bullet.x - 3, bullet.y - 9, 6, 18);
      context.fillStyle = '#ffffff';
      context.fillRect(bullet.x - 1, bullet.y - 9, 2, 18);
    }
    for (const particle of state.particles) {
      if (!particle.active) continue;
      context.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      context.fillStyle = particle.color;
      context.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
    }
    context.globalAlpha = 1;
    const player = state.player;
    if (player.invulnerable === 0 || Math.floor(player.invulnerable * 10) % 2 === 1) {
      drawShip(player.x, player.y, 1, elapsed, true);
      if (player.shield) {
        context.strokeStyle = PALETTE.powerShield;
        context.lineWidth = 2;
        context.beginPath();
        context.arc(player.x, player.y, 36 + 3 * Math.sin(elapsed * 5), 0, Math.PI * 2);
        context.stroke();
      }
    }
  }

  function drawHud(state, best, muted) {
    context.textBaseline = 'top';
    text(scoreLabel(state.score), 24, 18, 26, PALETTE.text, 'left');
    text(bestLabel(best), 24, 48, 16, PALETTE.muted, 'left');
    text(waveLabel(state.wave), FIELD.width / 2, 18, 26, PALETTE.text, 'center');
    const livesX = FIELD.width - 24;
    for (let life = 0; life < LIVES; life += 1) {
      if (life < state.lives) drawShip(livesX - life * 34, 34, 0.42, 0, false);
      else {
        context.strokeStyle = PALETTE.muted;
        context.lineWidth = 2;
        context.beginPath();
        context.arc(livesX - life * 34, 30, 8, 0, Math.PI * 2);
        context.stroke();
      }
    }
    text(bombsLabel(state.player.bombs), FIELD.width - 24, 52, 16, PALETTE.powerBomb, 'right');
    if (muted) text('MUTED (M)', FIELD.width - 24, 76, 14, PALETTE.muted, 'right');
    if (state.player.spreadTimer > 0) text('SPREAD', 24, 76, 14, PALETTE.powerSpread, 'left');
    if (state.player.rapidTimer > 0) text('RAPID', 24, state.player.spreadTimer > 0 ? 96 : 76, 14, PALETTE.powerRapid, 'left');
    if (state.boss !== null && state.boss.active && !state.boss.entering) {
      const width = 420;
      const x = (FIELD.width - width) / 2;
      const y = 92;
      text(BOSS.name, FIELD.width / 2, y - 20, 15, PALETTE.boss, 'center');
      context.fillStyle = '#2a3040';
      context.fillRect(x, y, width, 10);
      context.fillStyle = PALETTE.boss;
      context.fillRect(x, y, width * Math.max(0, state.boss.hp / state.boss.maxHp), 10);
    }
    if (state.banner.timer > 0) {
      context.globalAlpha = Math.min(1, state.banner.timer);
      text(state.banner.text, FIELD.width / 2, 200, 40, PALETTE.gold, 'center');
      context.globalAlpha = 1;
    }
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 78, 46, PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 20, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 22, PALETTE.gold, 'center');
  }

  /** Paint one frame: the field, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best, muted) {
    const elapsed = state.elapsed;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const shake = state.shake;
    const ox = shake > 0 ? Math.sin(elapsed * 127.1) * shake * 0.6 : 0;
    const oy = shake > 0 ? Math.cos(elapsed * 149.7) * shake * 0.6 : 0;
    context.setTransform(view.scale, 0, 0, view.scale, view.x + ox * view.scale, view.y + oy * view.scale);
    drawField(state, elapsed);
    if (screen === SCREEN_TITLE) {
      drawPanel(
        'STARFALL DEFENDER',
        [
          'The last star-harbour is under attack. Hold the line.',
          'Move: arrows / WASD or mouse — Fire: Space or hold mouse',
          'Bomb: B — Pause: P — Mute: M — Power-ups: S R H B +',
          'A boss closes every 5th wave. Survive, and beat your best.',
          bestLabel(best),
        ],
        'Press Space or click to launch',
      );
      return;
    }
    drawHud(state, best, muted);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The raiders will wait for you.'], 'Press P to resume');
    } else if (screen === SCREEN_OVER) {
      drawPanel(
        'GAME OVER',
        [finalLabel(state.score), bestLabel(best), wavesLabel(state.wave), killsLabel(state.kills), ''],
        'Press Space or click to fly again',
      );
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
