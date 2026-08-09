import { Scene } from '@babylonjs/core/scene';
import { Vector3, Matrix } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { GameSystem } from '../core/GameLoop';
import type { GameState, DamageInfo } from '../../types';
import { TargetType, LockState } from '../../types';
import type { ITarget } from './ITarget';
import type { AircraftController } from '../aircraft/AircraftController';
import type { InputManager } from '../controls/InputManager';
import { globalEventBus } from '../core/EventBus';

const MAX_LOCK_RANGE  = 2500; // metres
const LOCK_CONE_ANGLE = 0.61; // ~35 degrees in radians
const LOCK_TIME       = 1.25; // seconds to complete lock

/** TargetEntity — concrete implementation of ITarget for 3D world entities */
export class TargetEntity implements ITarget {
  readonly id: string;
  readonly name: string;
  readonly type: TargetType;
  health: number;
  maxHealth: number;
  isDestroyed = false;
  isHostile = true;

  private mesh: Mesh;
  private radius: number;
  private centerOffset: Vector3;
  private onDestroyedCb?: (target: TargetEntity) => void;

  // PERF: cached absolute position — refreshed once per frame by TargetManager
  private _cachedPos = new Vector3();

  constructor(
    id: string,
    name: string,
    type: TargetType,
    mesh: Mesh,
    maxHealth: number,
    radius: number,
    onDestroyedCb?: (target: TargetEntity) => void,
    centerOffset: Vector3 = Vector3.Zero()
  ) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.mesh = mesh;
    this.health = maxHealth;
    this.maxHealth = maxHealth;
    this.radius = radius;
    this.centerOffset = centerOffset.clone();
    this.onDestroyedCb = onDestroyedCb;
    // Initialise cache from absolute position
    this._cachedPos.copyFrom(this.mesh.getAbsolutePosition()).addInPlace(this.centerOffset);
  }

  /**
   * Returns the world-space position of the target.
   * Refreshed once per frame by TargetManager.refreshPositions().
   * Returns a direct reference — callers must NOT mutate it.
   */
  getPosition(): Vector3 {
    return this._cachedPos;
  }

  /**
   * Same as getPosition() — explicit alias used by collision systems.
   * Returns the cached position ref with no heap allocation.
   */
  getPositionRef(): Vector3 {
    return this._cachedPos;
  }

  refreshPosition(): void {
    if (!this.isDestroyed) {
      this._cachedPos.copyFrom(this.mesh.getAbsolutePosition()).addInPlace(this.centerOffset);
    }
  }

  getBoundingRadius(): number {
    return this.radius;
  }

  getMesh(): Mesh {
    return this.mesh;
  }

  takeDamage(info: DamageInfo): void {
    if (this.isDestroyed) return;

    this.health = Math.max(0, this.health - info.amount);
    // PERF: removed per-hit console.log (hot path)

    // Flash orange on hit (including all child meshes)
    const flashMesh = (m: Mesh) => {
      if (m.material && 'emissiveColor' in m.material) {
        const mat = m.material as StandardMaterial;
        const origEmissive = mat.emissiveColor.clone();
        mat.emissiveColor = new Color3(1, 0.4, 0.2);
        setTimeout(() => {
          if (!this.isDestroyed && mat) mat.emissiveColor = origEmissive;
        }, 80);
      }
    };
    
    flashMesh(this.mesh);
    for (const child of this.mesh.getChildMeshes()) {
      flashMesh(child as Mesh);
    }

    if (this.health <= 0) {
      this.destroy();
    }
  }

  destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    console.log(`[TargetManager] ${this.name} DESTROYED.`);

    globalEventBus.emit('TARGET_DESTROYED', {
      targetId:   this.id,
      targetName: this.name,
      position:   this._cachedPos.clone(), // clone OK — infrequent event
    });

    this.onDestroyedCb?.(this);

    this.mesh.visibility = 0;
    setTimeout(() => {
      this.mesh.dispose();
    }, 200);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * TargetManager — tracks all shootable targets (air & ground).
 *
 * PERF optimizations:
 *  1. _activeTargetsCache — rebuilt only when a target is destroyed (dirty flag)
 *     instead of filter() every frame.
 *  2. _scratchPlayerPos / _scratchForward — pre-allocated, zero per-frame allocs
 *     in updateLockState().
 *  3. Screen projection runs at 60 Hz (every frame) — synchronized with render loop
 *     so the target reticle never lags the camera.
 *  4. Target positions refreshed once per frame via refreshPositions(), so all
 *     collision & lock code reads from a cached value (no repeated mesh queries).
 *  5. _hudTargetPayload / _scratchScreenPos / _identityMatrix — pre-allocated,
 *     zero per-frame heap allocations in HUD_TARGET_UPDATE emit path.
 */
export class TargetManager implements GameSystem {
  readonly name = 'TargetManager';
  private scene: Scene | null = null;
  private targets: TargetEntity[] = [];

  private selectedTargetIndex = -1;
  private selectedTarget: TargetEntity | null = null;
  private lockState: LockState = LockState.None;
  private lockProgress = 0;

  private aircraftController: AircraftController | null = null;
  private inputManager: InputManager | null = null;

  // PERF: active-target cache — dirty flag set on any destruction
  private _activeTargetsCache: TargetEntity[] = [];
  private _activeTargetsDirty = true;

  // PERF: pre-allocated scratch vectors — reused every frame
  private readonly _scratchPlayerPos = new Vector3();
  private readonly _scratchForward   = new Vector3();
  private readonly _scratchToTarget  = new Vector3();

  // PERF: pre-allocated screen projection scratch objects — zero per-frame allocs
  /** Reused every frame — written into by _computeScreenPos() */
  private readonly _scratchScreenPos = { x: 0, y: 0, isBehind: false };
  /** Reused every frame — receives Vector3.Project() result without allocation */
  private readonly _scratchProjResult = new Vector3();
  /** Pre-allocated identity matrix — used as worldMatrix arg to Vector3.Project() */
  private readonly _identityMatrix = Matrix.Identity();

  // PERF: reusable HUD_TARGET_UPDATE payload — written in-place, never re-allocated
  private readonly _hudTargetPayload: {
    lockState: LockState | 'inbound';
    targetName: string | null;
    distance: number | undefined;
    lockProgress: number;
    screenPos: { x: number; y: number; isBehind: boolean } | undefined;
  } = {
    lockState: LockState.None,
    targetName: null,
    distance: undefined,
    lockProgress: 0,
    screenPos: undefined,
  };

  // PERF: cached distance — computed once per frame, reused for payload & state
  private _cachedDistance: number | undefined = undefined;

  setDependencies(aircraftController: AircraftController, inputManager: InputManager): void {
    this.aircraftController = aircraftController;
    this.inputManager = inputManager;
  }

  initialize(scene: Scene): void {
    this.scene = scene;
    this.spawnDefaultTargets();
    // Subscribe once — invalidate active-target cache on any destruction
    globalEventBus.on('TARGET_DESTROYED', () => {
      this._activeTargetsDirty = true;
    });
    console.log(`[TargetManager] Initialized with ${this.targets.length} target entities.`);
  }

  update(dt: number, state: GameState): void {
    // 0. Refresh all target positions once per frame (single mesh query each)
    this.refreshPositions();

    const activeTargets = this.getActiveTargets();

    // 1. Target cycle input
    if (this.inputManager) {
      const snap = this.inputManager.getSnapshot();
      if (snap.targetLock) {
        this.cycleTarget(activeTargets);
      }
    }

    // 2. Lock-on state machine
    this.updateLockState(dt);

    // 3. Sync to GameState
    const selId = this.selectedTarget?.id;
    state.targets = activeTargets.map((t) => ({
      id:        t.id,
      name:      t.name,
      type:      t.type,
      // Read from cached position — no mesh query
      position:  { x: t.getPositionRef().x, y: t.getPositionRef().y, z: t.getPositionRef().z },
      isHostile: t.isHostile,
      isLocked:  t.id === selId && this.lockState === LockState.Locked,
    }));

    // 4. Screen projection — High-frequency (60 Hz), camera-synchronized
    this._computeScreenPos();
    
    // PERF: compute distance once; reuse in payload and state (avoid double Vector3.Distance call)
    this._cachedDistance = this.selectedTarget && this.aircraftController
      ? Vector3.Distance(this._scratchPlayerPos, this.selectedTarget.getPositionRef())
      : undefined;

    // PERF: write into pre-allocated _hudTargetPayload — zero heap allocation per frame
    this._hudTargetPayload.lockState    = this.lockState;
    this._hudTargetPayload.targetName   = this.selectedTarget?.name ?? null;
    this._hudTargetPayload.distance     = this._cachedDistance;
    this._hudTargetPayload.lockProgress = this.lockProgress;
    this._hudTargetPayload.screenPos    = this.selectedTarget ? this._scratchScreenPos : undefined;
    globalEventBus.emit('HUD_TARGET_UPDATE', this._hudTargetPayload);

    state.lockState = {
      state:       this.lockState,
      targetId:    this.selectedTarget?.id ?? null,
      targetName:  this.selectedTarget?.name ?? null,
      targetPos:   this.selectedTarget
        ? { x: this.selectedTarget.getPositionRef().x, y: this.selectedTarget.getPositionRef().y, z: this.selectedTarget.getPositionRef().z }
        : undefined,
      screenPos:   this.selectedTarget ? this._scratchScreenPos : undefined,
      lockProgress: this.lockProgress,
      distance:    this._cachedDistance,
    };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private refreshPositions(): void {
    for (const t of this.targets) {
      if (!t.isDestroyed) t.refreshPosition();
    }
  }

  /**
   * Computes the screen-space position of the selected target and writes the
   * result into the pre-allocated _scratchScreenPos object.
   *
   * PERF: no heap allocation — reuses _scratchProjResult and _identityMatrix
   * rather than calling Vector3.Project() which would allocate a new Vector3.
   */
  private _computeScreenPos(): void {
    if (!this.selectedTarget || !this.scene || !this.scene.activeCamera) {
      // Mark as behind to signal HUD that target is not visible
      this._scratchScreenPos.isBehind = true;
      return;
    }

    const engine   = this.scene.getEngine();
    const viewport = this.scene.activeCamera.viewport;

    // Vector3.Project writes into _scratchProjResult; returns the same ref
    Vector3.ProjectToRef(
      this.selectedTarget.getPositionRef(),
      this._identityMatrix,
      this.scene.getTransformMatrix(),
      viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight()),
      this._scratchProjResult,
    );

    this._scratchScreenPos.x        = this._scratchProjResult.x;
    this._scratchScreenPos.y        = this._scratchProjResult.y;
    this._scratchScreenPos.isBehind = this._scratchProjResult.z < 0 || this._scratchProjResult.z > 1;
  }

  private cycleTarget(activeTargets: TargetEntity[]): void {
    if (activeTargets.length === 0) {
      this.selectedTarget      = null;
      this.selectedTargetIndex = -1;
      this.lockState           = LockState.None;
      this.lockProgress        = 0;
      return;
    }

    this.selectedTargetIndex = (this.selectedTargetIndex + 1) % activeTargets.length;
    this.selectedTarget      = activeTargets[this.selectedTargetIndex];
    this.lockState           = LockState.Searching;
    this.lockProgress        = 0;
    console.log(`[TargetManager] Target → ${this.selectedTarget.name}`);
  }

  private updateLockState(dt: number): void {
    if (!this.selectedTarget || this.selectedTarget.isDestroyed || !this.aircraftController) {
      this.selectedTarget = null;
      this.lockState      = LockState.None;
      this.lockProgress   = 0;
      return;
    }

    const fs = this.aircraftController.getFlightState();

    // PERF: write into pre-allocated scratch — no new Vector3
    this._scratchPlayerPos.copyFromFloats(fs.x, fs.y, fs.z);

    const cosP = Math.cos(fs.pitch);
    const sinP = Math.sin(fs.pitch);
    const cosY = Math.cos(fs.yaw);
    const sinY = Math.sin(fs.yaw);
    this._scratchForward.copyFromFloats(cosP * sinY, sinP, cosP * cosY);
    this._scratchForward.normalizeToRef(this._scratchForward);

    const targetPos = this.selectedTarget.getPositionRef();

    // PERF: subtract into scratch — no new Vector3
    targetPos.subtractToRef(this._scratchPlayerPos, this._scratchToTarget);
    const dist = this._scratchToTarget.length();

    if (dist > MAX_LOCK_RANGE * 1.2) {
      this.selectedTarget = null;
      this.lockState      = LockState.None;
      this.lockProgress   = 0;
      return;
    }

    // Normalise in-place using scratch
    this._scratchToTarget.normalizeToRef(this._scratchToTarget);
    const angle = Math.acos(Math.max(-1, Math.min(1, Vector3.Dot(this._scratchForward, this._scratchToTarget))));

    if (angle <= LOCK_CONE_ANGLE && dist <= MAX_LOCK_RANGE) {
      this.lockProgress = Math.min(1.0, this.lockProgress + dt / LOCK_TIME);
      this.lockState    = this.lockProgress >= 1.0 ? LockState.Locked : LockState.Locking;
      if (this.lockProgress >= 1.0 && this.lockState !== LockState.Locked) {
        console.log(`[TargetManager] 🎯 LOCKED: ${this.selectedTarget.name}`);
      }
    } else {
      this.lockProgress = Math.max(0, this.lockProgress - dt * 1.5);
      this.lockState    = this.lockProgress <= 0 ? LockState.Lost : LockState.Locking;
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  getSelectedTarget(): TargetEntity | null {
    return this.selectedTarget;
  }

  getLockState(): LockState {
    return this.lockState;
  }

  addTarget(target: TargetEntity): void {
    this.targets.push(target);
    this._activeTargetsDirty = true;
  }

  removeTarget(target: TargetEntity): void {
    this.targets = this.targets.filter((t) => t !== target && t.id !== target.id);
    if (this.selectedTarget?.id === target.id) this.selectedTarget = null;
    this._activeTargetsDirty = true;
  }

  clearTargets(): void {
    for (const t of this.targets) {
      t.destroy();
    }
    this.targets = [];
    this.selectedTarget = null;
    this._activeTargetsCache = [];
    this._activeTargetsDirty = true;
  }

  /**
   * Returns active (non-destroyed) targets.
   *
   * PERF: Result is cached between frames. Only rebuilt when
   * _activeTargetsDirty is true (set by TARGET_DESTROYED event or addTarget).
   */
  getActiveTargets(): TargetEntity[] {
    if (this._activeTargetsDirty) {
      this._activeTargetsCache = this.targets.filter((t) => !t.isDestroyed);
      this._activeTargetsDirty = false;
    }
    return this._activeTargetsCache;
  }

  // ─── Default spawn ────────────────────────────────────────────────────────

  private spawnDefaultTargets(): void {
    if (!this.scene) return;

    const matRed = new StandardMaterial('targetHostileMat', this.scene);
    matRed.diffuseColor  = new Color3(0.9, 0.2, 0.1);
    matRed.emissiveColor = new Color3(0.3, 0.05, 0.02);

    const matYellow = new StandardMaterial('targetGroundMat', this.scene);
    matYellow.diffuseColor  = new Color3(0.9, 0.7, 0.1);
    matYellow.emissiveColor = new Color3(0.2, 0.15, 0.02);

    const droneSpawns = [
      { id: 'drone_alpha',   name: 'TARGET DRONE ALPHA',   pos: new Vector3(0,   180, 200) },
      { id: 'drone_bravo',   name: 'TARGET DRONE BRAVO',   pos: new Vector3(-150, 220, 450) },
      { id: 'drone_charlie', name: 'TARGET DRONE CHARLIE', pos: new Vector3(180,  250, 700) },
    ];

    for (const d of droneSpawns) {
      const droneMesh = MeshBuilder.CreatePolyhedron(d.id, { type: 1, size: 4 }, this.scene);
      droneMesh.position = d.pos;
      droneMesh.material = matRed;
      droneMesh.freezeWorldMatrix(); // static drones — matrix won't change
      this.targets.push(new TargetEntity(d.id, d.name, TargetType.Aircraft, droneMesh, 100, 6.0,
        () => { /* score reward hook */ }));
    }

    const radarPos  = new Vector3(120, 28, 600);
    const radarMesh = MeshBuilder.CreateCylinder('ground_radar_target',
      { diameterTop: 12, diameterBottom: 2, height: 6 }, this.scene);
    radarMesh.position = radarPos;
    radarMesh.material = matYellow;
    radarMesh.freezeWorldMatrix();
    this.targets.push(new TargetEntity('ground_radar_target', 'GROUND RADAR TOWER',
      TargetType.Structure, radarMesh, 150, 10.0));

    this._activeTargetsDirty = true;
  }

  dispose(): void {
    for (const t of this.targets) {
      if (!t.isDestroyed) t.destroy();
    }
    this.targets             = [];
    this._activeTargetsCache = [];
    this.scene               = null;
  }
}
