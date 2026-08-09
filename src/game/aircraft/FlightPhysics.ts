import type { InputSnapshot } from '../controls/InputManager';
import { FlightPhase } from '../../types';

// ─── Public types ─────────────────────────────────────────────────────────────

/** Complete runtime state of the player aircraft (physics-owned). */
export interface FlightState {
  /** World position (metres) */
  x: number;
  y: number;
  z: number;

  /**
   * Euler orientation (radians).
   *   pitch > 0 → nose UP
   *   yaw   > 0 → nose RIGHT (clockwise from above)
   *   roll  > 0 → right wing DOWN (bank right)
   */
  pitch: number;
  yaw: number;
  roll: number;

  /** Mouse aim target angles (War Thunder style) */
  targetPitch: number;
  targetYaw: number;

  /** Current airspeed (m/s) */
  speed: number;
  /** Commanded throttle 0–1 (W/S controlled). Used by HUD & speed model. */
  throttle: number;

  isBoosting: boolean;
  isBraking: boolean;

  /** Finite boost resource 0 - 100 */
  boostFuel: number;

  flightPhase: FlightPhase;
  gearDown: boolean;

  // ── Derived convenience values ────────────────────────────────────────────
  /** = y (metres above sea level) */
  altitude: number;
  /** 0–360° compass heading */
  heading: number;
  /** speed in knots */
  speedKnots: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_SPEED = 60;   // m/s (~117 kts)  — stall speed
const MAX_SPEED = 360;   // m/s (~700 kts)  — military power limit
const BOOST_SPEED = 520;   // m/s (~1011 kts) — afterburner limit
const CRUISE_SPEED = 220;   // m/s — used only for yaw coupling normalisation
const ROTATION_SPEED = 80;   // m/s (~155 kts) — minimum speed to pitch up for takeoff

const ACCEL = 50;   // m/s² — throttle-up acceleration
const NATURAL_DECEL = 25;   // m/s² — throttle-down deceleration
const BRAKE_DECEL = 90;   // m/s² — air brake
const BOOST_ACCEL = 80;   // m/s² — afterburner push

/** Rate at which commanded throttle changes (0–1 per second) */
const THROTTLE_RATE = 0.45;

/** Pitch authority (rad/s) — touch joystick Y */
const PITCH_RATE = 1.20;

/** Roll authority (rad/s) — A/D keys */
const ROLL_RATE = 2.00;

/**
 * Roll-to-yaw coupling factor.
 * A banked aircraft automatically turns — the core of the arcade feel.
 * Combined with mouse yaw for full directional control.
 */
const YAW_COUPLING = 0.55;

/**
 * Mouse sensitivity (radians per pixel of movement).
 *   400 px mouse movement → 1 rad ≈ 57°   at MOUSE_SENSITIVITY = 0.0025
 */
const MOUSE_SENSITIVITY = 0.0025;

const MAX_PITCH = Math.PI * 0.44; // ≈ ±80°
const MAX_ROLL = Math.PI * 0.88; // ≈ ±158°

const GEAR_HEIGHT = 3;     // metres — landing gear clearance above terrain
const WORLD_BOUNDARY = 13500; // metres — soft invisible map edge

/** Fallback terrain height function — flat ground at 0 m if no real terrain provided. */
const FLAT_TERRAIN: (x: number, z: number) => number = () => 0;

// ─── FlightPhysics ────────────────────────────────────────────────────────────

/**
 * FlightPhysics — arcade flight model.
 *
 * Pure math module: no Babylon.js dependency.
 * Accepts an `InputSnapshot` from `InputManager` and a delta-time,
 * then updates the internal `FlightState` accordingly.
 *
 * ─── Control model (Task 06) ─────────────────────────────────────────────────
 *
 *   Throttle   — W/↑ increases, S/↓ decreases (0–1 range, THROTTLE_RATE/s)
 *                Speed converges to `MIN_SPEED + throttle × (MAX_SPEED − MIN_SPEED)`
 *
 *   Pitch      — Mouse Y (movementY) × MOUSE_SENSITIVITY
 *                Negative movementY (mouse up) = nose up
 *                No auto-level when mouse is still — aircraft holds attitude
 *
 *   Yaw        — Mouse X (movementX) × MOUSE_SENSITIVITY × 0.5
 *                PLUS roll-to-yaw coupling (bank to turn)
 *
 *   Roll       — A/D keyboard; auto-levels exponentially when released
 *
 *   Boost      — Space: speed → BOOST_SPEED at BOOST_ACCEL
 *   Air Brake  — Shift: speed → MIN_SPEED at BRAKE_DECEL
 *
 * ─── Physics summary ─────────────────────────────────────────────────────────
 *
 *   Speed       → approaches throttle-commanded target; boost / brake override
 *   Roll        → player-driven; auto-levels when idle (Math.pow(0.025, dt))
 *   Roll→Yaw    → bank angle × YAW_COUPLING × speedFactor steers heading
 *   Pitch       → mouse-driven; no auto-level (holds last commanded attitude)
 *   Movement    → aircraft moves along its own forward vector every frame
 *   Altitude    → changes naturally via pitch; ground floor enforced
 *   Boundaries  → soft clamp at ±WORLD_BOUNDARY metres
 */
export class FlightPhysics {
  private s: FlightState;

  /** Commanded throttle (0–1) — W/S controlled, persists between frames. */
  private _throttleCmd: number;

  /**
   * Terrain height callback — injected by AircraftController (via IslandTerrain.getHeightAt).
   * Keeps FlightPhysics free of any Babylon.js imports.
   */
  private _getTerrainHeight: (x: number, z: number) => number;

  constructor(
    spawnX: number,
    spawnY: number,
    spawnZ: number,
    spawnYaw = 0,
    terrainHeightFn: (x: number, z: number) => number = FLAT_TERRAIN,
  ) {
    this._getTerrainHeight = terrainHeightFn;
    const initThrottle = 0; // Start fully stopped — player must press W/↑ to throttle up
    this._throttleCmd = initThrottle;

    this.s = {
      x: spawnX,
      y: spawnY,
      z: spawnZ,
      pitch: 0,
      yaw: spawnYaw,
      roll: 0,
      targetPitch: 0,
      targetYaw: spawnYaw,
      speed: 0,            // Fully stopped on the runway
      throttle: initThrottle,
      isBoosting: false,
      isBraking: false,
      boostFuel: 100,
      flightPhase: FlightPhase.Parked,
      gearDown: true,
      altitude: spawnY,
      heading: (spawnYaw * 180 / Math.PI + 360) % 360,
      speedKnots: 0,
    };
  }

  /** Immutable view of the current state. Do not mutate. */
  getState(): Readonly<FlightState> {
    return this.s;
  }

  // ─── Main update ──────────────────────────────────────────────────────────

  update(input: InputSnapshot, dt: number): void {
    if (input.toggleGear) {
      if (this.s.flightPhase === FlightPhase.Airborne) {
        this.s.gearDown = !this.s.gearDown;
      }
    }

    this._updateThrottle(input, dt);
    this._updateSpeed(input, dt);
    this._updateRotation(input, dt);
    this._updatePosition(dt);
    this._updateDerived();
  }

  // ─── Sub-updates ──────────────────────────────────────────────────────────

  /**
   * Throttle control (W / S).
   * Updates `_throttleCmd` and `s.throttle` — speed model uses these.
   */
  private _updateThrottle(input: InputSnapshot, dt: number): void {
    if (input.throttleUp) this._throttleCmd = Math.min(1, this._throttleCmd + THROTTLE_RATE * dt);
    if (input.throttleDown) this._throttleCmd = Math.max(0, this._throttleCmd - THROTTLE_RATE * dt);
    this.s.throttle = this._throttleCmd;
  }

  /**
   * Speed update.
   *   Normal: converge toward `MIN_SPEED + throttle × (MAX_SPEED − MIN_SPEED)`
   *   Boost:  converge toward BOOST_SPEED, drains fuel
   *   Brake:  converge toward MIN_SPEED
   */
  private _updateSpeed(input: InputSnapshot, dt: number): void {
    const s = this.s;

    // Fuel consumption and regeneration
    const BOOST_DRAIN_RATE = 25; // per second (4s total)
    const BOOST_REGEN_RATE = 15; // per second (6.6s total to recharge)

    if (input.airBrake && !input.boost) {
      // If grounded, act as wheel brakes. If airborne, air brake.
      const decel = this.s.flightPhase !== FlightPhase.Airborne ? BRAKE_DECEL * 2 : BRAKE_DECEL;
      const minS = this.s.flightPhase !== FlightPhase.Airborne ? 0 : MIN_SPEED;
      s.speed = Math.max(minS, s.speed - decel * dt);
      s.isBraking = true;
      s.isBoosting = false;
      s.boostFuel = Math.min(100, s.boostFuel + BOOST_REGEN_RATE * dt);

    } else if (input.boost && !input.airBrake && s.boostFuel > 0) {
      s.speed = Math.min(BOOST_SPEED, s.speed + BOOST_ACCEL * dt);
      s.isBoosting = true;
      s.isBraking = false;
      s.boostFuel = Math.max(0, s.boostFuel - BOOST_DRAIN_RATE * dt);

    } else {
      // Converge on the throttle-commanded target speed
      // If grounded, we can actually go down to 0 speed if throttle is 0
      const minS = this.s.flightPhase !== FlightPhase.Airborne ? 0 : MIN_SPEED;
      const targetSpeed = minS + this._throttleCmd * (MAX_SPEED - minS);
      if (s.speed < targetSpeed) {
        s.speed = Math.min(targetSpeed, s.speed + ACCEL * dt);
      } else if (s.speed > targetSpeed) {
        s.speed = Math.max(targetSpeed, s.speed - NATURAL_DECEL * dt);
      }
      s.isBoosting = false;
      s.isBraking = false;
      s.boostFuel = Math.min(100, s.boostFuel + BOOST_REGEN_RATE * dt);
    }

    // Ground phase transitions based on speed
    if (this.s.flightPhase === FlightPhase.Parked && s.speed > 1) {
      this.s.flightPhase = FlightPhase.TakeoffRoll;
    } else if (this.s.flightPhase === FlightPhase.TakeoffRoll && s.speed >= ROTATION_SPEED) {
      this.s.flightPhase = FlightPhase.Rotation;
    } else if (this.s.flightPhase === FlightPhase.Rotation && s.speed < ROTATION_SPEED) {
      this.s.flightPhase = FlightPhase.TakeoffRoll;
    } else if (this.s.flightPhase === FlightPhase.TakeoffRoll && s.speed <= 1) {
      this.s.flightPhase = FlightPhase.Parked;
    }
  }

  /**
   * Rotation update.
   *
   * Roll  — A/D keyboard; auto-levels when released.
   * Pitch — mouse Y delta (movementY → pitch change, no auto-level).
   * Yaw   — mouse X delta + roll-to-yaw coupling.
   */
  private _updateRotation(input: InputSnapshot, dt: number): void {
    const s = this.s;

    // ── Roll (A/D keyboard or touch joystick X) ───────────────────────────
    const joyDeadzone = 0.10;
    if (input.rollLeft) {
      s.roll = Math.max(-MAX_ROLL, s.roll - ROLL_RATE * dt);
    } else if (input.rollRight) {
      s.roll = Math.min(MAX_ROLL, s.roll + ROLL_RATE * dt);
    } else if (Math.abs(input.joystickX) > joyDeadzone) {
      const joyRoll = input.joystickX * ROLL_RATE * dt;
      s.roll = Math.max(-MAX_ROLL, Math.min(MAX_ROLL, s.roll + joyRoll));
    } else {
      // Auto-level: frame-rate-independent exponential decay toward 0
      s.roll *= Math.pow(0.025, dt);
    }

    // ── Mouse Aim (War Thunder style target angles) ──────────────────────────
    let targetPitchDelta = 0;
    if (input.mouseDeltaY !== 0) {
      targetPitchDelta = -input.mouseDeltaY * MOUSE_SENSITIVITY;
    } else if (Math.abs(input.joystickY) > joyDeadzone) {
      targetPitchDelta = input.joystickY * PITCH_RATE * dt;
    }

    s.targetPitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, s.targetPitch + targetPitchDelta));
    const mouseYawDelta = input.mouseDeltaX * MOUSE_SENSITIVITY * 0.5;
    s.targetYaw += mouseYawDelta;

    // ── Plane Chases Target (Lerp) ─────────────────────────────────────────
    if (this.s.flightPhase !== FlightPhase.Airborne) {
      if (this.s.flightPhase === FlightPhase.Rotation) {
        s.pitch = Math.max(0, Math.min(MAX_PITCH, s.pitch + targetPitchDelta)); // Direct control on ground
      } else {
        s.pitch *= Math.pow(0.01, dt);
      }
      s.targetPitch = s.pitch; // Keep target locked to plane on ground
    } else {
      // Airborne pitch chase
      s.pitch += (s.targetPitch - s.pitch) * 5.0 * dt;
    }

    // Yaw Lerp (with wrap around)
    let diffYaw = s.targetYaw - s.yaw;
    while (diffYaw > Math.PI) diffYaw -= Math.PI * 2;
    while (diffYaw < -Math.PI) diffYaw += Math.PI * 2;
    s.yaw += diffYaw * 5.0 * dt;

    // ── Roll Coupling ───────────────────────────────────────────────────────
    // Banking turns the plane (applied to both plane and target so they don't fight)
    const speedFactor = s.speed / CRUISE_SPEED;
    const coupledYaw = s.roll * YAW_COUPLING * speedFactor * dt;

    s.yaw += coupledYaw;
    s.targetYaw += coupledYaw;

    // Wrap yaws to [–π, π]
    while (s.yaw > Math.PI) s.yaw -= Math.PI * 2;
    while (s.yaw < -Math.PI) s.yaw += Math.PI * 2;
    while (s.targetYaw > Math.PI) s.targetYaw -= Math.PI * 2;
    while (s.targetYaw < -Math.PI) s.targetYaw += Math.PI * 2;
  }

  private _updatePosition(dt: number): void {
    const s = this.s;

    // Aircraft's forward vector from pitch + yaw (yaw=0 → +Z, yaw=π/2 → +X)
    const cosP = Math.cos(s.pitch);
    const sinP = Math.sin(s.pitch);
    const cosY = Math.cos(s.yaw);
    const sinY = Math.sin(s.yaw);

    const fwdX = cosP * sinY;
    const fwdY = sinP;
    const fwdZ = cosP * cosY;

    s.x += fwdX * s.speed * dt;
    s.y += fwdY * s.speed * dt;
    s.z += fwdZ * s.speed * dt;

    // ── Terrain-aware collision (replaces flat MIN_ALTITUDE) ─────────────────
    const terrainY = this._getTerrainHeight(s.x, s.z);
    // Floor = terrain height + landing gear clearance
    const groundFloor = Math.max(0, terrainY) + GEAR_HEIGHT;

    // Check liftoff / grounded state
    const isGroundPhase = s.flightPhase === FlightPhase.Parked || s.flightPhase === FlightPhase.TakeoffRoll || s.flightPhase === FlightPhase.Rotation;

    if (isGroundPhase) {
      if (s.pitch > 0.05 && s.speed >= ROTATION_SPEED) {
        // Sufficient speed and pitch = Liftoff!
        s.flightPhase = FlightPhase.Airborne;
      } else {
        // Keep grounded on terrain
        s.y = groundFloor;
        if (s.pitch < 0) s.pitch = 0;
      }
    } else {
      // Airborne — enforce terrain floor to prevent going underground
      if (s.y < groundFloor) {
        s.y = groundFloor;
        if (s.pitch <= 0 && s.speed < ROTATION_SPEED && s.gearDown) {
          s.flightPhase = FlightPhase.TakeoffRoll; // Touched down
        }
        if (s.pitch < 0) s.pitch = 0;
      }
    }

    // Soft world boundary
    s.x = Math.max(-WORLD_BOUNDARY, Math.min(WORLD_BOUNDARY, s.x));
    s.z = Math.max(-WORLD_BOUNDARY, Math.min(WORLD_BOUNDARY, s.z));
  }

  private _updateDerived(): void {
    const s = this.s;
    s.altitude = s.y;
    s.heading = ((s.yaw * 180 / Math.PI) + 360) % 360;
    s.speedKnots = s.speed * 1.94384;
    // throttle is now the commanded value (not derived from speed)
    // — already set in _updateThrottle(), no override needed here
  }
}
