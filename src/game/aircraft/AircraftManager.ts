import type { Scene } from '@babylonjs/core/scene';
import type { GameSystem } from '../core/GameLoop';
import type { GameState, AircraftConfig } from '../../types';

/**
 * AircraftManager — manages all aircraft entities in the scene.
 *
 * Future responsibilities:
 * - Create/destroy aircraft meshes
 * - Update aircraft positions and rotations
 * - Handle aircraft physics and flight model
 * - Manage aircraft state (throttle, health, etc.)
 */
export class AircraftManager implements GameSystem {
  readonly name = 'AircraftManager';
  scene: Scene | null = null;

  initialize(scene: Scene): void {
    this.scene = scene;
    console.log('AircraftManager: Initialized.');
  }

  /** Create a new aircraft from config. Stub for future implementation. */
  createAircraft(_config: AircraftConfig, _isPlayer: boolean): void {
    // TODO: Implement aircraft creation with Babylon.js mesh
    console.log('AircraftManager: createAircraft — not yet implemented.');
  }

  update(_deltaTime: number, _state: GameState): void {
    // TODO: Update all aircraft positions, rotations, physics
  }

  dispose(): void {
    this.scene = null;
  }
}
