import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Damageable, DamageInfo } from '../../types';
import { globalEventBus } from '../core/EventBus';

export class AlliedAircraft implements Damageable {
  readonly id: string;
  readonly name: string;
  health: number;
  maxHealth: number;
  isDestroyed = false;

  private mesh: Mesh;
  private position: Vector3;
  private destination: Vector3;
  private speed = 120; // Cruise speed for transport aircraft

  constructor(
    id: string,
    name: string,
    scene: Scene,
    position: Vector3,
    destination: Vector3,
    maxHealth = 250
  ) {
    this.id = id;
    this.name = name;
    this.position = position.clone();
    this.destination = destination.clone();
    this.health = maxHealth;
    this.maxHealth = maxHealth;

    // Transport Aircraft Model (Fuselage + Wide Wings + Blue Camo)
    const root = new Mesh(`allied_root_${id}`, scene);
    root.position.copyFrom(this.position);

    const bodyMat = new StandardMaterial(`allied_body_mat_${id}`, scene);
    bodyMat.diffuseColor = new Color3(0.2, 0.5, 0.95); // Allied Blue
    bodyMat.emissiveColor = new Color3(0.05, 0.1, 0.2);

    const fuselage = MeshBuilder.CreateCylinder(`allied_body_${id}`, { height: 16, diameter: 2.8 }, scene);
    fuselage.rotation.x = Math.PI / 2;
    fuselage.material = bodyMat;
    fuselage.parent = root;

    const wingMat = new StandardMaterial(`allied_wing_mat_${id}`, scene);
    wingMat.diffuseColor = new Color3(0.85, 0.9, 0.95);

    const wings = MeshBuilder.CreateBox(`allied_wings_${id}`, { width: 22, height: 0.4, depth: 4 }, scene);
    wings.material = wingMat;
    wings.parent = root;

    this.mesh = root;
    this.mesh.lookAt(destination);
  }

  getPosition(): Vector3 {
    return this.position;
  }

  takeDamage(info: DamageInfo): void {
    if (this.isDestroyed) return;

    this.health = Math.max(0, this.health - info.amount);
    console.log(`[Allied ${this.name}] Took ${info.amount} damage (${this.health}/${this.maxHealth} HP)`);

    if (this.health <= 0) {
      this.isDestroyed = true;
      globalEventBus.emit('TARGET_DESTROYED', {
        targetId: this.id,
        targetName: this.name,
        position: this.position.clone(),
      });
      this.mesh.visibility = 0;
      setTimeout(() => this.mesh.dispose(), 200);
    }
  }

  update(dt: number): void {
    if (this.isDestroyed) return;

    const toDest = this.destination.subtract(this.position);
    if (toDest.length() > 10) {
      const dir = toDest.normalize();
      this.position.addInPlace(dir.scale(this.speed * dt));
      this.mesh.position.copyFrom(this.position);
      this.mesh.lookAt(this.position.add(dir));
    }
  }

  dispose(): void {
    if (!this.isDestroyed) {
      this.mesh.dispose();
    }
  }
}
