/**
 * ShockwavePool — Pool of expanding ring shockwaves for large explosions.
 *
 * Each shockwave is a flat torus mesh that scales outward rapidly and fades
 * from opaque to transparent over ~0.5 seconds. Used for missile hits and
 * large ground explosions to add visual impact.
 *
 * Pool: 8 concurrent shockwaves (exceeds realistic simultaneity).
 */

import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';

interface ShockwaveInstance {
  mesh: Mesh;
  active: boolean;
  timer: number;
  duration: number;
  maxScale: number;
}

export class ShockwavePool {
  private pool: ShockwaveInstance[] = [];

  constructor(scene: Scene, poolSize = 8) {
    const mat = new StandardMaterial('shockwave_mat', scene);
    mat.emissiveColor = new Color3(1.0, 0.6, 0.2);
    mat.disableLighting = true;
    mat.wireframe = false;

    for (let i = 0; i < poolSize; i++) {
      const mesh = MeshBuilder.CreateTorus(
        `shockwave_${i}`,
        { diameter: 1, thickness: 0.08, tessellation: 36 },
        scene
      );
      mesh.material  = mat;
      mesh.isVisible = false;
      mesh.isPickable = false;
      // Flat ring in the horizontal plane
      mesh.rotation.x = Math.PI / 2;

      this.pool.push({
        mesh,
        active:   false,
        timer:    0,
        duration: 0.5,
        maxScale: 10,
      });
    }
  }

  /**
   * Trigger a shockwave ring at position.
   * @param position World position (usually the explosion center)
   * @param scale    Final ring diameter in world units
   * @param duration Expansion duration in seconds
   */
  trigger(position: Vector3, scale = 12, duration = 0.5): void {
    const wave = this.pool.find(w => !w.active);
    if (!wave) return; // Pool full — skip gracefully

    wave.active    = true;
    wave.timer     = 0;
    wave.duration  = duration;
    wave.maxScale  = scale;

    wave.mesh.position.copyFrom(position);
    wave.mesh.scaling.setAll(0.1);
    wave.mesh.isVisible = true;
    (wave.mesh.material as StandardMaterial).alpha = 0.9;
  }

  update(dt: number): void {
    for (const wave of this.pool) {
      if (!wave.active) continue;

      wave.timer += dt;
      const t   = Math.min(wave.timer / wave.duration, 1.0);
      const eased = 1 - Math.pow(1 - t, 2); // Ease-out

      // Scale ring outward
      const s = 0.1 + eased * (wave.maxScale - 0.1);
      wave.mesh.scaling.setAll(s);

      // Fade out — opacity goes 0.9 → 0
      if (wave.mesh.material) {
        (wave.mesh.material as StandardMaterial).alpha = 0.9 * (1 - eased);
      }

      if (t >= 1.0) {
        wave.active        = false;
        wave.mesh.isVisible = false;
      }
    }
  }

  dispose(): void {
    for (const wave of this.pool) {
      wave.mesh.dispose();
    }
    this.pool = [];
  }
}
