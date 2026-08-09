import { Scene } from '@babylonjs/core/scene';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { IslandTerrain } from './IslandTerrain';

/**
 * MountainRange — Stylized Low-Poly Mesas, Buttes & Canyon Rock Pillars.
 *
 * Replaces generic snow cones with flat-topped canyon mesas and stepped bluffs
 * that perfectly complement the desert canyon terrain.
 */
export class MountainRange {
  /**
   * Landmark definitions: [cx, cz, height, baseRadius, topRadiusRatio, sides]
   */
  private static readonly FORMATIONS: Array<[number, number, number, number, number, number]> = [
    // ── Distant Northwest Canyon Pillars & Towering Mesas ─────────────────────
    [-2200,  2600, 160, 600, 0.70, 7],
    [-2900,  1900, 140, 520, 0.65, 8],
    [-1500,  3300, 130, 480, 0.72, 6],
    [-3400,  2800, 120, 440, 0.68, 7],

    // ── East & Northeast Plateau Buttes ───────────────────────────────────────
    [ 2600,   800, 110, 480, 0.75, 7],
    [ 1800,  2800, 130, 520, 0.70, 8],
    [ 3200,  2200, 140, 560, 0.68, 6],

    // ── Southwest Canyon Pillars ──────────────────────────────────────────────
    [-2600, -2100, 110, 460, 0.72, 7],
    [-1900, -3100, 100, 420, 0.75, 8],
  ];

  initialize(scene: Scene): void {
    // Canyon Cliff Sandstone Material (Flat-Shaded Matte)
    const cliffMat = new StandardMaterial('canyonCliffMat', scene);
    cliffMat.diffuseColor  = new Color3(0.62, 0.54, 0.20);
    cliffMat.specularColor = new Color3(0.04, 0.04, 0.02);
    cliffMat.specularPower = 4;

    for (let i = 0; i < MountainRange.FORMATIONS.length; i++) {
      const [cx, cz, height, baseRadius, topRatio, sides] = MountainRange.FORMATIONS[i];
      const groundY = IslandTerrain.getHeightAt(cx, cz);

      // Main Mesa Body — Tapered faceted prism with flat top
      const topRadius = baseRadius * topRatio;
      const mesaMesh = MeshBuilder.CreateCylinder(`canyon_mesa_${i}`, {
        height,
        diameterTop:    topRadius * 2,
        diameterBottom: baseRadius * 2,
        tessellation:   sides,
      }, scene);

      mesaMesh.position = new Vector3(cx, groundY + height * 0.48, cz);
      mesaMesh.material = cliffMat;
      mesaMesh.convertToFlatShadedMesh();
      mesaMesh.freezeWorldMatrix();
    }

    console.log(`[MountainRange] Created ${MountainRange.FORMATIONS.length} low-poly canyon mesas.`);
  }
}
