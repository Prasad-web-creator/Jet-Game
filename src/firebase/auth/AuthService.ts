/**
 * AuthService — Firebase Authentication wrapper.
 *
 * Provides: sign-up, sign-in, anonymous play, sign-out, auth state listener.
 * All callers import from this file — never import Firebase Auth directly.
 */
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInAnonymously,
  signOut as fbSignOut,
  onAuthStateChanged,
  updateProfile,
  type User,
  type Unsubscribe,
} from 'firebase/auth';
import { auth } from '../firebaseApp';

export type { User };

export interface SignUpParams {
  email:     string;
  password:  string;
  callsign:  string;
}

// ─── Auth operations ──────────────────────────────────────────────────────────

/**
 * Register a new account. Also sets the Firebase displayName to the callsign.
 * Returns the created User.
 */
export async function signUp({ email, password, callsign }: SignUpParams): Promise<User> {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: callsign });
  return cred.user;
}

/**
 * Sign in with email + password.
 */
export async function signIn(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

/**
 * Anonymous guest session. No email required.
 * Guest accounts can be upgraded to permanent accounts later.
 */
export async function signInAsGuest(): Promise<User> {
  const cred = await signInAnonymously(auth);
  return cred.user;
}

/**
 * Sign out the current user.
 */
export async function signOut(): Promise<void> {
  await fbSignOut(auth);
}

/**
 * Subscribe to auth state changes. Returns an unsubscribe function.
 * Fires immediately with current user (or null).
 */
export function onAuthChanged(callback: (user: User | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, callback);
}

/**
 * Returns the currently signed-in user, or null.
 */
export function getCurrentUser(): User | null {
  return auth.currentUser;
}

/**
 * Synchronous check — is any user signed in?
 */
export function isSignedIn(): boolean {
  return auth.currentUser !== null;
}

/**
 * Translate Firebase error codes to human-readable messages.
 */
export function formatAuthError(code: string): string {
  switch (code) {
    case 'auth/email-already-in-use':  return 'This email is already registered.';
    case 'auth/invalid-email':         return 'Invalid email address.';
    case 'auth/weak-password':         return 'Password must be at least 6 characters.';
    case 'auth/user-not-found':        return 'No account found with this email.';
    case 'auth/wrong-password':        return 'Incorrect password.';
    case 'auth/too-many-requests':     return 'Too many attempts. Please try again later.';
    case 'auth/network-request-failed': return 'Network error. Check your connection.';
    default:                           return 'Authentication failed. Please try again.';
  }
}
