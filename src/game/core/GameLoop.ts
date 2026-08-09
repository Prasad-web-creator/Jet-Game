import type { GameState } from '../../types';

/**
 * GameLoop — manages the game update cycle.
 *
 * Runs once per frame (called by GameEngine's render loop).
 * Responsible for updating all game systems in the correct order.
 *
 * The actual system managers (AircraftManager, WeaponManager, etc.)
 * will be registered here in future tasks.
 */

/** Interface for any system that participates in the game loop */
export interface GameSystem {
  readonly name: string;
  update(deltaTime: number, state: GameState): void;
  dispose(): void;
}

export class GameLoop {
  private systems: GameSystem[] = [];
  private _totalTime = 0;

  get totalTime(): number {
    return this._totalTime;
  }

  /**
   * Register a game system to receive update calls.
   * Systems are updated in the order they are registered.
   */
  registerSystem(system: GameSystem): void {
    this.systems.push(system);
    console.log(`GameLoop: Registered system "${system.name}".`);
  }

  /**
   * Unregister a game system.
   */
  unregisterSystem(name: string): void {
    this.systems = this.systems.filter((s) => s.name !== name);
    console.log(`GameLoop: Unregistered system "${name}".`);
  }

  /**
   * Register an additional system that was created AFTER the main init pass.
   * Unlike registerSystem(), this does NOT call initialize() — the caller must
   * have already done that. The system simply joins the update loop.
   */
  registerAdditional(system: GameSystem): void {
    this.systems.push(system);
    console.log(`GameLoop: Registered additional system "${system.name}".`);
  }

  /**
   * Called once per frame by the GameEngine.
   * Updates all registered systems with the current delta time.
   */
  update(deltaTime: number, state: GameState): void {
    this._totalTime += deltaTime;

    for (const system of this.systems) {
      system.update(deltaTime, state);
    }
  }

  /**
   * Dispose all registered systems.
   */
  dispose(): void {
    for (const system of this.systems) {
      system.dispose();
    }
    this.systems = [];
    this._totalTime = 0;
  }
}
