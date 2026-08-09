import { Scene } from '@babylonjs/core/scene';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { GameSystem } from '../../core/GameLoop';
import type { GameState } from '../../../types';

/**
 * Clouds — 3D Low-Poly Faceted Puffy Clouds.
 *
 * Recreates the iconic low-poly puffy clouds from the reference image:
 *   • 3D volumetric faceted geometry with crisp polygonal facets
 *   • Soft pastel warm-white with gentle peach/pink ambient tint
 *   • Layered across 750 m – 1 500 m altitude with smooth continuous drift
 */
export class Clouds implements GameSystem {
  readonly name = 'Clouds';

  private readonly CLOUD_COUNT = 36;
  private readonly WRAP_LIMIT  = 7500; // wrap at ±7.5 km

  private clouds: Mesh[]   = [];
  private speeds: number[] = [];

  initialize(scene: Scene): void {
    // ── Low-Poly Cloud Material ───────────────────────────────────────────────
    // Soft pastel white with subtle warm peach/pink ambient shading
    const cloudMat = new StandardMaterial('lowPolyCloudMat', scene);
    cloudMat.diffuseColor  = new Color3(0.96, 0.93, 0.95);
    cloudMat.emissiveColor = new Color3(0.25, 0.22, 0.24); // warm pastel bounce in shadows
    cloudMat.specularColor = new Color3(0, 0, 0);
    cloudMat.alpha         = 0.95;

    // ── Build 3 Variations of 3D Low-Poly Master Cloud Clusters ───────────────
    const masterClouds = [
      this.createCloudCluster(scene, 'master_cloud_A', [
        { x: 0,   y: 0,  z: 0,   scaleX: 180, scaleY: 65, scaleZ: 110 },
        { x: -90, y: -5, z: 15,  scaleX: 130, scaleY: 55, scaleZ: 95 },
        { x: 100, y: -8, z: -10, scaleX: 140, scaleY: 50, scaleZ: 100 },
        { x: 20,  y: 25, z: -15, scaleX: 110, scaleY: 55, scaleZ: 85 },
      ], cloudMat),

      this.createCloudCluster(scene, 'master_cloud_B', [
        { x: 0,    y: 0,  z: 0,   scaleX: 220, scaleY: 70, scaleZ: 130 },
        { x: -110, y: -5, z: -20, scaleX: 150, scaleY: 60, scaleZ: 100 },
        { x: 120,  y: -5, z: 20,  scaleX: 160, scaleY: 58, scaleZ: 110 },
        { x: -30,  y: 30, z: 10,  scaleX: 130, scaleY: 60, scaleZ: 90 },
        { x: 50,   y: 26, z: -10, scaleX: 120, scaleY: 55, scaleZ: 85 },
      ], cloudMat),

      this.createCloudCluster(scene, 'master_cloud_C', [
        { x: 0,   y: 0,  z: 0,  scaleX: 150, scaleY: 60, scaleZ: 95 },
        { x: -70, y: -5, z: 10, scaleX: 110, scaleY: 48, scaleZ: 80 },
        { x: 75,  y: -6, z: -8, scaleX: 115, scaleY: 50, scaleZ: 85 },
      ], cloudMat),
    ];

    // Hide master source meshes
    for (const master of masterClouds) {
      master.setEnabled(false);
    }

    // ── Scatter Cloud Instances across the sky ────────────────────────────────
    for (let i = 0; i < this.CLOUD_COUNT; i++) {
      const masterIdx = i % masterClouds.length;
      const master    = masterClouds[masterIdx];

      const instance = master.clone(`cloud_inst_${i}`, null);
      if (!instance) continue;

      instance.setEnabled(true);

      const spawnX = (Math.random() - 0.5) * 13000;
      const spawnY = 700 + Math.random() * 850;
      const spawnZ = (Math.random() - 0.5) * 13000;

      instance.position = new Vector3(spawnX, spawnY, spawnZ);

      // Randomize cloud scale & rotation
      const uniformScale = 0.85 + Math.random() * 0.45;
      instance.scaling = new Vector3(uniformScale, uniformScale, uniformScale);
      instance.rotation.y = Math.random() * Math.PI * 2;

      this.clouds.push(instance);
      this.speeds.push(8 + Math.random() * 12); // gentle drift speed (m/s)
    }

    console.log(`[Clouds] Initialized ${this.clouds.length} 3D low-poly faceted clouds.`);
  }

  /**
   * Helper: constructs a single merged low-poly cloud cluster mesh from overlapping
   * low-poly faceted spheres/polyhedrons.
   */
  private createCloudCluster(
    scene: Scene,
    name: string,
    puffs: Array<{ x: number; y: number; z: number; scaleX: number; scaleY: number; scaleZ: number }>,
    mat: StandardMaterial,
  ): Mesh {
    const puffMeshes: Mesh[] = [];

    for (let i = 0; i < puffs.length; i++) {
      const p = puffs[i];
      // Low-tessellation sphere (segments: 4) creates distinct triangular facets
      const sphere = MeshBuilder.CreateSphere(`${name}_puff_${i}`, {
        diameter: 1.0,
        segments: 4,
      }, scene);

      sphere.position = new Vector3(p.x, p.y, p.z);
      sphere.scaling  = new Vector3(p.scaleX, p.scaleY, p.scaleZ);
      sphere.convertToFlatShadedMesh();
      puffMeshes.push(sphere);
    }

    const merged = Mesh.MergeMeshes(puffMeshes, true, true, undefined, false, true);
    if (merged) {
      merged.name = name;
      merged.material = mat;
      merged.convertToFlatShadedMesh();
      return merged;
    }

    return puffMeshes[0];
  }

  // ─── GameSystem ───────────────────────────────────────────────────────────

  update(deltaTime: number, _state: GameState): void {
    for (let i = 0; i < this.clouds.length; i++) {
      const cloud = this.clouds[i];
      cloud.position.z += this.speeds[i] * deltaTime;

      // Wrap around when drifting beyond the boundary
      if (cloud.position.z > this.WRAP_LIMIT) {
        cloud.position.z -= this.WRAP_LIMIT * 2;
        cloud.position.x = (Math.random() - 0.5) * 13000;
      }
    }
  }

  dispose(): void {
    for (const cloud of this.clouds) {
      cloud.dispose();
    }
    this.clouds = [];
    this.speeds = [];
  }
}
