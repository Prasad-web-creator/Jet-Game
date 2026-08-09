/**
 * LobbyService — Firestore-based lobby management.
 *
 * Data lives in:  lobbies/{lobbyId}/
 *                 lobbies/{lobbyId}/players/{uid}  (subcollection)
 *
 * Lifecycle:
 *   createLobby() → joinLobby() → setReady() → startMatch() → [in-game] → endLobby()
 */
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  getDocs,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebaseApp';
import type { LobbyDoc, LobbyPlayer } from '../multiplayer/networkTypes';

const LOBBIES = 'lobbies';

// ─── Generate a short human-readable lobby code ───────────────────────────────

function generateLobbyCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ─── Create ───────────────────────────────────────────────────────────────────

export interface CreateLobbyOptions {
  hostUid:    string;
  callsign:   string;
  aircraftId: string;
  name?:      string;
  mode?:      'deathmatch' | 'team_deathmatch';
  maxPlayers?: number;
}

/**
 * Create a new lobby. Returns the lobbyId (Firestore doc ID).
 */
export async function createLobby(opts: CreateLobbyOptions): Promise<string> {
  const code = generateLobbyCode();

  const nowMs = Date.now();
  const EXPIRE_MS = 30 * 60 * 1000; // 30 minutes

  const lobbyData = {
    hostUid:    opts.hostUid,
    name:       opts.name ?? `${opts.callsign}'s Lobby`,
    code,
    mode:       opts.mode ?? 'deathmatch',
    maxPlayers: opts.maxPlayers ?? 8,
    status:     'waiting',
    matchId:    null,
    createdAt:  serverTimestamp(),
    updatedAt:  serverTimestamp(),
    expiresAt:  nowMs + EXPIRE_MS,
  };

  const ref = await addDoc(collection(db, LOBBIES), lobbyData);
  const lobbyId = ref.id;

  // Add host as first player
  await setDoc(doc(db, LOBBIES, lobbyId, 'players', opts.hostUid), {
    uid:        opts.hostUid,
    callsign:   opts.callsign,
    aircraftId: opts.aircraftId,
    isReady:    false,
    isHost:     true,
    joinedAt:   serverTimestamp(),
  } satisfies Omit<LobbyPlayer, 'joinedAt'> & { joinedAt: ReturnType<typeof serverTimestamp> });

  return lobbyId;
}

// ─── Join ─────────────────────────────────────────────────────────────────────

export interface JoinLobbyOptions {
  lobbyId:    string;
  uid:        string;
  callsign:   string;
  aircraftId: string;
}

/**
 * Join an existing lobby as a non-host player.
 * Returns false if lobby is full or not in 'waiting' state.
 */
export async function joinLobby(opts: JoinLobbyOptions): Promise<boolean> {
  const snap = await getDoc(doc(db, LOBBIES, opts.lobbyId));
  if (!snap.exists()) return false;

  const lobby = snap.data();
  if (lobby.status !== 'waiting') return false;

  const playersSnap = await getDocs(collection(db, LOBBIES, opts.lobbyId, 'players'));
  if (playersSnap.size >= lobby.maxPlayers) return false;

  await setDoc(doc(db, LOBBIES, opts.lobbyId, 'players', opts.uid), {
    uid:        opts.uid,
    callsign:   opts.callsign,
    aircraftId: opts.aircraftId,
    isReady:    false,
    isHost:     false,
    joinedAt:   serverTimestamp(),
  });

  return true;
}

/**
 * Join a lobby by code. Returns lobbyId if found, null otherwise.
 */
export async function joinLobbyByCode(
  code: string,
  uid: string,
  callsign: string,
  aircraftId: string
): Promise<string | null> {
  const q = query(collection(db, LOBBIES), where('code', '==', code.toUpperCase()), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;

  const lobbyId = snap.docs[0].id;
  const ok = await joinLobby({ lobbyId, uid, callsign, aircraftId });
  return ok ? lobbyId : null;
}

// ─── Leave ────────────────────────────────────────────────────────────────────

/**
 * Remove a player from the lobby.
 * If the leaving player is the host, the lobby is deleted.
 */
export async function leaveLobby(lobbyId: string, uid: string, isHost: boolean): Promise<void> {
  await deleteDoc(doc(db, LOBBIES, lobbyId, 'players', uid));

  if (isHost) {
    // Delete all player docs then the lobby itself
    const playersSnap = await getDocs(collection(db, LOBBIES, lobbyId, 'players'));
    await Promise.all(playersSnap.docs.map((d) => deleteDoc(d.ref)));
    await deleteDoc(doc(db, LOBBIES, lobbyId));
  }
}

// ─── Ready state ──────────────────────────────────────────────────────────────

export async function setReady(lobbyId: string, uid: string, ready: boolean): Promise<void> {
  await updateDoc(doc(db, LOBBIES, lobbyId, 'players', uid), { isReady: ready });
}

// ─── Start match (host only) ──────────────────────────────────────────────────

/**
 * Mark the lobby as 'starting' and write the matchId.
 * The game clients listen for this and transition to the match.
 */
export async function startMatch(lobbyId: string, matchId: string): Promise<void> {
  await updateDoc(doc(db, LOBBIES, lobbyId), {
    status:  'in_game',
    matchId,
  });
}

/**
 * Mark the lobby as ended after the match finishes.
 */
export async function endLobby(lobbyId: string): Promise<void> {
  await updateDoc(doc(db, LOBBIES, lobbyId), { status: 'ended' }).catch(() => {});
}

// ─── Browse / list ────────────────────────────────────────────────────────────

/**
 * Fetch a list of open public lobbies (status = 'waiting', up to 20).
 */
export async function listPublicLobbies(): Promise<LobbyDoc[]> {
  const q = query(
    collection(db, LOBBIES),
    where('status', '==', 'waiting'),
    orderBy('createdAt', 'desc'),
    limit(20)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as LobbyDoc));
}

// ─── Real-time listeners ──────────────────────────────────────────────────────

/**
 * Subscribe to a specific lobby document (status, matchId changes).
 */
export function onLobbyChanged(
  lobbyId: string,
  callback: (data: LobbyDoc & { id: string }) => void
): Unsubscribe {
  return onSnapshot(doc(db, LOBBIES, lobbyId), (snap) => {
    if (snap.exists()) callback({ id: snap.id, ...snap.data() } as LobbyDoc & { id: string });
  });
}

/**
 * Subscribe to the players subcollection of a lobby.
 */
export function onLobbyPlayersChanged(
  lobbyId: string,
  callback: (players: LobbyPlayer[]) => void
): Unsubscribe {
  return onSnapshot(collection(db, LOBBIES, lobbyId, 'players'), (snap) => {
    callback(snap.docs.map((d) => d.data() as LobbyPlayer));
  });
}
