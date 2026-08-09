/**
 * AudioManager — Centralized game audio service.
 *
 * Architecture:
 *  - Web Audio API AudioContext (lazy-init on first user gesture)
 *  - Per-category gain nodes: master → sfx → individual sounds
 *  - One-shot playback: fire-and-forget AudioBufferSourceNodes
 *  - Loop playback: retained SourceNode + can be stopped by ID
 *  - Oscillator-based loops for: jet_engine, missile_lock_beep, missile_warning
 *  - Graceful fallback: all methods are no-ops if AudioContext fails
 *
 * Usage:
 *   audioManager.initialize();          // call once (creates context)
 *   audioManager.playOneShot('hit');
 *   audioManager.startLoop('jet_engine');
 *   audioManager.stopLoop('jet_engine');
 *   audioManager.setVolume('sfx', 0.6);
 */

import { getSoundBuffer, clearSoundBankCache, type SoundId } from './SoundBank';

type CategoryId = 'master' | 'sfx' | 'music' | 'ui';

interface LoopNode {
  sourceNode: AudioScheduledSourceNode;  // BufferSource or OscillatorNode
  gainNode: GainNode;
}

export class AudioManager {
  private ctx: AudioContext | null = null;

  // ── Gain hierarchy: master → category → source ────────────────────────────
  private masterGain: GainNode | null = null;
  private categoryGains = new Map<CategoryId, GainNode>();

  // ── Active loops keyed by SoundId ─────────────────────────────────────────
  private loops = new Map<SoundId, LoopNode>();

  private _isInitialized = false;

  // ── Volume settings (persisted separately from gain nodes) ─────────────────
  private volumes: Record<CategoryId, number> = {
    master: 1.0,
    sfx:    0.8,
    music:  0.6,
    ui:     0.7,
  };

  // ─── Public API ───────────────────────────────────────────────────────────

  get isInitialized(): boolean { return this._isInitialized; }

  /**
   * Initialize the AudioContext.
   * Safe to call multiple times — only initializes once.
   * Must be called after a user gesture for browser autoplay policy compliance.
   */
  initialize(): void {
    if (this._isInitialized) return;
    try {
      this.ctx = new AudioContext();

      // Build gain hierarchy
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volumes.master;
      this.masterGain.connect(this.ctx.destination);

      for (const cat of ['sfx', 'music', 'ui'] as CategoryId[]) {
        const g = this.ctx.createGain();
        g.gain.value = this.volumes[cat];
        g.connect(this.masterGain);
        this.categoryGains.set(cat, g);
      }

      this._isInitialized = true;
      console.log('[AudioManager] Web Audio API initialized. Sample rate:', this.ctx.sampleRate);
    } catch (e) {
      console.warn('[AudioManager] Web Audio API not available:', e);
    }
  }

  /**
   * Resume the context if suspended (browser autoplay policy).
   * Call this on the first user interaction.
   */
  resume(): void {
    if (this.ctx?.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  /**
   * Play a sound once. Safe to call even if not initialized (no-op).
   * @param id   Sound identifier
   * @param volume Override volume [0,1]
   * @param pitchVariance Random pitch variance factor (0 = no variance)
   */
  playOneShot(id: SoundId, volume = 1.0, pitchVariance = 0): void {
    if (!this.ctx || !this.masterGain) return;
    this.resume();

    const buffer = getSoundBuffer(this.ctx, id);
    if (!buffer) return;

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;

    if (pitchVariance > 0) {
      src.playbackRate.value = 1.0 + (Math.random() * 2 - 1) * pitchVariance;
    }

    const gainNode = this.ctx.createGain();
    gainNode.gain.value = volume;

    const dest = this.categoryGains.get('sfx') ?? this.masterGain;
    src.connect(gainNode);
    gainNode.connect(dest);

    src.start();
    src.onended = () => { gainNode.disconnect(); };
  }

  /**
   * Start a looping oscillator-based sound (jet engine, beeps, warnings).
   * If already playing, does nothing.
   */
  startLoop(id: SoundId, volume = 1.0): void {
    if (!this.ctx || !this.masterGain) return;
    if (this.loops.has(id)) return;
    this.resume();

    const gainNode = this.ctx.createGain();
    gainNode.gain.value = volume;
    const dest = this.categoryGains.get('sfx') ?? this.masterGain;
    gainNode.connect(dest);

    let sourceNode: AudioScheduledSourceNode;

    switch (id) {
      case 'jet_engine':
        sourceNode = this._createEngineOscillator(gainNode);
        break;
      case 'missile_lock_beep':
        sourceNode = this._createLockBeep(gainNode);
        break;
      case 'missile_warning':
        sourceNode = this._createWarningTone(gainNode);
        break;
      default: {
        // Buffer-based loop fallback
        const buffer = getSoundBuffer(this.ctx, id);
        if (!buffer) return;
        const src = this.ctx.createBufferSource();
        src.buffer  = buffer;
        src.loop    = true;
        src.connect(gainNode);
        src.start();
        sourceNode = src;
        break;
      }
    }

    this.loops.set(id, { sourceNode, gainNode });
  }

  /** Fade out and stop a looping sound. */
  stopLoop(id: SoundId, fadeDuration = 0.3): void {
    const node = this.loops.get(id);
    if (!node || !this.ctx) return;

    const { sourceNode, gainNode } = node;
    const now = this.ctx.currentTime;
    gainNode.gain.setValueAtTime(gainNode.gain.value, now);
    gainNode.gain.linearRampToValueAtTime(0, now + fadeDuration);

    setTimeout(() => {
      try { sourceNode.stop(); } catch { /* already stopped */ }
      gainNode.disconnect();
    }, fadeDuration * 1000 + 50);

    this.loops.delete(id);
  }

  /** Stop all active loops immediately. */
  stopAllLoops(): void {
    for (const id of this.loops.keys()) {
      this.stopLoop(id as SoundId, 0.1);
    }
  }

  /** Set volume for a category [0, 1]. */
  setVolume(category: CategoryId, value: number): void {
    const v = Math.max(0, Math.min(1, value));
    this.volumes[category] = v;
    if (category === 'master' && this.masterGain) {
      this.masterGain.gain.value = v;
    } else {
      const g = this.categoryGains.get(category);
      if (g) g.gain.value = v;
    }
  }

  getVolume(category: CategoryId): number {
    return this.volumes[category];
  }

  /** Modulate jet engine pitch/volume (call from aircraft update at 10 Hz). */
  setEngineIntensity(throttle: number, isBoosting: boolean): void {
    const node = this.loops.get('jet_engine');
    if (!node || !this.ctx) return;

    const baseVol = 0.3 + throttle * 0.5;
    const vol     = isBoosting ? baseVol * 1.4 : baseVol;
    node.gainNode.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.1);
  }

  dispose(): void {
    this.stopAllLoops();
    if (this.ctx) {
      clearSoundBankCache(this.ctx);
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.masterGain = null;
    this.categoryGains.clear();
    this._isInitialized = false;
  }

  // ─── Private oscillator factories ─────────────────────────────────────────

  /** Jet engine: detuned sawtooth oscillator + pink noise + bandpass filter */
  private _createEngineOscillator(output: AudioNode): OscillatorNode {
    if (!this.ctx) throw new Error('No AudioContext');

    const osc = this.ctx.createOscillator();
    osc.type            = 'sawtooth';
    osc.frequency.value = 55; // A1 — deep turbine drone

    const bp = this.ctx.createBiquadFilter();
    bp.type            = 'bandpass';
    bp.frequency.value = 200;
    bp.Q.value         = 2.0;

    osc.connect(bp);
    bp.connect(output);
    osc.start();
    return osc;
  }

  /** Lock beep: alternating 800 Hz / 1200 Hz sine at 2 Hz */
  private _createLockBeep(output: AudioNode): OscillatorNode {
    if (!this.ctx) throw new Error('No AudioContext');

    const osc = this.ctx.createOscillator();
    osc.type            = 'sine';
    osc.frequency.value = 800;

    const now = this.ctx.currentTime;
    // Alternate freq at 2 Hz (every 0.5s)
    for (let i = 0; i < 60; i++) {
      osc.frequency.setValueAtTime(i % 2 === 0 ? 800 : 1200, now + i * 0.25);
    }

    osc.connect(output);
    osc.start();
    return osc;
  }

  /** Missile warning: fast warble between 400 and 1200 Hz at 6 Hz */
  private _createWarningTone(output: AudioNode): OscillatorNode {
    if (!this.ctx) throw new Error('No AudioContext');

    const osc = this.ctx.createOscillator();
    osc.type            = 'square';
    osc.frequency.value = 400;

    const now = this.ctx.currentTime;
    // Rapid 6 Hz warble
    for (let i = 0; i < 120; i++) {
      osc.frequency.setValueAtTime(i % 2 === 0 ? 400 : 1100, now + i * (1 / 12));
    }

    osc.connect(output);
    osc.start();
    return osc;
  }
}
