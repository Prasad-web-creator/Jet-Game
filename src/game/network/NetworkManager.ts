/**
 * NetworkManager — core real-time game network system.
 *
 * Implements GameSystem so it is registered in the GameLoop alongside
 * AircraftController, WeaponManager, etc.
 *
 * Responsibilities:
 *   1. Push local aircraft state to RTDB at 20 Hz (InputBroadcaster)
 *   2. Subscribe to all other players' RTDB state
 *   3. Feed received snapshots to StateInterpolator
 *   4. Expose interpolated remote states to RemotePlayerManager
 *   5. Listen for hit events targeting local player → apply damage
 *   6. Publish local hit events when local weapons fire
 */
import { Scene } from '@babylonjs/core/scene';
import {
  ref as rtdbRef,
  set as rtdbSet,
  onValue,
  off,
  push as rtdbPush,
  onChildAdded,
  remove as rtdbRemove,
  type DatabaseReference,
  type Unsubscribe,
} from 'firebase/database';
import { collection, doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';
import { rtdb, db } from '../../firebase/firebaseApp';
import { StateInterpolator } from './StateInterpolator';
import { globalEventBus } from '../core/EventBus';
import type { GameSystem } from '../core/GameLoop';
import type { GameState } from '../../types';
import type { AircraftController } from '../aircraft/AircraftController';
import type { PlayerNetState, HitEvent, LiveScore } from '../../firebase/multiplayer/networkTypes';

const BROADCAST_INTERVAL_MS = 50; // 20 Hz

export class NetworkManager implements GameSystem {
  readonly name = 'NetworkManager';

  // ── Config ─────────────────────────────────────────────────────────────────
  private readonly _matchId:    string;
  private readonly _localUid:   string;
  private readonly _callsign:   string;

  // ── Dependencies ───────────────────────────────────────────────────────────
  private _aircraftController: AircraftController | null = null;

  // ── Interpolation ──────────────────────────────────────────────────────────
  private readonly _interpolator = new StateInterpolator();

  // ── Remote player state ────────────────────────────────────────────────────
  /** Latest interpolated snapshot per remote UID */
  private readonly _remoteStates = new Map<string, PlayerNetState>();

  // ── Scoreboard ─────────────────────────────────────────────────────────────
  private readonly _scoreboard = new Map<string, LiveScore>();

  // ── Timer ──────────────────────────────────────────────────────────────────
  private _broadcastTimer = 0;
  private _lastFsBroadcastTime = 0;

  // ── Network refs ───────────────────────────────────────────────────────────
  private _playersRef:         DatabaseReference | null = null;
  private _eventsRef:          DatabaseReference | null = null;
  private _scoreRef:           DatabaseReference | null = null;
  private _unsubPlayers:       Unsubscribe | null = null;
  private _unsubEvents:        Unsubscribe | null = null;
  private _unsubScore:         Unsubscribe | null = null;
  private _unsubFirestoreLive: (() => void) | null = null;

  constructor(matchId: string, localUid: string, callsign: string) {
    this._matchId  = matchId;
    this._localUid = localUid;
    this._callsign = callsign;
  }

  setAircraftController(ac: AircraftController): void {
    this._aircraftController = ac;
  }

  // ─── GameSystem ─────────────────────────────────────────────────────────────

  initialize(_scene: Scene): void {
    const base = `matches/${this._matchId}`;
    this._playersRef = rtdbRef(rtdb, `${base}/players`);
    this._eventsRef  = rtdbRef(rtdb, `${base}/events`);
    this._scoreRef   = rtdbRef(rtdb, `${base}/scoreboard`);

    // Subscribe to remote players via RTDB (WebSocket channel)
    this._unsubPlayers = onValue(this._playersRef, (snap) => {
      const data = snap.val() as Record<string, PlayerNetState> | null;
      if (!data) return;
      for (const [uid, state] of Object.entries(data)) {
        if (uid === this._localUid) continue; // skip self
        this._interpolator.push(uid, state);
        this._remoteStates.set(uid, state);
      }
    });

    // Dual-channel Firestore live listener fallback (guarantees sync even if RTDB is blocked/unconfigured)
    const livePlayersCol = collection(db, 'matches', this._matchId, 'live_players');
    this._unsubFirestoreLive = onSnapshot(livePlayersCol, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const state = change.doc.data() as PlayerNetState;
        if (change.type === 'removed') {
          if (state?.uid && state.uid !== this._localUid) {
            this._remoteStates.delete(state.uid);
          }
        } else if (state && state.uid && state.uid !== this._localUid) {
          this._interpolator.push(state.uid, state);
          this._remoteStates.set(state.uid, state);
        }
      });
    }, (err) => {
      console.warn('[NetworkManager] Firestore live sync notice:', err);
    });

    // Subscribe to incoming hit events (only care about events targeting us)
    this._unsubEvents = onChildAdded(this._eventsRef, (snap) => {
      const evt = snap.val() as HitEvent;
      if (!evt) return;
      if (evt.targetUid !== this._localUid) return;
      if (!evt.confirmed) return; // wait for confirmation

      this._aircraftController?.takeDamage({
        amount:   evt.damage,
        sourceId: evt.sourceUid,
        type:     evt.type === 'missile_hit' ? 'missile' : 'bullet',
        hitPosition: evt.pos,
      });
    });

    // Subscribe to live scoreboard
    this._unsubScore = onValue(this._scoreRef, (snap) => {
      const data = snap.val() as Record<string, LiveScore> | null;
      if (!data) return;
      this._scoreboard.clear();
      for (const [uid, score] of Object.entries(data)) {
        this._scoreboard.set(uid, score);
      }
    });

    console.log(`[NetworkManager] Connected to match ${this._matchId} as ${this._callsign}`);
  }

  update(dt: number, _state: GameState): void {
    this._broadcastTimer += dt * 1000; // dt is in seconds

    if (this._broadcastTimer >= BROADCAST_INTERVAL_MS) {
      this._broadcastTimer -= BROADCAST_INTERVAL_MS;
      this._broadcastState();
    }
  }

  // ─── Broadcast ──────────────────────────────────────────────────────────────

  private _broadcastState(): void {
    if (!this._aircraftController || !this._playersRef) return;
    const fs = this._aircraftController.getFlightState();

    const snap: PlayerNetState = {
      uid:              this._localUid,
      x:                fs.x,
      y:                fs.y,
      z:                fs.z,
      pitch:            fs.pitch,
      yaw:              fs.yaw,
      roll:             fs.roll,
      speed:            fs.speed,
      health:           this._aircraftController.getHealth(),
      boostFuel:        fs.boostFuel,
      isBoosting:       fs.isBoosting,
      gunFiring:        this._aircraftController.isGunFiring(),
      missileFiring:    this._aircraftController.isMissileFiring(),
      missileTargetUid: null,
      t:                Date.now(),
    };

    // Fast 20 Hz WebSocket RTDB stream
    rtdbSet(rtdbRef(rtdb, `matches/${this._matchId}/players/${this._localUid}`), snap)
      .catch(() => {});

    // Throttled 4 Hz (250ms) Firestore fallback stream (avoids Firestore rate-limiting)
    const now = Date.now();
    if (now - this._lastFsBroadcastTime >= 250) {
      this._lastFsBroadcastTime = now;
      const fsDocRef = doc(db, 'matches', this._matchId, 'live_players', this._localUid);
      setDoc(fsDocRef, snap).catch(() => {});
    }
  }

  // ─── Hit event publishing ────────────────────────────────────────────────────

  /**
   * Publish a hit event to RTDB. Called by WeaponEventBroadcaster.
   * The event is confirmed immediately (client-authority) for responsiveness;
   * a Cloud Function can later validate and revert if invalid.
   */
  publishHitEvent(event: Omit<HitEvent, 'confirmed'>): void {
    if (!this._eventsRef) return;
    const eventData: HitEvent = { ...event, confirmed: true };
    rtdbPush(this._eventsRef, eventData).catch(() => {});
  }

  /**
   * Publish a kill confirmation to RTDB scoreboard.
   */
  publishKill(killerUid: string, victimUid: string): void {
    const killerScore = this._scoreboard.get(killerUid);
    if (killerScore) {
      rtdbSet(rtdbRef(rtdb, `matches/${this._matchId}/scoreboard/${killerUid}/kills`),
        killerScore.kills + 1).catch(() => {});
    }
    const victimScore = this._scoreboard.get(victimUid);
    if (victimScore) {
      rtdbSet(rtdbRef(rtdb, `matches/${this._matchId}/scoreboard/${victimUid}/deaths`),
        victimScore.deaths + 1).catch(() => {});
    }

    globalEventBus.emit('TARGET_DESTROYED', {
      targetId:   victimUid,
      targetName: victimScore?.callsign ?? victimUid,
      position:   { x: 0, y: 0, z: 0 } as any,
    });
  }

  // ─── Getters ─────────────────────────────────────────────────────────────────

  getInterpolatedState(uid: string) {
    return this._interpolator.getState(uid);
  }

  getRemoteUids(): string[] {
    return [...this._remoteStates.keys()];
  }

  getRemoteState(uid: string): PlayerNetState | undefined {
    return this._remoteStates.get(uid);
  }

  getScoreboard(): LiveScore[] {
    return [...this._scoreboard.values()].sort((a, b) => b.kills - a.kills);
  }

  getMatchId(): string { return this._matchId; }
  getLocalUid(): string { return this._localUid; }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  dispose(): void {
    if (this._unsubFirestoreLive) {
      this._unsubFirestoreLive();
      this._unsubFirestoreLive = null;
    }
    const fsDocRef = doc(db, 'matches', this._matchId, 'live_players', this._localUid);
    deleteDoc(fsDocRef).catch(() => {});

    // Detach RTDB listeners
    if (this._playersRef && this._unsubPlayers) {
      off(this._playersRef);
      this._unsubPlayers = null;
    }
    if (this._eventsRef && this._unsubEvents) {
      off(this._eventsRef);
      this._unsubEvents = null;
    }
    if (this._scoreRef && this._unsubScore) {
      off(this._scoreRef);
      this._unsubScore = null;
    }

    // Remove local player from RTDB
    rtdbRemove(rtdbRef(rtdb, `matches/${this._matchId}/players/${this._localUid}`))
      .catch(() => {});

    this._interpolator.dispose();
    this._remoteStates.clear();
    this._scoreboard.clear();
    this._aircraftController = null;

    console.log('[NetworkManager] Disconnected.');
  }
}
