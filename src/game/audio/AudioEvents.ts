/**
 * AudioEvents — Subscribes to the global EventBus and routes events to AudioManager.
 *
 * BUG-2 FIX: All listeners are now stored as named methods and removed in dispose().
 * Previously bind() used anonymous arrow functions that could not be unregistered,
 * causing duplicate audio events to accumulate across play sessions.
 *
 * Supported events:
 *   MACHINE_GUN_FIRED      → machine_gun one-shot (with pitch variance)
 *   MISSILE_LAUNCHED       → missile_launch one-shot
 *   MISSILE_HIT            → explosion one-shot (scale by damage)
 *   PLAYER_TOOK_DAMAGE     → hit one-shot
 *   TARGET_DESTROYED       → explosion one-shot (louder)
 *   GROUND_DEFENSE_DESTROYED → explosion one-shot
 *   SAM_LOCK_STATE_CHANGED → start/stop missile_warning loop
 *   MISSION_COMPLETED      → mission_complete one-shot + stop engine
 *   MISSION_FAILED         → mission_failed one-shot
 *   PLAYER_BOOST_STARTED   → boost one-shot
 *   PLAYER_DESTROYED       → explosion (big) + stop all loops
 */

import { globalEventBus } from '../core/EventBus';
import type { GameEventMap } from '../core/EventBus';
import type { AudioManager } from './AudioManager';

export class AudioEvents {
  private audioManager: AudioManager;
  private _warningActive = false;
  private _engineRunning = false;
  private _bound = false;

  constructor(audioManager: AudioManager) {
    this.audioManager = audioManager;
  }

  // ─── Named listener methods ───────────────────────────────────────────────
  // Must be arrow functions so `this` is bound correctly when passed as callbacks.

  private _onGunFired = (): void => {
    this.audioManager.playOneShot('machine_gun', 0.5, 0.08);
  };

  private _onMissileLaunched = (): void => {
    this.audioManager.playOneShot('missile_launch', 0.85, 0.05);
  };

  private _onMissileHit = (payload: GameEventMap['MISSILE_HIT']): void => {
    const vol = Math.min(1.0, 0.5 + payload.damage / 200);
    this.audioManager.playOneShot('explosion', vol, 0.1);
  };

  private _onPlayerDamage = (): void => {
    this.audioManager.playOneShot('hit', 0.75, 0.05);
  };

  private _onTargetDestroyed = (): void => {
    this.audioManager.playOneShot('explosion', 0.9, 0.12);
  };

  private _onDefenseDestroyed = (): void => {
    this.audioManager.playOneShot('explosion', 0.95, 0.08);
  };

  private _onSamLockChanged = (payload: GameEventMap['SAM_LOCK_STATE_CHANGED']): void => {
    if (payload.state === 'inbound' || payload.state === 'locked') {
      if (!this._warningActive) {
        this._warningActive = true;
        this.audioManager.startLoop('missile_warning', 0.6);
        this.audioManager.startLoop('missile_lock_beep', 0.5);
      }
    } else {
      if (this._warningActive) {
        this._warningActive = false;
        this.audioManager.stopLoop('missile_warning');
        this.audioManager.stopLoop('missile_lock_beep');
      }
    }
  };

  private _onBoostStarted = (): void => {
    this.audioManager.playOneShot('boost', 0.7, 0.05);
  };

  private _onPlayerDestroyed = (): void => {
    this.audioManager.stopAllLoops();
    this.audioManager.playOneShot('explosion', 1.0);
    this._warningActive = false;
    this._engineRunning = false;
  };

  private _onMissionCompleted = (): void => {
    this.audioManager.stopLoop('jet_engine');
    this.audioManager.stopLoop('missile_warning');
    this.audioManager.stopLoop('missile_lock_beep');
    this._warningActive = false;
    this._engineRunning = false;
    setTimeout(() => this.audioManager.playOneShot('mission_complete', 0.9), 400);
  };

  private _onMissionFailed = (): void => {
    this.audioManager.stopAllLoops();
    this._warningActive = false;
    this._engineRunning = false;
    setTimeout(() => this.audioManager.playOneShot('mission_failed', 0.9), 600);
  };

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  /** Wire all event listeners. Call once after AudioManager.initialize(). */
  bind(): void {
    if (this._bound) return; // guard against double-bind
    this._bound = true;

    globalEventBus.on('MACHINE_GUN_FIRED',       this._onGunFired);
    globalEventBus.on('MISSILE_LAUNCHED',         this._onMissileLaunched);
    globalEventBus.on('MISSILE_HIT',              this._onMissileHit);
    globalEventBus.on('PLAYER_TOOK_DAMAGE',       this._onPlayerDamage);
    globalEventBus.on('TARGET_DESTROYED',         this._onTargetDestroyed);
    globalEventBus.on('GROUND_DEFENSE_DESTROYED', this._onDefenseDestroyed);
    globalEventBus.on('SAM_LOCK_STATE_CHANGED',   this._onSamLockChanged);
    globalEventBus.on('PLAYER_BOOST_STARTED',     this._onBoostStarted);
    globalEventBus.on('PLAYER_DESTROYED',         this._onPlayerDestroyed);
    globalEventBus.on('MISSION_COMPLETED',        this._onMissionCompleted);
    globalEventBus.on('MISSION_FAILED',           this._onMissionFailed);
  }

  /** Start the persistent jet engine loop (call when game scene is ready). */
  startEngine(): void {
    if (this._engineRunning) return;
    this._engineRunning = true;
    this.audioManager.startLoop('jet_engine', 0.4);
  }

  /** Stop the jet engine loop (call on scene destroy). */
  stopEngine(): void {
    if (!this._engineRunning) return;
    this._engineRunning = false;
    this.audioManager.stopLoop('jet_engine');
  }

  /**
   * BUG-2 FIX: Remove all EventBus listeners registered in bind().
   * Previously this method was empty — listeners accumulated across sessions,
   * causing audio to fire N times after N play sessions.
   */
  dispose(): void {
    if (!this._bound) return;
    this._bound = false;

    globalEventBus.off('MACHINE_GUN_FIRED',       this._onGunFired);
    globalEventBus.off('MISSILE_LAUNCHED',         this._onMissileLaunched);
    globalEventBus.off('MISSILE_HIT',              this._onMissileHit);
    globalEventBus.off('PLAYER_TOOK_DAMAGE',       this._onPlayerDamage);
    globalEventBus.off('TARGET_DESTROYED',         this._onTargetDestroyed);
    globalEventBus.off('GROUND_DEFENSE_DESTROYED', this._onDefenseDestroyed);
    globalEventBus.off('SAM_LOCK_STATE_CHANGED',   this._onSamLockChanged);
    globalEventBus.off('PLAYER_BOOST_STARTED',     this._onBoostStarted);
    globalEventBus.off('PLAYER_DESTROYED',         this._onPlayerDestroyed);
    globalEventBus.off('MISSION_COMPLETED',        this._onMissionCompleted);
    globalEventBus.off('MISSION_FAILED',           this._onMissionFailed);

    this._warningActive = false;
    this._engineRunning = false;
  }
}
