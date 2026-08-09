/**
 * MatchmakingService — client-side matchmaking via Firestore.
 *
 * Flow:
 *   enqueue() → writes to matchmaking_queue/{uid}
 *   → listens for queue changes
 *   → when 2+ players present, the oldest player (host) creates the match
 *   → writes matchId back to each queue doc
 *   → clients detect matchId and transition to game
 *
 * This is a self-contained client-side matchmaker — no Cloud Function needed.
 * The "host" client is determined by earliest enqueuedAt timestamp.
 */
import {
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  updateDoc,
  serverTimestamp,
  addDoc,
} from 'firebase/firestore';
import { db, rtdb } from '../firebaseApp';
import { ref as rtdbRef, set as rtdbSet } from 'firebase/database';
import type { MatchDoc, MatchMeta } from '../multiplayer/networkTypes';

const QUEUE_COL   = 'matchmaking_queue';
const MATCHES_COL = 'matches';

export type MatchMode = 'deathmatch';

export interface QueueEntry {
  uid:        string;
  callsign:   string;
  aircraftId: string;
  mode:       MatchMode;
  level:      number;
  enqueuedAt: number; // unix ms — used for host election
}

// ─── Queue operations ─────────────────────────────────────────────────────────

/**
 * Add local player to the matchmaking queue.
 */
export async function enqueue(entry: Omit<QueueEntry, 'enqueuedAt'>): Promise<void> {
  await setDoc(doc(db, QUEUE_COL, entry.uid), {
    ...entry,
    matchId:    null,
    enqueuedAt: serverTimestamp(),
  });
}

/**
 * Remove local player from the queue (cancel search).
 */
export async function dequeue(uid: string): Promise<void> {
  await deleteDoc(doc(db, QUEUE_COL, uid)).catch(() => {});
}

// ─── Host-side match creation ─────────────────────────────────────────────────

/**
 * Called by the host client to create the Firestore match record AND
 * initialize RTDB match state.
 */
async function createMatch(
  players: QueueEntry[],
  mode: MatchMode
): Promise<string> {
  const matchData: Omit<MatchDoc, 'id'> = {
    lobbyId:         '',
    mode,
    status:          'starting',
    startedAt:       Date.now(),
    endedAt:         null,
    durationSeconds: 0,
    players:         players.map((p) => ({ uid: p.uid, callsign: p.callsign, aircraftId: p.aircraftId })),
    results:         [],
  };

  const matchRef = await addDoc(collection(db, MATCHES_COL), matchData);
  const matchId  = matchRef.id;

  // Initialize RTDB match structure
  const meta: MatchMeta = {
    status:           'starting',
    startedAt:        Date.now(),
    hostUid:          players[0].uid,
    mode,
    scoreLimit:       20,
    timeLimitSeconds: 600, // 10 minutes
  };
  await rtdbSet(rtdbRef(rtdb, `matches/${matchId}/meta`), meta);

  // Initialize empty scoreboard entries
  for (const p of players) {
    await rtdbSet(rtdbRef(rtdb, `matches/${matchId}/scoreboard/${p.uid}`), {
      uid:      p.uid,
      callsign: p.callsign,
      kills:    0,
      deaths:   0,
    });
  }

  // Write matchId back to each queue doc so all clients see it
  for (const p of players) {
    await updateDoc(doc(db, QUEUE_COL, p.uid), { matchId }).catch(() => {});
  }

  // Transition match status to active
  await updateDoc(matchRef, { status: 'active' });
  await rtdbSet(rtdbRef(rtdb, `matches/${matchId}/meta/status`), 'active');

  return matchId;
}

// ─── Subscribe / polling ──────────────────────────────────────────────────────

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 8;
let _hostCheckInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Subscribe to own queue doc. When `matchId` appears, call `onMatchFound`.
 * Also polls queue as potential host to trigger match creation.
 *
 * Returns an unsubscribe/cancel function.
 */
export function subscribeToMatchmaking(
  uid: string,
  mode: MatchMode,
  onMatchFound: (matchId: string) => void
): () => void {
  // Listen to own queue doc for matchId
  const unsub = onSnapshot(doc(db, QUEUE_COL, uid), (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    if (data.matchId) {
      cleanup();
      onMatchFound(data.matchId as string);
    }
  });

  // Periodic host-election check (every 3 seconds)
  _hostCheckInterval = setInterval(async () => {
    await tryMatchPlayers(uid, mode);
  }, 3000);

  const cleanup = () => {
    unsub();
    if (_hostCheckInterval) {
      clearInterval(_hostCheckInterval);
      _hostCheckInterval = null;
    }
  };

  return cleanup;
}

/**
 * Try to act as host and match queued players.
 * Only the player with the smallest `enqueuedAt` (oldest in queue) should act as host
 * to avoid race conditions where multiple clients try to create the same match.
 */
async function tryMatchPlayers(localUid: string, mode: MatchMode): Promise<void> {
  try {
    const q = query(
      collection(db, QUEUE_COL),
      where('mode', '==', mode),
      where('matchId', '==', null),
      orderBy('enqueuedAt', 'asc'),
      limit(MAX_PLAYERS)
    );
    const snap = await getDocs(q);
    if (snap.size < MIN_PLAYERS) return;

    const players = snap.docs.map((d) => d.data() as QueueEntry);

    // Only the oldest player in queue acts as host
    if (players[0].uid !== localUid) return;

    // Take up to MAX_PLAYERS
    const matched = players.slice(0, MAX_PLAYERS);
    await createMatch(matched, mode);
  } catch (_err) {
    // Silently fail — another client may have won the race
  }
}
