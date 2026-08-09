import { Scene } from '@babylonjs/core/scene';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { IslandTerrain } from '../terrain/IslandTerrain';

/**
 * Vegetation — instanced low-poly trees scattered across the island.
 *
 * Each tree is two meshes:
 *   • Trunk: thin cylinder (brown)
 *   • Canopy: sphere (green, slightly flattened)
 *
 * One source mesh per part; all placed trees are instances.
 * Trees are excluded from built-up zones (airport, base, city)
 * and from areas below sea level.
 *
 * Total draw calls: 2 (one per source mesh), regardless of tree count.
 */
export class Vegetation {
  private static readonly TREE_COUNT = 180;

  /** Radius around each built zone where trees are suppressed */
  private static readonly EXCLUSION_ZONES: Array<[number, number, number]> = [
    [0,      0,    900],   // airport
    [-3000, -2500, 650],   // military base
    [3000,   1000, 800],   // city
  ];

  initialize(scene: Scene): void {
    // ── Materials ──────────────────────────────────────────────────────────
    const trunkMat = new StandardMaterial('trunkMat', scene);
    trunkMat.diffuseColor  = new Color3(0.35, 0.22, 0.10);
    trunkMat.specularColor = new Color3(0.05, 0.03, 0.01);

    const foliageMat = new StandardMaterial('foliageMat', scene);
    foliageMat.diffuseColor  = new Color3(0.18, 0.48, 0.12);
    foliageMat.specularColor = new Color3(0.04, 0.08, 0.02);

    // ── Source meshes (hidden — instances are visible) ─────────────────────
    const srcTrunk = MeshBuilder.CreateCylinder('trunkSrc', {
      height: 1, diameter: 1, tessellation: 5,
    }, scene);
    srcTrunk.material = trunkMat;
    srcTrunk.isVisible = false;

    const srcCanopy = MeshBuilder.CreateSphere('canopySrc', {
      diameter: 1, segments: 4, // very low-poly
    }, scene);
    srcCanopy.material = foliageMat;
    srcCanopy.isVisible = false;

    // ── Scatter trees ──────────────────────────────────────────────────────
    let placed = 0;
    let attempts = 0;
    const maxAttempts = Vegetation.TREE_COUNT * 8;

    while (placed < Vegetation.TREE_COUNT && attempts < maxAttempts) {
      attempts++;

      // Random position on a 12 km square (matches terrain bounds)
      const x = (Math.random() - 0.5) * 12000;
      const z = (Math.random() - 0.5) * 12000;

      const groundH = IslandTerrain.getHeightAt(x, z);
      if (groundH < 3) continue;           // below sea / coastal edge
      if (groundH > 260) continue;         // above treeline
      if (this.inExclusionZone(x, z)) continue;

      const scale = 0.8 + Math.random() * 0.8; // variety in tree size
      const trunkH = 10 * scale;
      const canopyR = 8  * scale;

      // Trunk instance
      const trunk = (srcTrunk as Mesh).createInstance(`trunk_${placed}`);
      trunk.scaling  = new Vector3(2.5 * scale, trunkH, 2.5 * scale);
      trunk.position = new Vector3(x, groundH + trunkH / 2, z);
      trunk.freezeWorldMatrix();

      // Canopy instance
      const canopy = (srcCanopy as Mesh).createInstance(`canopy_${placed}`);
      canopy.scaling  = new Vector3(canopyR, canopyR * 0.75, canopyR);
      canopy.position = new Vector3(x, groundH + trunkH + canopyR * 0.35, z);
      canopy.freezeWorldMatrix();

      placed++;
    }

    console.log(`[Vegetation] Placed ${placed} trees (${attempts} attempts).`);
  }

  private inExclusionZone(x: number, z: number): boolean {
    for (const [cx, cz, r] of Vegetation.EXCLUSION_ZONES) {
      const dx = x - cx, dz = z - cz;
      if (dx * dx + dz * dz < r * r) return true;
    }
    return false;
  }
}
