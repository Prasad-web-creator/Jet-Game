import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { MissionRewards, LockState, FlightPhase } from '../../types';

export type GameEventMap = {
  // ── Player combat ──────────────────────────────────────────────────────────
  PLAYER_TOOK_DAMAGE:          { amount: number; sourceId: string; position: Vector3 };
  PLAYER_CRITICAL_HEALTH:      { health: number };
  PLAYER_DESTROYED:            { position: Vector3 };
  PLAYER_DAMAGE_STATE_CHANGED: { health: number; maxHealth: number; pct: number };
  PLAYER_BOOST_STARTED:        Record<string, never>;
  PLAYER_BOOST_STOPPED:        Record<string, never>;

  // ── Weapons ────────────────────────────────────────────────────────────────
  MACHINE_GUN_FIRED:  { origin: Vector3; direction: Vector3 };
  BULLET_HIT:         { position: Vector3; targetId: string; damage: number };
  MISSILE_LAUNCHED:   { origin: Vector3; targetId: string | null };
  MISSILE_HIT:        { position: Vector3; targetId: string | null; damage: number };

  // ── Targets / defenses ─────────────────────────────────────────────────────
  TARGET_DESTROYED:          { targetId: string; targetName: string; position: Vector3 };
  RADAR_DETECTION_CHANGED:   { detected: boolean; radarId: string };
  SAM_LOCK_STATE_CHANGED:    { state: 'none' | 'locking' | 'locked' | 'inbound'; samId: string };
  GROUND_DEFENSE_DESTROYED:  { id: string; name: string; position: Vector3 };

  // ── Mission lifecycle ──────────────────────────────────────────────────────
  MISSION_STARTED:    { missionId: string; name: string };
  OBJECTIVE_UPDATED:  { objectiveId: string; isCompleted: boolean; description: string };
  MISSION_COMPLETED:  { missionId: string; name: string; rewards: MissionRewards };
  MISSION_FAILED:     { missionId: string; name: string; reason: string };

  // ── HUD Telemetry (High-Frequency 60Hz) ────────────────────────────────────
  HUD_TELEMETRY_UPDATE: { 
    speed: number; 
    altitude: number; 
    heading: number; 
    pitch: number; 
    roll: number; 
    throttle: number;
    flightPhase: FlightPhase;
    gearDown: boolean;
  };
  HUD_TARGET_UPDATE: { 
    lockState: LockState | 'inbound'; // Allow inbound for threat warnings if needed, or just LockState
    targetName: string | null;
    distance: number | undefined;
    lockProgress: number;
    screenPos: { x: number; y: number; isBehind: boolean } | undefined;
  };

  // ── Combat Feed UI Event ───────────────────────────────────────────────────
  COMBAT_LOG_EVENT: {
    text:  string;
    type?: 'join' | 'spawn' | 'gun' | 'missile' | 'hit' | 'death' | 'info';
  };
};

type EventCallback<T = any> = (payload: T) => void;

/**
 * EventBus — Centralized event publish-subscribe system for decoupled communication.
 */
export class EventBus {
  private listeners = new Map<keyof GameEventMap, EventCallback[]>();

  on<K extends keyof GameEventMap>(event: K, callback: (payload: GameEventMap[K]) => void): void {
    const list = this.listeners.get(event) ?? [];
    list.push(callback as EventCallback);
    this.listeners.set(event, list);
  }

  off<K extends keyof GameEventMap>(event: K, callback: (payload: GameEventMap[K]) => void): void {
    const list = this.listeners.get(event);
    if (!list) return;
    this.listeners.set(
      event,
      list.filter((cb) => cb !== callback)
    );
  }

  emit<K extends keyof GameEventMap>(event: K, payload: GameEventMap[K]): void {
    const list = this.listeners.get(event);
    if (!list) return;
    for (const callback of list) {
      try {
        callback(payload);
      } catch (err) {
        console.error(`[EventBus] Error in listener for event ${event}:`, err);
      }
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}

// Global singleton instance for simplicity, though passing it explicitly is also fine.
// Using a singleton here for ease of access across diverse deeply nested systems.
export const globalEventBus = new EventBus();
