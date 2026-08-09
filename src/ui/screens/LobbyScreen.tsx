import { useState, useEffect, useCallback } from 'react';
import './LobbyScreen.css';
import {
  onLobbyChanged,
  onLobbyPlayersChanged,
  setReady,
  leaveLobby,
  startMatch,
} from '../../firebase/lobby/LobbyService';
import {
  addDoc, collection, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebase/firebaseApp';
import type { LobbyDoc, LobbyPlayer } from '../../firebase/multiplayer/networkTypes';

interface LobbyScreenProps {
  lobbyId:  string;
  localUid: string;
  onMatchStarted: (matchId: string) => void;
  onLeave: () => void;
}

const AIRCRAFT_NAMES: Record<string, string> = {
  'f16_player': 'F-16C FIGHTING FALCON',
};

export function LobbyScreen({ lobbyId, localUid, onMatchStarted, onLeave }: LobbyScreenProps) {
  const [lobby,    setLobby]   = useState<(LobbyDoc & { id: string }) | null>(null);
  const [players,  setPlayers] = useState<LobbyPlayer[]>([]);
  const [isReady,  setIsReady] = useState(false);
  const [starting, setStarting] = useState(false);

  const localPlayer  = players.find((p) => p.uid === localUid);
  const isHost       = localPlayer?.isHost ?? false;
  const allReady     = players.length >= 2 && players.every((p) => p.isReady || p.isHost);
  const maxPlayers   = lobby?.maxPlayers ?? 8;

  // Subscribe to lobby doc changes (status, matchId)
  useEffect(() => {
    const unsub = onLobbyChanged(lobbyId, (data) => {
      setLobby(data);
      if (data.matchId && data.status === 'in_game') {
        onMatchStarted(data.matchId);
      }
    });
    return unsub;
  }, [lobbyId, onMatchStarted]);

  // Subscribe to players subcollection
  useEffect(() => {
    const unsub = onLobbyPlayersChanged(lobbyId, setPlayers);
    return unsub;
  }, [lobbyId]);

  const handleToggleReady = useCallback(async () => {
    const next = !isReady;
    setIsReady(next);
    await setReady(lobbyId, localUid, next);
  }, [lobbyId, localUid, isReady]);

  const handleStartMatch = useCallback(async () => {
    if (!isHost || !allReady) return;
    setStarting(true);
    try {
      // Create Firestore match doc (MatchmakingService.createMatch handles RTDB)
      const matchRef = await addDoc(collection(db, 'matches'), {
        lobbyId,
        mode:            lobby?.mode ?? 'deathmatch',
        status:          'starting',
        startedAt:       serverTimestamp(),
        endedAt:         null,
        durationSeconds: 0,
        players:         players.map((p) => ({ uid: p.uid, callsign: p.callsign, aircraftId: p.aircraftId })),
        results:         [],
      });
      await startMatch(lobbyId, matchRef.id);
      // onMatchStarted fires via onLobbyChanged listener
    } catch (err) {
      console.error('[LobbyScreen] Failed to start match:', err);
      setStarting(false);
    }
  }, [isHost, allReady, lobbyId, lobby, players]);

  const handleLeave = useCallback(async () => {
    await leaveLobby(lobbyId, localUid, isHost);
    onLeave();
  }, [lobbyId, localUid, isHost, onLeave]);

  if (!lobby) {
    return (
      <div className="lobby-screen">
        <div className="lobby-panel" style={{ padding: 48, textAlign: 'center', color: 'rgba(0,255,136,0.7)', letterSpacing: 4 }}>
          LOADING LOBBY...
        </div>
      </div>
    );
  }

  const emptySlots = Math.max(0, maxPlayers - players.length);

  return (
    <div className="lobby-screen">
      <div className="lobby-panel">
        {/* Header */}
        <div className="lobby-header">
          <div>
            <div className="lobby-title">{lobby.name.toUpperCase()}</div>
            <div className="lobby-code">
              CODE: <span>{(lobby as any).code ?? lobbyId.slice(0, 6).toUpperCase()}</span>
            </div>
          </div>
          <div className="lobby-mode-badge">
            {lobby.mode === 'deathmatch' ? 'FREE FOR ALL' : 'TEAM BATTLE'}
          </div>
        </div>

        <div className="lobby-body">
          {/* Player list */}
          <div className="lobby-players">
            <div className="lobby-players-title">PILOTS — {players.length}/{maxPlayers}</div>

            {players.map((p) => (
              <div
                key={p.uid}
                className={`lobby-player-slot ${p.isReady || p.isHost ? 'ready' : ''}`}
              >
                <div className="lobby-player-ready-dot" />
                <div className="lobby-player-name">{p.callsign}</div>
                {p.isHost && <div className="lobby-player-host-badge">HOST</div>}
                <div className="lobby-player-aircraft">
                  {AIRCRAFT_NAMES[p.aircraftId] ?? p.aircraftId}
                </div>
              </div>
            ))}

            {Array.from({ length: emptySlots }).map((_, i) => (
              <div key={`empty-${i}`} className="lobby-player-slot empty">
                — WAITING FOR PILOT —
              </div>
            ))}
          </div>

          {/* Sidebar */}
          <div className="lobby-sidebar">
            <div className="lobby-sidebar-label">ACTIONS</div>

            {!isHost && (
              <button
                id="btn-ready"
                className={`lobby-btn lobby-btn-ready ${isReady ? 'is-ready' : ''}`}
                onClick={handleToggleReady}
              >
                {isReady ? '✓ READY' : 'READY UP'}
              </button>
            )}

            {isHost && (
              <button
                id="btn-start"
                className="lobby-btn lobby-btn-start"
                onClick={handleStartMatch}
                disabled={!allReady || starting}
              >
                {starting ? 'LAUNCHING...' : 'START MATCH'}
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="lobby-footer">
          <button id="btn-leave" className="lobby-btn lobby-btn-leave" onClick={handleLeave}>
            LEAVE LOBBY
          </button>
        </div>
      </div>
    </div>
  );
}
