import type { Scene } from '@babylonjs/core/scene';
import type { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import type { FlightState } from '../aircraft/FlightPhysics';

// ─── Camera mode enum ─────────────────────────────────────────────────────────

export const CameraMode = {
  Chase:     'chase',
  Cockpit:   'cockpit',
  Combat:    'combat',
  Cinematic: 'cinematic',
} as const;

export type CameraMode = (typeof CameraMode)[keyof typeof CameraMode];

// ─── Per-frame context ────────────────────────────────────────────────────────

/**
 * CameraContext — lightweight struct passed to every camera `update()`.
 *
 * Contains per-frame flags derived from player input + flight state that
 * cameras use to choose look targets, apply banking, etc.
 */
export interface CameraContext {
  /** Tab held — show rear-view */
  lookBack:   boolean;
  /** Aircraft in afterburner (speed > normal max) */
  isBoosting: boolean;
  /** Air brake active */
  isBraking:  boolean;
}

// ─── ICamera — camera strategy interface ─────────────────────────────────────

/**
 * ICamera — contract all camera strategies must fulfil.
 *
 * Lifecycle:
 *   1. `create(scene, spawnState)` — called once by CameraManager.initialize()
 *      Creates the Babylon FreeCamera. Does NOT set scene.activeCamera.
 *   2. `snapToState(state)` — called when switching TO this mode.
 *      Teleports the camera to the correct position (avoids a jump-from-spawn-pos).
 *   3. `update(state, dt, ctx)` — called every frame while this is the active mode.
 *   4. `dispose()` — clean up if the camera needs to release resources.
 */
export interface ICamera {
  /** The Babylon.js FreeCamera owned by this strategy. Valid after `create()`. */
  readonly babylonCamera: FreeCamera;
  /** Base field-of-view (radians). Used by CameraEffects to compute FOV modulation. */
  readonly baseFov: number;

  create(scene: Scene, spawnState: Readonly<FlightState>): void;
  snapToState(state: Readonly<FlightState>): void;
  update(state: Readonly<FlightState>, dt: number, ctx: CameraContext): void;
  dispose(): void;
}
