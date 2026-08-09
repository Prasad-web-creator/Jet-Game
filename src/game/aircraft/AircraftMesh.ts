import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { FlightState } from './FlightPhysics';

/**
 * AircraftMesh — Procedural F-35 Lightning II style stealth fighter mesh.
 *
 * Visual design matches:
 *   • Bright metallic ocean-blue airframe with glossy PBR-like highlights
 *   • Gold/amber radar-transparent nose radome
 *   • Wide blended-wing-body (BWB) stealth fuselage
 *   • DSI diverterless bubble intake under forward fuselage
 *   • Canted twin outward-tilted vertical stabilisers (cant ≈ 25 deg)
 *   • Retractable tricycle landing gear (nose + two main legs)
 *   • Dark tinted low-profile bubble canopy
 *   • Single nozzle with afterburner ring
 *
 * ─── Babylon rotation convention ─────────────────────────────────────────
 *   root.rotation.x = –state.pitch   (Babylon +X rot = nose DOWN)
 *   root.rotation.y = state.yaw      (Babylon +Y rot = nose RIGHT)
 *   root.rotation.z = –state.roll    (Babylon +Z rot from aircraft front = bank LEFT)
 */
export class AircraftMesh {
  private root!: TransformNode;

  get rootNode(): TransformNode {
    return this.root;
  }

  // ─── Initialization ───────────────────────────────────────────────────────

  initialize(scene: Scene, spawnX: number, spawnY: number, spawnZ: number): void {
    this.root = new TransformNode('playerJetRoot', scene);
    this.root.position.copyFromFloats(spawnX, spawnY, spawnZ);
    this.root.scaling.copyFromFloats(1.5, 1.5, 1.5); // Make player jet 50% larger
    this._buildF35(scene);
    console.log('[AircraftMesh] F-35 style stealth jet generated at', spawnX, spawnY, spawnZ);
  }

  // ─── Procedural F-35 Lightning II Style Builder ───────────────────────────

  private _buildF35(scene: Scene): void {

    // ══ MATERIALS ════════════════════════════════════════════════════════════

    // Primary ocean-blue metallic airframe (glossy)
    const blueMat = new StandardMaterial('f35_blue', scene);
    blueMat.diffuseColor  = new Color3(0.10, 0.48, 0.78);
    blueMat.specularColor = new Color3(0.60, 0.80, 1.00);
    blueMat.specularPower = 48;
    blueMat.backFaceCulling = false;

    // Slightly lighter blue for wing undersurfaces / panel variation
    const blueAltMat = new StandardMaterial('f35_blueAlt', scene);
    blueAltMat.diffuseColor  = new Color3(0.14, 0.55, 0.88);
    blueAltMat.specularColor = new Color3(0.55, 0.75, 1.00);
    blueAltMat.specularPower = 56;
    blueAltMat.backFaceCulling = false;

    // Gold / amber radar-transparent nose radome
    const radomeMat = new StandardMaterial('f35_radome', scene);
    radomeMat.diffuseColor  = new Color3(0.88, 0.72, 0.10);
    radomeMat.specularColor = new Color3(1.00, 0.90, 0.40);
    radomeMat.specularPower = 64;
    radomeMat.backFaceCulling = false;

    // Dark tinted cockpit glass
    const canopyMat = new StandardMaterial('f35_canopy', scene);
    canopyMat.diffuseColor  = new Color3(0.10, 0.18, 0.28);
    canopyMat.specularColor = new Color3(0.70, 0.88, 1.00);
    canopyMat.specularPower = 80;
    canopyMat.alpha         = 0.72;
    canopyMat.backFaceCulling = false;

    // Dark intake / exhaust / internal surfaces
    const darkMat = new StandardMaterial('f35_dark', scene);
    darkMat.diffuseColor  = new Color3(0.08, 0.10, 0.13);
    darkMat.specularColor = new Color3(0.10, 0.10, 0.12);
    darkMat.backFaceCulling = false;

    // Titanium exhaust nozzle
    const nozzleMat = new StandardMaterial('f35_nozzle', scene);
    nozzleMat.diffuseColor  = new Color3(0.30, 0.30, 0.34);
    nozzleMat.specularColor = new Color3(0.55, 0.55, 0.60);
    nozzleMat.specularPower = 32;
    nozzleMat.backFaceCulling = false;

    // Afterburner glow
    const burnerMat = new StandardMaterial('f35_burner', scene);
    burnerMat.diffuseColor  = new Color3(0.40, 0.20, 0.05);
    burnerMat.emissiveColor = new Color3(0.70, 0.35, 0.05);

    // Landing gear / struts (metallic silver)
    const gearMat = new StandardMaterial('f35_gear', scene);
    gearMat.diffuseColor  = new Color3(0.70, 0.72, 0.75);
    gearMat.specularColor = new Color3(0.40, 0.40, 0.42);
    gearMat.specularPower = 24;

    // Rubber tires
    const tireMat = new StandardMaterial('f35_tire', scene);
    tireMat.diffuseColor  = new Color3(0.12, 0.12, 0.14);
    tireMat.specularColor = new Color3(0.08, 0.08, 0.08);

    // ══ FUSELAGE ═════════════════════════════════════════════════════════════
    // F-35 has a wide, deep, flat-bottomed blended-wing-body fuselage.

    // Core mid-fuselage — wide & deep like BWB
    const midFuse = MeshBuilder.CreateCylinder('f35_mid_fuse', {
      height: 5.5, diameterTop: 1.90, diameterBottom: 1.70, tessellation: 10,
    }, scene);
    midFuse.scaling.x  = 1.35; // wider than tall (blended wing body)
    midFuse.rotation.x = Math.PI / 2;
    midFuse.position.z = -0.5;
    midFuse.position.y = 0.10;
    midFuse.material   = blueMat;
    midFuse.parent     = this.root;

    // Forward fuselage (narrows toward nose)
    const fwdFuse = MeshBuilder.CreateCylinder('f35_fwd_fuse', {
      height: 4.2, diameterTop: 1.10, diameterBottom: 1.70, tessellation: 10,
    }, scene);
    fwdFuse.scaling.x  = 1.30;
    fwdFuse.rotation.x = Math.PI / 2;
    fwdFuse.position.z = 4.25;
    fwdFuse.position.y = 0.14;
    fwdFuse.material   = blueMat;
    fwdFuse.parent     = this.root;

    // Aft engine bay (large round section for single F135 engine)
    const aftFuse = MeshBuilder.CreateCylinder('f35_aft_fuse', {
      height: 4.0, diameterTop: 1.55, diameterBottom: 1.88, tessellation: 10,
    }, scene);
    aftFuse.scaling.x  = 1.20;
    aftFuse.rotation.x = Math.PI / 2;
    aftFuse.position.z = -4.75;
    aftFuse.position.y = 0.08;
    aftFuse.material   = blueMat;
    aftFuse.parent     = this.root;

    // Spine fairing on top (avionics hump)
    const spine = MeshBuilder.CreateCylinder('f35_spine', {
      height: 5.0, diameterTop: 0.55, diameterBottom: 0.80, tessellation: 8,
    }, scene);
    spine.scaling.x  = 0.60;
    spine.rotation.x = Math.PI / 2;
    spine.position.y = 1.18;
    spine.position.z = 0.2;
    spine.material   = blueAltMat;
    spine.parent     = this.root;

    // ── Radome (Gold nose cone) ───────────────────────────────────────────────
    const radome = MeshBuilder.CreateCylinder('f35_radome', {
      height: 3.0, diameterTop: 0.05, diameterBottom: 1.10, tessellation: 10,
    }, scene);
    radome.scaling.x  = 1.28;
    radome.rotation.x = Math.PI / 2;
    radome.position.z = 7.75;
    radome.position.y = 0.14;
    radome.material   = radomeMat;
    radome.parent     = this.root;

    // Pitot probe at nose tip
    const pitot = MeshBuilder.CreateCylinder('f35_pitot', {
      height: 0.9, diameterTop: 0.018, diameterBottom: 0.035, tessellation: 6,
    }, scene);
    pitot.rotation.x = Math.PI / 2;
    pitot.position.z = 9.55;
    pitot.position.y = 0.14;
    pitot.material   = darkMat;
    pitot.parent     = this.root;

    // ── Cockpit canopy (low-profile blended bubble) ───────────────────────────
    // Canopy frame/windscreen
    const canopyFrame = MeshBuilder.CreateBox('f35_canopy_frame', {
      width: 0.92, height: 0.18, depth: 2.8,
    }, scene);
    canopyFrame.position.y = 1.02;
    canopyFrame.position.z = 3.4;
    canopyFrame.material   = blueMat;
    canopyFrame.parent     = this.root;

    // Canopy glass bubble
    const canopy = MeshBuilder.CreateSphere('f35_canopy_glass', {
      diameterX: 0.82, diameterY: 0.60, diameterZ: 2.6, segments: 10,
    }, scene);
    canopy.position.y = 1.12;
    canopy.position.z = 3.1;
    canopy.material   = canopyMat;
    canopy.parent     = this.root;

    // ── DSI Diverterless Bump Intake ──────────────────────────────────────────
    // The F-35 has a single large round intake under the fuselage,
    // preceded by a DSI compression ramp/bump.
    const intakeBump = MeshBuilder.CreateSphere('f35_dsi_bump', {
      diameterX: 1.55, diameterY: 0.45, diameterZ: 1.8, segments: 8,
    }, scene);
    intakeBump.position.y = -0.52;
    intakeBump.position.z = 3.6;
    intakeBump.material   = blueAltMat;
    intakeBump.parent     = this.root;

    // Intake duct opening (dark circle under fuselage)
    const intakeOpening = MeshBuilder.CreateCylinder('f35_intake_duct', {
      height: 3.0, diameterTop: 1.10, diameterBottom: 1.10, tessellation: 12,
    }, scene);
    intakeOpening.rotation.x = Math.PI / 2;
    intakeOpening.scaling.x  = 1.18;
    intakeOpening.position.y = -0.85;
    intakeOpening.position.z = 1.2;
    intakeOpening.material   = darkMat;
    intakeOpening.parent     = this.root;

    // ══ WINGS ════════════════════════════════════════════════════════════════
    // F-35 has large clipped delta wings blended into the fuselage.

    // Main wing slab (very wide, medium chord, slightly swept)
    const wings = MeshBuilder.CreateBox('f35_wings', {
      width: 10.4, height: 0.16, depth: 5.4,
    }, scene);
    wings.position.y = 0.06;
    wings.position.z = -1.0;
    wings.material   = blueMat;
    wings.parent     = this.root;

    // Wing leading-edge extensions blended into forward fuselage sides
    for (const side of [-1, 1]) {
      const lex = MeshBuilder.CreateBox(`f35_lex_${side > 0 ? 'r' : 'l'}`, {
        width: 2.8, height: 0.14, depth: 4.5,
      }, scene);
      lex.position.x = side * 2.10;
      lex.position.y = 0.08;
      lex.position.z = 2.4;
      lex.material   = blueAltMat;
      lex.parent     = this.root;
    }

    // Wing tip (clipped flat edge)
    for (const side of [-1, 1]) {
      const tip = MeshBuilder.CreateBox(`f35_wingtip_${side > 0 ? 'r' : 'l'}`, {
        width: 0.35, height: 0.13, depth: 1.8,
      }, scene);
      tip.position.x = side * 5.38;
      tip.position.y = 0.06;
      tip.position.z = -1.3;
      tip.material   = darkMat;
      tip.parent     = this.root;
    }

    // ══ EMPENNAGE ════════════════════════════════════════════════════════════

    // Horizontal stabilizers (trapezoidal, slightly downswept)
    for (const side of [-1, 1]) {
      const hStab = MeshBuilder.CreateBox(`f35_hstab_${side > 0 ? 'r' : 'l'}`, {
        width: 2.8, height: 0.12, depth: 2.6,
      }, scene);
      hStab.rotation.z = side * -0.08;
      hStab.position.x = side * 2.4;
      hStab.position.y = -0.06;
      hStab.position.z = -5.6;
      hStab.material   = blueMat;
      hStab.parent     = this.root;
    }

    // Canted twin vertical stabilisers (cant ≈ 25° outward, F-35 style)
    for (const side of [-1, 1]) {
      const vStab = MeshBuilder.CreateBox(`f35_vstab_${side > 0 ? 'r' : 'l'}`, {
        width: 0.14, height: 2.8, depth: 2.6,
      }, scene);
      // Cant outward by ~22 degrees + slight toe-out along Z
      vStab.rotation.z = side * 0.38;
      vStab.position.x = side * 1.20;
      vStab.position.y = 1.30;
      vStab.position.z = -4.8;
      vStab.material   = blueAltMat;
      vStab.parent     = this.root;

      // Tail fin leading-edge cap
      const finCap = MeshBuilder.CreateCylinder(`f35_fin_cap_${side > 0 ? 'r' : 'l'}`, {
        height: 2.6, diameterTop: 0.16, diameterBottom: 0.16, tessellation: 6,
      }, scene);
      finCap.rotation.x = Math.PI / 2;
      finCap.rotation.z = side * 0.38;
      finCap.position.x = side * 0.85;
      finCap.position.y = 1.35;
      finCap.position.z = -3.7;
      finCap.material   = blueMat;
      finCap.parent     = this.root;
    }

    // ══ ENGINE NOZZLE ════════════════════════════════════════════════════════

    // Round single nozzle (F135 engine, F-35 has ONLY one engine)
    const nozzleOuter = MeshBuilder.CreateCylinder('f35_nozzle_outer', {
      height: 1.8, diameterTop: 1.10, diameterBottom: 1.45, tessellation: 14,
    }, scene);
    nozzleOuter.rotation.x = Math.PI / 2;
    nozzleOuter.position.z = -7.4;
    nozzleOuter.position.y = 0.08;
    nozzleOuter.material   = nozzleMat;
    nozzleOuter.parent     = this.root;

    // Nozzle petals (serrated stealth edge)
    const nozzlePetals = MeshBuilder.CreateCylinder('f35_nozzle_petals', {
      height: 0.4, diameterTop: 1.05, diameterBottom: 1.12, tessellation: 12,
    }, scene);
    nozzlePetals.rotation.x = Math.PI / 2;
    nozzlePetals.position.z = -8.35;
    nozzlePetals.position.y = 0.08;
    nozzlePetals.material   = darkMat;
    nozzlePetals.parent     = this.root;

    // Afterburner glow disk
    const burnerDisk = MeshBuilder.CreateCylinder('f35_burner', {
      height: 0.18, diameterTop: 0.90, diameterBottom: 0.90, tessellation: 12,
    }, scene);
    burnerDisk.rotation.x = Math.PI / 2;
    burnerDisk.position.z = -8.2;
    burnerDisk.position.y = 0.08;
    burnerDisk.material   = burnerMat;
    burnerDisk.parent     = this.root;

    // ══ LANDING GEAR ════════════════════════════════════════════════════════
    // The image shows all three gear legs extended.

    // ── Nose gear ────────────────────────────────────────────────────────────
    const noseLeg = MeshBuilder.CreateCylinder('f35_nose_leg', {
      height: 1.05, diameter: 0.10, tessellation: 6,
    }, scene);
    noseLeg.position.y = -1.28;
    noseLeg.position.z = 4.0;
    noseLeg.material   = gearMat;
    noseLeg.parent     = this.root;

    const noseWheel = MeshBuilder.CreateCylinder('f35_nose_wheel', {
      height: 0.22, diameterTop: 0.38, diameterBottom: 0.38, tessellation: 12,
    }, scene);
    noseWheel.rotation.z = Math.PI / 2;
    noseWheel.position.y = -1.85;
    noseWheel.position.z = 4.0;
    noseWheel.material   = tireMat;
    noseWheel.parent     = this.root;

    // Nose gear door (partial open)
    const noseDoor = MeshBuilder.CreateBox('f35_nose_door', {
      width: 0.60, height: 0.06, depth: 0.55,
    }, scene);
    noseDoor.rotation.x = 0.4;
    noseDoor.position.y = -0.82;
    noseDoor.position.z = 4.3;
    noseDoor.material   = blueAltMat;
    noseDoor.parent     = this.root;

    // ── Main gear (two legs) ──────────────────────────────────────────────────
    for (const side of [-1, 1]) {
      const legX = side * 2.6;

      // Main strut
      const mainLeg = MeshBuilder.CreateCylinder(`f35_main_leg_${side > 0 ? 'r' : 'l'}`, {
        height: 1.25, diameter: 0.13, tessellation: 6,
      }, scene);
      mainLeg.position.x = legX;
      mainLeg.position.y = -1.30;
      mainLeg.position.z = -0.8;
      mainLeg.material   = gearMat;
      mainLeg.parent     = this.root;

      // Axle
      const axle = MeshBuilder.CreateCylinder(`f35_axle_${side > 0 ? 'r' : 'l'}`, {
        height: 0.45, diameter: 0.08, tessellation: 6,
      }, scene);
      axle.rotation.z = Math.PI / 2;
      axle.position.x = legX;
      axle.position.y = -1.95;
      axle.position.z = -0.8;
      axle.material   = gearMat;
      axle.parent     = this.root;

      // Dual main wheels
      for (const wSide of [-1, 1]) {
        const wheel = MeshBuilder.CreateCylinder(
          `f35_main_wheel_${side > 0 ? 'r' : 'l'}_${wSide > 0 ? 'a' : 'b'}`,
          { height: 0.26, diameterTop: 0.50, diameterBottom: 0.50, tessellation: 14 },
          scene,
        );
        wheel.rotation.z = Math.PI / 2;
        wheel.position.x = legX + wSide * 0.20;
        wheel.position.y = -1.96;
        wheel.position.z = -0.8;
        wheel.material   = tireMat;
        wheel.parent     = this.root;
      }

      // Main gear door
      const mainDoor = MeshBuilder.CreateBox(`f35_main_door_${side > 0 ? 'r' : 'l'}`, {
        width: 0.75, height: 0.06, depth: 0.80,
      }, scene);
      mainDoor.rotation.z = side * 0.45;
      mainDoor.position.x = side * 2.2;
      mainDoor.position.y = -0.75;
      mainDoor.position.z = -0.8;
      mainDoor.material   = blueAltMat;
      mainDoor.parent     = this.root;
    }

    // ══ FINISH ═══════════════════════════════════════════════════════════════
    // Disable picking/collision on every child mesh for performance
    for (const mesh of this.root.getChildMeshes()) {
      mesh.isPickable      = false;
      mesh.checkCollisions = false;
    }
  }

  // ─── Per-frame update ─────────────────────────────────────────────────────

  apply(state: Readonly<FlightState>): void {
    const r = this.root;
    r.position.copyFromFloats(state.x, state.y, state.z);
    r.rotation.x = -state.pitch;
    r.rotation.y = state.yaw;
    r.rotation.z = -state.roll;
  }

  dispose(): void {
    this.root.dispose(false, true);
  }
}
