import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { ICamera, CameraContext } from '../ICamera';
import type { FlightState } from '../../aircraft/FlightPhysics';

/**
 * CockpitCamera — first-person view from inside the aircraft canopy.
 *
 * ─── Design ──────────────────────────────────────────────────────────────────
 *
 *   • Positioned FWD_OFFSET m ahead of the aircraft's centre of mass,
 *     UP_OFFSET m above — placing the viewpoint inside the canopy glass.
 *   • Snappy position lerp (k = 25) — near-instant repositioning so there
 *     is no "floating" delay in first-person.
 *   • Full 1:1 banking: `rotation.z = –state.roll` so the horizon truly
 *     tilts when banking, matching the pilot's perspective exactly.
 *   • Tab look-back reverses the look direction to show the rear arc.
 *
 * ─── Configuration ───────────────────────────────────────────────────────────
 *
 *   FWD_OFFSET  = 2 m   — forward along aircraft axis
 *   UP_OFFSET   = 1.5 m — above aircraft centre
 *   BASE_FOV    = 0.92 rad (~53°) — slightly narrower for immersion
 *   LOOK_DIST   = 800 m — distance of the forward look target
 */
export class CockpitCamera implements ICamera {
  private readonly FWD_OFFSET = 2;
  private readonly UP_OFFSET  = 1.5;
  private readonly BASE_FOV   = 0.92;
  private readonly LOOK_DIST  = 800;

  private _cam!:    FreeCamera;
  private _posVec = new Vector3(); // reused position vector
  private _look   = new Vector3(); // reused look-target vector

  get babylonCamera(): FreeCamera { return this._cam; }
  get baseFov():       number     { return this.BASE_FOV; }

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  create(scene: Scene, spawnState: Readonly<FlightState>): void {
    const startPos = this._computePos(spawnState);
    this._cam      = new FreeCamera('cockpitCamera', startPos.clone(), scene);
    this._cam.fov  = this.BASE_FOV;
    this._cam.minZ = 0.05; // very near clip — needed inside the canopy
    this._cam.maxZ = 40000;
  }

  snapToState(state: Readonly<FlightState>): void {
    // Snap instantly to cockpit position
    this._cam.position.copyFrom(this._computePos(state));
    this._cam.rotation.z = -state.roll;
  }

  // ─── Per-frame ──────────────────────────────────────────────────────────────

  update(state: Readonly<FlightState>, dt: number, ctx: CameraContext): void {
    const lf = 1 - Math.exp(-25 * dt); // very snappy

    // ── Position ──────────────────────────────────────────────────────────
    const pos = this._computePos(state);
    this._cam.position.x += (pos.x - this._cam.position.x) * lf;
    this._cam.position.y += (pos.y - this._cam.position.y) * lf;
    this._cam.position.z += (pos.z - this._cam.position.z) * lf;

    // ── Forward direction ─────────────────────────────────────────────────
    const cosP = Math.cos(state.pitch);
    const sinP = Math.sin(state.pitch);
    const cosY = Math.cos(state.yaw);
    const sinY = Math.sin(state.yaw);

    const fwdX = cosP * sinY;
    const fwdY = sinP;
    const fwdZ = cosP * cosY;

    if (ctx.lookBack) {
      // Reverse look direction — pilot looking over shoulder
      this._look.copyFromFloats(
        state.x - fwdX * this.LOOK_DIST,
        state.y - fwdY * this.LOOK_DIST,
        state.z - fwdZ * this.LOOK_DIST,
      );
    } else {
      this._look.copyFromFloats(
        state.x + fwdX * this.LOOK_DIST,
        state.y + fwdY * this.LOOK_DIST,
        state.z + fwdZ * this.LOOK_DIST,
      );
    }

    this._cam.setTarget(this._look);

    // Full 1:1 banking — the horizon tilts exactly as the aircraft banks
    this._cam.rotation.z = -state.roll;
  }

  dispose(): void {}

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private _computePos(state: Readonly<FlightState>): Vector3 {
    const cosP = Math.cos(state.pitch);
    const sinP = Math.sin(state.pitch);
    const cosY = Math.cos(state.yaw);
    const sinY = Math.sin(state.yaw);

    const fwdX = cosP * sinY;
    const fwdY = sinP;
    const fwdZ = cosP * cosY;

    return this._posVec.copyFromFloats(
      state.x + fwdX * this.FWD_OFFSET,
      state.y + fwdY * this.FWD_OFFSET + this.UP_OFFSET,
      state.z + fwdZ * this.FWD_OFFSET,
    );
  }
}
