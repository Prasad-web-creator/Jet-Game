/**
 * EffectManager — Central coordinator for all visual effects.
 *
 * Implements GameSystem — registered in the game loop after weapons.
 *
 * Manages:
 *  - ExplosionPool    : fire + smoke explosions (existing, extended)
 *  - TracerPool       : bullet tracer line segments
 *  - MissileTrailSystem: per-missile smoke trail
 *  - DamageEffectSystem: smoke + fire on damaged aircraft
 *  - BoostFlameSystem : player afterburner exhaust
 *  - ShockwavePool    : ring shockwave on large explosions
 *
 * All effect triggering is done via:
 *  1. EventBus subscriptions (for game-event-driven effects)
 *  2. Direct method calls (for frame-level position updates)
 */

import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { GameSystem } from '../core/GameLoop';
import type { GameState } from '../../types';
import type { CameraManager } from '../camera/CameraManager';
import type { AircraftController } from '../aircraft/AircraftController';
import { globalEventBus } from '../core/EventBus';

import { ExplosionPool }       from './ExplosionPool';
import { TracerPool }          from './TracerPool';
import { MissileTrailSystem }  from './MissileTrailSystem';
import { DamageEffectSystem }  from './DamageEffectSystem';
import { BoostFlameSystem }    from './BoostFlameSystem';
import { ShockwavePool }       from './ShockwavePool';

export class EffectManager implements GameSystem {
  readonly name = 'EffectManager';

  private explosionPool: ExplosionPool | null = null;
  private tracerPool: TracerPool | null = null;
  private missileTrails: MissileTrailSystem | null = null;
  private damageEffects: DamageEffectSystem | null = null;
  private boostFlame: BoostFlameSystem | null = null;
  private shockwavePool: ShockwavePool | null = null;

  private _cameraManager: CameraManager | null = null;
  private aircraftController: AircraftController | null = null;

  // Track boost state to avoid redundant start/stop
  private _boostActive = false;

  // PERF: scratch vectors reused every update()
  private readonly _scratchPos     = new Vector3();
  private readonly _scratchForward = new Vector3();

  constructor(cameraManagerArg?: CameraManager, aircraftControllerArg?: AircraftController) {
    this._cameraManager    = cameraManagerArg ?? null;
    this.aircraftController = aircraftControllerArg ?? null;
  }

  initialize(scene: Scene): void {
    // Explosion pool (existing + camera shake)
    this.explosionPool = new ExplosionPool(scene, 10, this._cameraManager ?? undefined);

    // New VFX subsystems
    this.tracerPool    = new TracerPool(scene, 120);
    this.missileTrails = new MissileTrailSystem(scene);
    this.damageEffects = new DamageEffectSystem(scene);
    this.shockwavePool = new ShockwavePool(scene, 8);

    this.boostFlame    = new BoostFlameSystem();
    this.boostFlame.initialize(scene);

    this._bindEvents();
    console.log('[EffectManager] Initialized: ExplosionPool, TracerPool, MissileTrails, DamageEffects, BoostFlame, ShockwavePool.');
  }

  update(dt: number, _state: GameState): void {
    this.explosionPool?.update(dt);
    this.tracerPool?.update(dt);
    this.missileTrails?.update(dt);
    this.shockwavePool?.update(dt);

    // Drive boost flame from aircraft flight state
    if (this.aircraftController && this.boostFlame) {
      const fs = this.aircraftController.getFlightState();

      // PERF: write into pre-allocated scratch — no new Vector3
      this._scratchPos.copyFromFloats(fs.x, fs.y, fs.z);

      const cosP = Math.cos(fs.pitch);
      const sinP = Math.sin(fs.pitch);
      const cosY = Math.cos(fs.yaw);
      const sinY = Math.sin(fs.yaw);
      this._scratchForward.copyFromFloats(cosP * sinY, sinP, cosP * cosY);

      this.boostFlame.update(dt, this._scratchPos, this._scratchForward);

      // Activate/deactivate
      if (fs.isBoosting && !this._boostActive) {
        this._boostActive = true;
        this.boostFlame.start();
        globalEventBus.emit('PLAYER_BOOST_STARTED', {});
      } else if (!fs.isBoosting && this._boostActive) {
        this._boostActive = false;
        this.boostFlame.stop();
        globalEventBus.emit('PLAYER_BOOST_STOPPED', {});
      }
    }
  }

  // ─── Public effect API ────────────────────────────────────────────────────

  /** Trigger an explosion at position (called by EventBus or directly). */
  triggerExplosion(position: Vector3, scale = 1.0, shakeCamera = true): void {
    this.explosionPool?.trigger(position, scale, shakeCamera);
    // Large explosions also get a shockwave
    if (scale >= 1.5) {
      this.shockwavePool?.trigger(position, scale * 8, 0.5);
    }
  }

  /** Spawn a bullet tracer line. */
  spawnTracer(start: Vector3, end: Vector3): void {
    this.tracerPool?.spawn(start, end);
  }

  /** Attach missile trail. Call when a missile is launched. */
  attachMissileTrail(missileId: string, position: Vector3): void {
    this.missileTrails?.attach(missileId, position);
  }

  /** Update missile trail emitter position (call every frame per active missile). */
  updateMissileTrail(missileId: string, position: Vector3): void {
    this.missileTrails?.updatePosition(missileId, position);
  }

  /** Detach missile trail. Call when missile hits or expires. */
  detachMissileTrail(missileId: string): void {
    this.missileTrails?.detach(missileId);
  }

  /** Update damage state on an aircraft mesh. */
  setAircraftDamage(mesh: AbstractMesh, health: number, maxHealth: number): void {
    this.damageEffects?.setDamageState(mesh, health, maxHealth);
  }

  /** Remove damage effects (call on aircraft destruction). */
  clearAircraftDamage(mesh: AbstractMesh): void {
    this.damageEffects?.removeEffects(mesh);
  }

  /** Set aircraft controller reference for boost flame positioning. */
  setAircraftController(controller: AircraftController): void {
    this.aircraftController = controller;
  }

  setCameraManager(cameraManager: CameraManager): void {
    this._cameraManager = cameraManager;
    if (this.explosionPool) {
      this.explosionPool.setCameraManager(cameraManager);
    }
  }

  // ─── Private EventBus wiring ──────────────────────────────────────────────

  private _bindEvents(): void {
    globalEventBus.on('TARGET_DESTROYED', (payload) => {
      if (payload.position) {
        this.triggerExplosion(payload.position, 1.2, true);
      }
    });

    globalEventBus.on('GROUND_DEFENSE_DESTROYED', (payload) => {
      if (payload.position) {
        this.triggerExplosion(payload.position, 1.8, true);
      }
    });

    globalEventBus.on('PLAYER_DESTROYED', (payload) => {
      if (payload?.position) {
        this.triggerExplosion(payload.position, 2.5, true);
      }
    });

    globalEventBus.on('MISSILE_HIT', (payload) => {
      if (payload.position) {
        const scale = 1.0 + payload.damage / 100;
        this.triggerExplosion(payload.position, scale, true);
      }
    });

    globalEventBus.on('PLAYER_DAMAGE_STATE_CHANGED', (_payload) => {
      // Damage effects are set by AircraftController directly via setAircraftDamage()
    });
  }

  dispose(): void {
    this.explosionPool?.dispose();
    this.tracerPool?.dispose();
    this.missileTrails?.dispose();
    this.damageEffects?.dispose();
    this.boostFlame?.dispose();
    this.shockwavePool?.dispose();

    this.explosionPool  = null;
    this.tracerPool     = null;
    this.missileTrails  = null;
    this.damageEffects  = null;
    this.boostFlame     = null;
    this.shockwavePool  = null;
  }
}
