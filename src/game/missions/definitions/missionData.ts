import type { MissionDefinition } from '../types';
import { MissionStatus, ObjectiveType } from '../../../types';

export const MISSION_DEFINITIONS: MissionDefinition[] = [
  // ── MISSION 1: TRAINING FLIGHT ─────────────────────────────────────────────
  {
    mission: {
      id: 'm1_training',
      name: 'Training Flight',
      description: 'Master flight controls, throttle management, and aerial navigation.',
      briefing: 'Welcome pilot! Execute flight maneuvers and fly through the 4 aerial navigation rings positioned across the island bay.',
      status: MissionStatus.Available,
      objectives: [
        {
          id: 'obj_m1_waypoints',
          type: ObjectiveType.ReachLocation,
          description: 'Fly through 4 aerial navigation rings',
          currentProgress: 0,
          requiredProgress: 4,
          isCompleted: false,
        },
      ],
      rewards: {
        score: 500,
        unlocks: ['m2_air_interception'],
      },
    },
    spawnPoint: {
      position: { x: 0, y: 4, z: -900 },
      rotation: { pitch: 0, yaw: 0, roll: 0 },
    },
    waypoints: [
      { id: 'wp_1', name: 'WAYPOINT ALPHA', position: { x: 0, y: 180, z: -300 }, radius: 35, order: 1 },
      { id: 'wp_2', name: 'WAYPOINT BRAVO', position: { x: -250, y: 220, z: 200 }, radius: 35, order: 2 },
      { id: 'wp_3', name: 'WAYPOINT CHARLIE', position: { x: 150, y: 250, z: 700 }, radius: 35, order: 3 },
      { id: 'wp_4', name: 'WAYPOINT DELTA', position: { x: 0, y: 190, z: 1200 }, radius: 35, order: 4 },
    ],
    failureConditions: {
      playerDestroyed: true,
    },
  },

  // ── MISSION 2: AIR INTERCEPTION ───────────────────────────────────────────
  {
    mission: {
      id: 'm2_air_interception',
      name: 'Air Interception',
      description: 'Hostile interceptors have breached island airspace.',
      briefing: 'Scramble immediately! Intercept and destroy the wave of 3 hostile fighter drones approaching from the north sector.',
      status: MissionStatus.Locked,
      objectives: [
        {
          id: 'obj_m2_destroy_drones',
          type: ObjectiveType.DestroyEnemyWave,
          description: 'Destroy 3 hostile enemy fighters',
          currentProgress: 0,
          requiredProgress: 3,
          isCompleted: false,
        },
      ],
      rewards: {
        score: 1200,
        unlocks: ['m3_base_attack'],
      },
    },
    spawnPoint: {
      position: { x: 0, y: 180, z: -600 },
      rotation: { pitch: 0, yaw: 0, roll: 0 },
    },
    enemyWaves: [
      {
        waveId: 'wave_1',
        triggerDelay: 1.0,
        enemies: [
          { id: 'hostile_alpha', name: 'BANDIT ALPHA', type: 'interceptor', position: { x: -100, y: 200, z: 400 } },
          { id: 'hostile_bravo', name: 'BANDIT BRAVO', type: 'interceptor', position: { x: 100, y: 230, z: 500 } },
          { id: 'hostile_charlie', name: 'BANDIT CHARLIE', type: 'drone', position: { x: 0, y: 260, z: 700 } },
        ],
      },
    ],
    failureConditions: {
      playerDestroyed: true,
    },
  },

  // ── MISSION 3: MILITARY BASE ATTACK ───────────────────────────────────────
  {
    mission: {
      id: 'm3_base_attack',
      name: 'Military Base Attack',
      description: 'Neutralize enemy ground radar and SAM air defenses.',
      briefing: 'Commence precision strike on the enemy military stronghold. Destroy the Radar Tower and SAM Missile Battery on the Eastern Plateau.',
      status: MissionStatus.Locked,
      objectives: [
        {
          id: 'obj_m3_destroy_base',
          type: ObjectiveType.DestroyBase,
          description: 'Destroy Ground Radar Tower & SAM Battery',
          currentProgress: 0,
          requiredProgress: 2,
          isCompleted: false,
        },
      ],
      rewards: {
        score: 2500,
        unlocks: ['m4_escort'],
      },
    },
    spawnPoint: {
      position: { x: 1200, y: 220, z: -200 },
      rotation: { pitch: 0, yaw: 0.5, roll: 0 },
    },
    targetStructureIds: ['radar_bravo', 'sam_bravo_1'],
    failureConditions: {
      playerDestroyed: true,
    },
  },

  // ── MISSION 4: ESCORT MISSION ─────────────────────────────────────────────
  {
    mission: {
      id: 'm4_escort',
      name: 'Escort Mission',
      description: 'Protect allied transport aircraft "SkyKing-1".',
      briefing: 'Allied transport SkyKing-1 is flying through hostile territory. Escort the transport safely and defend it against enemy attack waves.',
      status: MissionStatus.Locked,
      objectives: [
        {
          id: 'obj_m4_protect_skyking',
          type: ObjectiveType.ProtectAircraft,
          description: 'Protect SkyKing-1 transport aircraft',
          isCompleted: false,
        },
        {
          id: 'obj_m4_clear_attackers',
          type: ObjectiveType.DestroyEnemyWave,
          description: 'Eliminate 3 hostile interceptor threats',
          currentProgress: 0,
          requiredProgress: 3,
          isCompleted: false,
        },
      ],
      rewards: {
        score: 3500,
        unlocks: ['m5_boss_battle'],
      },
    },
    spawnPoint: {
      position: { x: -400, y: 220, z: -400 },
      rotation: { pitch: 0, yaw: 0, roll: 0 },
    },
    alliedAssets: [
      {
        id: 'skyking_1',
        name: 'SkyKing-1 (Transport)',
        position: { x: -400, y: 220, z: -200 },
        destination: { x: -400, y: 220, z: 1800 },
        maxHealth: 250,
      },
    ],
    enemyWaves: [
      {
        waveId: 'escort_wave_1',
        triggerDelay: 2.0,
        enemies: [
          { id: 'escort_bandit_1', name: 'THREAT ALPHA', type: 'interceptor', position: { x: -500, y: 240, z: 400 } },
          { id: 'escort_bandit_2', name: 'THREAT BRAVO', type: 'interceptor', position: { x: -300, y: 250, z: 600 } },
          { id: 'escort_bandit_3', name: 'THREAT CHARLIE', type: 'drone', position: { x: -400, y: 270, z: 800 } },
        ],
      },
    ],
    failureConditions: {
      playerDestroyed: true,
      alliedAssetDestroyed: true,
    },
  },

  // ── MISSION 5: BOSS BATTLE ────────────────────────────────────────────────
  {
    mission: {
      id: 'm5_boss_battle',
      name: 'Boss Battle',
      description: 'Engage and destroy enemy Heavy Ace Bomber "Fortress Ace".',
      briefing: 'FINAL CONFRONTATION: Heavy Ace Bomber "Fortress Ace" and its elite fighter guards are approaching the island. Neutralize the Fortress Boss!',
      status: MissionStatus.Locked,
      objectives: [
        {
          id: 'obj_m5_destroy_boss',
          type: ObjectiveType.DestroyTarget,
          description: 'Destroy Ace Boss "Fortress Ace"',
          isCompleted: false,
        },
      ],
      rewards: {
        score: 5000,
        unlocks: [],
      },
    },
    spawnPoint: {
      position: { x: 0, y: 250, z: -800 },
      rotation: { pitch: 0, yaw: 0, roll: 0 },
    },
    enemyWaves: [
      {
        waveId: 'boss_wave',
        triggerDelay: 1.0,
        enemies: [
          { id: 'boss_fortress', name: 'FORTRESS ACE (BOSS)', type: 'ace_boss', position: { x: 0, y: 280, z: 600 }, health: 500 },
          { id: 'boss_guard_1', name: 'ACE GUARD ALPHA', type: 'interceptor', position: { x: -120, y: 280, z: 500 } },
          { id: 'boss_guard_2', name: 'ACE GUARD BRAVO', type: 'interceptor', position: { x: 120, y: 280, z: 500 } },
        ],
      },
    ],
    failureConditions: {
      playerDestroyed: true,
    },
  },
];
