// Keyboard and pointer input. Held keys give a steering direction; one-shot presses
// (start, restart, pause, bomb, mute) are queued as bit flags and taken once by the loop,
// so a press between two frames is never lost and never counted twice. The mouse steers
// the ship toward the pointer while it is held down, and holding it fires too.

import { FIELD } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_BOMB = 4;
export const ACTION_MUTE = 8;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const FIRE = new Set(['Space']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const BOMB = new Set(['KeyB']);
const MUTE = new Set(['KeyM']);

export function createInput(canvas) {
  let left = false;
  let right = false;
  let up = false;
  let down = false;
  let firingKey = false;
  let firingPointer = false;
  let actions = 0;
  /** Pointer position in playfield coordinates; null until the pointer first moves. */
  let pointer = null;
  let pointerSeenAt = -1;
  let now = 0;

  function toField(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = FIELD.width / rect.width;
    const scaleY = FIELD.height / rect.height;
    return { x: (event.clientX - rect.left) * scaleX, y: (event.clientY - rect.top) * scaleY };
  }

  window.addEventListener('keydown', (event) => {
    if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (UP.has(event.code)) up = true;
    else if (DOWN.has(event.code)) down = true;
    else if (FIRE.has(event.code)) firingKey = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (BOMB.has(event.code)) {
      if (!event.repeat) actions |= ACTION_BOMB;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
    else if (UP.has(event.code)) up = false;
    else if (DOWN.has(event.code)) down = false;
    else if (FIRE.has(event.code)) firingKey = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    left = false;
    right = false;
    up = false;
    down = false;
    firingKey = false;
    firingPointer = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    pointer = toField(event);
    pointerSeenAt = now;
  });
  canvas.addEventListener('pointerdown', (event) => {
    pointer = toField(event);
    pointerSeenAt = now;
    firingPointer = true;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => {
    firingPointer = false;
  });

  return {
    /** The loop calls this once a frame with the running clock, in seconds. */
    tick(clock) {
      now = clock;
    },
    /** Steering -1..1 on each axis from the held keys (0 when the mouse steers). */
    steer() {
      const mouseSteering = pointer !== null && now - pointerSeenAt < 2.5 && firingPointer;
      if (mouseSteering) return { x: 0, y: 0, mouse: true };
      return { x: (right ? 1 : 0) - (left ? 1 : 0), y: (down ? 1 : 0) - (up ? 1 : 0), mouse: false };
    },
    /** Pointer target in playfield coordinates, or null when the mouse is not steering. */
    pointerTarget() {
      if (pointer === null || now - pointerSeenAt >= 2.5 || !firingPointer) return null;
      return pointer;
    },
    /** True while Space or the mouse button is held. */
    firing() {
      return firingKey || firingPointer;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
