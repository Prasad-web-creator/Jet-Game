import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { BaseWeapon } from './BaseWeapon';
import type { ProjectilePool } from './ProjectilePool';
import type { MuzzleFlash } from './MuzzleFlash';
import { WeaponType } from '../../types';
import type { WeaponConfig } from '../../types';

export const M61_VULCAN_CONFIG: WeaponConfig = {
  id: 'm61_vulcan_20mm',
  name: 'M61A1 VULCAN 20MM',
  type: WeaponType.MachineGun,
  damage: 12,
  fireRate: 20,          // 20 rounds / sec (1200 rpm)
  range: 1200,           // 1,200 m effective range
  projectileSpeed: 1000, // 1,000 m/s
  ammoCapacity: 500,     // 500 rounds magazine
  isHoming: false,
};

export class MachineGun extends BaseWeapon {
  private projectilePool: ProjectilePool;
  private muzzleFlash: MuzzleFlash;
  private barrelToggle = false;

  constructor(projectilePool: ProjectilePool, muzzleFlash: MuzzleFlash) {
    super(
      M61_VULCAN_CONFIG,
      0.035, // 3.5% heat per shot (~28 shots continuous before overheat)
      0.40,  // 40% heat dissipation per sec
      2.2    // 2.2s overheat lockout
    );
    this.projectilePool = projectilePool;
    this.muzzleFlash = muzzleFlash;
  }

  fire(origin: Vector3, direction: Vector3, craftVelocity: Vector3): boolean {
    if (!this.canFire()) return false;

    // Alternate left (-1.4m) and right (+1.4m) wing root barrel offset
    const sideOffset = this.barrelToggle ? -1.4 : 1.4;
    this.barrelToggle = !this.barrelToggle;

    // Calculate nozzle world position
    const rightVec = Vector3.Cross(direction, Vector3.Up()).normalize();
    if (rightVec.lengthSquared() < 0.01) {
      rightVec.copyFrom(Vector3.Right());
    }
    const nozzlePos = origin.add(rightVec.scale(sideOffset)).add(direction.scale(3.0));

    // Spawn pooled bullet
    const spawned = this.projectilePool.spawn(
      nozzlePos,
      direction,
      this.config.projectileSpeed,
      craftVelocity,
      this.config.damage,
      this.config.range
    );

    if (spawned) {
      this.muzzleFlash.trigger(nozzlePos);
      this.recordShot();
      return true;
    }

    return false;
  }
}
