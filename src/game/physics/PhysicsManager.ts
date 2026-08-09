import type { Scene } from '@babylonjs/core/scene';

/**
 * PhysicsManager — configures and manages the physics engine.
 *
 * Future responsibilities:
 * - Initialize Babylon.js physics (Havok, Ammo, or Cannon)
 * - Configure gravity
 * - Create physics impostors for aircraft and projectiles
 * - Handle collision detection and callbacks
 */
export class PhysicsManager {
  scene: Scene | null = null;

  initialize(scene: Scene): void {
    this.scene = scene;
    console.log('PhysicsManager: Initialized.');
    // TODO: Set up physics engine plugin
  }

  dispose(): void {
    this.scene = null;
  }
}
