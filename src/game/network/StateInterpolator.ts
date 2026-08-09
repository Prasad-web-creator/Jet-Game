/**
 * StateInterpolator — smooth interpolation for remote aircraft.
 *
 * Each remote player has a ring buffer of N received snapshots.
 * At render time, we interpolate between the two snapshots that bracket
 * the target render timestamp (= now − INTERPOLATION_DELAY_MS).
 *
 * This absorbs network jitter without causing visual stutter.
 */
import type { PlayerNetState, InterpolatedState } from '../../firebase/multiplayer/networkTypes';

/** How far behind real-time we render remote players (ms). */
const INTERPOLATION_DELAY_MS = 100;

/** Max snapshots stored per player. */
const BUFFER_SIZE = 32;

// ─── Lerp helpers ─────────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Shortest-path angle lerp (handles wrap-around). */
function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  while (diff >  Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  return a + diff * t;
}

/**
 * TimedSnapshot — internal wrapper storing both remote & local timestamps.
 */
interface TimedSnapshot {
  snap:            PlayerNetState;
  remoteTimestamp: number;
  receivedAt:      number;
}

function isFiniteNum(val: unknown): boolean {
  return typeof val === 'number' && Number.isFinite(val);
}

function isValidSnapshot(snap: PlayerNetState): boolean {
  return (
    isFiniteNum(snap.x) &&
    isFiniteNum(snap.y) &&
    isFiniteNum(snap.z) &&
    isFiniteNum(snap.pitch) &&
    isFiniteNum(snap.yaw) &&
    isFiniteNum(snap.roll) &&
    isFiniteNum(snap.speed) &&
    isFiniteNum(snap.health)
  );
}

// ─── SnapshotBuffer ───────────────────────────────────────────────────────────

class SnapshotBuffer {
  private readonly _buf: TimedSnapshot[] = [];
  private _lastRemoteTimestamp = 0;
  private _lastEstimatedLatency = 50; // ms fallback

  push(snap: PlayerNetState): boolean {
    if (!isValidSnapshot(snap)) return false;

    const now = Date.now();
    const remoteTs = isFiniteNum(snap.t) && snap.t > 0 ? snap.t : now;

    // Out-of-order packet check: discard stale/duplicate remote packets
    if (this._lastRemoteTimestamp > 0 && remoteTs <= this._lastRemoteTimestamp) {
      return false;
    }
    this._lastRemoteTimestamp = remoteTs;

    // Calculate latency estimate (clamp between 0 and 2000 ms)
    if (snap.t > 0 && snap.t <= now) {
      const lat = now - snap.t;
      if (lat >= 0 && lat <= 2000) {
        this._lastEstimatedLatency = Math.round(this._lastEstimatedLatency * 0.8 + lat * 0.2);
      }
    }

    this._buf.push({
      snap,
      remoteTimestamp: remoteTs,
      receivedAt:      now,
    });

    // Bounded buffer
    if (this._buf.length > BUFFER_SIZE) this._buf.shift();
    return true;
  }

  getEstimatedLatency(): number {
    return this._lastEstimatedLatency;
  }

  getBufferLength(): number {
    return this._buf.length;
  }

  /**
   * Find two bracketing snapshots for `renderTime` (based on `receivedAt`) and return interpolated state.
   * Never returns null if at least one snapshot has been received.
   */
  getInterpolated(renderTime: number): InterpolatedState | null {
    if (this._buf.length === 0) return null;

    // Find the two snapshots that bracket renderTime using receivedAt
    let after = -1;
    for (let i = 0; i < this._buf.length; i++) {
      if (this._buf[i].receivedAt >= renderTime) { after = i; break; }
    }

    // renderTime is past all snapshots — clamp to last known snapshot
    if (after === -1) {
      return this._stateOf(this._buf[this._buf.length - 1].snap);
    }

    // renderTime is before first snapshot — clamp to first
    if (after === 0) return this._stateOf(this._buf[0].snap);

    const before = after - 1;
    const s0 = this._buf[before];
    const s1 = this._buf[after];
    const span = s1.receivedAt - s0.receivedAt;
    if (span <= 0) return this._stateOf(s1.snap);

    const t = Math.max(0, Math.min(1, (renderTime - s0.receivedAt) / span));
    const p0 = s0.snap;
    const p1 = s1.snap;

    return {
      x:          lerp(p0.x, p1.x, t),
      y:          lerp(p0.y, p1.y, t),
      z:          lerp(p0.z, p1.z, t),
      pitch:      lerpAngle(p0.pitch, p1.pitch, t),
      yaw:        lerpAngle(p0.yaw,   p1.yaw,   t),
      roll:       lerpAngle(p0.roll,  p1.roll,  t),
      speed:      lerp(p0.speed,     p1.speed,     t),
      health:     lerp(p0.health,    p1.health,    t),
      boostFuel:  lerp(p0.boostFuel, p1.boostFuel, t),
      isBoosting: p1.isBoosting,
      gunFiring:  p1.gunFiring,
      missileFiring: p1.missileFiring,
    };
  }

  private _stateOf(s: PlayerNetState): InterpolatedState {
    return {
      x: s.x, y: s.y, z: s.z,
      pitch: s.pitch, yaw: s.yaw, roll: s.roll,
      speed: s.speed, health: s.health, boostFuel: s.boostFuel,
      isBoosting: s.isBoosting,
      gunFiring:  s.gunFiring,
      missileFiring: s.missileFiring,
    };
  }

  clear(): void {
    this._buf.length = 0;
    this._lastRemoteTimestamp = 0;
  }
}

// ─── StateInterpolator ────────────────────────────────────────────────────────

/**
 * StateInterpolator — manages one SnapshotBuffer per remote player.
 */
export class StateInterpolator {
  private readonly _buffers = new Map<string, SnapshotBuffer>();

  /** Feed a new network snapshot for a remote player. */
  push(uid: string, snap: PlayerNetState): boolean {
    let buf = this._buffers.get(uid);
    if (!buf) {
      buf = new SnapshotBuffer();
      this._buffers.set(uid, buf);
    }
    return buf.push(snap);
  }

  /**
   * Get the interpolated state for a remote player at the current render time.
   * Returns null if no data yet.
   */
  getState(uid: string): InterpolatedState | null {
    const buf = this._buffers.get(uid);
    if (!buf) return null;
    const renderTime = Date.now() - INTERPOLATION_DELAY_MS;
    return buf.getInterpolated(renderTime);
  }

  getEstimatedLatency(uid: string): number {
    return this._buffers.get(uid)?.getEstimatedLatency() ?? 0;
  }

  getBufferLength(uid: string): number {
    return this._buffers.get(uid)?.getBufferLength() ?? 0;
  }

  /** Remove buffer for a disconnected player. */
  remove(uid: string): void {
    this._buffers.get(uid)?.clear();
    this._buffers.delete(uid);
  }

  dispose(): void {
    this._buffers.forEach((b) => b.clear());
    this._buffers.clear();
  }
}

