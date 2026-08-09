import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import type { AircraftController } from '../aircraft/AircraftController';
import { IslandTerrain } from '../world/terrain/IslandTerrain';
import { globalEventBus } from '../core/EventBus';
import { DamageType } from '../../types';

export interface ActiveSAMMissile {
  mesh: Mesh;
  light: PointLight;
  particles: ParticleSystem;
  position: Vector3;
  velocity: Vector3;
  damage: number;
  maxRange: number;
  distanceTraveled: number;
  lifetime: number;
  active: boolean;
}

const SAM_TOP_SPEED  = 780;  // m/s
const SAM_ACCEL      = 1200; // m/s²
const SAM_TURN_RATE  = 1.25; // max homing turn rate (rad/s)
const SAM_MAX_LIFE   = 7.0;  // max lifetime seconds

export class SAMMissilePool {
  private pool: ActiveSAMMissile[] = [];
  private _activeCount = 0;

  // PERF: pre-allocated scratch Vector3s — zero per-frame allocs in update()
  private readonly _scratchPlayerPos = new Vector3();
  private readonly _scratchDir       = new Vector3();
  private readonly _scratchToPlayer  = new Vector3();
  private readonly _scratchMove      = new Vector3();
  private readonly _scratchLookAt    = new Vector3();

  constructor(scene: Scene, poolSize = 12) {
    const missileMat = new StandardMaterial('samMissileMat', scene);
    missileMat.diffuseColor = new Color3(0.9, 0.3, 0.2); // Olive/Red SAM paint
    missileMat.emissiveColor = new Color3(0.2, 0.05, 0.02);

    const finMat = new StandardMaterial('samFinMat', scene);
    finMat.diffuseColor = new Color3(0.15, 0.15, 0.18);

    for (let i = 0; i < poolSize; i++) {
      const root = new Mesh(`sam_missile_root_${i}`, scene);

      // Main Rocket Body
      const body = MeshBuilder.CreateCylinder(`sam_body_${i}`, { height: 3.2, diameter: 0.32 }, scene);
      body.rotation.x = Math.PI / 2;
      body.material = missileMat;
      body.parent = root;

      // Nose Cone
      const nose = MeshBuilder.CreateCylinder(`sam_nose_${i}`, { height: 0.8, diameterTop: 0, diameterBottom: 0.32 }, scene);
      nose.rotation.x = -Math.PI / 2;
      nose.position.z = 2.0;
      nose.material = finMat;
      nose.parent = root;

      // Large Stabilizing Tail Fins
      const fin = MeshBuilder.CreateBox(`sam_fin_${i}`, { width: 1.2, height: 0.05, depth: 0.6 }, scene);
      fin.position.z = -1.1;
      fin.material = finMat;
      fin.parent = root;

      root.isVisible = false;
      root.isPickable = false;

      // Rocket Exhaust Light
      const light = new PointLight(`sam_light_${i}`, Vector3.Zero(), scene);
      light.diffuse = new Color3(1.0, 0.5, 0.1);
      light.intensity = 0;
      light.range = 15;

      // Dense Rocket Smoke Trail
      const ps = new ParticleSystem(`sam_trail_${i}`, 150, scene);
      ps.particleTexture = new Texture('https://raw.githubusercontent.com/BabylonJS/Babylon.js/master/packages/tools/playground/public/textures/flare.png', scene);
      ps.emitter = root;
      ps.minEmitBox = new Vector3(0, 0, -1.6);
      ps.maxEmitBox = new Vector3(0, 0, -1.6);
      ps.color1 = new Color4(1.0, 0.5, 0.1, 1.0);
      ps.color2 = new Color4(0.4, 0.4, 0.4, 0.8);
      ps.colorDead = new Color4(0.1, 0.1, 0.1, 0.0);
      ps.minSize = 0.5;
      ps.maxSize = 1.8;
      ps.minLifeTime = 0.4;
      ps.maxLifeTime = 1.2;
      ps.emitRate = 90;
      ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;

      this.pool.push({
        mesh: root,
        light,
        particles: ps,
        position: new Vector3(),
        velocity: new Vector3(),
        damage: 2,
        maxRange: 3800,
        distanceTraveled: 0,
        lifetime: 0,
        active: false,
      });
    }
  }

  spawn(origin: Vector3, launchDir: Vector3, damage = 2, maxRange = 3800): boolean {
    const m = this.pool.find((p) => !p.active);
    if (!m) return false;

    m.active = true;
    m.position.copyFrom(origin);
    m.velocity.copyFrom(launchDir).scaleInPlace(150);
    m.damage           = damage;
    m.maxRange         = maxRange;
    m.distanceTraveled = 0;
    m.lifetime         = 0;

    m.mesh.position.copyFrom(origin);
    m.mesh.isVisible = true;
    for (const c of m.mesh.getChildMeshes()) c.isVisible = true;

    // lookAt: compute world point = origin + dir (no new Vector3 — use scratch)
    origin.addToRef(launchDir, this._scratchLookAt);
    m.mesh.lookAt(this._scratchLookAt);

    m.light.position.copyFrom(origin);
    m.light.intensity = 5.0;
    m.particles.start();
    this._activeCount++;

    console.log(`[SAMMissilePool] SAM LAUNCHED from (${origin.x.toFixed(0)}, ${origin.z.toFixed(0)})`);
    return true;
  }

  update(dt: number, aircraftController: AircraftController | null): void {
    if (this._activeCount === 0) return; // early-out

    // PERF: read player state once, write into scratch — no new Vector3
    let hasPlayer = false;
    if (aircraftController) {
      const fs = aircraftController.getFlightState();
      this._scratchPlayerPos.copyFromFloats(fs.x, fs.y, fs.z);
      hasPlayer = true;
    }

    for (const m of this.pool) {
      if (!m.active) continue;

      m.lifetime += dt;
      if (m.lifetime >= SAM_MAX_LIFE) {
        this._explode(m, false);
        continue;
      }

      // PERF: normalizeToRef — no allocation
      m.velocity.normalizeToRef(this._scratchDir);
      let currentSpeed = m.velocity.length();
      currentSpeed = Math.min(SAM_TOP_SPEED, currentSpeed + SAM_ACCEL * dt);

      if (hasPlayer) {
        // PERF: subtractToRef — no allocation
        this._scratchPlayerPos.subtractToRef(m.position, this._scratchToPlayer);
        this._scratchToPlayer.normalizeToRef(this._scratchToPlayer);

        const angle = Math.acos(Math.max(-1, Math.min(1, Vector3.Dot(this._scratchDir, this._scratchToPlayer))));
        if (angle > 0.001) {
          const blend = Math.min(1.0, (SAM_TURN_RATE * dt) / angle);
          // PERF: LerpToRef — no allocation
          Vector3.LerpToRef(this._scratchDir, this._scratchToPlayer, blend, this._scratchDir);
          this._scratchDir.normalizeToRef(this._scratchDir);
        }
      }

      // Apply new velocity direction
      this._scratchDir.scaleToRef(currentSpeed, m.velocity);

      // Move
      m.velocity.scaleToRef(dt, this._scratchMove);
      m.position.addInPlace(this._scratchMove);
      m.distanceTraveled += this._scratchMove.length();

      m.mesh.position.copyFrom(m.position);
      // PERF: lookAt — use scratch (pos + vel)
      m.position.addToRef(m.velocity, this._scratchLookAt);
      m.mesh.lookAt(this._scratchLookAt);
      m.light.position.copyFrom(m.position);

      // Terrain Impact
      const groundH = IslandTerrain.getHeightAt(m.position.x, m.position.z);
      if (m.position.y <= groundH + 1.5) {
        this._explode(m, false);
        continue;
      }

      // Max Range
      if (m.distanceTraveled >= m.maxRange) {
        this._explode(m, false);
        continue;
      }

      // Player Collision
      if (hasPlayer && aircraftController) {
        const distToPlayer = Vector3.Distance(m.position, this._scratchPlayerPos);
        if (distToPlayer <= 7.0) {
          aircraftController.takeDamage({
            amount:      m.damage,
            sourceId:    'sam_missile',
            type:        DamageType.Missile,
            hitPosition: { x: m.position.x, y: m.position.y, z: m.position.z },
          });
          this._explode(m, true);
        }
      }
    }
  }

  private _explode(m: ActiveSAMMissile, hitPlayer: boolean): void {
    globalEventBus.emit('TARGET_DESTROYED', {
      targetId:   'sam_missile_exp',
      targetName: 'SAM MISSILE EXPLOSION',
      position:   m.position.clone(), // clone OK — infrequent event
    });

    m.active             = false;
    m.mesh.isVisible     = false;
    m.light.intensity    = 0;
    m.particles.stop();
    for (const c of m.mesh.getChildMeshes()) c.isVisible = false;
    this._activeCount = Math.max(0, this._activeCount - 1);
    void hitPlayer; // used by audio events via TARGET_DESTROYED
  }

  /** O(1) — maintained by spawn/_explode counters. */
  getActiveMissileCount(): number {
    return this._activeCount;
  }

  dispose(): void {
    for (const m of this.pool) {
      m.mesh.dispose();
      m.light.dispose();
      m.particles.dispose();
    }
    this.pool = [];
  }
}
