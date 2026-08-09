import { Scene } from '@babylonjs/core/scene';
import { CameraEffects }   from './CameraEffects';
import { ChaseCamera }     from './cameras/ChaseCamera';
import { CockpitCamera }   from './cameras/CockpitCamera';
import { CombatCamera }    from './cameras/CombatCamera';
import { CinematicCamera } from './cameras/CinematicCamera';
import { CameraMode }      from './ICamera';
import type { ICamera, CameraContext }  from './ICamera';
import type { GameSystem } from '../core/GameLoop';
import type { GameState }  from '../../types';
import type { AircraftController } from '../aircraft/AircraftController';
import type { InputManager }       from '../controls/InputManager';

// ─── Mode cycle order ─────────────────────────────────────────────────────────
const MODE_CYCLE: CameraMode[] = [
  CameraMode.Chase,
  CameraMode.Cockpit,
];

/**
 * CameraManager — dedicated GameSystem that owns all camera strategies + effects.
 *
 * ─── Dependencies (Task 06 refactor) ─────────────────────────────────────────
 *
 *   `AircraftController` → `getFlightState()` (position, orientation, speed flags)
 *   `InputManager`       → `getSnapshot()` (cameraToggle, lookBack, isBoosting)
 *
 *   Both are injected via the constructor. CameraManager no longer reads input
 *   indirectly through AircraftController — it reads from the shared InputManager
 *   directly, which is the single source of truth for all player input.
 *
 * ─── GameLoop registration order ────────────────────────────────────────────
 *
 *   1. InputManager      — builds snapshot from events
 *   2. AircraftController — reads snapshot, runs physics
 *   3. CameraManager     — reads snapshot + physics result, moves camera
 *
 * ─── Camera lifecycle ────────────────────────────────────────────────────────
 *
 *   initialize()
 *     → create() on all 4 cameras (creates Babylon FreeCamera objects)
 *     → Chase set as scene.activeCamera
 *
 *   update()
 *     → reads InputSnapshot for F/Tab
 *     → calls activeCamera.update(state, dt, ctx)
 *     → composites CameraEffects on top
 *
 *   _cycleMode() — on F keypress
 *     → snapToState() on incoming camera (teleport to correct position)
 *     → scene.activeCamera = newCam.babylonCamera
 *     → effects.setBaseFov(newCam.baseFov)
 */
export class CameraManager implements GameSystem {
  readonly name = 'CameraManager';

  private _aircraft:     AircraftController;
  private _inputManager: InputManager;
  private _scene: Scene | null = null;

  private _cameras: Record<CameraMode, ICamera> = {
    [CameraMode.Chase]:     new ChaseCamera(),
    [CameraMode.Cockpit]:   new CockpitCamera(),
    [CameraMode.Combat]:    new CombatCamera(),
    [CameraMode.Cinematic]: new CinematicCamera(),
  };

  private _activeMode: CameraMode = CameraMode.Chase;
  private _effects = new CameraEffects();

  constructor(aircraft: AircraftController, inputManager: InputManager) {
    this._aircraft     = aircraft;
    this._inputManager = inputManager;
  }

  // ─── GameSystem ───────────────────────────────────────────────────────────

  initialize(scene: Scene): void {
    this._scene = scene;
    const spawnState = this._aircraft.getFlightState();

    for (const cam of Object.values(this._cameras)) {
      cam.create(scene, spawnState);
    }

    scene.activeCamera = this._cameras[CameraMode.Chase].babylonCamera;
    this._effects.setBaseFov(this._cameras[CameraMode.Chase].baseFov);

    console.log('[CameraManager] Initialized. Mode: Chase (4 cameras created)');
  }

  private _spectateTargetUid: string | null = null;
  private _networkManager:    any = null;

  setSpectateTarget(uid: string | null, networkManager?: any): void {
    this._spectateTargetUid = uid;
    if (networkManager) this._networkManager = networkManager;
    console.log(`[CameraManager] Spectate target set to: ${uid ?? 'none'}`);
  }

  getSpectateTargetUid(): string | null {
    return this._spectateTargetUid;
  }

  update(dt: number, _gameState: GameState): void {
    // ── Spectator mode (multiplayer) ──────────────────────────────────────────
    if (this._spectateTargetUid && this._networkManager) {
      const remoteState = this._networkManager.getInterpolatedState(this._spectateTargetUid);
      if (remoteState) {
        const spectateState = {
          x: remoteState.x,
          y: remoteState.y,
          z: remoteState.z,
          pitch: remoteState.pitch,
          yaw: remoteState.yaw,
          roll: remoteState.roll,
          targetPitch: remoteState.pitch,
          targetYaw: remoteState.yaw,
          speed: remoteState.speed,
          throttle: 1,
          altitude: remoteState.y,
          heading: (remoteState.yaw * (180 / Math.PI) + 360) % 360,
          speedKnots: remoteState.speed * 1.94384,
          isBoosting: remoteState.isBoosting,
          isBraking: false,
          boostFuel: remoteState.boostFuel,
          flightPhase: 'airborne' as any,
          gearDown: false,
        };

        const ctx: CameraContext = {
          lookBack: false,
          isBoosting: remoteState.isBoosting,
          isBraking: false,
        };

        const activeCam = this._cameras[this._activeMode];
        activeCam.update(spectateState, dt, ctx);
        this._effects.apply(activeCam.babylonCamera, dt, false);
        return;
      }
    }

    const flightState = this._aircraft.getFlightState();
    const snap        = this._inputManager.getSnapshot();

    // ── F key: cycle camera mode ──────────────────────────────────────────
    if (snap.cameraToggle) {
      this._cycleMode();
    }

    const ctx: CameraContext = {
      lookBack:   snap.lookBack,
      isBoosting: flightState.isBoosting,
      isBraking:  flightState.isBraking,
    };

    // ── Active camera update ──────────────────────────────────────────────
    const activeCam = this._cameras[this._activeMode];
    activeCam.update(flightState, dt, ctx);

    // ── Effects composited on top ─────────────────────────────────────────
    this._effects.apply(activeCam.babylonCamera, dt, ctx.isBoosting);
  }

  dispose(): void {
    this._effects.reset();
    this._scene = null;
  }

  // ─── Public effect triggers (called by future gameplay systems) ───────────

  /** General camera shake — call from explosions, hits, turbulence. */
  shake(magnitude: number, duration: number): void {
    this._effects.shake(magnitude, duration);
  }

  /** Heavy nearby explosion — strong shake + FOV spike. */
  triggerExplosion(magnitude = 2.5): void {
    this._effects.triggerExplosion(magnitude);
  }

  /** Missile / gun recoil kick. */
  triggerMissile(): void {
    this._effects.triggerMissile();
  }

  /** Maximum shake — crash / hard impact. */
  triggerCrash(): void {
    this._effects.triggerCrash();
  }

  getActiveMode(): CameraMode {
    return this._activeMode;
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private _cycleMode(): void {
    const scene = this._scene;
    if (!scene) return;

    const currentIdx = MODE_CYCLE.indexOf(this._activeMode);
    const nextMode   = MODE_CYCLE[(currentIdx + 1) % MODE_CYCLE.length];
    const nextCam    = this._cameras[nextMode];
    const state      = this._aircraft.getFlightState();

    nextCam.snapToState(state);
    scene.activeCamera = nextCam.babylonCamera;
    this._effects.setBaseFov(nextCam.baseFov);
    this._activeMode = nextMode;

    console.log(`[CameraManager] Mode → ${nextMode}`);
  }
}
