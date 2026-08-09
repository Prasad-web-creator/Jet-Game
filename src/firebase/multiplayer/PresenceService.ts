/**
 * PresenceService — manages Firebase RTDB presence & connection state listeners.
 *
 * Uses RTDB `.info/connected` and `onDisconnect()` to track active user presence
 * and notify game UI of connection status changes ('connected' | 'reconnecting' | 'disconnected').
 */
import {
  ref as rtdbRef,
  onValue,
  onDisconnect,
  set as rtdbSet,
  type Unsubscribe,
} from 'firebase/database';
import { rtdb } from '../firebaseApp';

export type ConnectionState = 'connected' | 'reconnecting' | 'disconnected';

export class PresenceService {
  private readonly _matchId: string;
  private readonly _uid:     string;
  private _unsubConnected: Unsubscribe | null = null;
  private _onStateChange?: (state: ConnectionState) => void;

  constructor(matchId: string, uid: string) {
    this._matchId = matchId;
    this._uid     = uid;
  }

  private _reconnectTimer: any = null;

  bind(onStateChange?: (state: ConnectionState) => void): void {
    this._onStateChange = onStateChange;

    const connectedRef = rtdbRef(rtdb, '.info/connected');
    const userPresenceRef = rtdbRef(rtdb, `presence/matches/${this._matchId}/${this._uid}`);

    // Initial connected state
    this._onStateChange?.('connected');

    try {
      this._unsubConnected = onValue(connectedRef, (snap) => {
        const isConn = snap.val() === true;
        if (isConn) {
          if (this._reconnectTimer) {
            clearTimeout(this._reconnectTimer);
            this._reconnectTimer = null;
          }
          this._onStateChange?.('connected');

          // Configure server-side onDisconnect trigger
          onDisconnect(userPresenceRef).set({
            connected: false,
            lastSeen:  Date.now(),
          }).catch(() => {});

          // Set local connected state
          rtdbSet(userPresenceRef, {
            connected: true,
            lastSeen:  Date.now(),
          }).catch(() => {});
        } else {
          // If offline, flag reconnecting after grace period
          if (!this._reconnectTimer && typeof navigator !== 'undefined' && !navigator.onLine) {
            this._reconnectTimer = setTimeout(() => {
              this._onStateChange?.('reconnecting');
            }, 3500);
          }
        }
      }, () => {
        // Fallback on error — keep connected if browser is online
        if (typeof navigator !== 'undefined' && navigator.onLine) {
          this._onStateChange?.('connected');
        }
      });
    } catch (_err) {
      this._onStateChange?.('connected');
    }
  }

  dispose(): void {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    if (this._unsubConnected) {
      this._unsubConnected();
      this._unsubConnected = null;
    }
    const userPresenceRef = rtdbRef(rtdb, `presence/matches/${this._matchId}/${this._uid}`);
    rtdbSet(userPresenceRef, {
      connected: false,
      lastSeen:  Date.now(),
    }).catch(() => {});
  }
}
