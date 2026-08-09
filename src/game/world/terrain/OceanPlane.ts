import { Scene } from '@babylonjs/core/scene';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { GameSystem } from '../../core/GameLoop';
import type { GameState } from '../../../types';

/**
 * OceanPlane — large flat water plane surrounding the island.
 *
 * 30 km × 30 km plane at Y = -2 (just below the island shore line).
 * Uses a subtly animated emissive shimmer to suggest wave motion
 * without any expensive water simulation.
 *
 * Implements GameSystem so its update() is called each frame for the shimmer.
 */
export class OceanPlane implements GameSystem {
  readonly name = 'OceanPlane';

  private shimmerMat: StandardMaterial | null = null;
  private shimmerTime = 0;

  initialize(scene: Scene): void {
    // Ocean plane — single large quad (minimal poly)
    const ocean = MeshBuilder.CreateGround('ocean', {
      width:        30000,
      height:       30000,
      subdivisions: 1,
    }, scene);
    ocean.position.y = -2;

    const mat = new StandardMaterial('oceanMat', scene);
    mat.diffuseColor  = new Color3(0.02, 0.10, 0.30);  // darker ocean for sky contrast
    mat.specularColor = new Color3(0.45, 0.60, 0.80);
    mat.specularPower = 128;
    mat.emissiveColor = new Color3(0.01, 0.04, 0.12);
    ocean.material = mat;

    // Do NOT freeze — we animate the material each frame
    this.shimmerMat = mat;

    console.log('[OceanPlane] Created (30 km × 30 km).');
  }

  update(deltaTime: number, _state: GameState): void {
    if (!this.shimmerMat) return;

    this.shimmerTime += deltaTime * 0.12;
    const s = Math.sin(this.shimmerTime);
    const c = Math.cos(this.shimmerTime * 0.71);

    // Slightly modulate emissive to simulate light on water
    this.shimmerMat.emissiveColor.r = 0.010 + 0.004 * s;
    this.shimmerMat.emissiveColor.g = 0.060 + 0.012 * c;
    this.shimmerMat.emissiveColor.b = 0.160 + 0.025 * s;
  }

  dispose(): void {
    this.shimmerMat = null;
  }
}
