import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TargetEntity } from '../targets/TargetManager';
import { TargetType } from '../../types';

export abstract class GroundDefenseSite {
  readonly id: string;
  readonly name: string;
  readonly targetEntity: TargetEntity;
  
  protected scene: Scene;
  protected rootMesh: Mesh;
  protected position: Vector3;
  protected isActivated = false;

  constructor(
    id: string,
    name: string,
    scene: Scene,
    position: Vector3,
    rootMesh: Mesh,
    maxHealth: number,
    radius: number,
    centerOffset: Vector3 = Vector3.Zero()
  ) {
    this.id = id;
    this.name = name;
    this.scene = scene;
    this.position = position.clone();
    this.rootMesh = rootMesh;
    this.rootMesh.position.copyFrom(this.position);

    this.targetEntity = new TargetEntity(
      id,
      name,
      TargetType.Structure,
      rootMesh,
      maxHealth,
      radius,
      () => this.onDestroyed(),
      centerOffset
    );
  }

  get isDestroyed(): boolean {
    return this.targetEntity.isDestroyed;
  }

  get health(): number {
    return this.targetEntity.health;
  }

  getPosition(): Vector3 {
    return this.position;
  }

  setActivated(active: boolean): void {
    if (this.isDestroyed) return;
    this.isActivated = active;
  }

  getIsActivated(): boolean {
    return this.isActivated && !this.isDestroyed;
  }

  protected onDestroyed(): void {
    this.isActivated = false;
    console.log(`[GroundDefenseSite] ${this.name} destroyed!`);
  }

  abstract update(dt: number, playerPos: Vector3, playerVel?: Vector3): void;

  dispose(): void {
    if (!this.targetEntity.isDestroyed) {
      this.targetEntity.destroy();
    }
  }
}
