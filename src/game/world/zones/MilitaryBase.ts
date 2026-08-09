import { Scene } from '@babylonjs/core/scene';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { GameSystem } from '../../core/GameLoop';
import type { GameState } from '../../../types';
import { IslandTerrain } from '../terrain/IslandTerrain';

/**
 * MilitaryBase — hostile enemy zone in the SW quadrant.
 *
 * Layout centred at (-3000, ground, -2500):
 *   • Perimeter concrete wall (4 sides)
 *   • 8 barracks buildings
 *   • Command centre (taller, distinct shape)
 *   • Radar station: rotating dish on a pedestal
 *   • 4 AA gun positions (cylinder + angled barrel)
 *   • Helipad
 *
 * Implements GameSystem for the rotating radar dish.
 */
export class MilitaryBase implements GameSystem {
  readonly name = 'MilitaryBase';

  static readonly CX = -3000;
  static readonly CZ = -2500;

  private radarDish: Mesh | null = null;
  private readonly radarSpeed = 0.6; // rad/s

  initialize(scene: Scene): void {
    const gy = IslandTerrain.getHeightAt(MilitaryBase.CX, MilitaryBase.CZ);

    this.createPerimeter(scene, gy);
    this.createBarracks(scene, gy);
    this.createCommandCentre(scene, gy);
    this.createRadarStation(scene, gy);
    this.createAAPositions(scene, gy);
    this.createHelipad(scene, gy);

    console.log('[MilitaryBase] Created at (-3000, -, -2500).');
  }

  // ─── GameSystem ───────────────────────────────────────────────────────────

  update(deltaTime: number, _state: GameState): void {
    if (this.radarDish) {
      this.radarDish.rotation.y += this.radarSpeed * deltaTime;
    }
  }

  dispose(): void {
    this.radarDish = null;
  }

  // ─── Builders ─────────────────────────────────────────────────────────────

  private createPerimeter(scene: Scene, gy: number): void {
    const wallMat = new StandardMaterial('baseWallMat', scene);
    wallMat.diffuseColor = new Color3(0.50, 0.48, 0.38);

    const bx = MilitaryBase.CX;
    const bz = MilitaryBase.CZ;
    const span = 700;
    const wh   = 9;  // wall height

    const walls: Array<[number, number, number, number]> = [
      [bx,           bz + span / 2, span + 8, 5],  // north
      [bx,           bz - span / 2, span + 8, 5],  // south
      [bx - span / 2, bz,           5, span],       // west
      [bx + span / 2, bz,           5, span],       // east
    ];

    for (let i = 0; i < walls.length; i++) {
      const [px, pz, w, d] = walls[i];
      const wall = MeshBuilder.CreateBox(`baseWall_${i}`, {
        width: w, height: wh, depth: d,
      }, scene);
      wall.position = new Vector3(px, gy + wh / 2, pz);
      wall.material = wallMat;
      wall.freezeWorldMatrix();
    }
  }

  private createBarracks(scene: Scene, gy: number): void {
    const mat = new StandardMaterial('barracksMat', scene);
    mat.diffuseColor = new Color3(0.30, 0.38, 0.24);

    const bx = MilitaryBase.CX;
    const bz = MilitaryBase.CZ;

    // 8 barracks in two rows of 4
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 4; col++) {
        const px = bx - 240 + col * 120;
        const pz = bz + (row === 0 ? 160 : -50);
        const h  = 12;
        const bk = MeshBuilder.CreateBox(`barracks_${row}_${col}`, {
          width: 80, height: h, depth: 40,
        }, scene);
        bk.position = new Vector3(px, gy + h / 2, pz);
        bk.material = mat;
        bk.freezeWorldMatrix();
      }
    }
  }

  private createCommandCentre(scene: Scene, gy: number): void {
    const mat = new StandardMaterial('cmdMat', scene);
    mat.diffuseColor = new Color3(0.22, 0.30, 0.18);

    const bx = MilitaryBase.CX;
    const bz = MilitaryBase.CZ;

    const cmd = MeshBuilder.CreateBox('commandCentre', {
      width: 90, height: 22, depth: 70,
    }, scene);
    cmd.position = new Vector3(bx, gy + 11, bz - 180);
    cmd.material = mat;
    cmd.freezeWorldMatrix();

    // Antenna mast
    const mast = MeshBuilder.CreateCylinder('cmdMast', {
      height: 30, diameter: 2, tessellation: 6,
    }, scene);
    mast.position = new Vector3(bx, gy + 22 + 15, bz - 180);
    mast.material = mat;
    mast.freezeWorldMatrix();
  }

  private createRadarStation(scene: Scene, gy: number): void {
    const bx = MilitaryBase.CX;
    const bz = MilitaryBase.CZ;

    const metalMat = new StandardMaterial('radarMat', scene);
    metalMat.diffuseColor  = new Color3(0.60, 0.62, 0.65);
    metalMat.specularColor = new Color3(0.40, 0.42, 0.45);
    metalMat.specularPower = 64;

    // Pedestal
    const pedestal = MeshBuilder.CreateCylinder('radarPedestal', {
      height: 20, diameter: 12, tessellation: 8,
    }, scene);
    pedestal.position = new Vector3(bx + 260, gy + 10, bz + 220);
    pedestal.material = metalMat;
    pedestal.freezeWorldMatrix();

    // Dish — this rotates, so NO freezeWorldMatrix
    const dish = MeshBuilder.CreateCylinder('radarDish', {
      height: 2, diameterTop: 30, diameterBottom: 4, tessellation: 12,
    }, scene);
    dish.position = new Vector3(bx + 260, gy + 22, bz + 220);
    dish.rotation.z = Math.PI * 0.15; // tilt slightly
    dish.material = metalMat;
    this.radarDish = dish; // store for update() rotation
  }

  private createAAPositions(scene: Scene, gy: number): void {
    const mat = new StandardMaterial('aaMat', scene);
    mat.diffuseColor  = new Color3(0.25, 0.32, 0.18);

    const bx = MilitaryBase.CX;
    const bz = MilitaryBase.CZ;

    const positions: Array<[number, number]> = [
      [bx - 280, bz + 280],
      [bx + 280, bz + 280],
      [bx - 280, bz - 280],
      [bx + 280, bz - 280],
    ];

    for (let i = 0; i < positions.length; i++) {
      const [px, pz] = positions[i];

      // Base turret
      const base = MeshBuilder.CreateCylinder(`aaBase_${i}`, {
        height: 6, diameter: 16, tessellation: 8,
      }, scene);
      base.position = new Vector3(px, gy + 3, pz);
      base.material = mat;
      base.freezeWorldMatrix();

      // Gun barrel
      const barrel = MeshBuilder.CreateCylinder(`aaBarrel_${i}`, {
        height: 18, diameter: 2, tessellation: 6,
      }, scene);
      barrel.rotation.z = -Math.PI * 0.25; // angled upward
      barrel.position = new Vector3(px + 4, gy + 10, pz);
      barrel.material = mat;
      barrel.freezeWorldMatrix();
    }
  }

  private createHelipad(scene: Scene, gy: number): void {
    const padMat = new StandardMaterial('helipadMat', scene);
    padMat.diffuseColor  = new Color3(0.25, 0.25, 0.22);
    padMat.emissiveColor = new Color3(0.04, 0.04, 0.04);

    const bx = MilitaryBase.CX;
    const bz = MilitaryBase.CZ;

    const pad = MeshBuilder.CreateDisc('helipad', {
      radius: 25, tessellation: 16,
    }, scene);
    pad.rotation.x = Math.PI / 2; // lay flat
    pad.position = new Vector3(bx + 240, gy + 0.3, bz - 220);
    pad.material = padMat;
    pad.freezeWorldMatrix();
  }
}
