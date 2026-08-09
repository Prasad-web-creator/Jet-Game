import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { ICamera, CameraContext } from '../ICamera';
import type { FlightState } from '../../aircraft/FlightPhysics';

/**
 * ChaseCamera — professional third-person chase camera.
 *
 * ─── Design principles ───────────────────────────────────────────────────────
 *
 *   • Position lerp uses frame-rate-independent exponential smoothing:
 *       `factor = 1 − exp(−k × dt)`
 *     k = 6 at level flight; rises to k = 10 at max roll for tighter turns.
 *
 *   • Look target is NOT the aircraft's raw position — it is a point
 *     LOOK_AHEAD metres ahead of the aircraft along its forward vector.
 *     This creates a "leading" effect: the camera peeks at where the
 *     jet is heading instead of staring at its tail.
 *
 *   • Look target is also lerped (k = 8) to prevent snapping during
 *     sudden direction changes.
 *
 *   • Subtle banking: after `setTarget()` sets rotation.x/y, we layer a
 *     smooth rotation.z (≤ BANK_SCALE × aircraft roll) for an immersive
 *     banking sensation. This is lerped to avoid jumps.
 *
 * ─── Configuration ───────────────────────────────────────────────────────────
 *
 *   CHASE_DIST   = 35 m  — metres behind aircraft
 *   CHASE_HEIGHT = 9 m   — metres above aircraft
 *   BASE_FOV     = 1.05 rad (~60°)
 *   LOOK_AHEAD   = 8 m   — lead offset on look target
 *   BANK_SCALE   = 0.18  — fraction of aircraft roll applied to camera (0=none, 1=full)
 */
export class ChaseCamera implements ICamera {
  private readonly CHASE_DIST   = 12;   // metres behind aircraft
  private readonly CHASE_HEIGHT = 5;    // metres above aircraft
  private readonly BASE_FOV     = 0.95;
  private readonly LOOK_AHEAD   = 5;
  private readonly BANK_SCALE   = 0.18;

  private _cam!:       FreeCamera;
  private _desPos    = new Vector3(); // desired position (reused)
  private _lookWant  = new Vector3(); // where we want to look
  private _lookCurr  = new Vector3(); // current lerped look target
  private _bankAngle = 0;            // current camera bank angle (lerped)

  get babylonCamera(): FreeCamera { return this._cam; }
  get baseFov():       number     { return this.BASE_FOV; }

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  create(scene: Scene, spawnState: Readonly<FlightState>): void {
    const startPos = this._computeDesiredPos(spawnState, false);
    this._cam      = new FreeCamera('chaseCamera', startPos.clone(), scene);
    this._cam.fov  = this.BASE_FOV;
    this._cam.minZ = 0.5;
    this._cam.maxZ = 40000;
    // Internal look state initialised to aircraft position
    this._lookCurr.copyFromFloats(spawnState.x, spawnState.y, spawnState.z);
    this._bankAngle = 0;
  }

  snapToState(state: Readonly<FlightState>): void {
    // Teleport to correct chase position so the first lerp frame is smooth
    const pos = this._computeDesiredPos(state, false);
    this._cam.position.copyFrom(pos);
    this._lookCurr.copyFromFloats(state.x, state.y, state.z);
    this._bankAngle = 0;
    this._cam.rotation.z = 0;
  }

  // ─── Per-frame ──────────────────────────────────────────────────────────────

  update(state: Readonly<FlightState>, dt: number, ctx: CameraContext): void {
    // Adaptive position smoothing — tighter during rolls for a "reactive" feel
    const rollIntensity = Math.abs(state.roll) / Math.PI; // 0 → 1
    const posK  = 6 + rollIntensity * 4;                  // 6 → 10
    const posLf = 1 - Math.exp(-posK * dt);

    // ── Position lerp ────────────────────────────────────────────────────
    const des = this._computeDesiredPos(state, ctx.lookBack);
    this._cam.position.x += (des.x - this._cam.position.x) * posLf;
    this._cam.position.y += (des.y - this._cam.position.y) * posLf;
    this._cam.position.z += (des.z - this._cam.position.z) * posLf;

    // ── Look target lerp ─────────────────────────────────────────────────
    const lookLf = 1 - Math.exp(-8 * dt);
    const fwdX   = Math.cos(state.targetPitch) * Math.sin(state.targetYaw);
    const fwdY   = Math.sin(state.targetPitch);
    const fwdZ   = Math.cos(state.targetPitch) * Math.cos(state.targetYaw);

    if (ctx.lookBack) {
      // Camera is in front → look behind the aircraft
      this._lookWant.copyFromFloats(
        state.x - fwdX * 60,
        state.y,
        state.z - fwdZ * 60,
      );
    } else {
      // Lead the look slightly ahead of the aircraft
      this._lookWant.copyFromFloats(
        state.x + fwdX * this.LOOK_AHEAD,
        state.y + fwdY * this.LOOK_AHEAD,
        state.z + fwdZ * this.LOOK_AHEAD,
      );
    }

    this._lookCurr.x += (this._lookWant.x - this._lookCurr.x) * lookLf;
    this._lookCurr.y += (this._lookWant.y - this._lookCurr.y) * lookLf;
    this._lookCurr.z += (this._lookWant.z - this._lookCurr.z) * lookLf;

    this._cam.setTarget(this._lookCurr);

    // ── Camera banking (rotation.z after setTarget, which only sets x+y) ─
    const targetBank = -state.roll * this.BANK_SCALE;
    this._bankAngle += (targetBank - this._bankAngle) * posLf;
    this._cam.rotation.z = this._bankAngle;
  }

  dispose(): void { /* FreeCamera disposal handled by scene */ }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private _computeDesiredPos(state: Readonly<FlightState>, lookBack: boolean): Vector3 {
    const cosP = Math.cos(state.targetPitch);
    const sinP = Math.sin(state.targetPitch);
    const cosY = Math.cos(state.targetYaw);
    const sinY = Math.sin(state.targetYaw);

    const fwdX = cosP * sinY;
    const fwdY = sinP;
    const fwdZ = cosP * cosY;

    if (lookBack) {
      // Camera in front of aircraft, looking backward
      return this._desPos.copyFromFloats(
        state.x + fwdX * 30,
        state.y + 4,
        state.z + fwdZ * 30,
      );
    }

    // Standard chase: behind and above
    return this._desPos.copyFromFloats(
      state.x - fwdX * this.CHASE_DIST,
      state.y - fwdY * this.CHASE_DIST + this.CHASE_HEIGHT,
      state.z - fwdZ * this.CHASE_DIST,
    );
  }
}
