import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { GroundDefenseSite } from './GroundDefenseSite';
import type { AAATracerPool } from './AAATracerPool';

/**
 * AAAGun — Stylized quad-barrel Gatling turret matching the reference design.
 *
 * Visual layers (bottom → top):
 *   1. Octagonal gray platform + 3 orange wedge-feet tripod supports
 *   2. Orange central yaw-rotation hub sitting on top of the platform
 *   3. Orange L-bracket pitch arm extending forward+up from hub
 *   4. 4-barrel (2×2) gun cluster (gray/silver) attached to front of arm
 *   5. Small orange sensor/fire-control box on top of the arm
 *   6. Yellow–black hazard ammo-feed chain hanging from the side
 *
 * The yaw node (turretYawMesh) rotates the entire assembly around Y.
 * The pitch node (barrelsPitchMesh) rotates the arm + barrels around X.
 */
export class AAAGun extends GroundDefenseSite {
  readonly firingRange: number;
  private tracerPool: AAATracerPool;

  private burstTimer    = 0;
  private burstDuration = 1.5;
  private burstPause    = 1.2;
  private isBurstActive = false;
  private shotCooldown  = 0;
  private fireRate      = 12.0;

  private turretYawMesh:   Mesh;
  private barrelsPitchMesh: TransformNode;

  constructor(
    id: string,
    name: string,
    scene: Scene,
    position: Vector3,
    tracerPool: AAATracerPool,
    firingRange = 1200,
  ) {
    const root = new Mesh(`aaa_root_${id}`, scene);

    // ══ MATERIALS ════════════════════════════════════════════════════════════

    // Orange — main structural color matching the reference
    const orangeMat = new StandardMaterial(`aaa_orange_${id}`, scene);
    orangeMat.diffuseColor  = new Color3(0.95, 0.52, 0.06);
    orangeMat.specularColor = new Color3(0.40, 0.20, 0.05);
    orangeMat.specularPower = 20;

    // Gray platform / barrels
    const grayMat = new StandardMaterial(`aaa_gray_${id}`, scene);
    grayMat.diffuseColor  = new Color3(0.58, 0.60, 0.64);
    grayMat.specularColor = new Color3(0.30, 0.30, 0.32);
    grayMat.specularPower = 18;

    // Barrel steel (slightly darker)
    const barrelMat = new StandardMaterial(`aaa_barrel_${id}`, scene);
    barrelMat.diffuseColor  = new Color3(0.50, 0.52, 0.56);
    barrelMat.specularColor = new Color3(0.35, 0.35, 0.38);
    barrelMat.specularPower = 32;

    // Dark detail / bolt accents
    const darkMat = new StandardMaterial(`aaa_dark_${id}`, scene);
    darkMat.diffuseColor  = new Color3(0.14, 0.14, 0.16);
    darkMat.specularColor = new Color3(0.05, 0.05, 0.06);

    // Hazard yellow stripe
    const hazardYellowMat = new StandardMaterial(`aaa_hazard_y_${id}`, scene);
    hazardYellowMat.diffuseColor  = new Color3(0.96, 0.82, 0.06);
    hazardYellowMat.specularColor = new Color3(0.20, 0.18, 0.02);

    // Hazard black stripe
    const hazardBlackMat = new StandardMaterial(`aaa_hazard_b_${id}`, scene);
    hazardBlackMat.diffuseColor = new Color3(0.10, 0.10, 0.10);

    // ══ 1. BASE PLATFORM — Octagonal gray slab ════════════════════════════

    const basePad = MeshBuilder.CreateCylinder(`aaa_pad_${id}`, {
      height: 0.55, diameter: 6.8, tessellation: 8, // tessellation=8 = octagon
    }, scene);
    basePad.position.y = 0.27;
    basePad.material   = grayMat;
    basePad.parent     = root;

    // Thin orange rim ring around the octagonal pad
    const padRim = MeshBuilder.CreateCylinder(`aaa_pad_rim_${id}`, {
      height: 0.14, diameter: 7.20, tessellation: 8,
    }, scene);
    padRim.position.y = 0.07;
    padRim.material   = orangeMat;
    padRim.parent     = root;

    // ── Three orange wedge-feet — tripod support legs ──────────────────────
    //    Placed at 0°, 120°, 240° around the base, splaying outward.
    const footAngles = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
    for (let fi = 0; fi < footAngles.length; fi++) {
      const ang   = footAngles[fi];
      const footR = 4.2; // distance from center

      const foot = MeshBuilder.CreateBox(`aaa_foot_${id}_${fi}`, {
        width: 1.60, height: 0.42, depth: 2.40,
      }, scene);
      foot.rotation.y = ang;
      foot.position.x = Math.sin(ang) * footR;
      foot.position.z = Math.cos(ang) * footR;
      foot.position.y = 0.21;
      foot.material   = orangeMat;
      foot.parent     = root;

      // Small beveled edge cap at foot tip
      const footCap = MeshBuilder.CreateBox(`aaa_foot_cap_${id}_${fi}`, {
        width: 1.60, height: 0.20, depth: 0.28,
      }, scene);
      footCap.rotation.y = ang;
      footCap.position.x = Math.sin(ang) * (footR + 1.10);
      footCap.position.z = Math.cos(ang) * (footR + 1.10);
      footCap.position.y = 0.10;
      footCap.material   = darkMat;
      footCap.parent     = root;
    }

    // ══ 2. SWIVEL HUB — Orange rotating yaw body ════════════════════════

    const turretYaw = new Mesh(`aaa_turret_yaw_${id}`, scene);
    turretYaw.position.y = 0.55; // sits on top of the base pad
    turretYaw.parent     = root;

    // Main hub block (orange boxy body)
    const hubMain = MeshBuilder.CreateBox(`aaa_hub_main_${id}`, {
      width: 2.60, height: 1.60, depth: 2.60,
    }, scene);
    hubMain.position.y = 1.05;
    hubMain.material   = orangeMat;
    hubMain.parent     = turretYaw;

    // Hub top cap (slightly narrower, gives a beveled stepped look)
    const hubTop = MeshBuilder.CreateBox(`aaa_hub_top_${id}`, {
      width: 2.20, height: 0.38, depth: 2.20,
    }, scene);
    hubTop.position.y = 2.04;
    hubTop.material   = orangeMat;
    hubTop.parent     = turretYaw;

    // Hub bottom ring (transition to pad)
    const hubRing = MeshBuilder.CreateCylinder(`aaa_hub_ring_${id}`, {
      height: 0.35, diameter: 2.80, tessellation: 10,
    }, scene);
    hubRing.position.y = 0.17;
    hubRing.material   = grayMat;
    hubRing.parent     = turretYaw;

    // Dark panel details on hub front face
    const hubPanel = MeshBuilder.CreateBox(`aaa_hub_panel_${id}`, {
      width: 1.80, height: 0.90, depth: 0.08,
    }, scene);
    hubPanel.position.y = 1.05;
    hubPanel.position.z = 1.34;
    hubPanel.material   = darkMat;
    hubPanel.parent     = turretYaw;

    // ══ 3. PITCH ARM — L-bracket lifting and pointing the barrels ════════
    //    The arm is an orange structure that rises vertically then extends
    //    forward (along +Z) to hold the barrel cluster.
    //    Its pivot is at the center of the hub top.

    const barrelsPitch = new TransformNode(`aaa_barrels_pitch_${id}`, scene);
    barrelsPitch.position.set(0, 2.22, 0); // pivot at hub top center
    barrelsPitch.parent = turretYaw;

    // Vertical riser of the L-bracket
    const armRiser = MeshBuilder.CreateBox(`aaa_arm_riser_${id}`, {
      width: 0.68, height: 1.95, depth: 0.62,
    }, scene);
    armRiser.position.y = 0.97;  // rises upward from pivot
    armRiser.position.z = -0.25;
    armRiser.material   = orangeMat;
    armRiser.parent     = barrelsPitch;

    // Horizontal arm extending forward (+Z) at the top of the riser
    const armForward = MeshBuilder.CreateBox(`aaa_arm_fwd_${id}`, {
      width: 0.68, height: 0.62, depth: 3.20,
    }, scene);
    armForward.position.y = 1.85;  // at top of riser
    armForward.position.z = 1.30;
    armForward.material   = orangeMat;
    armForward.parent     = barrelsPitch;

    // Orange bracket cheeks (left and right side rails)
    for (const side of [-1, 1]) {
      const cheek = MeshBuilder.CreateBox(`aaa_cheek_${id}_${side}`, {
        width: 0.18, height: 0.80, depth: 3.00,
      }, scene);
      cheek.position.x = side * 0.58;
      cheek.position.y = 1.65;
      cheek.position.z = 1.20;
      cheek.material   = orangeMat;
      cheek.parent     = barrelsPitch;
    }

    // Elbow joint block (corner of the L)
    const elbowJoint = MeshBuilder.CreateBox(`aaa_elbow_${id}`, {
      width: 0.72, height: 0.72, depth: 0.72,
    }, scene);
    elbowJoint.position.y = 1.88;
    elbowJoint.position.z = -0.22;
    elbowJoint.material   = orangeMat;
    elbowJoint.parent     = barrelsPitch;

    // ── Sensor/Fire-Control Box on top of arm ─────────────────────────────
    const sensorBox = MeshBuilder.CreateBox(`aaa_sensor_${id}`, {
      width: 0.65, height: 0.52, depth: 0.75,
    }, scene);
    sensorBox.position.y = 2.16;
    sensorBox.position.z = -0.10;
    sensorBox.material   = orangeMat;
    sensorBox.parent     = barrelsPitch;

    // Sensor lens (dark circle on face)
    const sensorLens = MeshBuilder.CreateCylinder(`aaa_lens_${id}`, {
      height: 0.08, diameter: 0.26, tessellation: 10,
    }, scene);
    sensorLens.rotation.x = Math.PI / 2;
    sensorLens.position.y = 2.16;
    sensorLens.position.z = -0.48;
    sensorLens.material   = darkMat;
    sensorLens.parent     = barrelsPitch;

    // ══ 4. BARREL CLUSTER — 2×2 quad Gatling bundle ═════════════════════
    //    Barrels attach to the front face of armForward, centered at its tip.
    //    Arrangement: top-left, top-right, bottom-left, bottom-right.

    const barrelOffsets: Array<[number, number]> = [
      [-0.32,  0.32],   // top-left
      [ 0.32,  0.32],   // top-right
      [-0.32, -0.32],   // bottom-left
      [ 0.32, -0.32],   // bottom-right
    ];

    const barrelLength = 3.40;

    for (let bi = 0; bi < barrelOffsets.length; bi++) {
      const [bx, by] = barrelOffsets[bi];

      // Main barrel tube
      const barrel = MeshBuilder.CreateCylinder(`aaa_barrel_${id}_${bi}`, {
        height: barrelLength, diameter: 0.26, tessellation: 10,
      }, scene);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.x = bx;
      barrel.position.y = 1.62 + by;
      barrel.position.z = 2.90 + barrelLength / 2; // tip extends forward of arm
      barrel.material   = barrelMat;
      barrel.parent     = barrelsPitch;

      // Muzzle flash-hider / compensator at barrel tip
      const muzzle = MeshBuilder.CreateCylinder(`aaa_muzzle_${id}_${bi}`, {
        height: 0.22, diameterTop: 0.20, diameterBottom: 0.30, tessellation: 10,
      }, scene);
      muzzle.rotation.x = Math.PI / 2;
      muzzle.position.x = bx;
      muzzle.position.y = 1.62 + by;
      muzzle.position.z = 2.90 + barrelLength + 0.11;
      muzzle.material   = darkMat;
      muzzle.parent     = barrelsPitch;
    }

    // Central barrel-cluster carrier ring (holds the 4 barrels together)
    const clusterRingFront = MeshBuilder.CreateCylinder(`aaa_ring_front_${id}`, {
      height: 0.28, diameter: 1.05, tessellation: 12,
    }, scene);
    clusterRingFront.rotation.x = Math.PI / 2;
    clusterRingFront.position.y = 1.62;
    clusterRingFront.position.z = 2.90 + barrelLength * 0.80;
    clusterRingFront.material   = orangeMat;
    clusterRingFront.parent     = barrelsPitch;

    const clusterRingRear = MeshBuilder.CreateCylinder(`aaa_ring_rear_${id}`, {
      height: 0.28, diameter: 1.10, tessellation: 12,
    }, scene);
    clusterRingRear.rotation.x = Math.PI / 2;
    clusterRingRear.position.y = 1.62;
    clusterRingRear.position.z = 2.90 + barrelLength * 0.20;
    clusterRingRear.material   = orangeMat;
    clusterRingRear.parent     = barrelsPitch;

    // ══ 5. AMMO FEED CHAIN — Yellow/black hazard links ═══════════════════
    //    Hangs from the right side of the arm riser, as seen in the image.

    const chainSegments = 6;
    const chainSpacing  = 0.45;
    for (let ci = 0; ci < chainSegments; ci++) {
      const isYellow = ci % 2 === 0;
      const chainLink = MeshBuilder.CreateBox(`aaa_chain_${id}_${ci}`, {
        width: 0.26, height: 0.36, depth: 0.16,
      }, scene);
      chainLink.position.x = 0.54;           // right side of arm
      chainLink.position.y = 1.70 - ci * chainSpacing;  // hanging down
      chainLink.position.z = 0.22;
      chainLink.material   = isYellow ? hazardYellowMat : hazardBlackMat;
      chainLink.parent     = barrelsPitch;
    }

    // Chain attachment bracket on arm
    const chainBracket = MeshBuilder.CreateBox(`aaa_chain_bracket_${id}`, {
      width: 0.18, height: 0.35, depth: 0.35,
    }, scene);
    chainBracket.position.x = 0.60;
    chainBracket.position.y = 1.88;
    chainBracket.position.z = 0.20;
    chainBracket.material   = darkMat;
    chainBracket.parent     = barrelsPitch;

    // ══ FINALIZE ═════════════════════════════════════════════════════════

    // Scale the entire turret 4x — aircraft size or bigger
    root.scaling.setAll(4.0);

    // Disable picking and collision on every child mesh for performance
    for (const mesh of root.getChildMeshes()) {
      mesh.isPickable      = false;
      mesh.checkCollisions = false;
    }

    super(id, name, scene, position, root, 120 /* HP */, 40 /* radius */, new Vector3(0, 8, 0));

    this.firingRange     = firingRange;
    this.tracerPool      = tracerPool;
    this.turretYawMesh   = turretYaw;
    this.barrelsPitchMesh = barrelsPitch;
  }

  // ─── GameSystem update ────────────────────────────────────────────────────

  update(dt: number, playerPos: Vector3, playerVel?: Vector3): void {
    if (this.isDestroyed) return;

    const distToPlayer  = Vector3.Distance(this.position, playerPos);
    const isTargetable  = (this.isActivated || distToPlayer <= 1000) && distToPlayer <= this.firingRange;

    if (!isTargetable) {
      this.isBurstActive = false;
      return;
    }

    // ── Lead-angle intercept prediction ─────────────────────────────────────
    const bulletSpeed        = 850;
    const travelTime         = distToPlayer / bulletSpeed;
    const predictedPlayerPos = playerVel
      ? playerPos.add(playerVel.scale(travelTime * 0.85))
      : playerPos;

    const toTarget = predictedPlayerPos.subtract(this.position).normalize();

    // ── Turret yaw & barrel pitch aiming ────────────────────────────────────
    const targetYaw   = Math.atan2(toTarget.x, toTarget.z);
    const targetPitch = Math.asin(toTarget.y);

    this.turretYawMesh.rotation.y = Vector3.Lerp(
      new Vector3(0, this.turretYawMesh.rotation.y, 0),
      new Vector3(0, targetYaw, 0),
      0.15,
    ).y;

    this.barrelsPitchMesh.rotation.x = Vector3.Lerp(
      new Vector3(this.barrelsPitchMesh.rotation.x, 0, 0),
      new Vector3(-targetPitch, 0, 0),
      0.15,
    ).x;

    // ── Burst fire control ───────────────────────────────────────────────────
    this.burstTimer += dt;
    if (this.isBurstActive) {
      if (this.burstTimer >= this.burstDuration) {
        this.isBurstActive = false;
        this.burstTimer    = 0;
      } else {
        this.shotCooldown -= dt;
        if (this.shotCooldown <= 0) {
          this.shotCooldown = 1.0 / this.fireRate;
          this._fireTracer(toTarget);
        }
      }
    } else {
      if (this.burstTimer >= this.burstPause) {
        this.isBurstActive = true;
        this.burstTimer    = 0;
      }
    }
  }

  private _fireTracer(aimDir: Vector3): void {
    const spread = 0.035;
    const spreadDir = new Vector3(
      aimDir.x + (Math.random() - 0.5) * spread,
      aimDir.y + (Math.random() - 0.5) * spread,
      aimDir.z + (Math.random() - 0.5) * spread,
    ).normalize();

    const spawnOrigin = this.position.add(new Vector3(0, 4.2, 0));
    this.tracerPool.spawn(spawnOrigin, spreadDir, 850, 6, this.firingRange);
  }
}
