import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { ICamera, CameraContext } from '../ICamera';
import type { FlightState } from '../../aircraft/FlightPhysics';

/**
 * CombatCamera — wide-angle pull-back camera for situational awareness.
 *
 * ─── Design ──────────────────────────────────────────────────────────────────
 *
 *   Used when enemies are present or manually selected via the F-key cycle.
 *   Sits further back than ChaseCamera (55 m vs 35 m) and higher (14 m vs 9 m),
 *   giving the player visibility of incoming threats from a wider perspective.
 *
 *   A wider BASE_FOV (1.18 rad ≈ 67°) shows more of the battlefield without
 *   distorting geometry too heavily.
 *
 *   The look target leads the aircraft further ahead (LOOK_AHEAD = 18 m) so
 *   the player can see what the aircraft is heading toward.
 *
 *   Banking is more subtle (BANK_SCALE = 0.10) compared to ChaseCamera
 *   because the wider FOV makes aggressive banking feel disorienting.
 *
 * ─── Configuration ───────────────────────────────────────────────────────────
 *
 *   CHASE_DIST   = 55 m
 *   CHASE_HEIGHT = 14 m
 *   BASE_FOV     = 1.18 rad (~67°)
 *   LOOK_AHEAD   = 18 m
 *   BANK_SCALE   = 0.10
 */
export class CombatCamera implements ICamera {
  private readonly CHASE_DIST   = 55;
  private readonly CHASE_HEIGHT = 14;
  private readonly BASE_FOV     = 1.18;
  private readonly LOOK_AHEAD   = 18;
  private readonly BANK_SCALE   = 0.10;

  private _cam!:       FreeCamera;
  private _desPos    = new Vector3();
  private _lookWant  = new Vector3();
  private _lookCurr  = new Vector3();
  private _bankAngle = 0;

  get babylonCamera(): FreeCamera { return this._cam; }
  get baseFov():       number     { return this.BASE_FOV; }

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  create(scene: Scene, spawnState: Readonly<FlightState>): void {
    const startPos = this._computeDesiredPos(spawnState, false);
    this._cam      = new FreeCamera('combatCamera', startPos.clone(), scene);
    this._cam.fov  = this.BASE_FOV;
    this._cam.minZ = 0.5;
    this._cam.maxZ = 40000;
    this._lookCurr.copyFromFloats(spawnState.x, spawnState.y, spawnState.z);
  }

  snapToState(state: Readonly<FlightState>): void {
    const pos = this._computeDesiredPos(state, false);
    this._cam.position.copyFrom(pos);
    this._lookCurr.copyFromFloats(state.x, state.y, state.z);
    this._bankAngle = 0;
    this._cam.rotation.z = 0;
  }

  // ─── Per-frame ──────────────────────────────────────────────────────────────

  update(state: Readonly<FlightState>, dt: number, ctx: CameraContext): void {
    const rollIntensity = Math.abs(state.roll) / Math.PI;
    const posK  = 5 + rollIntensity * 3; // slightly slower than chase for weight feel
    const posLf = 1 - Math.exp(-posK * dt);

    // ── Position ──────────────────────────────────────────────────────────
    const des = this._computeDesiredPos(state, ctx.lookBack);
    this._cam.position.x += (des.x - this._cam.position.x) * posLf;
    this._cam.position.y += (des.y - this._cam.position.y) * posLf;
    this._cam.position.z += (des.z - this._cam.position.z) * posLf;

    // ── Look target ───────────────────────────────────────────────────────
    const lookLf = 1 - Math.exp(-7 * dt);
    const fwdX   = Math.cos(state.pitch) * Math.sin(state.yaw);
    const fwdY   = Math.sin(state.pitch);
    const fwdZ   = Math.cos(state.pitch) * Math.cos(state.yaw);

    if (ctx.lookBack) {
      this._lookWant.copyFromFloats(
        state.x - fwdX * 80,
        state.y,
        state.z - fwdZ * 80,
      );
    } else {
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

    // ── Banking ───────────────────────────────────────────────────────────
    const targetBank = -state.roll * this.BANK_SCALE;
    this._bankAngle += (targetBank - this._bankAngle) * posLf;
    this._cam.rotation.z = this._bankAngle;
  }

  dispose(): void {}

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private _computeDesiredPos(state: Readonly<FlightState>, lookBack: boolean): Vector3 {
    const cosP = Math.cos(state.pitch);
    const sinP = Math.sin(state.pitch);
    const cosY = Math.cos(state.yaw);
    const sinY = Math.sin(state.yaw);

    const fwdX = cosP * sinY;
    const fwdY = sinP;
    const fwdZ = cosP * cosY;

    if (lookBack) {
      return this._desPos.copyFromFloats(
        state.x + fwdX * 45,
        state.y + 6,
        state.z + fwdZ * 45,
      );
    }

    return this._desPos.copyFromFloats(
      state.x - fwdX * this.CHASE_DIST,
      state.y - fwdY * this.CHASE_DIST + this.CHASE_HEIGHT,
      state.z - fwdZ * this.CHASE_DIST,
    );
  }
}
