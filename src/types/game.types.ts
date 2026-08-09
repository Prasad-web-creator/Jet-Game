// ============================================================================
// Core Geometry & Math Types
// ============================================================================

/** 3D position in world space */
export interface Position3D {
  x: number;
  y: number;
  z: number;
}

/** 3D rotation in radians (Euler angles) */
export interface Rotation3D {
  pitch: number; // X-axis rotation
  yaw: number;   // Y-axis rotation
  roll: number;  // Z-axis rotation
}

/** 3D velocity vector */
export interface Velocity3D {
  x: number;
  y: number;
  z: number;
}

// ============================================================================
// Damage System
// ============================================================================

/** Any object that can take damage */
export interface Damageable {
  readonly id: string;
  health: number;
  maxHealth: number;
  isDestroyed: boolean;
  takeDamage(info: DamageInfo): void;
}

/** Information about a damage event */
export interface DamageInfo {
  amount: number;
  sourceId: string;
  type: DamageType;
  hitPosition?: Position3D;
}

export const DamageType = {
  Bullet: 'bullet',
  Missile: 'missile',
  Collision: 'collision',
  Explosion: 'explosion',
} as const;

export type DamageType = (typeof DamageType)[keyof typeof DamageType];

// ============================================================================
// Aircraft
// ============================================================================

export const FlightPhase = {
  Parked: 'parked',
  TakeoffRoll: 'takeoff_roll',
  Rotation: 'rotation',
  Airborne: 'airborne',
} as const;

export type FlightPhase = (typeof FlightPhase)[keyof typeof FlightPhase];

/** Configuration for creating an aircraft */
export interface AircraftConfig {
  id: string;
  name: string;
  modelPath: string;
  maxSpeed: number;
  minSpeed: number;
  acceleration: number;
  turnRate: number;
  rollRate: number;
  maxHealth: number;
  weaponSlots: number;
}

/** Runtime aircraft state */
export interface Aircraft extends Damageable {
  config: AircraftConfig;
  position: Position3D;
  rotation: Rotation3D;
  velocity: Velocity3D;
  speed: number;
  throttle: number; // 0.0 - 1.0
  weapons: Weapon[];
  isPlayer: boolean;
  boostFuel: number; // 0.0 - 100.0
  flightPhase: FlightPhase;
  gearDown: boolean;
}

// ============================================================================
// Weapons
// ============================================================================

export const WeaponType = {
  MachineGun: 'machine_gun',
  Missile: 'missile',
  Bomb: 'bomb',
  Rocket: 'rocket',
} as const;

export type WeaponType = (typeof WeaponType)[keyof typeof WeaponType];

/** Configuration for a weapon type */
export interface WeaponConfig {
  id: string;
  name: string;
  type: WeaponType;
  damage: number;
  fireRate: number;       // rounds per second
  range: number;          // maximum effective range
  projectileSpeed: number;
  ammoCapacity: number;
  isHoming: boolean;      // for missiles
  blastRadius?: number;   // for explosive weapons
}

/** Runtime weapon instance on an aircraft */
export interface Weapon {
  config: WeaponConfig;
  currentAmmo: number;
  isReloading: boolean;
  cooldownRemaining: number;
}

// ============================================================================
// Enemies
// ============================================================================

export const EnemyBehavior = {
  Patrol: 'patrol',
  Chase: 'chase',
  Evade: 'evade',
  Attack: 'attack',
  Formation: 'formation',
} as const;

export type EnemyBehavior = (typeof EnemyBehavior)[keyof typeof EnemyBehavior];

/** Configuration for an enemy type */
export interface EnemyConfig {
  id: string;
  name: string;
  aircraftConfig: AircraftConfig;
  behavior: EnemyBehavior;
  aggressionLevel: number;   // 0.0 - 1.0
  skillLevel: number;        // 0.0 - 1.0
  detectionRange: number;
  defaultWeapons: WeaponConfig[];
}

/** Runtime enemy instance */
export interface Enemy extends Aircraft {
  config: AircraftConfig;
  enemyConfig: EnemyConfig;
  currentBehavior: EnemyBehavior;
  targetId: string | null;
}

// ============================================================================
// Targets
// ============================================================================

export const TargetType = {
  Aircraft: 'aircraft',
  GroundVehicle: 'ground_vehicle',
  Structure: 'structure',
  Waypoint: 'waypoint',
} as const;

export type TargetType = (typeof TargetType)[keyof typeof TargetType];

/** A lockable/trackable target */
export interface Target {
  id: string;
  type: TargetType;
  position: Position3D;
  name: string;
  isHostile: boolean;
  isLocked: boolean;
  distance?: number;
}

// ============================================================================
// Missions
// ============================================================================

export const MissionStatus = {
  Locked: 'locked',
  Available: 'available',
  Active: 'active',
  Completed: 'completed',
  Failed: 'failed',
} as const;

export type MissionStatus = (typeof MissionStatus)[keyof typeof MissionStatus];

export const ObjectiveType = {
  DestroyTarget: 'destroy_target',
  ReachLocation: 'reach_location',
  ProtectAircraft: 'protect_aircraft',
  Survive: 'survive',
  DestroyEnemyWave: 'destroy_enemy_wave',
  DestroyBase: 'destroy_base',
  EscapeArea: 'escape_area',
} as const;

export type ObjectiveType = (typeof ObjectiveType)[keyof typeof ObjectiveType];

/** A single mission objective */
export interface MissionObjective {
  id: string;
  type: ObjectiveType;
  description: string;
  targetIds?: string[];
  currentProgress?: number;
  requiredProgress?: number;
  isCompleted: boolean;
  isOptional?: boolean;
}

/** Mission definition */
export interface Mission {
  id: string;
  name: string;
  description: string;
  briefing: string;
  status: MissionStatus;
  objectives: MissionObjective[];
  rewards: MissionRewards;
  timeLimit?: number; // seconds, optional
  spawnPoint?: { position: Position3D; rotation: Rotation3D };
}

export interface MissionRewards {
  score: number;
  unlocks?: string[];
}

// ============================================================================
// Player
// ============================================================================

/** Player profile and progression */
export interface Player {
  id: string;
  name: string;
  callsign: string;
  score: number;
  totalKills: number;
  missionsCompleted: number;
  currentAircraftId: string;
  unlockedAircraftIds: string[];
  unlockedWeaponIds: string[];
}

// ============================================================================
// Game State
// ============================================================================

export const GamePhase = {
  Loading: 'loading',
  MainMenu: 'main_menu',
  Briefing: 'briefing',
  Playing: 'playing',
  Paused: 'paused',
  GameOver: 'game_over',
  Victory: 'victory',
} as const;

export type GamePhase = (typeof GamePhase)[keyof typeof GamePhase];

export const LockState = {
  None: 'none',
  Searching: 'searching',
  Locking: 'locking',
  Locked: 'locked',
  Lost: 'lost',
} as const;

export type LockState = (typeof LockState)[keyof typeof LockState];

export interface TargetLockTelemetry {
  state: LockState;
  targetId: string | null;
  targetName: string | null;
  targetPos?: Position3D;
  screenPos?: { x: number; y: number; isBehind: boolean };
  lockProgress: number; // 0.0 - 1.0
  distance?: number;
}

export interface ActiveWeaponState {
  name: string;
  ammo: number;
  maxAmmo: number;
  heat: number;        // 0.0 - 1.0
  isOverheated: boolean;
}

export interface ThreatState {
  isRadarDetected: boolean;
  samLockState: 'none' | 'locking' | 'locked' | 'inbound';
  incomingMissileCount: number;
  activeThreatName?: string;
}

/** Master game state — the single source of truth */
export interface GameState {
  phase: GamePhase;
  player: Player | null;
  currentMission: Mission | null;
  playerAircraft: Aircraft | null;
  enemies: Enemy[];
  targets: Target[];
  score: number;
  elapsedTime: number;
  isPaused: boolean;
  weaponState?: ActiveWeaponState;
  lockState?: TargetLockTelemetry;
  threatState?: ThreatState;
}

/** Initial/default game state */
export const createDefaultGameState = (): GameState => ({
  phase: GamePhase.Loading,
  player: null,
  currentMission: null,
  playerAircraft: null,
  enemies: [],
  targets: [],
  score: 0,
  elapsedTime: 0,
  isPaused: false,
  weaponState: {
    name: 'M61A1 VULCAN 20MM',
    ammo: 500,
    maxAmmo: 500,
    heat: 0,
    isOverheated: false,
  },
  lockState: {
    state: LockState.None,
    targetId: null,
    targetName: null,
    lockProgress: 0,
  },
  threatState: {
    isRadarDetected: false,
    samLockState: 'none',
    incomingMissileCount: 0,
  },
});
