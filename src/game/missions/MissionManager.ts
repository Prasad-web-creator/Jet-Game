import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { GameSystem } from '../core/GameLoop';
import type { GameState, Mission, MissionObjective } from '../../types';
import { GamePhase, TargetType, MissionStatus, FlightPhase } from '../../types';
import type { AircraftController } from '../aircraft/AircraftController';
import type { TargetManager } from '../targets/TargetManager';
import { TargetEntity } from '../targets/TargetManager';
import { MISSION_DEFINITIONS } from './definitions/missionData';
import type { MissionDefinition, EnemySpawnConfig } from './types';
import { WaypointMesh } from './WaypointMesh';
import { AlliedAircraft } from './AlliedAircraft';
import { globalEventBus } from '../core/EventBus';

export class MissionManager implements GameSystem {
  readonly name = 'MissionManager';

  private scene: Scene | null = null;
  private aircraftController: AircraftController | null = null;
  private targetManager: TargetManager | null = null;

  private activeDefinition: MissionDefinition | null = null;
  private activeMission: Mission | null = null;

  private waypoints: WaypointMesh[] = [];
  private enemyEntities: TargetEntity[] = [];
  private alliedAsset: AlliedAircraft | null = null;

  private waveTimer = 0;
  private spawnedWaves = new Set<string>();
  private waypointsSpawned = false;

  // BUG-6 FIX: pre-allocated scratch vector — no new Vector3 every frame
  private readonly _scratchPlayerPos = new Vector3();

  setDependencies(aircraftController: AircraftController, targetManager: TargetManager): void {
    this.aircraftController = aircraftController;
    this.targetManager = targetManager;
  }

  initialize(scene: Scene): void {
    this.scene = scene;

    // BUG-4 FIX: Store the listener reference so it can be removed in dispose()
    globalEventBus.on('PLAYER_DESTROYED', this._onPlayerDestroyed);

    // Auto-start Mission 1 by default if none selected
    this.startMission('m1_training');
  }

  getMissions(): Mission[] {
    return MISSION_DEFINITIONS.map((d) => d.mission);
  }

  startMission(missionId: string): boolean {
    const def = MISSION_DEFINITIONS.find((d) => d.mission.id === missionId);
    if (!def) {
      console.warn(`[MissionManager] Mission definition ${missionId} not found.`);
      return false;
    }

    this.cleanupActiveMission();

    this.activeDefinition = def;
    // Deep clone mission definition for runtime mutation
    this.activeMission = JSON.parse(JSON.stringify(def.mission));
    this.activeMission!.status = 'active';

    console.log(`[MissionManager] 🚀 STARTING MISSION: ${this.activeMission!.name}`);
    globalEventBus.emit('MISSION_STARTED', {
      missionId: this.activeMission!.id,
      name: this.activeMission!.name,
    });

    // 1. Teleport Player to Spawn Point
    if (def.spawnPoint && this.aircraftController) {
      // AircraftController handles initial positioning
    }

    // 2. Spawn Waypoint Rings
    // Deferred until aircraft is airborne (handled in update())
    this.waypointsSpawned = false;

    // 3. Spawn Allied Aircraft (if any)
    if (def.alliedAssets && def.alliedAssets.length > 0 && this.scene) {
      const a = def.alliedAssets[0];
      this.alliedAsset = new AlliedAircraft(
        a.id,
        a.name,
        this.scene,
        new Vector3(a.position.x, a.position.y, a.position.z),
        a.destination ? new Vector3(a.destination.x, a.destination.y, a.destination.z) : new Vector3(a.position.x, a.position.y, a.position.z + 2000),
        a.maxHealth
      );
    }

    this.waveTimer = 0;
    this.spawnedWaves.clear();

    return true;
  }

  update(dt: number, state: GameState): void {
    if (!this.activeMission || this.activeMission.status !== 'active' || !this.aircraftController) {
      return;
    }

    this.waveTimer += dt;
    const fs = this.aircraftController.getFlightState();
    // BUG-6 FIX: write into pre-allocated scratch — no new Vector3 each frame
    this._scratchPlayerPos.copyFromFloats(fs.x, fs.y, fs.z);

    // 1. Process Enemy Wave Spawns
    if (this.activeDefinition?.enemyWaves) {
      for (const wave of this.activeDefinition.enemyWaves) {
        if (!this.spawnedWaves.has(wave.waveId) && this.waveTimer >= wave.triggerDelay) {
          this.spawnedWaves.add(wave.waveId);
          this.spawnEnemyWave(wave.enemies);
        }
      }
    }

    // 1.5 Process Deferred Waypoints (Training Mission)
    if (!this.waypointsSpawned && fs.flightPhase === FlightPhase.Airborne && this.activeDefinition?.waypoints && this.scene) {
      this.waypointsSpawned = true;
      for (const wp of this.activeDefinition.waypoints) {
        const mesh = new WaypointMesh(
          wp.id,
          wp.name,
          this.scene,
          new Vector3(wp.position.x, wp.position.y, wp.position.z),
          wp.radius,
          wp.order
        );
        this.waypoints.push(mesh);
      }
      console.log(`[MissionManager] 🛩️ Player is airborne. Spawning ${this.activeDefinition.waypoints.length} waypoints.`);
    }

    // 2. Update Allied Aircraft (Escort)
    if (this.alliedAsset) {
      this.alliedAsset.update(dt);
      if (this.alliedAsset.isDestroyed && this.activeDefinition?.failureConditions?.alliedAssetDestroyed) {
        this.failMission(`${this.alliedAsset.name} was destroyed!`);
        return;
      }
    }

    // 3. Evaluate Objectives
    let allCompleted = true;

    for (const obj of this.activeMission.objectives) {
      if (obj.isCompleted) continue;

      switch (obj.type) {
        case 'reach_location': {
          // Check waypoints
          let passedCount = 0;
          for (const wp of this.waypoints) {
            wp.update(dt, this._scratchPlayerPos);
            if (wp.getIsPassed()) passedCount++;
          }
          obj.currentProgress = passedCount;
          if (passedCount >= (obj.requiredProgress ?? 1)) {
            obj.isCompleted = true;
            this.notifyObjectiveCompleted(obj);
          } else {
            allCompleted = false;
          }
          break;
        }

        case 'destroy_enemy_wave': {
          const destroyedCount = this.enemyEntities.filter((e) => e.isDestroyed).length;
          obj.currentProgress = destroyedCount;
          if (destroyedCount >= (obj.requiredProgress ?? this.enemyEntities.length)) {
            obj.isCompleted = true;
            this.notifyObjectiveCompleted(obj);
          } else {
            allCompleted = false;
          }
          break;
        }

        case 'destroy_base': {
          if (this.targetManager && this.activeDefinition?.targetStructureIds) {
            const activeTargets = this.targetManager.getActiveTargets();
            let destroyedBaseCount = 0;
            for (const id of this.activeDefinition.targetStructureIds) {
              const target = activeTargets.find((t) => t.id === id);
              if (!target || target.isDestroyed) destroyedBaseCount++;
            }
            obj.currentProgress = destroyedBaseCount;
            if (destroyedBaseCount >= (obj.requiredProgress ?? this.activeDefinition.targetStructureIds.length)) {
              obj.isCompleted = true;
              this.notifyObjectiveCompleted(obj);
            } else {
              allCompleted = false;
            }
          }
          break;
        }

        case 'protect_aircraft': {
          if (this.alliedAsset && !this.alliedAsset.isDestroyed) {
            // Objective completed when enemy attackers are eliminated
            const attackersDestroyed = this.enemyEntities.length > 0 && this.enemyEntities.every((e) => e.isDestroyed);
            if (attackersDestroyed) {
              obj.isCompleted = true;
              this.notifyObjectiveCompleted(obj);
            } else {
              allCompleted = false;
            }
          }
          break;
        }

        case 'destroy_target': {
          // Boss or primary target destruction
          const bossDestroyed = this.enemyEntities.some((e) => e.id.includes('boss') && e.isDestroyed);
          if (bossDestroyed) {
            obj.isCompleted = true;
            this.notifyObjectiveCompleted(obj);
          } else {
            allCompleted = false;
          }
          break;
        }
      }
    }

    // 4. Sync Mission State to GameState for React UI
    state.currentMission = this.activeMission;

    // 5. Check Overall Mission Victory
    if (allCompleted) {
      this.completeMission();
    }
  }

  private spawnEnemyWave(enemies: EnemySpawnConfig[]): void {
    if (!this.scene || !this.targetManager) return;

    for (const e of enemies) {
      const isBoss = e.type === 'ace_boss';
      const size = isBoss ? 10 : 4;

      const mat = new StandardMaterial(`enemy_mat_${e.id}`, this.scene);
      mat.diffuseColor = isBoss ? new Color3(0.95, 0.1, 0.2) : new Color3(0.9, 0.3, 0.1);
      mat.emissiveColor = isBoss ? new Color3(0.4, 0.05, 0.05) : new Color3(0.2, 0.05, 0.02);

      const mesh = MeshBuilder.CreatePolyhedron(
        e.id,
        { type: isBoss ? 2 : 1, size },
        this.scene
      );
      mesh.position.set(e.position.x, e.position.y, e.position.z);
      mesh.material = mat;

      const target = new TargetEntity(
        e.id,
        e.name,
        TargetType.Aircraft,
        mesh,
        e.health ?? (isBoss ? 500 : 100),
        size * 1.5
      );

      this.enemyEntities.push(target);
      this.targetManager.addTarget(target);
      console.log(`[MissionManager] ⚔️ SPAWNED ENEMY WAVE TARGET: ${e.name}`);
    }
  }

  private notifyObjectiveCompleted(obj: MissionObjective): void {
    console.log(`[MissionManager] ✅ OBJECTIVE COMPLETED: ${obj.description}`);
    globalEventBus.emit('OBJECTIVE_UPDATED', {
      objectiveId: obj.id,
      isCompleted: true,
      description: obj.description,
    });
  }

  private completeMission(): void {
    if (!this.activeMission) return;

    this.activeMission.status = 'completed';
    console.log(`[MissionManager] 🏆 MISSION COMPLETED: ${this.activeMission.name}!`);

    // Unlock next mission in data definitions
    if (this.activeMission.rewards.unlocks) {
      for (const unlockId of this.activeMission.rewards.unlocks) {
        const nextDef = MISSION_DEFINITIONS.find((d) => d.mission.id === unlockId);
        if (nextDef) {
          nextDef.mission.status = MissionStatus.Available;
          console.log(`[MissionManager] 🔓 UNLOCKED MISSION: ${nextDef.mission.name}`);
        }
      }
    }

    globalEventBus.emit('MISSION_COMPLETED', {
      missionId: this.activeMission.id,
      name:      this.activeMission.name,
      rewards:   this.activeMission.rewards,
    });

    /**
     * BUG-7 FIX: Do NOT overwrite aircraftController._onStateUpdate.
     * Previously completeMission() called setStateUpdater() with a one-shot
     * function that replaced the existing HUD bridge callback, causing telemetry
     * (speed, altitude, health) to stop updating after mission completion.
     *
     * Instead, emit MISSION_COMPLETED (above) and let the listener in GameEngine
     * call engine.updateState({ phase: GamePhase.Victory }) — or emit a new
     * custom event that GameEngine listens for, which it does via the
     * PLAYER_DESTROYED handler pattern. Here we fire via the eventbus.
     */
    globalEventBus.emit('TARGET_DESTROYED', {
      targetId:   '_mission_complete_phase_trigger',
      targetName: 'MISSION_COMPLETE',
      position:   { x: 0, y: 0, z: 0 } as any,
    });

    // Use a short delay to allow the MISSION_COMPLETED audio to play before
    // transitioning to Victory screen.
    // The stateUpdater here is the ORIGINAL callback (not replaced) because
    // we store it separately on the class — safe to call.
    setTimeout(() => {
      this.aircraftController?.getStateUpdater()?.({ phase: GamePhase.Victory });
    }, 1800);
  }

  private failMission(reason: string): void {
    if (!this.activeMission) return;

    this.activeMission.status = 'failed';
    console.log(`[MissionManager] ❌ MISSION FAILED: ${reason}`);

    globalEventBus.emit('MISSION_FAILED', {
      missionId: this.activeMission.id,
      name: this.activeMission.name,
      reason,
    });
  }

  private cleanupActiveMission(): void {
    for (const wp of this.waypoints) wp.dispose();
    this.waypoints = [];

    this.enemyEntities = [];
    if (this.alliedAsset) {
      this.alliedAsset.dispose();
      this.alliedAsset = null;
    }
  }

  // BUG-4 FIX: Named listener so it can be removed in dispose()
  private _onPlayerDestroyed = (): void => {
    if (this.activeMission && this.activeMission.status === 'active') {
      this.failMission('Player aircraft destroyed.');
    }
  };

  dispose(): void {
    // BUG-4 FIX: Remove the PLAYER_DESTROYED listener
    globalEventBus.off('PLAYER_DESTROYED', this._onPlayerDestroyed);
    this.cleanupActiveMission();
    this.activeMission = null;
    this.activeDefinition = null;
    this.scene = null;
  }
}
