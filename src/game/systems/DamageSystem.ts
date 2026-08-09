import type { GameSystem } from '../core/GameLoop';
import type { GameState, DamageInfo, Damageable } from '../../types';

/**
 * DamageSystem — processes damage events and applies them to entities.
 *
 * Future responsibilities:
 * - Queue and process damage events
 * - Apply damage to Damageable entities
 * - Handle destruction (trigger explosions, remove entities)
 * - Track kill/assist attribution
 * - Damage number display events
 */
export class DamageSystem implements GameSystem {
  readonly name = 'DamageSystem';
  private pendingDamage: Array<{ target: Damageable; info: DamageInfo }> = [];

  /** Queue a damage event for processing. */
  queueDamage(target: Damageable, info: DamageInfo): void {
    this.pendingDamage.push({ target, info });
  }

  update(_deltaTime: number, _state: GameState): void {
    // Process all pending damage events
    for (const { target, info } of this.pendingDamage) {
      target.takeDamage(info);
    }
    this.pendingDamage = [];
  }

  dispose(): void {
    this.pendingDamage = [];
  }
}
