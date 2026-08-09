import { Scene } from '@babylonjs/core/scene';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import '@babylonjs/core/Meshes/instancedMesh';
import { IslandTerrain } from '../terrain/IslandTerrain';

/**
 * Airport — central starting zone of the game world.
 *
 * Layout (all centred around X=0, Z=0):
 *   • Main runway: 2 000 m × 40 m (N–S)
 *   • Cross runway: 1 200 m × 30 m (E–W)
 *   • Taxiways connecting runways to apron
 *   • Apron (paved standing area)
 *   • 4 hangars (wide low boxes)
 *   • Control tower (tall narrow box + observation deck)
 *   • Runway centreline markings (instanced white strips)
 *
 * All meshes are frozen after placement — no per-frame updates needed.
 */
export class Airport {
  /** World-space coordinates of the airport reference point */
  static readonly CX = 0;
  static readonly CZ = 0;

  initialize(scene: Scene): void {
    const groundY = IslandTerrain.getHeightAt(Airport.CX, Airport.CZ);

    this.createRunways(scene, groundY);
    this.createTaxiways(scene, groundY);
    this.createApron(scene, groundY);
    this.createHangars(scene, groundY);
    this.createControlTower(scene, groundY);
    this.createRunwayMarkings(scene, groundY);

    console.log('[Airport] Created at origin.');
  }

  // ─── Builders ─────────────────────────────────────────────────────────────

  private createRunways(scene: Scene, gy: number): void {
    const runwayMat = this.runwayMat(scene);

    // Main runway: North–South, 2 km long
    const rMain = MeshBuilder.CreateBox('runwayMain', {
      width: 42, height: 0.4, depth: 2000,
    }, scene);
    rMain.position = new Vector3(Airport.CX, gy + 0.2, Airport.CZ);
    rMain.material = runwayMat;
    rMain.freezeWorldMatrix();

    // Cross runway: East–West, 1.2 km long
    const rCross = MeshBuilder.CreateBox('runwayCross', {
      width: 1200, height: 0.4, depth: 32,
    }, scene);
    rCross.position = new Vector3(Airport.CX, gy + 0.2, Airport.CZ + 200);
    rCross.material = runwayMat;
    rCross.freezeWorldMatrix();
  }

  private createTaxiways(scene: Scene, gy: number): void {
    const taxiMat = new StandardMaterial('taxiMat', scene);
    taxiMat.diffuseColor = new Color3(0.28, 0.28, 0.26);

    const taxiways: Array<[number, number, number, number]> = [
      // [posX, posZ, width, depth]
      [Airport.CX + 70,   Airport.CZ - 200, 14, 400],   // east taxiway
      [Airport.CX - 70,   Airport.CZ - 200, 14, 400],   // west taxiway
      [Airport.CX + 200,  Airport.CZ - 400, 350, 14],   // connector E
      [Airport.CX - 200,  Airport.CZ - 400, 350, 14],   // connector W
    ];

    for (let i = 0; i < taxiways.length; i++) {
      const [px, pz, w, d] = taxiways[i];
      const box = MeshBuilder.CreateBox(`taxi_${i}`, {
        width: w, height: 0.35, depth: d,
      }, scene);
      box.position = new Vector3(px, gy + 0.18, pz);
      box.material = taxiMat;
      box.freezeWorldMatrix();
    }
  }

  private createApron(scene: Scene, gy: number): void {
    const apronMat = new StandardMaterial('apronMat', scene);
    apronMat.diffuseColor = new Color3(0.32, 0.32, 0.30);

    const apron = MeshBuilder.CreateBox('apron', {
      width: 400, height: 0.3, depth: 280,
    }, scene);
    apron.position = new Vector3(Airport.CX, gy + 0.15, Airport.CZ - 600);
    apron.material = apronMat;
    apron.freezeWorldMatrix();
  }

  private createHangars(scene: Scene, gy: number): void {
    const hangarMat = new StandardMaterial('hangarMat', scene);
    hangarMat.diffuseColor  = new Color3(0.60, 0.62, 0.65);
    hangarMat.specularColor = new Color3(0.20, 0.20, 0.20);

    const offsets = [-160, -60, 60, 160];
    for (let i = 0; i < offsets.length; i++) {
      const hgr = MeshBuilder.CreateBox(`hangar_${i}`, {
        width: 80, height: 24, depth: 60,
      }, scene);
      hgr.position = new Vector3(Airport.CX + offsets[i], gy + 12, Airport.CZ - 680);
      hgr.material = hangarMat;
      hgr.freezeWorldMatrix();
    }
  }

  private createControlTower(scene: Scene, gy: number): void {
    const towerMat = new StandardMaterial('towerMat', scene);
    towerMat.diffuseColor  = new Color3(0.88, 0.88, 0.86);
    towerMat.specularColor = new Color3(0.30, 0.30, 0.30);

    const glassMat = new StandardMaterial('glassMat', scene);
    glassMat.diffuseColor  = new Color3(0.40, 0.68, 0.90);
    glassMat.specularColor = new Color3(0.80, 0.88, 1.00);
    glassMat.specularPower = 128;
    glassMat.alpha = 0.80;

    const tx = Airport.CX + 180;
    const tz = Airport.CZ - 620;

    // Shaft
    const shaft = MeshBuilder.CreateBox('towerShaft', {
      width: 14, height: 60, depth: 14,
    }, scene);
    shaft.position = new Vector3(tx, gy + 30, tz);
    shaft.material = towerMat;
    shaft.freezeWorldMatrix();

    // Observation deck
    const deck = MeshBuilder.CreateBox('towerDeck', {
      width: 26, height: 10, depth: 26,
    }, scene);
    deck.position = new Vector3(tx, gy + 65, tz);
    deck.material = glassMat;
    deck.freezeWorldMatrix();
  }

  private createRunwayMarkings(scene: Scene, gy: number): void {
    // White centreline dashes — instanced for performance
    const srcMark = MeshBuilder.CreateBox('markSrc', {
      width: 1.8, height: 0.05, depth: 30,
    }, scene);

    const markMat = new StandardMaterial('markMat', scene);
    markMat.diffuseColor  = new Color3(0.95, 0.95, 0.92);
    markMat.emissiveColor = new Color3(0.10, 0.10, 0.10);
    srcMark.material = markMat;
    srcMark.isVisible = false; // hide the source

    const step = 60; // gap between dashes
    const count = 30;
    const startZ = Airport.CZ - 900;

    for (let i = 0; i < count; i++) {
      const inst = (srcMark as Mesh).createInstance(`mark_${i}`);
      inst.position = new Vector3(Airport.CX, gy + 0.45, startZ + i * step);
      inst.freezeWorldMatrix();
    }
  }

  // ─── Shared materials ──────────────────────────────────────────────────────

  private runwayMat(scene: Scene): StandardMaterial {
    const mat = new StandardMaterial('runwayMat', scene);
    mat.diffuseColor  = new Color3(0.22, 0.22, 0.20);
    mat.specularColor = new Color3(0.10, 0.10, 0.10);
    return mat;
  }
}
