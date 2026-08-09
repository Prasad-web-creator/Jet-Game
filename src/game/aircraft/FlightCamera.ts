/**
 * @deprecated FlightCamera has been superseded by the full CameraManager system.
 *
 * Camera logic now lives in `src/game/camera/`:
 *   CameraManager  → orchestrator (GameSystem)
 *   ChaseCamera    → third-person chase
 *   CockpitCamera  → first-person cockpit
 *   CombatCamera   → wide-angle combat pull-back
 *   CinematicCamera→ cinematic/cutscene (stub)
 *   CameraEffects  → shake, boost FOV, explosion impulse
 *
 * This file is intentionally empty and kept only to avoid breaking any
 * residual imports during the migration period.
 */
export {};
