import { Scene } from '@babylonjs/core/scene';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';

// ─── Mathematical Height & Mesa Helpers ───────────────────────────────────────

/** Pseudo-random deterministic hash for vertex coordinate jitter & variation */
function hash2d(x: number, z: number): number {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Flat-topped Mesa / Plateau equation.
 * Creates steep polygonal cliffs with a perfectly flat top tableland.
 */
function mesa(
  x: number, z: number,
  cx: number, cz: number,
  radius: number, height: number,
  steepness = 3.8,
): number {
  const dx = x - cx;
  const dz = z - cz;
  const dist = Math.sqrt(dx * dx + dz * dz);
  const nd = dist / radius;
  if (nd >= 1.25) return 0;

  // Smoothstep plateau profile — flat at the top, steep drop-off at edge
  const t = Math.max(0, Math.min(1, (1.12 - nd) * steepness));
  const s = t * t * (3 - 2 * t);
  return height * s;
}

/** Gaussian hill helper */
function gauss(
  x: number, z: number,
  cx: number, cz: number,
  sigma: number,
): number {
  const dx = x - cx;
  const dz = z - cz;
  return Math.exp(-(dx * dx + dz * dz) / (2 * sigma * sigma));
}

// ─── IslandTerrain ────────────────────────────────────────────────────────────

/**
 * IslandTerrain — Low-poly stylized desert canyon & mesa landscape.
 *
 * Recreates the aesthetic of the reference image:
 *   • Crisp, flat-shaded triangular facets
 *   • Prominent flat-topped mesas and stepped bluffs
 *   • Golden-chartreuse / desert olive-lime plains and plateau tops
 *   • Sandstone ochre cliff faces
 *   • Level airport basin at origin for smooth runway operations
 */
export class IslandTerrain {
  private static readonly SIZE         = 14000; // 14 km
  private static readonly SUBDIVISIONS = 120;   // 121×121 grid for bold low-poly facets

  /**
   * Evaluates the terrain height at world position (x, z).
   * Accurate for physics collision, radar, and camera clearances.
   */
  static getHeightAt(x: number, z: number): number {
    const r = Math.sqrt(x * x + z * z);
    const fade = Math.max(0, 1 - Math.pow(r / 6000, 2.2));
    if (fade <= 0.001) return -1;

    // ── 1. Base rolling desert floor ──────────────────────────────────────────
    let h = 4 + 3.5 * Math.sin(x * 0.0012) * Math.cos(z * 0.0014)
              + 2.0 * Math.sin(x * 0.0028 + z * 0.0022);

    // ── 2. Prominent Scenic Mesas (Visible around Airport / Flight Area) ──────
    // Front-right mesa (prominent flat-topped mesa as in reference image)
    h += mesa(x, z,  850,   650, 480, 95, 4.0);
    // Midground-left mesa (trapezoidal bluff)
    h += mesa(x, z, -950,   500, 420, 85, 3.8);
    // South-west bluff
    h += mesa(x, z, -750,  -650, 360, 65, 3.6);
    // South-east mesa
    h += mesa(x, z,  900,  -700, 400, 75, 3.8);

    // ── 3. Major Canyon Formations & Highland Plateaus ───────────────────────
    // Northwest mountain canyon massif
    h += mesa(x, z, -2200,  2600, 1100, 280, 3.0);
    h += mesa(x, z, -2900,  1900,  950, 240, 3.2);
    h += mesa(x, z, -1500,  3300,  800, 210, 3.5);
    h += 120 * gauss(x, z, -2400,  2700, 700);

    // Northeast canyon ridges
    h += mesa(x, z,  1800,  2800,  900, 220, 3.2);
    h += mesa(x, z,  2900,  2100, 1000, 250, 3.0);

    // East plateau cluster
    h += mesa(x, z,  2600,   800,  850, 175, 3.4);
    h += mesa(x, z,  3400,  -400,  950, 190, 3.2);

    // Southwest canyon buttes
    h += mesa(x, z, -2600, -2100,  900, 160, 3.4);
    h += mesa(x, z, -1900, -3100,  800, 150, 3.5);

    // ── 4. Apply Island Edge Falloff ──────────────────────────────────────────
    h *= fade;

    // ── 5. Flatten Airport Valley Basin (Centered at 0, 0) ────────────────────
    // Guarantees perfectly level runway and taxiways at ~2.0 m elevation
    const airportDist = Math.sqrt(x * x + z * z);
    const airportFlatten = Math.max(0, 1 - airportDist / 850);
    if (airportFlatten > 0) {
      const flatCurve = airportFlatten * airportFlatten * (3 - 2 * airportFlatten);
      h = h * (1 - flatCurve) + 2.0 * flatCurve;
    }

    return Math.max(-0.5, h);
  }

  // ─── Initialization ───────────────────────────────────────────────────────

  initialize(scene: Scene): void {
    const mesh = MeshBuilder.CreateGround('island', {
      width:        IslandTerrain.SIZE,
      height:       IslandTerrain.SIZE,
      subdivisions: IslandTerrain.SUBDIVISIONS,
      updatable:    true,
    }, scene);

    const positions = mesh.getVerticesData('position');
    if (!positions) return;

    // 1. Displace vertices based on terrain height function + organic jitter
    for (let i = 0; i < positions.length; i += 3) {
      let vx = positions[i];
      let vz = positions[i + 2];

      const distOrigin = Math.sqrt(vx * vx + vz * vz);
      // Add subtle organic vertex coordinate perturbation outside the airport
      if (distOrigin > 600) {
        const jitterX = (hash2d(vx, vz) - 0.5) * 35;
        const jitterZ = (hash2d(vz, vx) - 0.5) * 35;
        vx += jitterX;
        vz += jitterZ;
        positions[i]     = vx;
        positions[i + 2] = vz;
      }

      positions[i + 1] = IslandTerrain.getHeightAt(vx, vz);
    }

    mesh.setVerticesData('position', positions, false);
    // 2. Compute smooth normals for the new displaced positions
    const indices = mesh.getIndices();
    const normals = new Float32Array(positions.length);
    
    // We must use dynamic import since we didn't import VertexData globally
    import('@babylonjs/core/Meshes/mesh.vertexData').then(({ VertexData }) => {
      if (indices) {
        VertexData.ComputeNormals(positions, indices, normals);
        mesh.setVerticesData('normal', normals, false);
      }
      
      // 3. Compute Per-Vertex Colors for smooth blending
      const vertCount = positions.length / 3;
      const colors = new Float32Array(vertCount * 4);

      for (let v = 0; v < vertCount; v++) {
        const i0 = v * 3;

        // Normal of the vertex (fallback to up if undefined)
        const ny = indices ? normals[i0 + 1] : 1.0;

        const posX = positions[i0];
        const posY = positions[i0 + 1];
        const posZ = positions[i0 + 2];

        // Slope factor: 1 = perfectly horizontal, 0 = vertical cliff
        const slope = Math.max(0, Math.min(1, ny));
        const noise = (hash2d(posX * 0.01, posZ * 0.01) - 0.5) * 0.08;

        let cr: number, cg: number, cb: number;

        if (slope > 0.78) {
          cr = 0.74 + noise + (posY > 60 ? 0.05 : 0.0);
          cg = 0.79 + noise * 0.8;
          cb = 0.22 + noise * 0.4;
        } else if (slope > 0.50) {
          const t = (slope - 0.50) / 0.28;
          const cliffR = 0.64 + noise;
          const cliffG = 0.56 + noise * 0.8;
          const cliffB = 0.20 + noise * 0.3;

          const topR = 0.74 + noise;
          const topG = 0.79 + noise * 0.8;
          const topB = 0.22 + noise * 0.4;

          cr = cliffR + t * (topR - cliffR);
          cg = cliffG + t * (topG - cliffG);
          cb = cliffB + t * (topB - cliffB);
        } else {
          cr = 0.60 + noise;
          cg = 0.52 + noise * 0.8;
          cb = 0.18 + noise * 0.3;
        }

        const cIdx = v * 4;
        colors[cIdx]     = Math.max(0.1, Math.min(1.0, cr));
        colors[cIdx + 1] = Math.max(0.1, Math.min(1.0, cg));
        colors[cIdx + 2] = Math.max(0.05, Math.min(1.0, cb));
        colors[cIdx + 3] = 1.0;
      }

      mesh.setVerticesData(VertexBuffer.ColorKind, colors, false);
    });
    // 4. Terrain Material (StandardMaterial with vertex color passthrough)
    const mat = new StandardMaterial('terrainMat', scene);
    mat.diffuseColor  = new Color3(1, 1, 1); // lets vertex colors shine brightly
    mat.specularColor = new Color3(0.04, 0.04, 0.02); // subtle matte finish
    mat.specularPower = 4;
    mat.ambientColor  = new Color3(0.2, 0.2, 0.15);
    mesh.material = mat;

    mesh.refreshBoundingInfo();
    mesh.freezeWorldMatrix();

    console.log(
      `[IslandTerrain] Created ${IslandTerrain.SIZE / 1000} km low-poly mesa & canyon terrain, flat-shaded.`,
    );
  }
}
