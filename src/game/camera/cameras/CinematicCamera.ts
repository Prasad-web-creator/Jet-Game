import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { ICamera, CameraContext } from '../ICamera';
import type { FlightState } from '../../aircraft/FlightPhysics';

/**
 * CinematicCamera — stub for future mission cutscenes and briefings.
 *
 * ─── Current behaviour ───────────────────────────────────────────────────────
 *
 *   Positions itself 120 m to the side and 60 m above the aircraft,
 *   looking toward the aircraft. Does not follow or interpolate — this is
 *   intentional for cinematic effect (the aircraft flies through the frame).
 *
 * ─── Future use ──────────────────────────────────────────────────────────────
 *
 *   This camera will receive a spline path or waypoint list for mission
 *   intro/outro cutscenes. The `update()` method will animate along that path.
 *   For now, update() is a no-op — the camera stays at its activate() position.
 *
 * ─── Configuration ───────────────────────────────────────────────────────────
 *
 *   BASE_FOV = 0.78 rad (~45°) — narrow cinematic FOV
 */
export class CinematicCamera implements ICamera {
  private readonly BASE_FOV = 0.78;
  private _cam!:    FreeCamera;
  private _look   = new Vector3();

  get babylonCamera(): FreeCamera { return this._cam; }
  get baseFov():       number     { return this.BASE_FOV; }

  create(scene: Scene, spawnState: Readonly<FlightState>): void {
    const startPos = this._computeSidePos(spawnState);
    this._cam      = new FreeCamera('cinematicCamera', startPos, scene);
    this._cam.fov  = this.BASE_FOV;
    this._cam.minZ = 0.5;
    this._cam.maxZ = 60000;

    this._look.copyFromFloats(spawnState.x, spawnState.y, spawnState.z);
    this._cam.setTarget(this._look);
  }

  snapToState(state: Readonly<FlightState>): void {
    // Reposition to side angle of current aircraft location
    const pos = this._computeSidePos(state);
    this._cam.position.copyFrom(pos);
    this._look.copyFromFloats(state.x, state.y, state.z);
    this._cam.setTarget(this._look);
    this._cam.rotation.z = 0;
  }

  /** Stub — future: animate along a scripted spline path. */
  update(_state: Readonly<FlightState>, _dt: number, _ctx: CameraContext): void {
    // No-op intentionally. Cinematic cameras are scripted, not physics-driven.
  }

  dispose(): void {}

  private _computeSidePos(state: Readonly<FlightState>): Vector3 {
    // 120 m to the east (+X) and 60 m above
    return new Vector3(state.x + 120, state.y + 60, state.z);
  }
}
