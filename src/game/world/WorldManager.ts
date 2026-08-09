import { Scene } from '@babylonjs/core/scene';
import type { GameSystem } from '../core/GameLoop';
import type { GameState } from '../../types';

// ── Terrain ──────────────────────────────────────────────────────────────────
import { OceanPlane }    from './terrain/OceanPlane';
import { IslandTerrain } from './terrain/IslandTerrain';

// ── Nature (3D Low-Poly Clouds) ──────────────────────────────────────────────
import { Clouds }        from './nature/Clouds';

// ── Zones ────────────────────────────────────────────────────────────────────
import { Airport }       from './zones/Airport';

/**
 * WorldManager — top-level orchestrator for the open-world environment.
 *
 * Implements GameSystem so it receives update() calls every frame.
 * Delegates per-frame animation to sub-systems that require it:
 *   • OceanPlane — wave shimmer (emissive colour animation)
 *   • Clouds     — 3D low-poly cloud drift
 *
 * Builds the stylized low-poly desert canyon & mesa environment:
 *   terrain (ocean, faceted island mesas, canyon bluffs) + 3D low-poly clouds + airport.
 */
export class WorldManager implements GameSystem {
  readonly name = 'WorldManager';

  scene: Scene | null = null;

  // Sub-systems that need per-frame updates
  private ocean:  OceanPlane | null = null;
  private clouds: Clouds     | null = null;

  // ─── Initialization ───────────────────────────────────────────────────────

  initialize(scene: Scene): void {
    this.scene = scene;

    console.log('[WorldManager] Building low-poly stylized world…');

    // ── 1. Terrain ──────────────────────────────────────────────────────────
    this.ocean = new OceanPlane();
    this.ocean.initialize(scene);

    const terrain = new IslandTerrain();
    terrain.initialize(scene);

    // ── 2. Nature (3D Low-Poly Faceted Clouds) ──────────────────────────────
    this.clouds = new Clouds();
    this.clouds.initialize(scene);

    // ── 3. Airport (runways & landing strip on flat valley floor) ────────────
    const airport = new Airport();
    airport.initialize(scene);

    console.log('[WorldManager] Low-poly canyon world ready.');
  }

  // ─── GameSystem ───────────────────────────────────────────────────────────

  update(deltaTime: number, state: GameState): void {
    this.ocean?.update(deltaTime, state);
    this.clouds?.update(deltaTime, state);
  }

  dispose(): void {
    this.clouds?.dispose();
    this.ocean?.dispose();
    this.clouds = null;
    this.ocean  = null;
    this.scene  = null;
  }
}
