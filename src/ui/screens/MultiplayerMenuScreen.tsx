import { useState, useCallback } from 'react';
import './MultiplayerMenuScreen.css';
import { createLobby, joinLobbyByCode } from '../../firebase/lobby/LobbyService';
import { enqueue, subscribeToMatchmaking } from '../../firebase/matchmaking/MatchmakingService';
import type { PlayerProfile } from '../../firebase/multiplayer/networkTypes';

interface MultiplayerMenuScreenProps {
  profile: PlayerProfile;
  onLobbyJoined: (lobbyId: string) => void;
  onMatchFound: (matchId: string) => void;
  onBack: () => void;
}

export function MultiplayerMenuScreen({
  profile,
  onLobbyJoined,
  onMatchFound,
  onBack,
}: MultiplayerMenuScreenProps) {
  const [lobbyCode,    setLobbyCode]    = useState('');
  const [error,        setError]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const [searching,    setSearching]    = useState(false);
  const [cancelSearch, setCancelSearch] = useState<(() => void) | null>(null);

  // ─── Create Lobby ─────────────────────────────────────────────────────────
  const handleCreateLobby = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const lobbyId = await createLobby({
        hostUid:    profile.uid,
        callsign:   profile.callsign,
        aircraftId: profile.currentAircraftId,
      });
      onLobbyJoined(lobbyId);
    } catch (err) {
      setError('Failed to create lobby. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, [profile, onLobbyJoined]);

  // ─── Join by Code ─────────────────────────────────────────────────────────
  const handleJoinByCode = useCallback(async () => {
    if (!lobbyCode.trim()) return;
    setError('');
    setLoading(true);
    try {
      const lobbyId = await joinLobbyByCode(
        lobbyCode.trim(),
        profile.uid,
        profile.callsign,
        profile.currentAircraftId
      );
      if (!lobbyId) { setError('Lobby not found or already started.'); return; }
      onLobbyJoined(lobbyId);
    } catch {
      setError('Failed to join lobby.');
    } finally {
      setLoading(false);
    }
  }, [lobbyCode, profile, onLobbyJoined]);

  // ─── Quick Match ──────────────────────────────────────────────────────────
  const handleQuickMatch = useCallback(async () => {
    setError('');
    setSearching(true);
    try {
      await enqueue({
        uid:        profile.uid,
        callsign:   profile.callsign,
        aircraftId: profile.currentAircraftId,
        mode:       'deathmatch',
        level:      profile.level,
      });
      const cancel = subscribeToMatchmaking(profile.uid, 'deathmatch', (matchId) => {
        setSearching(false);
        setCancelSearch(null);
        onMatchFound(matchId);
      });
      setCancelSearch(() => cancel);
    } catch {
      setError('Failed to join matchmaking queue.');
      setSearching(false);
    }
  }, [profile, onMatchFound]);

  const handleCancelSearch = useCallback(async () => {
    cancelSearch?.();
    setCancelSearch(null);
    setSearching(false);
    const { dequeue } = await import('../../firebase/matchmaking/MatchmakingService');
    await dequeue(profile.uid);
  }, [cancelSearch, profile.uid]);

  return (
    <div className="mp-menu-screen">
      <div className="mp-menu-panel">
        <div className="mp-menu-title">MULTIPLAYER</div>
        <div className="mp-menu-sub">SELECT GAME MODE</div>

        {!searching ? (
          <div className="mp-menu-options">
            {/* Quick Match */}
            <button id="btn-quickmatch" className="mp-option-btn" onClick={handleQuickMatch} disabled={loading}>
              <span className="mp-option-icon">⚡</span>
              <div className="mp-option-label">
                <div>QUICK MATCH</div>
                <div className="mp-option-desc">Auto-match with available pilots</div>
              </div>
            </button>

            {/* Create Lobby */}
            <button id="btn-create-lobby" className="mp-option-btn" onClick={handleCreateLobby} disabled={loading}>
              <span className="mp-option-icon">🛡</span>
              <div className="mp-option-label">
                <div>CREATE LOBBY</div>
                <div className="mp-option-desc">Invite friends with a code</div>
              </div>
            </button>

            {/* Join by Code */}
            <div>
              <div className="mp-option-btn" style={{ cursor: 'default', pointerEvents: 'none' }}>
                <span className="mp-option-icon">🔗</span>
                <div className="mp-option-label">
                  <div>JOIN WITH CODE</div>
                  <div className="mp-option-desc">Enter a 6-character lobby code</div>
                </div>
              </div>
              <div className="mp-join-row">
                <input
                  id="lobby-code-input"
                  className="mp-code-input"
                  placeholder="ENTER CODE"
                  value={lobbyCode}
                  onChange={(e) => setLobbyCode(e.target.value.toUpperCase().slice(0, 6))}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoinByCode()}
                  maxLength={6}
                />
                <button
                  id="btn-join-code"
                  className="mp-code-btn"
                  onClick={handleJoinByCode}
                  disabled={lobbyCode.length < 6 || loading}
                >
                  JOIN
                </button>
              </div>
            </div>

            {error && <div className="mp-error">{error}</div>}
          </div>
        ) : (
          /* Searching state */
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div className="auth-spinner" style={{ margin: '0 auto 20px' }} />
            <div style={{ fontSize: 13, letterSpacing: 4, color: 'rgba(0,180,255,0.8)', marginBottom: 8 }}>
              SEARCHING FOR PILOTS...
            </div>
            <div style={{ fontSize: 10, letterSpacing: 2, color: 'rgba(255,255,255,0.3)', fontFamily: 'Rajdhani, sans-serif' }}>
              You will be matched with up to 7 other pilots
            </div>
            <button
              id="btn-cancel-search"
              className="mp-back-btn"
              style={{ marginTop: 32, maxWidth: 200, margin: '32px auto 0' }}
              onClick={handleCancelSearch}
            >
              CANCEL
            </button>
          </div>
        )}

        {!searching && (
          <button id="btn-back-menu" className="mp-back-btn" onClick={onBack}>
            ← BACK
          </button>
        )}
      </div>
    </div>
  );
}
