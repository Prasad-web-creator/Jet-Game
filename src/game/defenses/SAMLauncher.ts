import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { GroundDefenseSite } from './GroundDefenseSite';
import type { SAMMissilePool } from './SAMMissilePool';
import { globalEventBus } from '../core/EventBus';

export class SAMLauncher extends GroundDefenseSite {
  readonly engagementRadius: number;
  private samPool: SAMMissilePool;
  
  private lockTimer = 0;
  private lockRequiredTime = 2.0; // 2 seconds to acquire lock
  private cooldownTimer = 0;
  private reloadCooldown = 5.0;   // 5 seconds between missile launches
  
  private lockState: 'none' | 'locking' | 'locked' | 'inbound' = 'none';

  private turretMesh: Mesh;

  constructor(
    id: string,
    name: string,
    scene: Scene,
    position: Vector3,
    samPool: SAMMissilePool,
    engagementRadius = 2200
  ) {
    const root = new Mesh(`sam_root_${id}`, scene);

    // Concrete Base Ring
    const baseMat = new StandardMaterial(`sam_base_mat_${id}`, scene);
    baseMat.diffuseColor = new Color3(0.2, 0.25, 0.22); // Camo dark green/grey

    const basePad = MeshBuilder.CreateCylinder(`sam_pad_${id}`, { height: 1.5, diameter: 10 }, scene);
    basePad.position.y = 0.75;
    basePad.material = baseMat;
    basePad.parent = root;

    // Swiveling Turret Pod Assembly
    const turretMat = new StandardMaterial(`sam_turret_mat_${id}`, scene);
    turretMat.diffuseColor = new Color3(0.3, 0.35, 0.28);
    turretMat.emissiveColor = new Color3(0.04, 0.06, 0.04);

    const turret = new Mesh(`sam_turret_${id}`, scene);
    turret.position.y = 2.0;
    turret.parent = root;

    const turretCore = MeshBuilder.CreateBox(`sam_core_${id}`, { width: 4, height: 2.5, depth: 5 }, scene);
    turretCore.position.y = 1.25;
    turretCore.material = turretMat;
    turretCore.parent = turret;

    // Quad Launcher Tubes
    const tubeMat = new StandardMaterial(`sam_tube_mat_${id}`, scene);
    tubeMat.diffuseColor = new Color3(0.15, 0.18, 0.16);

    for (let x = -1.2; x <= 1.2; x += 2.4) {
      for (let y = 1.0; y <= 2.2; y += 1.2) {
        const tube = MeshBuilder.CreateCylinder(`sam_tube_${id}_${x}_${y}`, { height: 5, diameter: 0.7 }, scene);
        tube.rotation.x = -Math.PI / 4; // Angled 45 deg upwards
        tube.position.set(x, y, 1.0);
        tube.material = tubeMat;
        tube.parent = turret;
      }
    }

    // Scale the entire SAM launcher 4x — aircraft size or bigger
    root.scaling.setAll(4.0);

    super(id, name, scene, position, root, 120 /* HP */, 50 /* radius */, new Vector3(0, 16, 0));

    this.engagementRadius = engagementRadius;
    this.samPool = samPool;
    this.turretMesh = turret;
  }

  update(dt: number, playerPos: Vector3): void {
    if (this.isDestroyed) {
      if (this.lockState !== 'none') {
        this.setLockState('none');
      }
      return;
    }

    if (this.cooldownTimer > 0) {
      this.cooldownTimer -= dt;
    }

    const distToPlayer = Vector3.Distance(this.position, playerPos);
    const toPlayerDir = playerPos.subtract(this.position).normalize();

    // Swivel turret yaw towards player
    const targetYaw = Math.atan2(toPlayerDir.x, toPlayerDir.z);
    this.turretMesh.rotation.y = Vector3.Lerp(
      new Vector3(0, this.turretMesh.rotation.y, 0),
      new Vector3(0, targetYaw, 0),
      0.1
    ).y;

    // Engagement logic: active if Radar detected player OR player within 1500m close defense boundary
    const isTargetable = (this.isActivated || distToPlayer <= 1500) && distToPlayer <= this.engagementRadius;

    if (isTargetable && this.cooldownTimer <= 0) {
      // Locking on
      this.lockTimer += dt;
      if (this.lockTimer >= this.lockRequiredTime) {
        // LOCK COMPLETE -> LAUNCH MISSILE!
        this.setLockState('inbound');
        this.launchSAM(toPlayerDir);
        this.lockTimer = 0;
        this.cooldownTimer = this.reloadCooldown;
      } else {
        this.setLockState('locking');
      }
    } else {
      // Decay lock timer when out of envelope or cooling down
      this.lockTimer = Math.max(0, this.lockTimer - dt * 2.0);
      if (this.lockState !== 'inbound' || this.cooldownTimer <= this.reloadCooldown - 1.5) {
        this.setLockState('none');
      }
    }
  }

  private launchSAM(toPlayerDir: Vector3): void {
    // Pitch launch vector 40 degrees upward for initial boost climb
    const launchDir = new Vector3(
      toPlayerDir.x * 0.8,
      0.6,
      toPlayerDir.z * 0.8
    ).normalize();

    const spawnOrigin = this.position.add(new Vector3(0, 4.0, 0));
    this.samPool.spawn(spawnOrigin, launchDir, 65, this.engagementRadius * 1.5);
  }

  getLockState(): 'none' | 'locking' | 'locked' | 'inbound' {
    return this.isDestroyed ? 'none' : this.lockState;
  }

  private setLockState(newState: 'none' | 'locking' | 'locked' | 'inbound'): void {
    if (this.lockState !== newState) {
      this.lockState = newState;
      globalEventBus.emit('SAM_LOCK_STATE_CHANGED', { state: newState, samId: this.id });
    }
  }

  protected override onDestroyed(): void {
    super.onDestroyed();
    this.setLockState('none');
  }
}
