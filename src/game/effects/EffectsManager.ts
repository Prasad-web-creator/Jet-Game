import type { Scene } from '@babylonjs/core/scene';

/**
 * EffectsManager — manages visual effects (particles, explosions, trails).
 *
 * Future responsibilities:
 * - Engine exhaust/afterburner trails
 * - Missile smoke trails
 * - Explosions (air and ground)
 * - Bullet tracers
 * - Damage smoke/fire on aircraft
 * - Vapor trails at high speed
 */
export class EffectsManager {
  scene: Scene | null = null;

  initialize(scene: Scene): void {
    this.scene = scene;
    console.log('EffectsManager: Initialized.');
  }

  dispose(): void {
    this.scene = null;
  }
}
