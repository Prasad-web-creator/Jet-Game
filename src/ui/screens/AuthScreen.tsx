import { useState, useCallback } from 'react';
import './AuthScreen.css';
import {
  signIn,
  signUp,
  signInAsGuest,
  formatAuthError,
  type User,
} from '../../firebase/auth/AuthService';
import { createProfile } from '../../firebase/profile/PlayerProfileService';

interface AuthScreenProps {
  onAuthenticated: (user: User) => void;
}

type AuthTab = 'login' | 'register';

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [tab,      setTab]      = useState<AuthTab>('login');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [callsign, setCallsign] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const clearError = () => setError('');

  // ─── Sign In ──────────────────────────────────────────────────────────────
  const handleSignIn = useCallback(async () => {
    clearError();
    setLoading(true);
    try {
      const user = await signIn(email.trim(), password);
      onAuthenticated(user);
    } catch (err: any) {
      setError(formatAuthError(err.code ?? ''));
    } finally {
      setLoading(false);
    }
  }, [email, password, onAuthenticated]);

  // ─── Sign Up ──────────────────────────────────────────────────────────────
  const handleSignUp = useCallback(async () => {
    clearError();
    if (!callsign.trim() || callsign.trim().length < 3) {
      setError('Callsign must be at least 3 characters.');
      return;
    }
    setLoading(true);
    try {
      const user = await signUp({ email: email.trim(), password, callsign: callsign.trim().toUpperCase() });
      await createProfile(user.uid, callsign.trim().toUpperCase(), false);
      onAuthenticated(user);
    } catch (err: any) {
      setError(formatAuthError(err.code ?? ''));
    } finally {
      setLoading(false);
    }
  }, [email, password, callsign, onAuthenticated]);

  // ─── Guest ────────────────────────────────────────────────────────────────
  const handleGuest = useCallback(async () => {
    clearError();
    setLoading(true);
    try {
      const user = await signInAsGuest();
      const guestCallsign = `GHOST-${Math.floor(Math.random() * 9000) + 1000}`;
      await createProfile(user.uid, guestCallsign, true);
      onAuthenticated(user);
    } catch (err: any) {
      setError(formatAuthError(err.code ?? ''));
    } finally {
      setLoading(false);
    }
  }, [onAuthenticated]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (tab === 'login') handleSignIn();
      else handleSignUp();
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-panel">
        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-title"><span>JET</span> STRIKE</div>
          <div className="auth-logo-sub">AERIAL COMBAT MULTIPLAYER</div>
        </div>

        {/* Tabs */}
        <div className="auth-tabs">
          <button
            className={`auth-tab ${tab === 'login' ? 'active' : ''}`}
            onClick={() => { setTab('login'); clearError(); }}
          >
            SIGN IN
          </button>
          <button
            className={`auth-tab ${tab === 'register' ? 'active' : ''}`}
            onClick={() => { setTab('register'); clearError(); }}
          >
            REGISTER
          </button>
        </div>

        {/* Form */}
        <div className="auth-form" onKeyDown={handleKeyDown}>
          {tab === 'register' && (
            <div className="auth-field">
              <label className="auth-label">CALLSIGN</label>
              <input
                id="auth-callsign"
                className="auth-input"
                placeholder="MAVERICK"
                value={callsign}
                onChange={(e) => setCallsign(e.target.value.toUpperCase())}
                maxLength={16}
                autoComplete="off"
              />
            </div>
          )}

          <div className="auth-field">
            <label className="auth-label">EMAIL</label>
            <input
              id="auth-email"
              className="auth-input"
              type="email"
              placeholder="pilot@airbase.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div className="auth-field">
            <label className="auth-label">PASSWORD</label>
            <input
              id="auth-password"
              className="auth-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {error && <div className="auth-error">{error}</div>}

          {loading ? (
            <div className="auth-spinner" />
          ) : (
            <>
              <button
                id={tab === 'login' ? 'btn-signin' : 'btn-register'}
                className="auth-btn auth-btn-primary"
                onClick={tab === 'login' ? handleSignIn : handleSignUp}
                disabled={!email || !password || (tab === 'register' && !callsign)}
              >
                {tab === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}
              </button>

              <div className="auth-divider">— OR —</div>

              <button
                id="btn-guest"
                className="auth-btn auth-btn-ghost"
                onClick={handleGuest}
              >
                PLAY AS GUEST
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
