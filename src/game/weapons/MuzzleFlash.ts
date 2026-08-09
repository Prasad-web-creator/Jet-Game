import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Mesh } from '@babylonjs/core/Meshes/mesh';

export class MuzzleFlash {
  private flashLight: PointLight;
  private flashMesh: Mesh;
  private flashDuration = 0.04; // 40ms flash
  private timer = 0;

  constructor(scene: Scene) {
    this.flashLight = new PointLight('muzzleFlashLight', Vector3.Zero(), scene);
    this.flashLight.diffuse = new Color3(1.0, 0.85, 0.3);
    this.flashLight.intensity = 0;
    this.flashLight.range = 15;

    const mat = new StandardMaterial('muzzleFlashMat', scene);
    mat.emissiveColor = new Color3(1.0, 0.9, 0.5);
    mat.disableLighting = true;

    this.flashMesh = MeshBuilder.CreateDisc('muzzleFlashMesh', { radius: 0.8 }, scene);
    this.flashMesh.material = mat;
    this.flashMesh.isVisible = false;
    this.flashMesh.isPickable = false;
  }

  trigger(position: Vector3): void {
    this.flashLight.position.copyFrom(position);
    this.flashLight.intensity = 4.0;

    this.flashMesh.position.copyFrom(position);
    this.flashMesh.isVisible = true;
    this.flashMesh.scaling.setAll(0.8 + Math.random() * 0.4);

    this.timer = this.flashDuration;
  }

  update(dt: number): void {
    if (this.timer > 0) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.flashLight.intensity = 0;
        this.flashMesh.isVisible = false;
      }
    }
  }

  dispose(): void {
    this.flashLight.dispose();
    this.flashMesh.dispose();
  }
}
