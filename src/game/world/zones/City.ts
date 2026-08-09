import { Scene } from '@babylonjs/core/scene';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { IslandTerrain } from '../terrain/IslandTerrain';

/**
 * City — civilian area in the eastern part of the island.
 *
 * Centred at (3000, ground, 1000).
 * Uses Babylon.js instancing for efficient rendering of many buildings.
 *
 * Three building tiers (one source mesh per tier, all instances):
 *   Tier 1 — Residential : height  20 – 40 m, 50 instances
 *   Tier 2 — Commercial  : height  50 – 90 m, 40 instances
 *   Tier 3 — Skyscrapers : height 100 – 150 m, 20 instances
 *
 * Roads are flat dark-grey box strips between building blocks.
 * All meshes are frozen after placement.
 */
export class City {
  static readonly CX = 3000;
  static readonly CZ = 1000;

  /** Cell size in the city grid (m) */
  private static readonly CELL = 110;

  initialize(scene: Scene): void {
    const gy = IslandTerrain.getHeightAt(City.CX, City.CZ);

    this.createBuildings(scene, gy);
    this.createRoads(scene, gy);
    this.createDocks(scene, gy);

    console.log('[City] Created at (3000, -, 1000).');
  }

  // ─── Builders ─────────────────────────────────────────────────────────────

  private createBuildings(scene: Scene, gy: number): void {
    // ── Materials ──────────────────────────────────────────────────────────
    const residentialMat = new StandardMaterial('residentialMat', scene);
    residentialMat.diffuseColor  = new Color3(0.72, 0.68, 0.60);
    residentialMat.specularColor = new Color3(0.10, 0.10, 0.10);

    const commercialMat = new StandardMaterial('commercialMat', scene);
    commercialMat.diffuseColor  = new Color3(0.58, 0.62, 0.70);
    commercialMat.specularColor = new Color3(0.30, 0.32, 0.35);
    commercialMat.specularPower = 32;

    const skyscraperMat = new StandardMaterial('skyscraperMat', scene);
    skyscraperMat.diffuseColor  = new Color3(0.40, 0.55, 0.78);
    skyscraperMat.specularColor = new Color3(0.60, 0.70, 0.90);
    skyscraperMat.specularPower = 128;

    // ── Source meshes (unit-sized — instances are scaled) ──────────────────
    const srcRes = MeshBuilder.CreateBox('srcRes', { size: 1 }, scene);
    srcRes.material = residentialMat;
    srcRes.isVisible = false;

    const srcCom = MeshBuilder.CreateBox('srcCom', { size: 1 }, scene);
    srcCom.material = commercialMat;
    srcCom.isVisible = false;

    const srcSky = MeshBuilder.CreateBox('srcSky', { size: 1 }, scene);
    srcSky.material = skyscraperMat;
    srcSky.isVisible = false;

    // ── Grid placement ──────────────────────────────────────────────────────
    const cx = City.CX;
    const cz = City.CZ;
    const cell = City.CELL;
    const half = 5; // grid is 11 × 11 (but we skip centre roads)

    let resIdx = 0, comIdx = 0, skyIdx = 0;

    for (let row = -half; row <= half; row++) {
      for (let col = -half; col <= half; col++) {
        // Roads run on every 4th row/col — skip building placement there
        if (row % 4 === 0 || col % 4 === 0) continue;

        const px = cx + col * cell + (Math.random() - 0.5) * 20;
        const pz = cz + row * cell + (Math.random() - 0.5) * 20;
        const bw = 35 + Math.random() * 45;
        const bd = 35 + Math.random() * 45;

        // Tier selection by distance from city centre
        const dist = Math.sqrt((px - cx) ** 2 + (pz - cz) ** 2);

        if (dist < 350) {
          // Skyscraper core
          const h = 100 + Math.random() * 50;
          const inst = (srcSky as Mesh).createInstance(`sky_${skyIdx++}`);
          inst.scaling  = new Vector3(bw, h, bd);
          inst.position = new Vector3(px, gy + h / 2, pz);
          inst.freezeWorldMatrix();
        } else if (dist < 750) {
          // Commercial ring
          const h = 50 + Math.random() * 40;
          const inst = (srcCom as Mesh).createInstance(`com_${comIdx++}`);
          inst.scaling  = new Vector3(bw, h, bd);
          inst.position = new Vector3(px, gy + h / 2, pz);
          inst.freezeWorldMatrix();
        } else {
          // Residential outskirts
          const h = 20 + Math.random() * 20;
          const inst = (srcRes as Mesh).createInstance(`res_${resIdx++}`);
          inst.scaling  = new Vector3(bw, h, bd);
          inst.position = new Vector3(px, gy + h / 2, pz);
          inst.freezeWorldMatrix();
        }
      }
    }
  }

  private createRoads(scene: Scene, gy: number): void {
    const roadMat = new StandardMaterial('roadMat', scene);
    roadMat.diffuseColor = new Color3(0.20, 0.20, 0.19);

    const cx = City.CX;
    const cz = City.CZ;
    const cell = City.CELL;
    const half = 5;

    // Horizontal roads (every 4th row)
    for (let row = -half; row <= half; row += 4) {
      const road = MeshBuilder.CreateBox(`roadH_${row}`, {
        width: cell * (half * 2 + 1) + cell, height: 0.3, depth: 14,
      }, scene);
      road.position = new Vector3(cx, gy + 0.15, cz + row * cell);
      road.material = roadMat;
      road.freezeWorldMatrix();
    }

    // Vertical roads (every 4th col)
    for (let col = -half; col <= half; col += 4) {
      const road = MeshBuilder.CreateBox(`roadV_${col}`, {
        width: 14, height: 0.3, depth: cell * (half * 2 + 1) + cell,
      }, scene);
      road.position = new Vector3(cx + col * cell, gy + 0.15, cz);
      road.material = roadMat;
      road.freezeWorldMatrix();
    }
  }

  private createDocks(scene: Scene, gy: number): void {
    // Docks — a short jetty east of the city, at sea level
    const dockMat = new StandardMaterial('dockMat', scene);
    dockMat.diffuseColor = new Color3(0.45, 0.35, 0.22);

    const piers: Array<[number, number, number, number]> = [
      [City.CX + 900, City.CZ + 200, 200, 16],
      [City.CX + 900, City.CZ,       220, 16],
      [City.CX + 900, City.CZ - 200, 180, 16],
    ];

    for (let i = 0; i < piers.length; i++) {
      const [px, pz, len, w] = piers[i];
      const pier = MeshBuilder.CreateBox(`pier_${i}`, {
        width: len, height: 3, depth: w,
      }, scene);
      pier.position = new Vector3(px, gy + 1.5, pz);
      pier.material = dockMat;
      pier.freezeWorldMatrix();
    }

    // Dock warehouse
    const whMat = new StandardMaterial('whtMat', scene);
    whMat.diffuseColor = new Color3(0.60, 0.55, 0.42);
    const wh = MeshBuilder.CreateBox('dockWarehouse', {
      width: 80, height: 20, depth: 60,
    }, scene);
    wh.position = new Vector3(City.CX + 760, gy + 10, City.CZ);
    wh.material = whMat;
    wh.freezeWorldMatrix();
  }
}
