/**
 * SoundBank — Procedurally synthesized sounds using the Web Audio API.
 *
 * No external audio files are required. All sounds are generated at runtime
 * using oscillators, noise buffers, and filters. This provides zero-latency
 * loading, works offline, and never produces 404 errors.
 *
 * Usage: pass an AudioContext, call create(ctx) to get a playable AudioBuffer
 * or a factory function that creates a looping sound.
 */

export type SoundId =
  | 'jet_engine'
  | 'boost'
  | 'machine_gun'
  | 'missile_launch'
  | 'missile_lock_beep'
  | 'missile_warning'
  | 'explosion'
  | 'hit'
  | 'ui_click'
  | 'mission_complete'
  | 'mission_failed';

// ─── Noise helpers ────────────────────────────────────────────────────────────

function fillWhiteNoise(buffer: AudioBuffer): void {
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }
}

function fillPinkNoise(buffer: AudioBuffer): void {
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < data.length; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.96900 * b2 + w * 0.1538520;
      b3 = 0.86650 * b3 + w * 0.3104856;
      b4 = 0.55000 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  }
}

// ─── Sound synthesizers ───────────────────────────────────────────────────────

/** White noise burst — 0.08s, shaped by envelope */
export function createMachineGunBuffer(ctx: AudioContext): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const duration   = 0.08;
  const buf = ctx.createBuffer(1, sampleRate * duration, sampleRate);
  fillWhiteNoise(buf);
  const data = buf.getChannelData(0);
  // Apply quick attack + exponential decay
  for (let i = 0; i < data.length; i++) {
    const t = i / data.length;
    const env = t < 0.05 ? t / 0.05 : Math.pow(1 - t, 2.5);
    data[i] *= env * 1.4;
  }
  return buf;
}

/** Long noise + low-pass filtered thump — explosion */
export function createExplosionBuffer(ctx: AudioContext): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const duration   = 2.0;
  const buf = ctx.createBuffer(1, sampleRate * duration, sampleRate);
  fillPinkNoise(buf);
  const data = buf.getChannelData(0);
  // Exponential decay + bass emphasis envelope
  for (let i = 0; i < data.length; i++) {
    const t = i / (sampleRate * duration);
    const env = Math.exp(-t * 3.5);
    // Boost low frequencies by weighting later samples less
    const bassBoost = t < 0.1 ? 1.0 : Math.max(0.1, 1.0 - t * 0.9);
    data[i] *= env * bassBoost * 2.0;
  }
  return buf;
}

/** Short metallic noise burst — hit */
export function createHitBuffer(ctx: AudioContext): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const duration   = 0.12;
  const buf = ctx.createBuffer(1, sampleRate * duration, sampleRate);
  fillWhiteNoise(buf);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / data.length;
    // Metallic ring shape: quick attack, exponential decay
    const env = t < 0.02 ? t / 0.02 : Math.exp(-(t - 0.02) * 25);
    data[i] *= env * 0.9;
  }
  return buf;
}

/** Upward noise sweep — missile launch whoosh */
export function createMissileLaunchBuffer(ctx: AudioContext): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const duration   = 0.7;
  const buf = ctx.createBuffer(1, sampleRate * duration, sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t    = i / (sampleRate * duration);
    const freq = 100 + 3000 * t * t;                    // frequency sweep up
    const angle = (2 * Math.PI * freq * i) / sampleRate;
    const noise = Math.random() * 0.4 - 0.2;
    const env   = t < 0.1 ? t / 0.1 : Math.exp(-(t - 0.1) * 2.5);
    data[i] = (Math.sin(angle) * 0.5 + noise) * env;
  }
  return buf;
}

/** Sine click — UI */
export function createUIClickBuffer(ctx: AudioContext): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const duration   = 0.05;
  const buf = ctx.createBuffer(1, sampleRate * duration, sampleRate);
  const data = buf.getChannelData(0);
  const freq = 1000;
  for (let i = 0; i < data.length; i++) {
    const t   = i / data.length;
    const env = t < 0.1 ? t / 0.1 : Math.exp(-(t - 0.1) * 40);
    data[i] = Math.sin(2 * Math.PI * freq * i / sampleRate) * env * 0.5;
  }
  return buf;
}

/** C-E-G ascending arpeggio — mission complete */
export function createMissionCompleteBuffer(ctx: AudioContext): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const duration   = 1.5;
  const buf = ctx.createBuffer(1, sampleRate * duration, sampleRate);
  const data = buf.getChannelData(0);
  const notes = [261.63, 329.63, 392.0, 523.25]; // C4-E4-G4-C5
  const noteLen = (sampleRate * duration) / notes.length;
  for (let n = 0; n < notes.length; n++) {
    const freq  = notes[n];
    const start = Math.floor(n * noteLen);
    const end   = Math.floor((n + 1) * noteLen);
    for (let i = start; i < end; i++) {
      const localT = (i - start) / (end - start);
      const env    = localT < 0.05 ? localT / 0.05 : Math.exp(-(localT - 0.05) * 4);
      data[i] = Math.sin(2 * Math.PI * freq * i / sampleRate) * env * 0.4;
    }
  }
  return buf;
}

/** Descending tritone — mission failed */
export function createMissionFailedBuffer(ctx: AudioContext): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const duration   = 1.2;
  const buf = ctx.createBuffer(1, sampleRate * duration, sampleRate);
  const data = buf.getChannelData(0);
  // Descend: G4 → Db4 → Ab3
  const notes = [392.0, 277.18, 207.65];
  const noteLen = (sampleRate * duration) / notes.length;
  for (let n = 0; n < notes.length; n++) {
    const freq  = notes[n];
    const start = Math.floor(n * noteLen);
    const end   = Math.floor((n + 1) * noteLen);
    for (let i = start; i < end; i++) {
      const localT = (i - start) / (end - start);
      const env    = localT < 0.05 ? localT / 0.05 : Math.exp(-(localT - 0.05) * 3);
      data[i] = (
        Math.sin(2 * Math.PI * freq * i / sampleRate) +
        Math.sin(2 * Math.PI * freq * 2 * i / sampleRate) * 0.3
      ) * env * 0.35;
    }
  }
  return buf;
}

/** Boost whoosh buffer (shorter than launch, more rumble) */
export function createBoostBuffer(ctx: AudioContext): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const duration   = 0.4;
  const buf = ctx.createBuffer(1, sampleRate * duration, sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t    = i / (sampleRate * duration);
    const freq = 60 + 400 * t;
    const noise = (Math.random() - 0.5) * 0.5;
    const env  = Math.sin(Math.PI * t);
    data[i] = (Math.sin(2 * Math.PI * freq * i / sampleRate) * 0.4 + noise * 0.6) * env;
  }
  return buf;
}

// ─── Buffer cache (built lazily once per AudioContext) ────────────────────────

const _cache = new Map<AudioContext, Map<SoundId, AudioBuffer>>();

function getCache(ctx: AudioContext): Map<SoundId, AudioBuffer> {
  let map = _cache.get(ctx);
  if (!map) { map = new Map(); _cache.set(ctx, map); }
  return map;
}

export function getSoundBuffer(ctx: AudioContext, id: SoundId): AudioBuffer | null {
  const cache = getCache(ctx);
  if (cache.has(id)) return cache.get(id)!;

  let buf: AudioBuffer | null = null;
  try {
    switch (id) {
      case 'machine_gun':      buf = createMachineGunBuffer(ctx);      break;
      case 'explosion':        buf = createExplosionBuffer(ctx);        break;
      case 'hit':              buf = createHitBuffer(ctx);              break;
      case 'missile_launch':   buf = createMissileLaunchBuffer(ctx);    break;
      case 'ui_click':         buf = createUIClickBuffer(ctx);          break;
      case 'mission_complete': buf = createMissionCompleteBuffer(ctx);  break;
      case 'mission_failed':   buf = createMissionFailedBuffer(ctx);    break;
      case 'boost':            buf = createBoostBuffer(ctx);            break;
      default:
        // jet_engine, missile_lock_beep, missile_warning are oscillator-based loops
        // — they are created on-the-fly in AudioManager, not buffered.
        break;
    }
  } catch (e) {
    console.warn(`[SoundBank] Failed to create buffer for "${id}":`, e);
  }

  if (buf) cache.set(id, buf);
  return buf;
}

/** Remove cached buffers for a given context (call on dispose) */
export function clearSoundBankCache(ctx: AudioContext): void {
  _cache.delete(ctx);
}
