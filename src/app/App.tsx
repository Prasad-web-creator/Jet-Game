import { useState, useEffect, useCallback, useRef } from 'react';
import GamePage from '../pages/GamePage';
import MainMenu from '../ui/menus/MainMenu';
import { MultiplayerGamePage } from '../pages/MultiplayerGamePage';
import { AuthScreen } from '../ui/screens/AuthScreen';
import { MultiplayerMenuScreen } from '../ui/screens/MultiplayerMenuScreen';
import { LobbyScreen } from '../ui/screens/LobbyScreen';
import { onAuthChanged, type User } from '../firebase/auth/AuthService';
import { getProfile, createProfile } from '../firebase/profile/PlayerProfileService';
import type { PlayerProfile } from '../firebase/multiplayer/networkTypes';

type AppScreen =
  | 'auth'
  | 'main_menu'
  | 'solo_game'
  | 'multiplayer_menu'
  | 'lobby'
  | 'multi_game';

/**
 * App — root application component.
 *
 * Manages top-level navigation between auth, menus, solo game, and multiplayer.
 *
 * Screen state machine:
 *   auth → main_menu
 *   main_menu → solo_game (existing flow)
 *   main_menu → multiplayer_menu
 *   multiplayer_menu → lobby (create/join) | multi_game (quick-match)
 *   lobby → multi_game (when host starts)
 *   multi_game → main_menu (on exit/results)
 */
function App() {
  const [screen,            setScreen]      = useState<AppScreen>('auth');
  const [profile,           setProfile]     = useState<PlayerProfile | null>(null);
  const [selectedMissionId, setMission]     = useState<string | undefined>(undefined);
  const [lobbyId,           setLobbyId]     = useState<string | null>(null);
  const [matchId,           setMatchId]     = useState<string | null>(null);
  const callsignMapRef = useRef<Map<string, string>>(new Map());

  // ─── Auth gate ────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthChanged(async (u) => {
      if (u) {
        // Fetch or create profile
        let p = await getProfile(u.uid);
        if (!p) {
          const callsign = u.displayName ?? `PILOT-${u.uid.slice(0, 4).toUpperCase()}`;
          p = await createProfile(u.uid, callsign, u.isAnonymous);
        }
        setProfile(p);
        setScreen('main_menu');
      } else {
        setScreen('auth');
        setProfile(null);
      }
    });
    return unsub;
  }, []);

  // ─── Auth ─────────────────────────────────────────────────────────────────
  const handleAuthenticated = useCallback((_u: User) => {
    // Profile is loaded by the onAuthChanged listener above
  }, []);

  // ─── Solo play ────────────────────────────────────────────────────────────
  const handleStartGame = useCallback((missionId?: string) => {
    setMission(missionId);
    setScreen('solo_game');
  }, []);

  // ─── Multiplayer flow ─────────────────────────────────────────────────────
  const handleMultiplayer = useCallback(() => setScreen('multiplayer_menu'), []);

  const handleLobbyJoined = useCallback((id: string) => {
    setLobbyId(id);
    setScreen('lobby');
  }, []);

  const handleMatchFound = useCallback((id: string) => {
    setMatchId(id);
    setScreen('multi_game');
  }, []);

  const handleMatchStarted = useCallback((id: string) => {
    setMatchId(id);
    setScreen('multi_game');
  }, []);

  const handleExitToMenu = useCallback(() => {
    setScreen('main_menu');
    setLobbyId(null);
    setMatchId(null);
  }, []);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div id="app-root">
      {screen === 'auth' && (
        <AuthScreen onAuthenticated={handleAuthenticated} />
      )}

      {screen === 'main_menu' && (
        <MainMenu
          onStartGame={handleStartGame}
          onMultiplayer={handleMultiplayer}
          profile={profile}
        />
      )}

      {screen === 'solo_game' && (
        <GamePage
          missionId={selectedMissionId}
          onExitToMenu={handleExitToMenu}
        />
      )}

      {screen === 'multiplayer_menu' && profile && (
        <MultiplayerMenuScreen
          profile={profile}
          onLobbyJoined={handleLobbyJoined}
          onMatchFound={handleMatchFound}
          onBack={handleExitToMenu}
        />
      )}

      {screen === 'lobby' && lobbyId && profile && (
        <LobbyScreen
          lobbyId={lobbyId}
          localUid={profile.uid}
          onMatchStarted={handleMatchStarted}
          onLeave={handleExitToMenu}
        />
      )}

      {screen === 'multi_game' && matchId && profile && (
        <MultiplayerGamePage
          matchId={matchId}
          profile={profile}
          callsignMap={callsignMapRef.current}
          onExitToMenu={handleExitToMenu}
          onPlayAgain={() => {
            setMatchId(null);
            setScreen('multiplayer_menu');
          }}
        />
      )}
    </div>
  );
}

export default App;
