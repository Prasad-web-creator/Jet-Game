/**
 * MatchScoreManager — tracks live kill/death scores and match timer.
 *
 * Reads from NetworkManager.getScoreboard() each frame.
 * Exposes getScoreboard(), getMatchTime(), isMatchOver().
 * Emits match-end via callback when score limit or time limit is reached.
 */
import type { NetworkManager } from './NetworkManager';
import type { LiveScore } from '../../firebase/multiplayer/networkTypes';
import { ref as rtdbRef, set as rtdbSet } from 'firebase/database';
import { rtdb } from '../../firebase/firebaseApp';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebaseApp';

export interface MatchEndResult {
  winnerUid:    string;
  winnerCallsign: string;
  scoreboard:   LiveScore[];
  durationSeconds: number;
}

export class MatchScoreManager {
  private readonly _networkManager: NetworkManager;
  private readonly _scoreLimit:     number;
  private readonly _timeLimitSec:   number;
  private readonly _onMatchEnd:     (result: MatchEndResult) => void;

  private _elapsedSec  = 0;
  private _matchEnded  = false;

  constructor(
    networkManager: NetworkManager,
    scoreLimit: number,
    timeLimitSec: number,
    onMatchEnd: (result: MatchEndResult) => void,
  ) {
    this._networkManager = networkManager;
    this._scoreLimit     = scoreLimit;
    this._timeLimitSec   = timeLimitSec;
    this._onMatchEnd     = onMatchEnd;
  }

  /** Called each frame with dt (seconds). */
  update(dt: number): void {
    if (this._matchEnded) return;
    this._elapsedSec += dt;

    const board = this._networkManager.getScoreboard();

    // Check score limit
    if (this._scoreLimit > 0) {
      const winner = board.find((s) => s.kills >= this._scoreLimit);
      if (winner) { this._endMatch(board, winner.uid); return; }
    }

    // Check time limit
    if (this._timeLimitSec > 0 && this._elapsedSec >= this._timeLimitSec) {
      const winner = board[0]; // highest kills wins on timeout
      if (winner) this._endMatch(board, winner.uid);
    }
  }

  private async _endMatch(board: LiveScore[], winnerUid: string): Promise<void> {
    if (this._matchEnded) return;
    this._matchEnded = true;

    const matchId = this._networkManager.getMatchId();

    // Update RTDB match status
    await rtdbSet(rtdbRef(rtdb, `matches/${matchId}/meta/status`), 'ended').catch(() => {});

    // Update Firestore match doc
    const durationSeconds = Math.floor(this._elapsedSec);
    await updateDoc(doc(db, 'matches', matchId), {
      status:          'ended',
      endedAt:         Date.now(),
      durationSeconds,
      results:         board.map((s, i) => ({
        uid:           s.uid,
        callsign:      s.callsign,
        kills:         s.kills,
        deaths:        s.deaths,
        score:         s.kills * 100,
        placement:     i + 1,
        xpEarned:      s.kills * 50 + (s.uid === winnerUid ? 300 : 0),
        creditsEarned: s.kills * 25 + (s.uid === winnerUid ? 150 : 0),
      })),
    }).catch(() => {});

    const winner = board.find((s) => s.uid === winnerUid)!;
    this._onMatchEnd({
      winnerUid,
      winnerCallsign: winner?.callsign ?? 'UNKNOWN',
      scoreboard:     board,
      durationSeconds,
    });
  }

  // ─── Accessors ──────────────────────────────────────────────────────────────

  getScoreboard(): LiveScore[] {
    return this._networkManager.getScoreboard();
  }

  getMatchTimeSec(): number { return this._elapsedSec; }
  getRemainingTimeSec(): number {
    return Math.max(0, this._timeLimitSec - this._elapsedSec);
  }
  isMatchOver(): boolean { return this._matchEnded; }
}
