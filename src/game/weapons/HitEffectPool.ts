import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Mesh } from '@babylonjs/core/Meshes/mesh';

interface HitParticle {
  mesh: Mesh;
  timer: number;
  duration: number;
  active: boolean;
}

export class HitEffectPool {
  private pool: HitParticle[] = [];
  private material: StandardMaterial;

  constructor(scene: Scene, poolSize = 25) {
    this.material = new StandardMaterial('hitSparkMat', scene);
    this.material.emissiveColor = new Color3(1.0, 0.6, 0.1);
    this.material.disableLighting = true;

    for (let i = 0; i < poolSize; i++) {
      const spark = MeshBuilder.CreateSphere(`hitSpark_${i}`, { diameter: 0.8, segments: 4 }, scene);
      spark.material = this.material;
      spark.isVisible = false;
      spark.isPickable = false;

      this.pool.push({
        mesh: spark,
        timer: 0,
        duration: 0.12,
        active: false,
      });
    }
  }

  trigger(position: Vector3): void {
    const spark = this.pool.find((s) => !s.active);
    if (!spark) return;

    spark.active = true;
    spark.timer = spark.duration;
    spark.mesh.position.copyFrom(position);
    spark.mesh.scaling.setAll(1.0);
    spark.mesh.isVisible = true;
  }

  update(dt: number): void {
    for (const s of this.pool) {
      if (!s.active) continue;

      s.timer -= dt;
      const progress = s.timer / s.duration;
      s.mesh.scaling.setAll(progress * 1.5);

      if (s.timer <= 0) {
        s.active = false;
        s.mesh.isVisible = false;
      }
    }
  }

  dispose(): void {
    for (const s of this.pool) {
      s.mesh.dispose();
    }
    this.pool = [];
    this.material.dispose();
  }
}
