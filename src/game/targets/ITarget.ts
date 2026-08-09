import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Damageable, TargetType } from '../../types';

/** Extended Target Interface for 3D Game World Objects */
export interface ITarget extends Damageable {
  readonly name: string;
  readonly type: TargetType;
  /** Returns the current world-space position. May be cached. */
  getPosition(): Vector3;
  /**
   * Returns a direct reference to the internally cached position Vector3.
   * Callers MUST NOT mutate the returned value.
   * Preferred over getPosition() in hot update loops (no allocation).
   */
  getPositionRef(): Vector3;
  getBoundingRadius(): number;
  isHostile: boolean;
}
