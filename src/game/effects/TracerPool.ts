/**
 * TracerPool — Object pool for bullet tracer line segments.
 *
 * Each tracer is a thin LinesMesh that renders a streak between the bullet's
 * previous and current position. The pool pre-allocates all meshes at scene
 * load. Zero allocations occur during combat.
 *
 * Usage:
 *   pool.spawn(startPos, endPos)   — called when a projectile is fired
 *   pool.update(dt)                — fades and returns expired tracers
 */

import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { CreateLines } from '@babylonjs/core/Meshes/Builders/linesBuilder';
import type { LinesMesh } from '@babylonjs/core/Meshes/linesMesh';

interface TracerInstance {
  mesh: LinesMesh;
  active: boolean;
  life: number;
  maxLife: number;
}

export class TracerPool {
  private pool: TracerInstance[] = [];

  constructor(scene: Scene, poolSize = 120) {

    const dummy = [Vector3.Zero(), Vector3.One()];
    for (let i = 0; i < poolSize; i++) {
      const mesh = CreateLines(`tracer_${i}`, { points: dummy, updatable: true }, scene) as LinesMesh;
      mesh.isVisible = false;
      mesh.isPickable = false;
      mesh.color = new Color3(1.0, 0.95, 0.6);

      this.pool.push({
        mesh,
        active: false,
        life: 0,
        maxLife: 0,
      });
    }
  }

  /**
   * Spawn a tracer from start to end position.
   * @param start     Tracer start point (behind bullet)
   * @param end       Tracer end point (bullet current position)
   * @param lifetime  How long the tracer stays visible (seconds)
   */
  spawn(start: Vector3, end: Vector3, lifetime = 0.06): void {
    const tracer = this.pool.find(t => !t.active);
    if (!tracer) return; // Pool exhausted — silently skip

    // Update mesh geometry to new position
    CreateLines(`tracer_update`, {
      points: [start, end],
      instance: tracer.mesh,
    });

    tracer.active  = true;
    tracer.life    = 0;
    tracer.maxLife = lifetime;
    tracer.mesh.isVisible = true;
    tracer.mesh.alpha = 1.0;
  }

  /** Update all active tracers — fade and return to pool. */
  update(dt: number): void {
    for (const tracer of this.pool) {
      if (!tracer.active) continue;

      tracer.life += dt;
      const pct = tracer.life / tracer.maxLife;

      if (pct >= 1.0) {
        tracer.active        = false;
        tracer.mesh.isVisible = false;
        tracer.mesh.alpha     = 0;
      } else {
        // Fade from full opacity to 0
        tracer.mesh.alpha = Math.max(0, 1.0 - pct * 2.5);
      }
    }
  }

  dispose(): void {
    for (const t of this.pool) {
      t.mesh.dispose();
    }
    this.pool = [];
  }
}
