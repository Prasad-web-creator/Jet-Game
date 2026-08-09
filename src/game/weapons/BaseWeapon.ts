import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { WeaponConfig, WeaponType } from '../../types';
import type { IWeapon, WeaponState } from './IWeapon';

export abstract class BaseWeapon implements IWeapon {
  readonly id: string;
  readonly name: string;
  readonly type: WeaponType;
  readonly config: WeaponConfig;

  protected currentAmmo: number;
  protected maxAmmo: number;
  protected heat = 0;               // 0.0 to 1.0
  protected isOverheated = false;
  protected fireCooldown = 0;        // seconds until next shot allowed
  protected heatRate: number;        // heat added per shot
  protected coolingRate: number;     // heat lost per second
  protected overheatPenalty: number; // seconds locked out when overheated
  protected overheatTimer = 0;

  constructor(
    config: WeaponConfig,
    heatRate = 0.04,
    coolingRate = 0.35,
    overheatPenalty = 2.5
  ) {
    this.id = config.id;
    this.name = config.name;
    this.type = config.type;
    this.config = config;
    this.maxAmmo = config.ammoCapacity;
    this.currentAmmo = config.ammoCapacity;
    this.heatRate = heatRate;
    this.coolingRate = coolingRate;
    this.overheatPenalty = overheatPenalty;
  }

  abstract fire(origin: Vector3, direction: Vector3, craftVelocity: Vector3): boolean;

  update(dt: number): void {
    // Cooldown timer between rounds
    if (this.fireCooldown > 0) {
      this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    }

    // Overheat timer
    if (this.isOverheated) {
      this.overheatTimer -= dt;
      // Dissipate heat rapidly during lockout
      this.heat = Math.max(0, this.heat - (1.0 / this.overheatPenalty) * dt);
      if (this.heat <= 0 && this.overheatTimer <= 0) {
        this.isOverheated = false;
        this.heat = 0;
        console.log(`[Weapon ${this.name}] Cooled down! Ready to fire.`);
      }
    } else {
      // Normal heat dissipation when idle
      if (this.heat > 0) {
        this.heat = Math.max(0, this.heat - this.coolingRate * dt);
      }
    }
  }

  protected canFire(): boolean {
    if (this.isOverheated) return false;
    if (this.fireCooldown > 0) return false;
    if (this.currentAmmo <= 0 && this.maxAmmo > 0) return false;
    return true;
  }

  protected recordShot(): void {
    this.fireCooldown = 1.0 / this.config.fireRate;

    if (this.maxAmmo > 0) {
      this.currentAmmo = Math.max(0, this.currentAmmo - 1);
    }

    // Heat buildup
    this.heat = Math.min(1.0, this.heat + this.heatRate);
    if (this.heat >= 1.0) {
      this.isOverheated = true;
      this.overheatTimer = this.overheatPenalty;
      console.warn(`[Weapon ${this.name}] OVERHEATED! Lockout for ${this.overheatPenalty}s.`);
    }
  }

  getState(): WeaponState {
    return {
      currentAmmo: this.currentAmmo,
      maxAmmo: this.maxAmmo,
      heat: this.heat,
      isOverheated: this.isOverheated,
      cooldownProgress: this.fireCooldown > 0 ? this.fireCooldown * this.config.fireRate : 0,
    };
  }
}
