import { Scene } from '@babylonjs/core/scene';
import type { GameSystem } from '../core/GameLoop';
import type { GameState, Aircraft, AircraftConfig, DamageInfo } from '../../types';
import { FlightPhase } from '../../types';
import { FlightPhysics }    from './FlightPhysics';
import { AircraftMesh }     from './AircraftMesh';
import { IslandTerrain }    from '../world/terrain/IslandTerrain';
import { getDeterministicSpawnPoint } from '../network/SpawnPointManager';
import type { InputManager } from '../controls/InputManager';
import { globalEventBus } from '../core/EventBus';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';

// ─── Player aircraft config ────────────────────────────────────────────────────

const PLAYER_CONFIG: AircraftConfig = {
  id:           'f16_player',
  name:         'F-16C Fighting Falcon',
  modelPath:    '',
  maxSpeed:     360,
  minSpeed:     60,
  acceleration: 45,
  turnRate:     1.20,
  rollRate:     2.00,
  maxHealth:    1000,
  weaponSlots:  4,
};

/**
 * AircraftController — coordinator for the player aircraft.
 *
 * Implements `GameSystem` (registered 2nd in GameLoop, after InputManager).
 *
 * ─── Responsibility ───────────────────────────────────────────────────────────
 *
 *   InputManager  — reads the current frame's InputSnapshot (injected via constructor)
 *   FlightPhysics — computes position / orientation / speed (pure math, no Babylon)
 *   AircraftMesh  — applies FlightState to 3D geometry (Babylon)
 *
 *   Camera is ABSENT from this class — `CameraManager` (a separate GameSystem,
 *   registered 3rd) reads flight state via `getFlightState()` and input via
 *   the shared `InputManager` reference it also receives.
 *
 * ─── State → React bridge ─────────────────────────────────────────────────────
 *
 *   Pushes an `Aircraft` object to React at 10 Hz via `_onStateUpdate`.
 *   The physics loop always runs at 60+ FPS; the HUD update is throttled.
 */
export class AircraftController implements GameSystem {
  readonly name = 'AircraftController';

  private _inputManager: InputManager;
  private _physics!:     FlightPhysics;
  private _mesh!:        AircraftMesh;

  // ── HUD bridge ────────────────────────────────────────────────────────────
  private _onStateUpdate: ((partial: Partial<GameState>) => void) | null = null;
  private _hudTimer = 0;
  private readonly HUD_UPDATE_INTERVAL = 0.10; // 10 Hz — gates GameState push only

  /**
   * PERF: Pre-allocated mutable telemetry payload — reused every frame.
   * Fields are written in-place before each emit, avoiding one heap object
   * allocation per frame (60×/s). Safe because EventBus listeners are synchronous.
   */
  private readonly _hudPayload = {
    speed: 0,
    altitude: 0,
    heading: 0,
    pitch: 0,
    roll: 0,
    throttle: 0,
    flightPhase: 'airborne' as import('../../types').FlightPhase,
    gearDown: false,
  };

  /** Mutable Aircraft object — updated in place, then pushed to React */
  private _aircraft: Aircraft = {
    id:          'player',
    config:      PLAYER_CONFIG,
    position:    { x: 0, y: 0, z: 0 },
    rotation:    { pitch: 0, yaw: 0, roll: 0 },
    velocity:    { x: 0, y: 0, z: 0 },
    speed:       0,
    throttle:    0,
    weapons:     [],
    isPlayer:    true,
    health:      PLAYER_CONFIG.maxHealth,
    maxHealth:   PLAYER_CONFIG.maxHealth,
    isDestroyed: false,
    boostFuel:   100,
    flightPhase: FlightPhase.Parked,
    gearDown:    true,
    takeDamage:  (info) => this.handleDamage(info),
  };

  private _isCriticallyDamaged = false;

  constructor(inputManager: InputManager) {
    this._inputManager = inputManager;
  }

  takeDamage(info: DamageInfo): void {
    this.handleDamage(info);
  }

  private handleDamage(info: DamageInfo): void {
    if (this._aircraft.isDestroyed) return;

    console.log(`[HEALTH][BEFORE] playerId=${this._aircraft.id} health=${this._aircraft.health}`);
    console.log(`[HEALTH][DAMAGE] playerId=${this._aircraft.id} damage=${info.amount}`);

    // Create a new reference for React to detect the change (Immutable update)
    this._aircraft = {
      ...this._aircraft,
      health: Math.max(0, this._aircraft.health - info.amount)
    };

    console.log(`[HEALTH][AFTER] playerId=${this._aircraft.id} health=${this._aircraft.health}`);

    // Immediately push to React so the UI updates without waiting for the 10Hz timer
    this._onStateUpdate?.({ playerAircraft: this._aircraft });

    const pos = new Vector3(
      this._aircraft.position.x,
      this._aircraft.position.y,
      this._aircraft.position.z,
    );
    
    globalEventBus.emit('PLAYER_TOOK_DAMAGE', {
      amount:   info.amount,
      sourceId: info.sourceId,
      position: info.hitPosition
        ? new Vector3(info.hitPosition.x, info.hitPosition.y, info.hitPosition.z)
        : pos,
    });

    // Emit damage state for DamageEffectSystem
    const pct = this._aircraft.health / this._aircraft.maxHealth;
    globalEventBus.emit('PLAYER_DAMAGE_STATE_CHANGED', {
      health:    this._aircraft.health,
      maxHealth: this._aircraft.maxHealth,
      pct,
    });
    
    if (this._aircraft.health <= this._aircraft.maxHealth * 0.25 && !this._isCriticallyDamaged) {
      this._isCriticallyDamaged = true;
      globalEventBus.emit('PLAYER_CRITICAL_HEALTH', { health: this._aircraft.health });
      console.log('[AircraftController] CRITICAL DAMAGE!');
    }

    if (this._aircraft.health <= 0) {
      this.destroyPlayer();
    }
    
    this._onStateUpdate?.({ playerAircraft: this._aircraft });
  }

  isDestroyed(): boolean {
    return this._aircraft.isDestroyed;
  }

  private destroyPlayer(): void {
    if (this._aircraft.isDestroyed) return;
    this._aircraft = {
      ...this._aircraft,
      isDestroyed: true
    };
    
    console.log('[AircraftController] PLAYER DESTROYED!');
    globalEventBus.emit('PLAYER_DESTROYED', { position: new Vector3(this._aircraft.position.x, this._aircraft.position.y, this._aircraft.position.z) });
    
    // Leave mesh visible so DamageEffectSystem continues to emit heavy smoke and fire
    // as the dead plane falls to the ground.
  }

  // ─── GameSystem ───────────────────────────────────────────────────────────

  private _spawnSlotIndex = 0;

  setSpawnSlotIndex(index: number): void {
    this._spawnSlotIndex = Math.max(0, index);
  }

  initialize(scene: Scene): void {
    const sp = getDeterministicSpawnPoint(this._spawnSlotIndex);
    const spawnX = sp.x;
    const spawnY = sp.y;
    const spawnZ = sp.z;

    this._physics = new FlightPhysics(spawnX, spawnY, spawnZ, sp.heading, IslandTerrain.getHeightAt);

    this._mesh = new AircraftMesh();
    this._mesh.initialize(scene, spawnX, spawnY, spawnZ);

    this._syncAircraft();

    console.log(
      `[AircraftController] Spawned at slot ${this._spawnSlotIndex} (${spawnX}, ${spawnY.toFixed(1)}, ${spawnZ})`,
    );
  }

  setStateUpdater(fn: (partial: Partial<GameState>) => void): void {
    this._onStateUpdate = fn;
    this._onStateUpdate({ playerAircraft: this._aircraft });
  }

  /**
   * BUG-7 FIX: Returns the current state updater so MissionManager can
   * push phase changes WITHOUT overwriting (replacing) this callback.
   */
  getStateUpdater(): ((partial: Partial<GameState>) => void) | null {
    return this._onStateUpdate;
  }

  update(dt: number, _state: GameState): void {
    // 1. Read this frame's input snapshot (built by InputManager earlier in the loop)
    let snap = this._inputManager.getSnapshot();

    // Ignore input if destroyed (dead stick / fall)
    if (this._aircraft.isDestroyed) {
      snap = {
        ...snap,
        mouseDeltaX: 0,
        mouseDeltaY: 0,
        joystickX: 0,
        joystickY: 0,
        rollLeft: false,
        rollRight: false,
        throttleUp: false,
        throttleDown: true, // Force throttle down
        boost: false,
        airBrake: false,
        fireGun: false,
        fireMissile: false,
        targetLock: false,
        toggleGear: false,
        cameraToggle: false,
        lookBack: false,
        pause: false,
      };
    }

    // 2. Physics (mouse pitch/yaw + throttle keys + boost/brake)
    this._physics.update(snap, dt);

    // 3. Apply to 3D mesh (if not destroyed)
    if (!this._aircraft.isDestroyed) {
      this._mesh.apply(this._physics.getState());
    }

    // Check for crash (terrain collision while airborne)
    const fs = this._physics.getState();
    const groundHeight = IslandTerrain.getHeightAt(fs.x, fs.z);
    if (!this._aircraft.isDestroyed && fs.flightPhase === FlightPhase.Airborne && fs.y <= groundHeight + 1.2) {
      console.log(`[AircraftController] TERRAIN COLLISION at altitude ${fs.y.toFixed(1)}`);
      this.handleDamage({ amount: 9999, sourceId: 'terrain', type: 'collision' });
    }

    // 4. Update Aircraft state for React
    this._syncAircraft();

    // High-frequency telemetry push for direct UI subscription (60 Hz)
    // PERF: write into pre-allocated _hudPayload — zero heap allocation per frame
    const fs2 = this._physics.getState();
    this._hudPayload.speed       = fs2.speed;
    this._hudPayload.altitude    = fs2.y;
    this._hudPayload.heading     = (fs2.yaw * 180 / Math.PI + 360) % 360;
    this._hudPayload.pitch       = fs2.pitch;
    this._hudPayload.roll        = fs2.roll;
    this._hudPayload.throttle    = fs2.throttle;
    this._hudPayload.flightPhase = fs2.flightPhase;
    this._hudPayload.gearDown    = fs2.gearDown;
    globalEventBus.emit('HUD_TELEMETRY_UPDATE', this._hudPayload);

    // Low-frequency global state push (10 Hz)
    this._hudTimer += dt;
    if (this._hudTimer >= this.HUD_UPDATE_INTERVAL) {
      this._hudTimer -= this.HUD_UPDATE_INTERVAL;
      this._onStateUpdate?.({ playerAircraft: this._aircraft });
    }
  }

  dispose(): void {
    this._mesh.dispose();
    this._onStateUpdate = null;
  }

  // ─── Getters (read by CameraManager) ─────────────────────────────────────

  /** Latest physics state. Valid after the first update() call. */
  getFlightState() {
    return this._physics.getState();
  }

  /** Current health (0–maxHealth). Needed by NetworkManager for RTDB broadcast. */
  getHealth(): number {
    return this._aircraft.health;
  }

  isGunFiring(): boolean {
    if (this._aircraft.isDestroyed) return false;
    return this._inputManager.getSnapshot().fireGun;
  }

  isMissileFiring(): boolean {
    if (this._aircraft.isDestroyed) return false;
    return this._inputManager.getSnapshot().fireMissile;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private _syncAircraft(): void {
    const fs = this._physics.getState();
    const ac = this._aircraft;

    ac.position.x = fs.x;
    ac.position.y = fs.y;
    ac.position.z = fs.z;

    ac.rotation.pitch = fs.pitch;
    ac.rotation.yaw   = fs.yaw;
    ac.rotation.roll  = fs.roll;

    const cosP    = Math.cos(fs.pitch);
    ac.velocity.x = cosP * Math.sin(fs.yaw) * fs.speed;
    ac.velocity.y = Math.sin(fs.pitch)       * fs.speed;
    ac.velocity.z = cosP * Math.cos(fs.yaw)  * fs.speed;

    ac.speed    = fs.speed;
    ac.throttle = fs.throttle;
    ac.boostFuel = fs.boostFuel;
    ac.flightPhase = fs.flightPhase;
    ac.gearDown = fs.gearDown;
  }
}
