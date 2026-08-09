import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { TargetEntity } from '../targets/TargetManager';
import { TargetType } from '../../types';

/**
 * EnemyJet — a single AI-controlled enemy fighter aircraft.
 *
 * RCA fix: TargetEntity needs a real Mesh whose absolute world position
 * updates every frame. We use a dedicated invisible hitbox Mesh (child of root)
 * so TargetManager.refreshPosition() reads the correct world-space position.
 *
 * AI State Machine:
 *   PATROL  → flies a lazy orbit around spawn point
 *   CHASE   → when player is in detection range, turns toward player
 *   ATTACK  → when in firing cone, fires machine gun bursts at player
 *   EVADE   → when health < 40%, breaks away and retreats
 */
export class EnemyJet {
  readonly id: string;
  readonly name: string;
  readonly targetEntity: TargetEntity;

  // World state (kept as plain numbers to avoid Vector3 allocations each frame)
  private x: number;
  private y: number;
  private z: number;
  private yaw:   number;
  private pitch  = 0;
  private speed: number;
  health: number;
  readonly maxHealth = 120;  // 10 hits at 12 gun damage each
  isDestroyed = false;

  // 3D scene nodes
  private root!:    TransformNode;
  private hitbox!:  Mesh;           // invisible mesh tracked by TargetEntity

  // AI state
  private state: 'patrol' | 'chase' | 'attack' | 'breakaway' | 'evade' = 'patrol';
  private patrolAngle: number;
  private readonly patrolRadius = 400;  // orbit radius in metres
  private readonly spawnX: number;
  private readonly spawnY: number;
  private readonly spawnZ: number;

  // Formation/Tactics offsets
  private readonly flankAngle: number;
  private readonly altitudeOffset: number;

  // Shooting
  private shotCooldown = 0;
  private readonly FIRE_RATE       = 0.12;  // seconds between shots
  private readonly FIRE_RANGE      = 700;   // metres
  private readonly DETECTION_RANGE = 1500;  // only chase player within 1500 m

  // Bullet-fire callback wired by EnemyManager
  onFireBullet?: (origin: Vector3, direction: Vector3) => void;

  constructor(id: string, name: string, scene: Scene, spawnPos: Vector3, initialYaw: number) {
    this.id         = id;
    this.name       = name;
    this.x          = spawnPos.x;
    this.y          = spawnPos.y;
    this.z          = spawnPos.z;
    this.spawnX     = spawnPos.x;
    this.spawnY     = spawnPos.y;
    this.spawnZ     = spawnPos.z;
    this.yaw        = initialYaw;
    this.patrolAngle = initialYaw;
    this.speed      = 18;   // 5% of player max speed (360 m/s × 0.05 = 18 m/s)
    this.health     = this.maxHealth;

    // Generate unique offset for this jet based on its ID so they attack from different flanks
    const idHash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    this.flankAngle = (idHash % 360) * (Math.PI / 180);
    this.altitudeOffset = (idHash % 300) - 150; // -150 to +150m altitude offset

    this._buildMesh(scene);

    // TargetEntity reads hitbox.getAbsolutePosition() every frame.
    // hitbox is a direct child of root so Babylon keeps its world matrix in sync.
    this.targetEntity = new TargetEntity(
      id,
      name,
      TargetType.Aircraft,
      this.hitbox,
      this.maxHealth,
      20,                              // bounding radius metres
      (_t) => this._onDestroyed(),
      Vector3.Zero(),                  // no extra offset — hitbox IS the center
    );
  }

  // ─── Procedural Mesh ──────────────────────────────────────────────────────

  private _buildMesh(scene: Scene): void {
    this.root = new TransformNode(`enemy_root_${this.id}`, scene);
    this.root.position.copyFromFloats(this.x, this.y, this.z);
    this.root.scaling.copyFromFloats(2.0, 2.0, 2.0); // Make AI jets 100% larger (2x scale)

    // ── Materials ─────────────────────────────────────────────────────────────
    const bodyMat = new StandardMaterial(`enemy_body_${this.id}`, scene);
    bodyMat.diffuseColor  = new Color3(0.78, 0.12, 0.10);
    bodyMat.specularColor = new Color3(0.50, 0.20, 0.20);
    bodyMat.specularPower = 32;

    const darkMat = new StandardMaterial(`enemy_dark_${this.id}`, scene);
    darkMat.diffuseColor = new Color3(0.12, 0.10, 0.10);

    const accentMat = new StandardMaterial(`enemy_accent_${this.id}`, scene);
    accentMat.diffuseColor  = new Color3(0.92, 0.72, 0.05);
    accentMat.emissiveColor = new Color3(0.40, 0.30, 0.02);

    const burnerMat = new StandardMaterial(`enemy_glow_${this.id}`, scene);
    burnerMat.diffuseColor  = new Color3(0.8, 0.35, 0.05);
    burnerMat.emissiveColor = new Color3(0.9, 0.45, 0.05);

    // ── Fuselage ──────────────────────────────────────────────────────────────
    const fuse = MeshBuilder.CreateCylinder(`enemy_fuse_${this.id}`, {
      height: 10, diameterTop: 1.0, diameterBottom: 1.6, tessellation: 8,
    }, scene);
    fuse.rotation.x = Math.PI / 2;
    fuse.material = bodyMat;
    fuse.parent = this.root;

    // ── Nose ──────────────────────────────────────────────────────────────────
    const nose = MeshBuilder.CreateCylinder(`enemy_nose_${this.id}`, {
      height: 3.5, diameterTop: 0.05, diameterBottom: 1.0, tessellation: 8,
    }, scene);
    nose.rotation.x = Math.PI / 2;
    nose.position.z = 6.5;
    nose.material = accentMat;
    nose.parent = this.root;

    // ── Wings ─────────────────────────────────────────────────────────────────
    for (const side of [-1, 1]) {
      const wing = MeshBuilder.CreateBox(`enemy_wing_${this.id}_${side}`, {
        width: 5.5, height: 0.22, depth: 3.5,
      }, scene);
      wing.position.x = side * 2.5;
      wing.position.z = -1.0;
      wing.rotation.y = side * 0.18;
      wing.material = bodyMat;
      wing.parent = this.root;

      const tip = MeshBuilder.CreateBox(`enemy_tip_${this.id}_${side}`, {
        width: 1.2, height: 0.18, depth: 1.5,
      }, scene);
      tip.position.x = side * 5.4;
      tip.position.z = -0.5;
      tip.material = darkMat;
      tip.parent = this.root;
    }

    // ── Tail fins ─────────────────────────────────────────────────────────────
    for (const side of [-1, 1]) {
      const tail = MeshBuilder.CreateBox(`enemy_tail_${this.id}_${side}`, {
        width: 0.18, height: 2.0, depth: 2.2,
      }, scene);
      tail.position.x = side * 1.0;
      tail.position.y = 0.8;
      tail.position.z = -5.0;
      tail.rotation.z = side * 0.28;
      tail.material = bodyMat;
      tail.parent = this.root;
    }

    // ── Engine nozzle ─────────────────────────────────────────────────────────
    const nozzle = MeshBuilder.CreateCylinder(`enemy_nozzle_${this.id}`, {
      height: 2.0, diameterTop: 1.55, diameterBottom: 1.0, tessellation: 10,
    }, scene);
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.z = -6.2;
    nozzle.material = darkMat;
    nozzle.parent = this.root;

    // ── Afterburner ───────────────────────────────────────────────────────────
    const burner = MeshBuilder.CreateCylinder(`enemy_burner_${this.id}`, {
      height: 1.2, diameterTop: 0.0, diameterBottom: 0.9, tessellation: 10,
    }, scene);
    burner.rotation.x = Math.PI / 2;
    burner.position.z = -7.5;
    burner.material = burnerMat;
    burner.parent = this.root;

    // ── Invisible hitbox mesh — this is what TargetEntity tracks ──────────────
    // Must be a real Mesh (not TransformNode) so Babylon computes world matrix.
    this.hitbox = MeshBuilder.CreateSphere(`enemy_hitbox_${this.id}`, { diameter: 1, segments: 4 }, scene);
    this.hitbox.isVisible  = false;
    this.hitbox.isPickable = false;
    this.hitbox.parent     = this.root;   // inherits root world position automatically

    // Disable picking/collision on all visual meshes
    for (const m of this.root.getChildMeshes()) {
      if (m !== this.hitbox) {
        m.isPickable      = false;
        m.checkCollisions = false;
      }
    }
  }

  // ─── Per-frame AI update ──────────────────────────────────────────────────

  update(dt: number, playerPos: Vector3): void {
    if (this.isDestroyed) return;

    this.shotCooldown = Math.max(0, this.shotCooldown - dt);

    const toPlayerX   = playerPos.x - this.x;
    const toPlayerY   = playerPos.y - this.y;
    const toPlayerZ   = playerPos.z - this.z;
    const distToPlayer = Math.sqrt(toPlayerX * toPlayerX + toPlayerY * toPlayerY + toPlayerZ * toPlayerZ);

    // ── State transitions ────────────────────────────────────────────────────
    const healthPct = this.health / this.maxHealth;
    if (healthPct < 0.40) {
      this.state = 'evade';
    } else if (this.state === 'breakaway') {
      if (distToPlayer > 500) {
        this.state = 'chase';  // Return to chase once clear
      }
    } else if (distToPlayer <= 150) {
      this.state = 'breakaway'; // Too close, break away!
    } else if (distToPlayer <= this.FIRE_RANGE) {
      this.state = 'attack';
    } else if (distToPlayer <= this.DETECTION_RANGE) {
      this.state = 'chase';
    } else {
      this.state = 'patrol';
    }

    // ── State behaviors ──────────────────────────────────────────────────────
    switch (this.state) {
      case 'patrol':    this._doPatrol(dt);                                          break;
      case 'chase':     this._doChase(dt, playerPos.x, playerPos.y, playerPos.z, distToPlayer); break;
      case 'attack':    this._doAttack(dt, toPlayerX, toPlayerY, toPlayerZ, distToPlayer, playerPos); break;
      case 'breakaway': this._doBreakaway(dt);                                       break;
      case 'evade':     this._doEvade(dt);                                           break;
    }

    // ── Integrate position ───────────────────────────────────────────────────
    const cosP = Math.cos(this.pitch);
    const fwdX = cosP * Math.sin(this.yaw);
    const fwdY = Math.sin(this.pitch);
    const fwdZ = cosP * Math.cos(this.yaw);

    this.x += fwdX * this.speed * dt;
    this.y += fwdY * this.speed * dt;
    this.z += fwdZ * this.speed * dt;

    // Clamp altitude
    this.y = Math.max(80, Math.min(1200, this.y));

    // ── Push to Babylon TransformNode ─────────────────────────────────────────
    // The hitbox is a child of root, so it inherits world position automatically.
    this.root.position.copyFromFloats(this.x, this.y, this.z);
    this.root.rotation.x = -this.pitch;
    this.root.rotation.y =  this.yaw;
  }

  // ── AI: Patrol ───────────────────────────────────────────────────────────────
  private _doPatrol(dt: number): void {
    this.patrolAngle += 0.22 * dt;
    const tx = this.spawnX + Math.sin(this.patrolAngle) * this.patrolRadius;
    const tz = this.spawnZ + Math.cos(this.patrolAngle) * this.patrolRadius;
    this._steerToward(tx, this.spawnY, tz, dt, 0.8);
    this.speed += (18 - this.speed) * dt;  // patrol cruise 18 m/s (5% of player)
  }

  // ── AI: Chase ────────────────────────────────────────────────────────────────
  private _doChase(dt: number, px: number, py: number, pz: number, _dist: number): void {
    // Each jet aims for a unique flank position around the player
    const flankDist = 300;
    const targetX = px + Math.sin(this.flankAngle) * flankDist;
    const targetY = py + this.altitudeOffset;
    const targetZ = pz + Math.cos(this.flankAngle) * flankDist;

    this._steerToward(targetX, targetY, targetZ, dt, 1.5);
    this.speed += (20 - this.speed) * dt * 2;  // chase 20 m/s
  }

  // ── AI: Attack ───────────────────────────────────────────────────────────────
  private _doAttack(
    dt: number, dx: number, dy: number, dz: number, dist: number,
    playerPos: Vector3,
  ): void {
    this._steerToward(playerPos.x, playerPos.y, playerPos.z, dt, 2.5);
    this.speed += (18 - this.speed) * dt;  // attack 18 m/s

    if (this.shotCooldown <= 0) {
      const cosP = Math.cos(this.pitch);
      const fwdX = cosP * Math.sin(this.yaw);
      const fwdY = Math.sin(this.pitch);
      const fwdZ = cosP * Math.cos(this.yaw);

      const dotToPlayer =
        (dx / dist) * fwdX +
        (dy / dist) * fwdY +
        (dz / dist) * fwdZ;

      if (dotToPlayer > 0.82) {  // ~35° firing cone
        const ox = this.x + fwdX * 10;
        const oy = this.y + fwdY * 10;
        const oz = this.z + fwdZ * 10;
        this.onFireBullet?.(
          new Vector3(ox, oy, oz),
          new Vector3(fwdX, fwdY, fwdZ),
        );
        this.shotCooldown = this.FIRE_RATE;
      }
    }
  }

  // ── AI: Breakaway ────────────────────────────────────────────────────────────
  private _doBreakaway(dt: number): void {
    // When too close to player, pull hard away (usually upward and outward)
    const ex = this.x + Math.sin(this.yaw + Math.PI / 2) * 400;
    const ez = this.z + Math.cos(this.yaw + Math.PI / 2) * 400;
    this._steerToward(ex, Math.min(this.y + 150, 1000), ez, dt, 2.5);
    this.speed += (22 - this.speed) * dt * 2;  // accelerate to get away
  }

  // ── AI: Evade ────────────────────────────────────────────────────────────────
  private _doEvade(dt: number): void {
    const ex = this.spawnX + Math.sin(this.patrolAngle + Math.PI) * this.patrolRadius * 1.6;
    const ez = this.spawnZ + Math.cos(this.patrolAngle + Math.PI) * this.patrolRadius * 1.6;
    this._steerToward(ex, Math.min(this.y + 80, 1000), ez, dt, 1.2);
    this.speed += (22 - this.speed) * dt * 2;  // evade 22 m/s
  }

  // ── Smooth steering ────────────────────────────────────────────────────────
  private _steerToward(tx: number, ty: number, tz: number, dt: number, rate: number): void {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dz = tz - this.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < 1) return;

    const targetYaw   = Math.atan2(dx, dz);
    const targetPitch = Math.asin(Math.max(-1, Math.min(1, dy / dist)));

    let diffYaw = targetYaw - this.yaw;
    while (diffYaw >  Math.PI) diffYaw -= Math.PI * 2;
    while (diffYaw < -Math.PI) diffYaw += Math.PI * 2;

    const factor = Math.min(1, rate * dt);
    this.yaw   += diffYaw * factor;
    this.pitch += (targetPitch - this.pitch) * factor;
    this.pitch  = Math.max(-0.52, Math.min(0.52, this.pitch));
  }

  // ── Destruction ────────────────────────────────────────────────────────────
  private _onDestroyed(): void {
    this.isDestroyed = true;
    this.root.setEnabled(false);
    console.log(`[EnemyJet] ${this.name} destroyed!`);
  }

  getPosition(): Vector3 {
    return new Vector3(this.x, this.y, this.z);
  }

  dispose(): void {
    this.root.dispose(false, true);
  }
}
