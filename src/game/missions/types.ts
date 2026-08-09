import type { Mission, Position3D, Rotation3D } from '../../types';

export interface WaypointConfig {
  id: string;
  name: string;
  position: Position3D;
  radius: number;
  order: number;
}

export interface EnemySpawnConfig {
  id: string;
  name: string;
  type: 'drone' | 'interceptor' | 'ace_boss';
  position: Position3D;
  health?: number;
}

export interface EnemyWaveConfig {
  waveId: string;
  triggerDelay: number; // seconds after mission start or wave start
  enemies: EnemySpawnConfig[];
}

export interface AlliedAssetConfig {
  id: string;
  name: string;
  position: Position3D;
  destination?: Position3D;
  maxHealth: number;
}

export interface MissionDefinition {
  mission: Mission;
  spawnPoint?: { position: Position3D; rotation: Rotation3D };
  waypoints?: WaypointConfig[];
  enemyWaves?: EnemyWaveConfig[];
  alliedAssets?: AlliedAssetConfig[];
  targetStructureIds?: string[];
  failureConditions?: {
    playerDestroyed?: boolean;
    alliedAssetDestroyed?: boolean;
    timeExpired?: boolean;
  };
}
