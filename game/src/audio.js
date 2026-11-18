// All sound is synthesized with WebAudio: short oscillator blips and filtered noise,
// no audio files and no network. The context is created on the first user gesture, so
// the game stays silent until the player interacts, and M toggles mute.

export function createAudio() {
  let context = null;
  let muted = false;
  let noiseBuffer = null;

  /** Create (or resume) the context; call from a user gesture or a game event. */
  function ensure() {
    if (context === null) {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      const length = Math.floor(context.sampleRate * 0.5);
      noiseBuffer = context.createBuffer(1, length, context.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    }
    if (context.state === 'suspended') void context.resume();
    return true;
  }

  function tone(startFreq, endFreq, duration, type, gainValue) {
    if (context === null || muted) return;
    const t = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(startFreq, t);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t + duration);
    gain.gain.setValueAtTime(gainValue, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(t);
    oscillator.stop(t + duration + 0.02);
  }

  function noise(duration, gainValue, filterFreq) {
    if (context === null || muted || noiseBuffer === null) return;
    const t = context.currentTime;
    const source = context.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = context.createGain();
    gain.gain.setValueAtTime(gainValue, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    source.connect(filter).connect(gain).connect(context.destination);
    source.start(t);
    source.stop(t + duration + 0.02);
  }

  return {
    ensure,
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    /** The player's laser: a quick downward chirp. */
    laser() {
      tone(880, 220, 0.09, 'square', 0.05);
    },
    /** An enemy's shot: a softer upward blip. */
    enemyLaser() {
      tone(300, 520, 0.12, 'sawtooth', 0.03);
    },
    /** An explosion; bigger ones last longer and rumble lower. */
    explosion(big) {
      noise(big ? 0.5 : 0.25, big ? 0.22 : 0.12, big ? 900 : 1600);
      tone(big ? 160 : 220, 40, big ? 0.5 : 0.25, 'sine', big ? 0.2 : 0.1);
    },
    /** The player was hit: a harsh buzz plus noise. */
    hit() {
      tone(220, 60, 0.3, 'sawtooth', 0.16);
      noise(0.2, 0.12, 1200);
    },
    powerup() {
      tone(520, 780, 0.09, 'sine', 0.08);
      tone(780, 1170, 0.12, 'sine', 0.08);
    },
    waveClear() {
      tone(523, 523, 0.1, 'triangle', 0.08);
      tone(659, 659, 0.1, 'triangle', 0.08);
      tone(784, 784, 0.18, 'triangle', 0.09);
    },
    bossAlarm() {
      tone(196, 196, 0.22, 'sawtooth', 0.1);
      tone(185, 185, 0.22, 'sawtooth', 0.1);
    },
    bomb() {
      noise(0.7, 0.2, 700);
      tone(120, 30, 0.7, 'sine', 0.18);
    },
    gameOver() {
      tone(392, 392, 0.18, 'triangle', 0.09);
      tone(311, 311, 0.18, 'triangle', 0.09);
      tone(233, 180, 0.4, 'triangle', 0.09);
    },
  };
}
