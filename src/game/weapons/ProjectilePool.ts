import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { TargetManager } from '../targets/TargetManager';
import { DamageType } from '../../types';

export interface ActiveProjectile {
  mesh: Mesh;
  position: Vector3;
  velocity: Vector3;
  damage: number;
  maxRange: number;
  distanceTraveled: number;
  active: boolean;
}

/**
 * ProjectilePool — pre-allocated bullet tracer pool.
 *
 * PERF: All per-frame math uses pre-allocated scratch Vector3 fields.
 * Zero heap allocations occur during update() in steady state.
 *
 * PERF: Active bullet tracking uses a free-index stack for O(1)
 * allocation and deallocation instead of O(N) array.find().
 */
export class ProjectilePool {
  private pool: ActiveProjectile[] = [];
  private material: StandardMaterial;

  // O(1) free-slot tracking
  private _freeIndices: number[] = [];
  private _activeCount = 0;

  // Scratch Vector3s — reused every frame, zero allocations in update()
  private readonly _scratchMove = new Vector3();
  private readonly _scratchHitPos = new Vector3();

  constructor(scene: Scene, poolSize = 120) {
    // Emissive glowing tracer material
    this.material = new StandardMaterial('tracerMat', scene);
    this.material.emissiveColor = new Color3(1.0, 0.85, 0.25);
    this.material.diffuseColor  = new Color3(1.0, 0.9,  0.4);
    this.material.disableLighting = true;

    // Pre-instantiate pool meshes
    for (let i = 0; i < poolSize; i++) {
      const tracer = MeshBuilder.CreateCylinder(
        `tracer_${i}`,
        { height: 4.5, diameterTop: 0.18, diameterBottom: 0.18 },
        scene
      );
      tracer.material  = this.material;
      tracer.isVisible = false;
      tracer.isPickable = false;

      this.pool.push({
        mesh: tracer,
        position: new Vector3(),
        velocity: new Vector3(),
        damage: 0,
        maxRange: 1200,
        distanceTraveled: 0,
        active: false,
      });

      // All slots start free
      this._freeIndices.push(i);
    }

    console.log(`[ProjectilePool] Initialized pool with ${poolSize} bullet tracers.`);
  }

  /**
   * Spawn a bullet tracer from the pool.
   * O(1) — pops from the free-index stack.
   */
  spawn(
    origin: Vector3,
    direction: Vector3,
    speed: number,
    craftVelocity: Vector3,
    damage: number,
    maxRange = 1200
  ): boolean {
    if (this._freeIndices.length === 0) return false; // Pool exhausted silently

    const idx  = this._freeIndices.pop()!;
    const proj = this.pool[idx];

    proj.active = true;
    proj.position.copyFrom(origin);

    // Bullet velocity = muzzle direction * speed + aircraft velocity
    // Uses ScaleToRef to avoid allocating a new Vector3
    direction.scaleToRef(speed, proj.velocity);
    proj.velocity.addInPlace(craftVelocity);

    proj.damage           = damage;
    proj.maxRange         = maxRange;
    proj.distanceTraveled = 0;

    proj.mesh.position.copyFrom(origin);
    proj.mesh.isVisible = true;

    // Align mesh orientation to bullet velocity vector
    // lookAt needs a world-space point, not a direction — add current pos
    proj.position.addToRef(proj.velocity, this._scratchMove);
    proj.mesh.lookAt(this._scratchMove);
    proj.mesh.rotate(Vector3.Right(), Math.PI / 2);

    this._activeCount++;
    return true;
  }

  /**
   * Update all active bullets, perform bounding-sphere collision, invoke hit callback.
   *
   * PERF: Uses ScaleToRef + addInPlace → zero Vector3 allocations per frame.
   * PERF: Skips inactive slots immediately.
   */
  update(dt: number, targetManager: TargetManager, onHitCb?: (hitPos: Vector3) => void): void {
    if (this._activeCount === 0) return; // Early-out when nothing is firing

    const activeTargets = targetManager.getActiveTargets();

    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      if (!p.active) continue;

      // PERF: ScaleToRef → writes into _scratchMove, no allocation
      p.velocity.scaleToRef(dt, this._scratchMove);
      const stepDist = this._scratchMove.length();

      p.position.addInPlace(this._scratchMove);
      p.distanceTraveled += stepDist;

      // Range check
      if (p.distanceTraveled >= p.maxRange) {
        this._recycle(i);
        continue;
      }

      // Update mesh position
      p.mesh.position.copyFrom(p.position);

      // Bounding-sphere collision against active targets
      let hit = false;
      for (const target of activeTargets) {
        if (target.isDestroyed) continue;

        const targetPos    = target.getPositionRef(); // returns cached position ref, no alloc
        const targetRadius = target.getBoundingRadius();

        const distToTarget = Vector3.Distance(p.position, targetPos);
        if (distToTarget <= targetRadius) {
          // HIT — copy hit position into scratch to pass to callback without alloc
          this._scratchHitPos.copyFrom(p.position);

          target.takeDamage({
            amount:      p.damage,
            sourceId:    'player',
            type:        DamageType.Bullet,
            hitPosition: { x: p.position.x, y: p.position.y, z: p.position.z },
          });

          onHitCb?.(this._scratchHitPos);
          this._recycle(i);
          hit = true;
          break;
        }
      }
      if (hit) continue;
    }
  }

  /** O(1) deactivation — pushes index back to free stack. */
  private _recycle(idx: number): void {
    const p = this.pool[idx];
    p.active         = false;
    p.mesh.isVisible = false;
    this._freeIndices.push(idx);
    this._activeCount = Math.max(0, this._activeCount - 1);
  }

  get activeCount(): number { return this._activeCount; }

  dispose(): void {
    for (const p of this.pool) {
      p.mesh.dispose();
    }
    this.pool = [];
    this._freeIndices = [];
    this.material.dispose();
  }
}
