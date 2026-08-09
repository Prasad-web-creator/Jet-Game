import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { BaseWeapon } from './BaseWeapon';
import type { MissilePool } from './MissilePool';
import type { TargetEntity } from '../targets/TargetManager';
import { WeaponType } from '../../types';
import type { WeaponConfig } from '../../types';

export const AIM9_SIDEWINDER_CONFIG: WeaponConfig = {
  id: 'aim9_sidewinder',
  name: 'AIM-9 SIDEWINDER',
  type: WeaponType.Missile,
  damage: 150,           // 150 HP damage per hit
  fireRate: 0.67,        // 1 missile every 1.5 seconds
  range: 3500,           // 3,500 m max range
  projectileSpeed: 1200, // 1,200 m/s max boost speed
  ammoCapacity: 6,       // 6 missiles capacity
  isHoming: true,
  blastRadius: 25,       // 25m blast radius
};

export class MissileWeapon extends BaseWeapon {
  private missilePool: MissilePool;
  private pylonToggle = false;

  constructor(missilePool: MissilePool) {
    super(
      AIM9_SIDEWINDER_CONFIG,
      0.0, // Missiles generate no heat
      1.0,
      0
    );
    this.missilePool = missilePool;
  }

  fire(origin: Vector3, direction: Vector3, craftVelocity: Vector3): boolean {
    return this.fireWithTarget(origin, direction, craftVelocity, null);
  }

  /**
   * Fire missile with acquired lock-on target.
   */
  fireWithTarget(
    origin: Vector3,
    direction: Vector3,
    craftVelocity: Vector3,
    target: TargetEntity | null
  ): boolean {
    if (!this.canFire()) return false;

    // Alternate left (-2.8m) and right (+2.8m) wing pylon position
    const pylonOffset = this.pylonToggle ? -2.8 : 2.8;
    this.pylonToggle = !this.pylonToggle;

    const rightVec = Vector3.Cross(direction, Vector3.Up()).normalize();
    if (rightVec.lengthSquared() < 0.01) {
      rightVec.copyFrom(Vector3.Right());
    }

    const pylonPos = origin
      .add(rightVec.scale(pylonOffset))
      .add(Vector3.Up().scale(-0.4))
      .add(direction.scale(1.2));

    const launched = this.missilePool.spawn(
      pylonPos,
      direction,
      craftVelocity,
      target,
      this.config.damage,
      this.config.range
    );

    if (launched) {
      this.recordShot();
      console.log(`[MissileWeapon] Launched AIM-9 Sidewinder at ${target ? target.name : 'BORESIGHT'}! (Ammo: ${this.currentAmmo}/${this.maxAmmo})`);
      return true;
    }

    return false;
  }
}
