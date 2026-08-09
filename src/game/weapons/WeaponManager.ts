import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { GameSystem } from '../core/GameLoop';
import type { GameState } from '../../types';
import type { InputManager } from '../controls/InputManager';
import type { AircraftController } from '../aircraft/AircraftController';
import type { CameraManager } from '../camera/CameraManager';
import type { TargetManager } from '../targets/TargetManager';
import { ProjectilePool } from './ProjectilePool';
import { MuzzleFlash } from './MuzzleFlash';
import { HitEffectPool } from './HitEffectPool';
import { MachineGun } from './MachineGun';
import { MissilePool } from './MissilePool';
import { MissileWeapon } from './MissileWeapon';
import { globalEventBus } from '../core/EventBus';

/**
 * WeaponManager — manages player aircraft weapons, projectile pools,
 * missiles, muzzle flash, and hit detection.
 */
export class WeaponManager implements GameSystem {
  readonly name = 'WeaponManager';

  private inputManager: InputManager;
  private aircraftController: AircraftController;
  private cameraManager: CameraManager | null = null;
  private targetManager: TargetManager | null = null;

  private projectilePool: ProjectilePool | null = null;
  private muzzleFlash: MuzzleFlash | null = null;
  private hitEffectPool: HitEffectPool | null = null;
  private machineGun: MachineGun | null = null;

  private missilePool: MissilePool | null = null;
  private missileWeapon: MissileWeapon | null = null;

  constructor(
    inputManager: InputManager,
    aircraftController: AircraftController,
    cameraManager?: CameraManager,
    targetManager?: TargetManager
  ) {
    this.inputManager = inputManager;
    this.aircraftController = aircraftController;
    this.cameraManager = cameraManager ?? null;
    this.targetManager = targetManager ?? null;
  }

  setTargetManager(targetManager: TargetManager): void {
    this.targetManager = targetManager;
  }

  setCameraManager(cameraManager: CameraManager): void {
    this.cameraManager = cameraManager;
    if (this.cameraManager && this.missilePool) {
      this.missilePool.setCameraManager(this.cameraManager);
    }
  }

  initialize(scene: Scene): void {
    this.projectilePool = new ProjectilePool(scene, 120);
    this.muzzleFlash = new MuzzleFlash(scene);
    this.hitEffectPool = new HitEffectPool(scene, 30);
    this.machineGun = new MachineGun(this.projectilePool, this.muzzleFlash);

    this.missilePool = new MissilePool(scene, this.cameraManager ?? undefined, 16);
    this.missileWeapon = new MissileWeapon(this.missilePool);

    console.log('[WeaponManager] Initialized with MachineGun (M61 Vulcan) & MissileWeapon (AIM-9 Sidewinder).');
  }

  update(dt: number, _state: GameState): void {
    if (!this.machineGun || !this.projectilePool || !this.targetManager) return;

    // 1. Update weapon timers & heat
    this.machineGun.update(dt);
    this.missileWeapon?.update(dt);
    this.muzzleFlash?.update(dt);
    this.hitEffectPool?.update(dt);

    const flightState = this.aircraftController.getFlightState();
    const origin = new Vector3(flightState.x, flightState.y, flightState.z);

    const cosP = Math.cos(flightState.pitch);
    const sinP = Math.sin(flightState.pitch);
    const cosY = Math.cos(flightState.yaw);
    const sinY = Math.sin(flightState.yaw);
    const direction = new Vector3(cosP * sinY, sinP, cosP * cosY);
    const craftVel = direction.scale(flightState.speed);

    // 2. Read Input & Fire
    const snap = this.inputManager.getSnapshot();

    // Machine Gun
    if (snap.fireGun) {
      const fired = this.machineGun.fire(origin, direction, craftVel);
      if (fired) {
        this.cameraManager?.shake(0.06, 0.04);
        globalEventBus.emit('MACHINE_GUN_FIRED', {
          origin: origin.clone(),
          direction: direction.clone(),
        });
      }
    }

    // Missile Launch (Right Click / MSL touch button)
    if (snap.fireMissile && this.missileWeapon) {
      const target = this.targetManager.getSelectedTarget();
      this.missileWeapon.fireWithTarget(origin, direction, craftVel, target);
    }

    // 3. Update active bullet tracers & missiles
    this.projectilePool.update(dt, this.targetManager, (hitPos) => {
      this.hitEffectPool?.trigger(hitPos);
    });

    this.missilePool?.update(dt, this.targetManager);

    // 4. Sync weapon telemetry to GameState for HUD display
    const mgState = this.machineGun.getState();
    _state.weaponState = {
      name: this.machineGun.name,
      ammo: mgState.currentAmmo,
      maxAmmo: mgState.maxAmmo,
      heat: mgState.heat,
      isOverheated: mgState.isOverheated,
    };
  }

  getMachineGunState() {
    return this.machineGun?.getState();
  }

  getMissileState() {
    return this.missileWeapon?.getState();
  }

  dispose(): void {
    this.projectilePool?.dispose();
    this.muzzleFlash?.dispose();
    this.hitEffectPool?.dispose();
    this.missilePool?.dispose();

    this.projectilePool = null;
    this.muzzleFlash = null;
    this.hitEffectPool = null;
    this.machineGun = null;
    this.missilePool = null;
    this.missileWeapon = null;
  }
}
