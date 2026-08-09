import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { AircraftController } from '../aircraft/AircraftController';
import { DamageType } from '../../types';

export interface ActiveAAATracer {
  mesh: Mesh;
  position: Vector3;
  velocity: Vector3;
  damage: number;
  maxRange: number;
  distanceTraveled: number;
  active: boolean;
}

export class AAATracerPool {
  private pool: ActiveAAATracer[] = [];

  constructor(scene: Scene, poolSize = 40) {
    const tracerMat = new StandardMaterial('aaaTracerMat', scene);
    tracerMat.emissiveColor = new Color3(1.0, 0.8, 0.1); // Bright yellow/gold tracer glow
    tracerMat.disableLighting = true;

    for (let i = 0; i < poolSize; i++) {
      // 20mm Tracer Bullet Line / Cylinder
      const mesh = MeshBuilder.CreateCylinder(`aaa_tracer_${i}`, { height: 3.0, diameter: 0.25 }, scene);
      mesh.rotation.x = Math.PI / 2;
      mesh.material = tracerMat;
      mesh.isVisible = false;
      mesh.isPickable = false;

      this.pool.push({
        mesh,
        position: new Vector3(),
        velocity: new Vector3(),
        damage: 1,
        maxRange: 1400,
        distanceTraveled: 0,
        active: false,
      });
    }
  }

  spawn(origin: Vector3, direction: Vector3, speed = 850, damage = 1, maxRange = 1400): boolean {
    const t = this.pool.find((p) => !p.active);
    if (!t) return false;

    t.active = true;
    t.position.copyFrom(origin);
    t.velocity.copyFrom(direction).scaleInPlace(speed);
    t.damage = damage;
    t.maxRange = maxRange;
    t.distanceTraveled = 0;

    t.mesh.position.copyFrom(origin);
    t.mesh.isVisible = true;
    t.mesh.lookAt(t.position.add(direction));

    return true;
  }

  update(dt: number, aircraftController: AircraftController | null): void {
    const playerPos = aircraftController
      ? new Vector3(aircraftController.getFlightState().x, aircraftController.getFlightState().y, aircraftController.getFlightState().z)
      : null;

    for (const t of this.pool) {
      if (!t.active) continue;

      const moveVec = t.velocity.scale(dt);
      const stepDist = moveVec.length();

      t.position.addInPlace(moveVec);
      t.distanceTraveled += stepDist;
      t.mesh.position.copyFrom(t.position);

      // Max Range Exceeded Check
      if (t.distanceTraveled >= t.maxRange) {
        t.active = false;
        t.mesh.isVisible = false;
        continue;
      }

      // Hit Player Check
      if (playerPos && aircraftController) {
        const distToPlayer = Vector3.Distance(t.position, playerPos);
        if (distToPlayer <= 5.0) { // Player hit box radius
          aircraftController.takeDamage({
            amount: t.damage,
            sourceId: 'aaa_tracer',
            type: DamageType.Bullet,
            hitPosition: t.position.clone(),
          });

          t.active = false;
          t.mesh.isVisible = false;
        }
      }
    }
  }

  dispose(): void {
    for (const t of this.pool) {
      t.mesh.dispose();
    }
    this.pool = [];
  }
}
