/**
 * networkTypes.ts — Shared type definitions for the multiplayer network layer.
 *
 * These types are used by both Firebase services (LobbyService, MatchmakingService)
 * and in-game network systems (NetworkManager, RemotePlayerManager).
 */

// ─── Realtime Database — per-player aircraft snapshot ─────────────────────────

/** Aircraft state snapshot pushed to RTDB at 20 Hz by each client. */
export interface PlayerNetState {
  /** Firebase UID of the owning player */
  uid:         string;
  /** World position */
  x: number;
  y: number;
  z: number;
  /** Euler orientation (radians) */
  pitch: number;
  yaw:   number;
  roll:  number;
  /** Airspeed m/s */
  speed:     number;
  /** Health 0–100 */
  health:    number;
  /** Boost fuel 0–100 */
  boostFuel: number;
  isBoosting: boolean;
  /** Weapon state flags */
  gunFiring:        boolean;
  missileFiring:    boolean;
  missileTargetUid: string | null;
  /** Unix timestamp (ms) this snapshot was created — used for interpolation */
  t: number;
}

// ─── Realtime Database — game events ──────────────────────────────────────────

export type HitEventType = 'bullet_hit' | 'missile_hit' | 'kill';

/** Hit/kill event pushed to RTDB by the shooting client. */
export interface HitEvent {
  type:       HitEventType;
  ts:         number;      // unix ms
  sourceUid:  string;
  targetUid:  string;
  damage:     number;
  pos:        { x: number; y: number; z: number };
  /** Set to true by Cloud Function (or host client) after validation */
  confirmed?: boolean;
}

// ─── Realtime Database — match meta ───────────────────────────────────────────

export interface MatchMeta {
  status:           'starting' | 'active' | 'ended';
  startedAt:        number;  // unix ms
  hostUid:          string;
  mode:             'deathmatch' | 'team_deathmatch';
  scoreLimit:       number;   // kills to win (0 = no limit)
  timeLimitSeconds: number;   // 0 = no limit
}

// ─── Firestore — lobby ────────────────────────────────────────────────────────

export interface LobbyPlayer {
  uid:        string;
  callsign:   string;
  aircraftId: string;
  isReady:    boolean;
  isHost:     boolean;
  joinedAt:   number; // unix ms
}

export interface LobbyDoc {
  id:         string;
  hostUid:    string;
  name:       string;
  mode:       'deathmatch' | 'team_deathmatch';
  maxPlayers: number;
  status:     'waiting' | 'starting' | 'in_game' | 'ended';
  matchId:    string | null;
  createdAt:  number; // unix ms
  players:    LobbyPlayer[];
}

// ─── Firestore — player profile ───────────────────────────────────────────────

export interface PlayerProfile {
  uid:                 string;
  displayName:         string;
  callsign:            string;
  level:               number;
  xp:                  number;
  credits:             number;
  totalKills:          number;
  totalDeaths:         number;
  totalWins:           number;
  missionsCompleted:   number;
  currentAircraftId:   string;
  unlockedAircraftIds: string[];
  createdAt:           number; // unix ms
  lastSeenAt:          number; // unix ms
  isAnonymous:         boolean;
}

// ─── Firestore — match record ─────────────────────────────────────────────────

export interface MatchPlayerResult {
  uid:        string;
  callsign:   string;
  kills:      number;
  deaths:     number;
  score:      number;
  placement:  number;  // 1 = winner
  xpEarned:   number;
  creditsEarned: number;
}

export interface MatchDoc {
  id:              string;
  lobbyId:         string;
  mode:            string;
  status:          'starting' | 'active' | 'ended';
  startedAt:       number; // unix ms
  endedAt:         number | null;
  durationSeconds: number;
  players:         Array<{ uid: string; callsign: string; aircraftId: string }>;
  results:         MatchPlayerResult[];
}

// ─── Scoreboard (live, from RTDB) ─────────────────────────────────────────────

export interface LiveScore {
  uid:      string;
  callsign: string;
  kills:    number;
  deaths:   number;
}

// ─── Interpolated remote state (used by RemotePlayerManager) ──────────────────

export interface InterpolatedState {
  x: number; y: number; z: number;
  pitch: number; yaw: number; roll: number;
  speed:     number;
  health:    number;
  boostFuel: number;
  isBoosting: boolean;
  gunFiring:  boolean;
  missileFiring: boolean;
}
