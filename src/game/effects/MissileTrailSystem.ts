/**
 * MissileTrailSystem — Smoke/exhaust particle trails for active missiles.
 *
 * One ParticleSystem is leased from a pre-built pool for each active missile.
 * The emitter position is updated to follow the missile mesh each frame.
 * When the missile deactivates, the trail particle emission stops and the
 * system fades out over ~1 second before being returned to the pool.
 *
 * Pool: up to MAX_TRAILS concurrent trails (matches MissilePool size).
 */

import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Mesh } from '@babylonjs/core/Meshes/mesh';

const FLARE_URL = 'https://raw.githubusercontent.com/BabylonJS/Babylon.js/master/packages/tools/playground/public/textures/flare.png';

interface TrailSlot {
  ps: ParticleSystem;
  emitterRoot: Mesh;
  inUse: boolean;
  fadeTimer: number; // >0 means we're fading out
}

export class MissileTrailSystem {
  private pool: TrailSlot[] = [];
  // Maps missile ID → pool index
  private allocations = new Map<string, number>();
  private readonly MAX_TRAILS = 16;

  constructor(scene: Scene) {
    for (let i = 0; i < this.MAX_TRAILS; i++) {
      const emitterRoot = new Mesh(`missile_trail_root_${i}`, scene);
      emitterRoot.isPickable = false;

      const ps = new ParticleSystem(`missile_trail_${i}`, 80, scene);
      ps.particleTexture = new Texture(FLARE_URL, scene, false, false, Texture.BILINEAR_SAMPLINGMODE, null,
        () => { /* silent fallback — texture missing is fine */ });

      ps.emitter     = emitterRoot;
      ps.minEmitBox  = new Vector3(-0.1, -0.1, -0.1);
      ps.maxEmitBox  = new Vector3(0.1,  0.1,  0.1);

      // White-grey smoke trail
      ps.color1    = new Color4(0.9, 0.9, 0.9, 0.7);
      ps.color2    = new Color4(0.6, 0.6, 0.6, 0.4);
      ps.colorDead = new Color4(0.3, 0.3, 0.3, 0.0);

      ps.minSize     = 0.2;
      ps.maxSize     = 0.8;
      ps.minLifeTime = 0.4;
      ps.maxLifeTime = 0.9;
      ps.emitRate    = 80;

      // Trail flows backward from missile direction
      ps.direction1 = new Vector3(-0.2, 0.2, -1.0);
      ps.direction2 = new Vector3(0.2,  0.3, -1.0);
      ps.minEmitPower = 3;
      ps.maxEmitPower = 6;
      ps.gravity      = new Vector3(0, 0.3, 0);
      ps.updateSpeed  = 0.02;

      // Also add a bright exhaust core
      ps.color1 = new Color4(1.0, 0.8, 0.5, 0.9);
      ps.color2 = new Color4(0.9, 0.9, 0.9, 0.6);

      ps.stop(); // Start stopped — will be started on allocation

      this.pool.push({ ps, emitterRoot, inUse: false, fadeTimer: 0 });
    }
  }

  /**
   * Attach a trail to a missile.
   * @param missileId Unique missile identifier
   * @param position  Initial missile world position
   */
  attach(missileId: string, position: Vector3): void {
    if (this.allocations.has(missileId)) return; // Already tracked

    const idx = this.pool.findIndex(s => !s.inUse);
    if (idx < 0) return; // Pool exhausted — no trail (graceful)

    const slot = this.pool[idx];
    slot.inUse     = true;
    slot.fadeTimer  = 0;
    slot.emitterRoot.position.copyFrom(position);
    slot.ps.start();

    this.allocations.set(missileId, idx);
  }

  /**
   * Update emitter position to follow active missile.
   * Call every frame for missiles that have an attached trail.
   */
  updatePosition(missileId: string, position: Vector3): void {
    const idx = this.allocations.get(missileId);
    if (idx === undefined) return;
    this.pool[idx].emitterRoot.position.copyFrom(position);
  }

  /**
   * Detach trail from a missile (missile deactivated/hit/expired).
   * The smoke particles will fade out naturally over ~1 second.
   */
  detach(missileId: string): void {
    const idx = this.allocations.get(missileId);
    if (idx === undefined) return;

    const slot   = this.pool[idx];
    slot.ps.stop();           // Stop emitting new particles
    slot.fadeTimer = 1.2;     // Mark for cleanup after fade

    this.allocations.delete(missileId);
  }

  /** Called every frame — advances fade timers, returns slots to pool. */
  update(dt: number): void {
    for (const slot of this.pool) {
      if (!slot.inUse) continue;

      // Fade timer is set after detach
      if (slot.fadeTimer > 0) {
        slot.fadeTimer -= dt;
        if (slot.fadeTimer <= 0) {
          slot.inUse = false;
          // ps is already stopped; it'll finish emitting existing particles
        }
      }
    }
  }

  dispose(): void {
    for (const slot of this.pool) {
      slot.ps.dispose();
      slot.emitterRoot.dispose();
    }
    this.pool         = [];
    this.allocations.clear();
  }
}
