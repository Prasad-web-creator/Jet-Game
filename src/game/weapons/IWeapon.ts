import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { WeaponConfig, WeaponType } from '../../types';

export interface WeaponState {
  currentAmmo: number;
  maxAmmo: number;
  heat: number;             // 0.0 - 1.0 (0% - 100%)
  isOverheated: boolean;
  cooldownProgress: number; // 0.0 - 1.0
}

export interface IWeapon {
  readonly id: string;
  readonly name: string;
  readonly type: WeaponType;
  readonly config: WeaponConfig;

  /**
   * Attempt to fire the weapon.
   * @param origin World position of gun barrel
   * @param direction Forward direction vector
   * @param craftVelocity Velocity of the firing aircraft
   * @returns true if weapon fired successfully
   */
  fire(origin: Vector3, direction: Vector3, craftVelocity: Vector3): boolean;

  /** Update cooldowns, heat dissipation, and weapon timers */
  update(dt: number): void;

  getState(): WeaponState;
}
