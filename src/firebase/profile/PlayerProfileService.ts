/**
 * PlayerProfileService — Firestore CRUD for player profiles.
 *
 * Each authenticated user has a single document in `players/{uid}`.
 * This service handles creation (on first sign-up), reads, updates,
 * and real-time subscriptions.
 */
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebaseApp';
import type { PlayerProfile } from '../multiplayer/networkTypes';

const COLLECTION = 'players';

// ─── Default profile template ─────────────────────────────────────────────────

function buildDefaultProfile(uid: string, callsign: string, isAnonymous: boolean): PlayerProfile {
  return {
    uid,
    displayName:         callsign,
    callsign,
    level:               1,
    xp:                  0,
    credits:             1500,
    totalKills:          0,
    totalDeaths:         0,
    totalWins:           0,
    missionsCompleted:   0,
    currentAircraftId:   'f16_player',
    unlockedAircraftIds: ['f16_player'],
    createdAt:           Date.now(),
    lastSeenAt:          Date.now(),
    isAnonymous,
  };
}

// ─── Operations ───────────────────────────────────────────────────────────────

/**
 * Create a new profile document. Call on first sign-up.
 * Does nothing if a profile already exists.
 */
export async function createProfile(
  uid: string,
  callsign: string,
  isAnonymous = false
): Promise<PlayerProfile> {
  const ref = doc(db, COLLECTION, uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data() as PlayerProfile;

  const profile = buildDefaultProfile(uid, callsign, isAnonymous);
  await setDoc(ref, { ...profile, createdAt: serverTimestamp(), lastSeenAt: serverTimestamp() });
  return profile;
}

/**
 * Fetch a profile by UID. Returns null if it doesn't exist yet.
 */
export async function getProfile(uid: string): Promise<PlayerProfile | null> {
  const snap = await getDoc(doc(db, COLLECTION, uid));
  return snap.exists() ? (snap.data() as PlayerProfile) : null;
}

/**
 * Partially update a profile field set.
 */
export async function updateProfile(
  uid: string,
  partial: Partial<Omit<PlayerProfile, 'uid' | 'createdAt'>>
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, uid), {
    ...partial,
    lastSeenAt: serverTimestamp(),
  });
}

/**
 * Apply XP + credit rewards after a match. Handles level-up calculation.
 */
export async function applyMatchRewards(
  uid: string,
  xpEarned: number,
  creditsEarned: number,
  kills: number,
  deaths: number,
  isWin: boolean
): Promise<void> {
  const profile = await getProfile(uid);
  if (!profile) return;

  const newXp      = profile.xp + xpEarned;
  const newLevel   = Math.floor(1 + newXp / 1000);
  const newCredits = profile.credits + creditsEarned;

  await updateDoc(doc(db, COLLECTION, uid), {
    xp:          newXp,
    level:       newLevel,
    credits:     newCredits,
    totalKills:  profile.totalKills + kills,
    totalDeaths: profile.totalDeaths + deaths,
    totalWins:   profile.totalWins + (isWin ? 1 : 0),
    lastSeenAt:  serverTimestamp(),
  });
}

/**
 * Subscribe to real-time profile changes. Returns unsubscribe fn.
 */
export function onProfileChanged(
  uid: string,
  callback: (profile: PlayerProfile) => void
): Unsubscribe {
  return onSnapshot(doc(db, COLLECTION, uid), (snap) => {
    if (snap.exists()) callback(snap.data() as PlayerProfile);
  });
}

/**
 * Update `lastSeenAt` — call on app focus / re-open.
 */
export async function touchLastSeen(uid: string): Promise<void> {
  await updateDoc(doc(db, COLLECTION, uid), { lastSeenAt: serverTimestamp() }).catch(() => {});
}
