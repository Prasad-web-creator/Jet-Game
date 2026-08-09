import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { GameSystem } from '../core/GameLoop';
import type { GameState } from '../../types';
import { EnemyJet } from './EnemyJet';
import type { TargetManager } from '../targets/TargetManager';
import type { AircraftController } from '../aircraft/AircraftController';

/**
 * EnemyManager — spawns 12 AI enemy fighter jets spread across the map.
 *
 * Jets fly random patrol orbits and only engage the player when within 1500 m.
 * Each jet is registered as a TargetEntity so the player can lock on and destroy them.
 */
export class EnemyManager implements GameSystem {
  readonly name = 'EnemyManager';

  private aircraftController: AircraftController | null = null;
  private targetManager: TargetManager | null = null;

  private jets: EnemyJet[] = [];

  // Pre-allocated scratch vector for player position
  private readonly _scratchPlayerPos = new Vector3();

  setDependencies(aircraftController: AircraftController, targetManager: TargetManager): void {
    this.aircraftController = aircraftController;
    this.targetManager = targetManager;
  }

  initialize(scene: Scene): void {
    // 12 enemy jets — 4 spawn visibly close to the runway so player can see them
    // immediately, and 8 more spread across the map.
    // Player spawns at (0,0,0) heading North (+Z). Close jets are 200-600m out.
    const spawns: Array<{ x: number; y: number; z: number; yaw: number; name: string }> = [
      // ── Close group (visible from runway right away) ──────────────────────
      { x:   120, y: 250, z:  400, yaw: Math.PI * 1.0,  name: 'VIPER-01' }, // directly ahead
      { x:  -200, y: 300, z:  350, yaw: Math.PI * 0.8,  name: 'VIPER-02' }, // ahead-left
      { x:   300, y: 280, z:  500, yaw: Math.PI * 1.2,  name: 'VIPER-03' }, // ahead-right
      { x:     0, y: 400, z:  600, yaw: Math.PI * 1.5,  name: 'VIPER-04' }, // high directly ahead
      // ── Mid-range group (visible once airborne) ───────────────────────────
      { x:   700, y: 350, z:  900, yaw: Math.PI * 0.5,  name: 'VIPER-05' },
      { x:  -800, y: 420, z:  800, yaw: Math.PI * 0.25, name: 'VIPER-06' },
      { x:   500, y: 300, z: -600, yaw: Math.PI * 1.75, name: 'VIPER-07' },
      { x:  -600, y: 380, z: -700, yaw: Math.PI * 0.75, name: 'VIPER-08' },
      // ── Far patrol group ──────────────────────────────────────────────────
      { x:  1800, y: 450, z:  1500, yaw: Math.PI * 1.1, name: 'VIPER-09' },
      { x: -2000, y: 380, z:  1200, yaw: Math.PI * 0.9, name: 'VIPER-10' },
      { x:  1500, y: 500, z: -1800, yaw: Math.PI * 0.3, name: 'VIPER-11' },
      { x: -1600, y: 340, z: -1500, yaw: Math.PI * 1.6, name: 'VIPER-12' },
    ];

    for (let i = 0; i < spawns.length; i++) {
      const s = spawns[i];
      const pos = new Vector3(s.x, s.y, s.z);
      const jet = new EnemyJet(`enemy_${i + 1}`, s.name, scene, pos, s.yaw);

      // Wire bullet callback: enemy bullets check against player hitbox
      jet.onFireBullet = (origin, direction) => {
        this._enemyFire(origin, direction);
      };

      this.jets.push(jet);

      // Register with TargetManager so player HUD can lock on and track them
      this.targetManager?.addTarget(jet.targetEntity);
    }

    console.log(`[EnemyManager] Spawned ${this.jets.length} AI enemy fighter jets across the map.`);
  }

  update(dt: number, _state: GameState): void {
    if (!this.aircraftController) return;

    const flightState = this.aircraftController.getFlightState();
    this._scratchPlayerPos.copyFromFloats(flightState.x, flightState.y, flightState.z);

    for (const jet of this.jets) {
      if (jet.isDestroyed) continue;
      jet.update(dt, this._scratchPlayerPos);
    }
  }

  // ─── Enemy bullet → player damage check ───────────────────────────────────────

  private _enemyFire(origin: Vector3, direction: Vector3): void {
    if (!this.aircraftController) return;

    const playerPos = this._scratchPlayerPos;

    const BULLET_RANGE  = 800;
    const PLAYER_RADIUS = 14;

    const toPlayerX = playerPos.x - origin.x;
    const toPlayerY = playerPos.y - origin.y;
    const toPlayerZ = playerPos.z - origin.z;
    const distToPlayer = Math.sqrt(toPlayerX * toPlayerX + toPlayerY * toPlayerY + toPlayerZ * toPlayerZ);

    if (distToPlayer > BULLET_RANGE) return;

    const dot = toPlayerX * direction.x + toPlayerY * direction.y + toPlayerZ * direction.z;
    if (dot <= 0) return;

    const t = Math.min(dot, BULLET_RANGE);
    const cx = origin.x + direction.x * t - playerPos.x;
    const cy = origin.y + direction.y * t - playerPos.y;
    const cz = origin.z + direction.z * t - playerPos.z;
    const closestDist = Math.sqrt(cx * cx + cy * cy + cz * cz);

    if (closestDist <= PLAYER_RADIUS) {
      this.aircraftController.takeDamage({
        amount: 8,
        sourceId: 'enemy_jet',
        type: 'bullet' as import('../../types').DamageType,
        hitPosition: { x: origin.x, y: origin.y, z: origin.z },
      });
    }
  }

  dispose(): void {
    for (const jet of this.jets) {
      jet.dispose();
    }
    this.jets = [];
  }
}
