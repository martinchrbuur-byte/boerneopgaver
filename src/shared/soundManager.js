/**
 * Sound Manager
 *
 * Plays short cartoon sound effects for key moments in the app.
 * Strategy:
 *   1. Try to play a bundled audio file from /sounds/<name>.mp3
 *   2. Fall back to a Web Audio API synthesized tone if the file is not available
 *      (works fully offline without any assets).
 *
 * Audio is only initialised after the first user gesture (browser autoplay policy).
 * A muted state is persisted in localStorage under the key "opgavehelte_sound_muted".
 *
 * Usage:
 *   import { playSound, toggleMute, isMuted } from '../shared/soundManager.js';
 *   playSound('pop');
 */

const SOUND_NAMES = ['pop', 'chime', 'whoosh', 'firework', 'coin', 'levelup'];

// Synthesizer profiles: each describes a brief Web Audio "instrument" patch
const SYNTH_PROFILES = Object.freeze({
  pop: {
    type: 'sine',
    freq: [520, 700],
    duration: 0.12,
    envelope: { attack: 0.005, decay: 0.08, sustain: 0, release: 0.03 },
  },
  chime: {
    type: 'sine',
    freq: [880, 1046, 1318],
    duration: 0.5,
    envelope: { attack: 0.01, decay: 0.3, sustain: 0.1, release: 0.15 },
  },
  whoosh: {
    type: 'sawtooth',
    freq: [200, 80],
    duration: 0.35,
    envelope: { attack: 0.01, decay: 0.25, sustain: 0, release: 0.08 },
  },
  firework: {
    type: 'triangle',
    freq: [300, 600, 900, 1200],
    duration: 0.7,
    envelope: { attack: 0.01, decay: 0.5, sustain: 0, release: 0.18 },
  },
  coin: {
    type: 'sine',
    freq: [1046, 1318],
    duration: 0.25,
    envelope: { attack: 0.005, decay: 0.18, sustain: 0, release: 0.06 },
  },
  levelup: {
    type: 'square',
    freq: [523, 659, 784, 1046],
    duration: 0.65,
    envelope: { attack: 0.01, decay: 0.12, sustain: 0.05, release: 0.08 },
  },
});

let audioCtx = null;
let audioBuffers = {};
let gestureUnlocked = false;
let loadAttempted = false;

const MUTE_KEY = 'opgavehelte_sound_muted';

function getMuted() {
  try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
}

function setMuted(value) {
  try { localStorage.setItem(MUTE_KEY, value ? '1' : '0'); } catch { /* ignore */ }
}

function getOrCreateContext() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return null;
    }
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/** Pre-load bundled audio files (/sounds/<name>.mp3) in the background. */
async function preloadAudioFiles() {
  if (loadAttempted) return;
  loadAttempted = true;

  const ctx = getOrCreateContext();
  if (!ctx) return;

  await Promise.allSettled(
    SOUND_NAMES.map(async name => {
      try {
        const resp = await fetch(`/sounds/${name}.mp3`);
        if (!resp.ok) return;
        const arrayBuffer = await resp.arrayBuffer();
        audioBuffers[name] = await ctx.decodeAudioData(arrayBuffer);
      } catch {
        // File not available — synthesized fallback will be used
      }
    })
  );
}

/** Synthesize a short tone using the Web Audio API. */
function synthesizeSound(name, ctx) {
  const profile = SYNTH_PROFILES[name];
  if (!profile) return;

  const now = ctx.currentTime;
  const freqs = profile.freq;
  const noteDuration = profile.duration / freqs.length;

  freqs.forEach((freq, i) => {
    const t = now + i * noteDuration * 0.85;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = profile.type;
    osc.frequency.setValueAtTime(freq, t);

    const { attack, decay, release } = profile.envelope;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.22, t + attack);
    gain.gain.linearRampToValueAtTime(0.08, t + attack + decay);
    gain.gain.linearRampToValueAtTime(0, t + noteDuration - release);

    osc.start(t);
    osc.stop(t + noteDuration);
  });
}

/** Play a sound by name. Silently does nothing when muted or after errors. */
export function playSound(name) {
  if (getMuted()) return;
  if (typeof window === 'undefined') return;

  const ctx = getOrCreateContext();
  if (!ctx) return;

  // Attempt to play buffered audio first
  const buffer = audioBuffers[name];
  if (buffer) {
    try {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start();
      return;
    } catch { /* fall through to synth */ }
  }

  synthesizeSound(name, ctx);
}

/** Toggle mute state. Returns the new muted value (true = muted). */
export function toggleMute() {
  const next = !getMuted();
  setMuted(next);
  // Dispatch a custom event so the mute button UI can react
  try {
    document.dispatchEvent(new CustomEvent('soundMuteChanged', { detail: { muted: next } }));
  } catch { /* ignore */ }
  return next;
}

/** Returns true if sound is currently muted. */
export function isMuted() {
  return getMuted();
}

/**
 * Must be called once from any user-gesture handler (click/touchstart) to
 * unlock audio and pre-load bundled files.
 */
export function unlockAudio() {
  if (gestureUnlocked) return;
  gestureUnlocked = true;
  getOrCreateContext();
  preloadAudioFiles();
}
