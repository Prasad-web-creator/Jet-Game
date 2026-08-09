import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { GroundDefenseSite } from './GroundDefenseSite';
import { IslandTerrain } from '../world/terrain/IslandTerrain';
import { globalEventBus } from '../core/EventBus';

export class RadarStation extends GroundDefenseSite {
  readonly detectionRadius: number;
  private isPlayerDetected = false;

  private dishMesh: Mesh;
  private rotSpeed = 2.0;

  // PERF: LOS throttle — only recalculate LOS every N frames when player is far
  private _losFrameSkip = 0;
  private static readonly LOS_SKIP_FRAMES_FAR = 6; // ~10 Hz at 60 fps

  constructor(
    id: string,
    name: string,
    scene: Scene,
    position: Vector3,
    detectionRadius = 2600
  ) {
    // 3D Mesh Construction: Base + Tower + Dish
    const root = new Mesh(`radar_root_${id}`, scene);

    // Building Base
    const baseMat = new StandardMaterial(`radar_base_mat_${id}`, scene);
    baseMat.diffuseColor = new Color3(0.25, 0.28, 0.32);
    baseMat.emissiveColor = new Color3(0.05, 0.05, 0.08);

    const baseBunker = MeshBuilder.CreateBox(`radar_bunker_${id}`, { width: 14, height: 6, depth: 14 }, scene);
    baseBunker.position.y = 3;
    baseBunker.material = baseMat;
    baseBunker.parent = root;

    // Support Lattice Tower
    const towerMat = new StandardMaterial(`radar_tower_mat_${id}`, scene);
    towerMat.diffuseColor = new Color3(0.4, 0.45, 0.5);

    const tower = MeshBuilder.CreateCylinder(`radar_tower_${id}`, { height: 18, diameterTop: 3, diameterBottom: 6 }, scene);
    tower.position.y = 15;
    tower.material = towerMat;
    tower.parent = root;

    // Dish Mount & Dish
    const dishMat = new StandardMaterial(`radar_dish_mat_${id}`, scene);
    dishMat.diffuseColor = new Color3(0.8, 0.8, 0.85);
    dishMat.emissiveColor = new Color3(0.1, 0.15, 0.2);

    const dish = MeshBuilder.CreateCylinder(`radar_dish_${id}`, { height: 1.2, diameterTop: 10, diameterBottom: 1 }, scene);
    dish.rotation.x = Math.PI / 3; // Tilt dish upwards
    dish.position.y = 25;
    dish.material = dishMat;
    dish.parent = root;

    // Scale the entire radar station 4x — aircraft size or bigger
    root.scaling.setAll(4.0);

    super(id, name, scene, position, root, 120 /* HP */, 60 /* radius */, new Vector3(0, 48, 0));

    this.detectionRadius = detectionRadius;
    this.dishMesh = dish;
  }

  update(dt: number, playerPos: Vector3): void {
    if (this.isDestroyed) {
      if (this.isPlayerDetected) {
        this.isPlayerDetected = false;
        globalEventBus.emit('RADAR_DETECTION_CHANGED', { detected: false, radarId: this.id });
      }
      return;
    }

    // 1. Rotate Radar Dish (always, for visual)
    this.dishMesh.rotation.y += this.rotSpeed * dt;

    // 2. Distance to player
    const dist = Vector3.Distance(this.position, playerPos);

    // 3. PERF: Skip LOS calculation when player is far away (> 1.5x range)
    //    Only recalculate every LOS_SKIP_FRAMES_FAR frames when distant.
    //    At engagement range (< 1.0x), always recalculate for accuracy.
    const isFar = dist > this.detectionRadius * 1.5;
    if (isFar) {
      this._losFrameSkip++;
      if (this._losFrameSkip < RadarStation.LOS_SKIP_FRAMES_FAR) {
        return; // Skip this frame
      }
      this._losFrameSkip = 0;
    } else {
      this._losFrameSkip = 0;
    }

    let detected = false;
    if (dist <= this.detectionRadius) {
      detected = this.checkLineOfSight(playerPos);
    }

    // 4. Update detection state (emit only on change)
    if (detected !== this.isPlayerDetected) {
      this.isPlayerDetected = detected;
      console.log(`[Radar ${this.name}] Detection: ${detected ? 'DETECTED 🚨' : 'CLEAR 🟢'}`);
      globalEventBus.emit('RADAR_DETECTION_CHANGED', { detected, radarId: this.id });
    }
  }

  getIsPlayerDetected(): boolean {
    return this.isPlayerDetected && !this.isDestroyed;
  }

  /** Checks whether terrain blocks line-of-sight between radar and player */
  private checkLineOfSight(playerPos: Vector3): boolean {
    const samples = 8;
    for (let i = 1; i < samples; i++) {
      const t = i / samples;
      const sampleX = this.position.x + (playerPos.x - this.position.x) * t;
      const sampleZ = this.position.z + (playerPos.z - this.position.z) * t;
      const rayY = this.position.y + 25 + (playerPos.y - (this.position.y + 25)) * t;

      const terrainH = IslandTerrain.getHeightAt(sampleX, sampleZ);
      if (terrainH > rayY + 2.0) {
        // Mountain terrain blocks radar line-of-sight!
        return false;
      }
    }
    return true;
  }

  protected override onDestroyed(): void {
    super.onDestroyed();
    if (this.isPlayerDetected) {
      this.isPlayerDetected = false;
      globalEventBus.emit('RADAR_DETECTION_CHANGED', { detected: false, radarId: this.id });
    }
  }
}
