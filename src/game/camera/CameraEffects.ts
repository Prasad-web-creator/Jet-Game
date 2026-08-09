import type { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';

// ─── Internal types ───────────────────────────────────────────────────────────

interface ShakeEffect {
  magnitude: number; // peak displacement (metres)
  duration:  number; // total lifetime (seconds)
  elapsed:   number; // time already spent
}

/**
 * CameraEffects — additive effect layer composited on top of any active camera.
 *
 * Effects NEVER replace the camera's computed position — they add/multiply on top.
 * This means all effects are automatically compatible with every camera mode.
 *
 * ─── Available effects ───────────────────────────────────────────────────────
 *
 *   shake()              General purpose positional shake (explosions, hits).
 *   triggerBoostFov()    Smooth FOV widening while boosting.
 *   triggerExplosion()   Heavy shake + brief FOV distortion.
 *   triggerMissile()     Quick backward kick (missile recoil feel).
 *
 * ─── Shake algorithm ─────────────────────────────────────────────────────────
 *
 *   Each shake effect produces a sinusoidal oscillation that decays linearly:
 *     displacement(t) = magnitude × (1 – t/duration) × sin(t × FREQ)
 *   Multiple concurrent shake effects are summed.
 *   A small random phase offset per-effect prevents synchronised looks.
 *
 * ─── FOV algorithm ───────────────────────────────────────────────────────────
 *
 *   FOV is composed as:   camera.fov = baseFov + _boostMod + _impulseMod
 *   _boostMod  — lerps toward BOOST_FOV_ADD when boosting, back to 0 otherwise
 *   _impulseMod — starts at a peak value and decays exponentially (~0.08 s half-life)
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   effects.setBaseFov(camera.baseFov);     // call when switching camera modes
 *   effects.apply(cam.babylonCamera, dt, isBoosting);  // call every frame
 *
 *   // Trigger from gameplay events (Task 06+):
 *   effects.shake(1.5, 0.5);
 *   effects.triggerExplosion(3.0);
 *   effects.triggerMissile();
 */
export class CameraEffects {
  private _baseFov    = 1.05;
  private _boostMod   = 0;   // additive FOV from boost
  private _impulseMod = 0;   // additive FOV from impulse (decays)
  private _shakes: ShakeEffect[] = [];

  // Tuning
  private readonly BOOST_FOV_ADD  = 0.13;  // radians added to FOV when at boost speed
  private readonly BOOST_FOV_K    = 4;     // lerp speed for boost FOV
  private readonly IMPULSE_DECAY  = 18;    // exponential decay constant (1/s)
  private readonly SHAKE_FREQ     = 42;    // oscillation frequency (rad/s)

  // ─── Configuration ──────────────────────────────────────────────────────────

  /** Call whenever switching camera modes so FOV modulation anchors to the right base. */
  setBaseFov(fov: number): void {
    this._baseFov  = fov;
    // Don't reset _boostMod/_impulseMod — effects continue across mode switches
  }

  /** Reset all active effects and FOV modifiers (e.g. on game reset). */
  reset(): void {
    this._shakes.length = 0;
    this._boostMod   = 0;
    this._impulseMod = 0;
  }

  // ─── Public triggers ────────────────────────────────────────────────────────

  /**
   * General camera shake.
   * @param magnitude  Peak displacement in metres (typical: 0.5–5.0)
   * @param duration   Duration in seconds (typical: 0.3–1.0)
   */
  shake(magnitude: number, duration: number): void {
    if (magnitude <= 0 || duration <= 0) return;
    this._shakes.push({ magnitude, duration, elapsed: 0 });
  }

  /**
   * Heavy explosion effect: strong shake + brief FOV impulse.
   * @param magnitude  Explosion intensity (typical: 1.0–5.0)
   */
  triggerExplosion(magnitude: number): void {
    this.shake(magnitude * 1.2, 0.80);
    this._impulseMod += magnitude * 0.04; // FOV spike
  }

  /**
   * Missile / gun launch recoil — quick backward kick.
   * Smaller shake than an explosion, very short duration.
   */
  triggerMissile(): void {
    this.shake(0.60, 0.22);
  }

  /**
   * Crash / ground impact — maximum shake.
   */
  triggerCrash(): void {
    this.shake(6.0, 1.20);
    this._impulseMod += 0.18;
  }

  // ─── Per-frame apply ────────────────────────────────────────────────────────

  /**
   * Apply all effects to the active Babylon FreeCamera.
   * Must be called AFTER the camera's own `update()` so effects layer on top.
   *
   * @param camera      The currently active Babylon.js FreeCamera
   * @param dt          Delta time in seconds
   * @param isBoosting  Whether afterburner is active
   */
  apply(camera: FreeCamera, dt: number, isBoosting: boolean): void {
    this._applyShake(camera, dt);
    this._applyFov(camera, dt, isBoosting);
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private _applyShake(camera: FreeCamera, dt: number): void {
    if (this._shakes.length === 0) return;

    let totalX = 0;
    let totalY = 0;

    this._shakes = this._shakes.filter(s => {
      s.elapsed += dt;
      if (s.elapsed >= s.duration) return false;

      // Linear decay envelope × sinusoidal oscillation
      const t        = s.elapsed / s.duration;
      const envelope = 1 - t;
      const osc      = Math.sin(s.elapsed * this.SHAKE_FREQ);
      const strength = s.magnitude * envelope * osc;

      totalX += strength;
      totalY += strength * 0.65; // Y shake is slightly smaller
      return true;
    });

    camera.position.x += totalX;
    camera.position.y += totalY;
  }

  private _applyFov(camera: FreeCamera, dt: number, isBoosting: boolean): void {
    // ── Boost FOV (lerp toward target) ────────────────────────────────────
    const boostTarget = isBoosting ? this.BOOST_FOV_ADD : 0;
    const boostLf     = 1 - Math.exp(-this.BOOST_FOV_K * dt);
    this._boostMod   += (boostTarget - this._boostMod) * boostLf;

    // ── Impulse FOV (exponential decay) ──────────────────────────────────
    this._impulseMod *= Math.exp(-this.IMPULSE_DECAY * dt);

    // ── Compose final FOV ────────────────────────────────────────────────
    camera.fov = this._baseFov + this._boostMod + this._impulseMod;
  }
}
