import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import type { TargetManager, TargetEntity } from '../targets/TargetManager';
import type { CameraManager } from '../camera/CameraManager';
import { DamageType } from '../../types';
import { globalEventBus } from '../core/EventBus';

export interface ActiveMissile {
  mesh: Mesh;
  exhaustLight: PointLight;
  particles: ParticleSystem;
  position: Vector3;
  velocity: Vector3;
  target: TargetEntity | null;
  damage: number;
  maxRange: number;
  distanceTraveled: number;
  lifetime: number;
  stageTimer: number;
  stage: 'drop' | 'flight';
  active: boolean;
}

const MISSILE_TOP_SPEED = 1200; // m/s
const MISSILE_ACCEL     = 1800; // m/s² acceleration
const MISSILE_TURN_RATE = 1.65; // max turn rate in rad/sec (~95 deg/sec)
const MISSILE_MAX_LIFE  = 6.5;  // seconds max lifetime

export class MissilePool {
  private pool: ActiveMissile[] = [];
  private cameraManager: CameraManager | null = null;

  // PERF: pre-allocated scratch Vector3s — zero heap allocs in update()
  private readonly _scratchDir      = new Vector3();
  private readonly _scratchToTarget = new Vector3();
  private readonly _scratchMove     = new Vector3();
  private readonly _scratchLookAt   = new Vector3();

  constructor(scene: Scene, cameraManager?: CameraManager, poolSize = 16) {
    this.cameraManager = cameraManager ?? null;

    const missileMat = new StandardMaterial('missileBodyMat', scene);
    missileMat.diffuseColor = new Color3(0.85, 0.88, 0.92);
    missileMat.specularColor = new Color3(0.5, 0.5, 0.5);

    const finMat = new StandardMaterial('missileFinMat', scene);
    finMat.diffuseColor = new Color3(0.15, 0.15, 0.18);

    for (let i = 0; i < poolSize; i++) {
      // 3D Missile Model: Body + Nose + Fins
      const root = new Mesh(`missile_root_${i}`, scene);

      const body = MeshBuilder.CreateCylinder(`m_body_${i}`, { height: 2.4, diameter: 0.22 }, scene);
      body.rotation.x = Math.PI / 2;
      body.material = missileMat;
      body.parent = root;

      const nose = MeshBuilder.CreateCylinder(`m_nose_${i}`, { height: 0.6, diameterTop: 0, diameterBottom: 0.22 }, scene);
      nose.rotation.x = -Math.PI / 2;
      nose.position.z = 1.5;
      nose.material = finMat;
      nose.parent = root;

      const fin = MeshBuilder.CreateBox(`m_fin_${i}`, { width: 0.8, height: 0.04, depth: 0.4 }, scene);
      fin.position.z = -0.8;
      fin.material = finMat;
      fin.parent = root;

      root.isVisible = false;
      root.isPickable = false;

      // Exhaust Light
      const light = new PointLight(`m_light_${i}`, Vector3.Zero(), scene);
      light.diffuse = new Color3(1.0, 0.6, 0.1);
      light.intensity = 0;
      light.range = 10;

      // Smoke Trail Particle System
      const ps = new ParticleSystem(`m_trail_${i}`, 100, scene);
      ps.particleTexture = new Texture('https://raw.githubusercontent.com/BabylonJS/Babylon.js/master/packages/tools/playground/public/textures/flare.png', scene);
      ps.emitter = root;
      ps.minEmitBox = new Vector3(0, 0, -1.2);
      ps.maxEmitBox = new Vector3(0, 0, -1.2);
      ps.color1 = new Color4(1.0, 0.7, 0.2, 1.0);
      ps.color2 = new Color4(0.5, 0.5, 0.5, 0.8);
      ps.colorDead = new Color4(0.1, 0.1, 0.1, 0.0);
      ps.minSize = 0.3;
      ps.maxSize = 1.0;
      ps.minLifeTime = 0.3;
      ps.maxLifeTime = 0.8;
      ps.emitRate = 60;
      ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
      ps.gravity = new Vector3(0, 0, 0);

      this.pool.push({
        mesh: root,
        exhaustLight: light,
        particles: ps,
        position: new Vector3(),
        velocity: new Vector3(),
        target: null,
        damage: 150,
        maxRange: 3500,
        distanceTraveled: 0,
        lifetime: 0,
        stageTimer: 0,
        stage: 'drop',
        active: false,
      });
    }

    console.log(`[MissilePool] Initialized pool with ${poolSize} Sidewinder missiles.`);
  }

  setCameraManager(cameraManager: CameraManager): void {
    this.cameraManager = cameraManager;
  }

  spawn(
    origin: Vector3,
    direction: Vector3,
    craftVelocity: Vector3,
    target: TargetEntity | null,
    damage = 150,
    maxRange = 3500
  ): boolean {
    const m = this.pool.find((p) => !p.active);
    if (!m) {
      console.warn('[MissilePool] Missile pool exhausted!');
      return false;
    }

    m.active = true;
    m.stage = 'drop';
    m.stageTimer = 0.15; // 0.15s pylon drop stage
    m.position.copyFrom(origin);
    m.velocity.copyFrom(craftVelocity).addInPlace(direction.scale(80)); // Initial ejection speed
    m.target = target;
    m.damage = damage;
    m.maxRange = maxRange;
    m.distanceTraveled = 0;
    m.lifetime = 0;

    m.mesh.position.copyFrom(origin);
    m.mesh.isVisible = true;
    m.mesh.getChildMeshes().forEach((c) => (c.isVisible = true));
    m.mesh.lookAt(m.position.add(direction));

    m.exhaustLight.position.copyFrom(origin);
    m.exhaustLight.intensity = 0;

    // Emit launch event for audio + effects
    globalEventBus.emit('MISSILE_LAUNCHED', {
      origin: origin.clone(),
      targetId: target ? target.id : null,
    });

    return true;
  }

  update(dt: number, targetManager: TargetManager): void {
    const activeTargets = targetManager.getActiveTargets();

    for (const m of this.pool) {
      if (!m.active) continue;

      m.lifetime += dt;
      if (m.lifetime >= MISSILE_MAX_LIFE) {
        this.explode(m, false);
        continue;
      }

      // STAGE 1: Pylon Drop
      if (m.stage === 'drop') {
        m.stageTimer -= dt;
        // PERF: ScaleToRef → _scratchMove, no allocation
        m.velocity.scaleToRef(dt, this._scratchMove);
        m.position.addInPlace(this._scratchMove);
        // Gravity drop: y -= 4 * dt
        m.position.y -= 4.0 * dt;
        m.mesh.position.copyFrom(m.position);

        if (m.stageTimer <= 0) {
          m.stage = 'flight';
          m.exhaustLight.intensity = 4.0;
          m.particles.start();
        }
        continue;
      }

      // STAGE 2: Motor Flight & Proportional Navigation Homing
      // PERF: normalizeToRef into scratch — no allocation
      m.velocity.normalizeToRef(this._scratchDir);
      let currentSpeed = m.velocity.length();
      currentSpeed = Math.min(MISSILE_TOP_SPEED, currentSpeed + MISSILE_ACCEL * dt);

      // Target Homing
      if (m.target && !m.target.isDestroyed) {
        const targetPos = m.target.getPositionRef(); // cached, no alloc
        // PERF: subtractToRef → _scratchToTarget, no allocation
        targetPos.subtractToRef(m.position, this._scratchToTarget);
        this._scratchToTarget.normalizeToRef(this._scratchToTarget);

        const angle = Math.acos(Math.max(-1, Math.min(1, Vector3.Dot(this._scratchDir, this._scratchToTarget))));
        if (angle > 0.001) {
          const maxStep = MISSILE_TURN_RATE * dt;
          const blend   = Math.min(1.0, maxStep / angle);
          // PERF: LerpToRef — no allocation
          Vector3.LerpToRef(this._scratchDir, this._scratchToTarget, blend, this._scratchDir);
          this._scratchDir.normalizeToRef(this._scratchDir);
        }
      }

      // Apply new velocity
      this._scratchDir.scaleToRef(currentSpeed, m.velocity);

      // Move
      m.velocity.scaleToRef(dt, this._scratchMove);
      const stepDist = this._scratchMove.length();
      m.position.addInPlace(this._scratchMove);
      m.distanceTraveled += stepDist;

      m.mesh.position.copyFrom(m.position);

      // PERF: lookAt needs a world point — add velocity to pos into scratch
      m.position.addToRef(m.velocity, this._scratchLookAt);
      m.mesh.lookAt(this._scratchLookAt);
      m.exhaustLight.position.copyFrom(m.position);

      // Max Range
      if (m.distanceTraveled >= m.maxRange) {
        this.explode(m, false);
        continue;
      }

      // Hit Detection
      for (const target of activeTargets) {
        if (target.isDestroyed) continue;

        const dist = Vector3.Distance(m.position, target.getPositionRef());
        if (dist <= target.getBoundingRadius() + 3.0) {
          target.takeDamage({
            amount:      m.damage,
            sourceId:    'player_missile',
            type:        DamageType.Missile,
            hitPosition: { x: m.position.x, y: m.position.y, z: m.position.z },
          });
          globalEventBus.emit('MISSILE_HIT', {
            position: m.position.clone(), // clone OK — infrequent event
            targetId: target.id,
            damage:   m.damage,
          });
          this.explode(m, true);
          break;
        }
      }
    }
  }

  private explode(m: ActiveMissile, hitTarget: boolean): void {
    if (hitTarget) {
      this.cameraManager?.triggerExplosion(2.2);
    }

    m.active             = false;
    m.mesh.isVisible     = false;
    m.exhaustLight.intensity = 0;
    m.particles.stop();
    // Hide child meshes (nose, fins) — iterate stored children
    for (const child of m.mesh.getChildMeshes()) {
      child.isVisible = false;
    }
  }

  dispose(): void {
    for (const m of this.pool) {
      m.mesh.dispose();
      m.exhaustLight.dispose();
      m.particles.dispose();
    }
    this.pool = [];
  }
}
