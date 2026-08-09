import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { GameSystem } from '../core/GameLoop';
import type { GameState } from '../../types';
import type { AircraftController } from '../aircraft/AircraftController';
import type { TargetManager } from '../targets/TargetManager';
import { RadarStation } from './RadarStation';
import { SAMLauncher } from './SAMLauncher';
import { SAMMissilePool } from './SAMMissilePool';
import { AAAGun } from './AAAGun';
import { AAATracerPool } from './AAATracerPool';
import { IslandTerrain } from '../world/terrain/IslandTerrain';

export class GroundDefenseManager implements GameSystem {
  readonly name = 'GroundDefenseManager';

  private scene: Scene | null = null;
  private aircraftController: AircraftController | null = null;
  private targetManager: TargetManager | null = null;

  private samPool: SAMMissilePool | null = null;
  private tracerPool: AAATracerPool | null = null;

  private radarStations: RadarStation[] = [];
  private samLaunchers: SAMLauncher[] = [];
  private aaaGuns: AAAGun[] = [];

  // PERF: pre-allocated scratch vectors — reused every update()
  private readonly _scratchPlayerPos = new Vector3();
  private readonly _scratchPlayerVel = new Vector3();

  setDependencies(aircraftController: AircraftController, targetManager: TargetManager): void {
    this.aircraftController = aircraftController;
    this.targetManager = targetManager;
  }

  initialize(scene: Scene): void {
    this.scene = scene;
    this.samPool = new SAMMissilePool(scene, 16);
    this.tracerPool = new AAATracerPool(scene, 50);

    this.spawnDefenses();
    console.log(`[GroundDefenseManager] Initialized with ${this.radarStations.length} Radars, ${this.samLaunchers.length} SAMs, ${this.aaaGuns.length} AAA Guns.`);
  }

  // BUG-6 FIX: Startup grace period — no radar/SAM activation for first 3 seconds.
  // The player spawns at (0, 161, -800) which is within Radar BRAVO's 2600m detection
  // radius. Without this guard the player is detected, SAM-locked, and destroyed on
  // frame 1 before the scene is even visible.
  private _startupTimer = 0;
  private static readonly STARTUP_GRACE_SECONDS = 3.0;

  update(dt: number, state: GameState): void {
    if (!this.aircraftController) return;

    // Suppress all defense logic during startup grace period
    this._startupTimer += dt;
    if (this._startupTimer < GroundDefenseManager.STARTUP_GRACE_SECONDS) {
      // Keep threat state clear during grace period
      state.threatState = { isRadarDetected: false, samLockState: 'none', incomingMissileCount: 0 };
      return;
    }

    const fs = this.aircraftController.getFlightState();
    // PERF: write into pre-allocated scratch — no new Vector3
    this._scratchPlayerPos.copyFromFloats(fs.x, fs.y, fs.z);

    const cosP = Math.cos(fs.pitch);
    this._scratchPlayerVel.copyFromFloats(
      cosP * Math.sin(fs.yaw) * fs.speed,
      Math.sin(fs.pitch) * fs.speed,
      cosP * Math.cos(fs.yaw) * fs.speed,
    );

    // 1. Update Radars
    let globalRadarDetected = false;
    for (const radar of this.radarStations) {
      radar.update(dt, this._scratchPlayerPos);
      if (radar.getIsPlayerDetected()) globalRadarDetected = true;
    }

    // 2. Activate / Deactivate SAMs and AAAs
    for (const sam of this.samLaunchers) {
      sam.setActivated(globalRadarDetected);
      sam.update(dt, this._scratchPlayerPos);
    }
    for (const aaa of this.aaaGuns) {
      aaa.setActivated(globalRadarDetected);
      aaa.update(dt, this._scratchPlayerPos, this._scratchPlayerVel);
    }

    // 3. Update SAM Missiles & AAA Tracers
    this.samPool?.update(dt, this.aircraftController);
    this.tracerPool?.update(dt, this.aircraftController);

    // 4. Aggregate Threat Telemetry for HUD
    let highestSAMState: 'none' | 'locking' | 'locked' | 'inbound' = 'none';
    const statePriority = { none: 0, locking: 1, locked: 2, inbound: 3 };

    for (const sam of this.samLaunchers) {
      const s = sam.getLockState();
      if (statePriority[s] > statePriority[highestSAMState]) {
        highestSAMState = s;
      }
    }

    const incomingMissileCount = this.samPool?.getActiveMissileCount() ?? 0;
    if (incomingMissileCount > 0 && highestSAMState !== 'inbound') {
      highestSAMState = 'inbound';
    }

    state.threatState = {
      isRadarDetected: globalRadarDetected,
      samLockState: highestSAMState,
      incomingMissileCount,
    };
  }

  private spawnDefenses(): void {
    if (!this.scene || !this.targetManager || !this.samPool || !this.tracerPool) return;

    // Defense Complex Definitions (Terrain Surface Heights Calculated Automatically)
    const complexes = [
      // Complex Alpha - North Ridge
      {
        name: 'ALPHA',
        radar: { x: -1800, z: 2000 },
        sams: [{ x: -1750, z: 2050 }],
        aaas: [{ x: -1850, z: 1950 }],
      },
      // Complex Bravo - East Plateau (Main Air Defense Network)
      {
        name: 'BRAVO',
        radar: { x: 2200, z: 1200 },
        sams: [
          { x: 2150, z: 1250 },
          { x: 2250, z: 1150 },
        ],
        aaas: [
          { x: 2100, z: 1180 },
          { x: 2300, z: 1220 },
        ],
      },
      // Complex Charlie - South Ridge Outpost
      {
        name: 'CHARLIE',
        radar: null,
        sams: [{ x: 500, z: -1500 }],
        aaas: [{ x: 450, z: -1550 }],
      },
    ];

    for (const c of complexes) {
      // 1. Spawn Radar Station
      if (c.radar) {
        const h = IslandTerrain.getHeightAt(c.radar.x, c.radar.z);
        const radarPos = new Vector3(c.radar.x, h, c.radar.z);
        const radar = new RadarStation(`radar_${c.name.toLowerCase()}`, `RADAR TOWER ${c.name}`, this.scene, radarPos, 2600);
        
        this.radarStations.push(radar);
        this.targetManager.addTarget(radar.targetEntity);
      }

      // 2. Spawn SAM Launchers
      for (let i = 0; i < c.sams.length; i++) {
        const coord = c.sams[i];
        const h = IslandTerrain.getHeightAt(coord.x, coord.z);
        const samPos = new Vector3(coord.x, h, coord.z);
        const sam = new SAMLauncher(`sam_${c.name.toLowerCase()}_${i + 1}`, `SAM BATTERY ${c.name}-${i + 1}`, this.scene, samPos, this.samPool, 2200);

        this.samLaunchers.push(sam);
        this.targetManager.addTarget(sam.targetEntity);
      }

      // 3. Spawn AAA Guns
      for (let i = 0; i < c.aaas.length; i++) {
        const coord = c.aaas[i];
        const h = IslandTerrain.getHeightAt(coord.x, coord.z);
        const aaaPos = new Vector3(coord.x, h, coord.z);
        const aaa = new AAAGun(`aaa_${c.name.toLowerCase()}_${i + 1}`, `AAA GUN ${c.name}-${i + 1}`, this.scene, aaaPos, this.tracerPool, 1300);

        this.aaaGuns.push(aaa);
        this.targetManager.addTarget(aaa.targetEntity);
      }
    }
  }

  dispose(): void {
    this.samPool?.dispose();
    this.tracerPool?.dispose();

    for (const r of this.radarStations) r.dispose();
    for (const s of this.samLaunchers) s.dispose();
    for (const a of this.aaaGuns) a.dispose();

    this.radarStations = [];
    this.samLaunchers = [];
    this.aaaGuns = [];
    this.scene = null;
  }
}
