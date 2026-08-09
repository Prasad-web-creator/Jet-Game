import { useState, useCallback, useEffect, useRef } from 'react';
import GameCanvas from '../components/GameCanvas';
import HUD from '../ui/hud/HUD';
import { TouchControls } from '../ui/mobile';
import { PauseOverlay } from '../ui/menus/PauseOverlay';
import { MatchResultsScreen, type MatchEndResult } from '../ui/screens/MatchResultsScreen';
import type { GameEngine } from '../game/core/GameEngine';
import type { GameState } from '../types';
import { GamePhase } from '../types';
import { NetworkManager } from '../game/network/NetworkManager';
import { WeaponEventBroadcaster } from '../game/network/WeaponEventBroadcaster';
import { MatchScoreManager } from '../game/network/MatchScoreManager';
import { RemotePlayerManager } from '../game/network/RemotePlayerManager';
import { PresenceService, type ConnectionState } from '../firebase/multiplayer/PresenceService';
import { NetworkDebugPanel } from '../ui/hud/NetworkDebugPanel';
import type { PlayerProfile } from '../firebase/multiplayer/networkTypes';

interface MultiplayerGamePageProps {
  matchId:     string;
  profile:     PlayerProfile;
  /** uid → callsign map for all players in match */
  callsignMap?: Map<string, string>;
  onExitToMenu: () => void;
  onPlayAgain:  () => void;
}

export function MultiplayerGamePage({
  matchId,
  profile,
  callsignMap: _callsignMap,
  onExitToMenu,
  onPlayAgain,
}: MultiplayerGamePageProps) {
  const [gameState,  setGameState]  = useState<GameState | null>(null);
  const [fps,        setFps]        = useState(0);
  const [matchResult, setMatchResult] = useState<MatchEndResult | null>(null);
  const [connState,  setConnState]  = useState<ConnectionState>('connected');

  const engineRef         = useRef<GameEngine | null>(null);
  const unsubRef          = useRef<(() => void) | null>(null);
  const networkRef        = useRef<NetworkManager | null>(null);
  const weaponBroadRef    = useRef<WeaponEventBroadcaster | null>(null);
  const scoreManagerRef   = useRef<MatchScoreManager | null>(null);
  const presenceRef       = useRef<PresenceService | null>(null);
  const gameStateRef      = useRef<GameState | null>(null);
  gameStateRef.current    = gameState;

  // RTDB Presence & Connection State Listener
  useEffect(() => {
    const ps = new PresenceService(matchId, profile.uid);
    presenceRef.current = ps;
    ps.bind((st) => setConnState(st));
    return () => ps.dispose();
  }, [matchId, profile.uid]);

  // FPS polling
  useEffect(() => {
    const id = setInterval(() => {
      if (engineRef.current) setFps(Math.round(engineRef.current.getFps()));
    }, 500);
    return () => clearInterval(id);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      unsubRef.current?.();
      weaponBroadRef.current?.dispose();
      networkRef.current?.dispose();
    };
  }, []);

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const cur = gameStateRef.current;
      if (e.key === 'Escape' && cur) {
        if (cur.phase === GamePhase.Playing)
          engineRef.current?.updateState({ phase: GamePhase.Paused });
        else if (cur.phase === GamePhase.Paused)
          engineRef.current?.updateState({ phase: GamePhase.Playing });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleEngineReady = useCallback((engine: GameEngine) => {
    engineRef.current = engine;
    const unsub = engine.onStateChange((state) => setGameState({ ...state }));
    unsubRef.current = unsub;

    // Create and attach NetworkManager as a system
    const nm = new NetworkManager(matchId, profile.uid, profile.callsign);
    networkRef.current = nm;

    // Attach aircraft controller reference (available after engine init)
    const ac = engine.getAircraftController();
    if (ac) nm.setAircraftController(ac);

    // Bind weapon event broadcaster
    const wb = new WeaponEventBroadcaster(nm);
    wb.bind();
    weaponBroadRef.current = wb;

    // Match score manager — ends match at 20 kills or 10 minutes
    const sm = new MatchScoreManager(nm, 20, 600, (result) => {
      setMatchResult(result);
    });
    scoreManagerRef.current = sm;

    // Prepare engine for multiplayer mode (clears AI jets & ground SAM batteries)
    engine.prepareMultiplayerMode();

    // Register NetworkManager in the engine game loop
    engine.registerAdditionalSystem(nm);

    // Register RemotePlayerManager to draw remote aircraft and track them in TargetManager
    const rpm = new RemotePlayerManager(nm, engine.getTargetManager());
    engine.registerAdditionalSystem(rpm);

    engine.updateState({ phase: GamePhase.Playing });
  }, [matchId, profile]);

  // ─── Scoreboard overlay (Tab key) ────────────────────────────────────────
  const [showScoreboard, setShowScoreboard] = useState(false);
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === 'Tab') { e.preventDefault(); setShowScoreboard(true); } };
    const up   = (e: KeyboardEvent) => { if (e.key === 'Tab') setShowScoreboard(false); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup',   up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  const [spectatingUid, setSpectatingUid] = useState<string | null>(null);

  const isLocalDestroyed = gameState?.playerAircraft?.isDestroyed || (gameState?.playerAircraft?.health ?? 1) <= 0;

  // Handle Spectator Mode when player dies
  useEffect(() => {
    if (!isLocalDestroyed) {
      if (spectatingUid) {
        setSpectatingUid(null);
        engineRef.current?.getCameraManager()?.setSpectateTarget(null);
      }
      return;
    }

    const uids = networkRef.current?.getRemoteUids() ?? [];
    if (uids.length > 0 && (!spectatingUid || !uids.includes(spectatingUid))) {
      const nextUid = uids[0];
      setSpectatingUid(nextUid);
      engineRef.current?.getCameraManager()?.setSpectateTarget(nextUid, networkRef.current);
    }
  }, [isLocalDestroyed, spectatingUid]);

  const cycleSpectate = useCallback((direction: 1 | -1) => {
    const uids = networkRef.current?.getRemoteUids() ?? [];
    if (uids.length === 0) return;
    const curIdx = spectatingUid ? uids.indexOf(spectatingUid) : -1;
    const nextIdx = (curIdx + direction + uids.length) % uids.length;
    const nextUid = uids[nextIdx];
    setSpectatingUid(nextUid);
    engineRef.current?.getCameraManager()?.setSpectateTarget(nextUid, networkRef.current);
  }, [spectatingUid]);

  // Spacebar key to cycle spectator target
  useEffect(() => {
    if (!isLocalDestroyed) return;
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        cycleSpectate(1);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isLocalDestroyed, cycleSpectate]);

  if (matchResult) {
    return (
      <MatchResultsScreen
        result={matchResult}
        localUid={profile.uid}
        onPlayAgain={onPlayAgain}
        onMainMenu={onExitToMenu}
      />
    );
  }

  const spectatingScore = spectatingUid
    ? networkRef.current?.getScoreboard().find((s) => s.uid === spectatingUid)
    : null;
  const spectatingCallsign = spectatingScore?.callsign ?? spectatingUid?.substring(0, 6) ?? '';

  return (
    <div
      id="multiplayer-game-page"
      style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: '#040814' }}
    >
      <GameCanvas onEngineReady={handleEngineReady} />

      {gameState?.phase === GamePhase.Playing && (
        <>
          <HUD gameState={gameState} fps={fps} />

          {/* Spectator Mode Overlay when local player is destroyed */}
          {isLocalDestroyed && (
            <SpectatorOverlay
              spectatingCallsign={spectatingCallsign}
              onPrev={() => cycleSpectate(-1)}
              onNext={() => cycleSpectate(1)}
              onExit={onExitToMenu}
            />
          )}

          {/* Multiplayer Scoreboard overlay (hold Tab) */}
          {showScoreboard && networkRef.current && (
            <ScoreboardOverlay
              scores={networkRef.current.getScoreboard()}
              localUid={profile.uid}
              elapsedSec={scoreManagerRef.current?.getMatchTimeSec() ?? 0}
            />
          )}

          {/* Connection Status Badge */}
          {connState !== 'connected' && (
            <div style={{
              position: 'absolute', top: 16, right: 20,
              background: 'rgba(255, 170, 0, 0.9)', color: '#000',
              padding: '6px 14px', borderRadius: 4,
              fontFamily: "'Orbitron', monospace", fontSize: 11, fontWeight: 'bold',
              letterSpacing: 1, zIndex: 300, boxShadow: '0 0 12px rgba(255, 170, 0, 0.4)',
            }}>
              ⚠️ {connState === 'reconnecting' ? 'RECONNECTING...' : 'DISCONNECTED'}
            </div>
          )}

          {/* Developer Network Diagnostics Debug Panel */}
          <NetworkDebugPanel
            connectionState={connState}
            fps={fps}
            networkManager={networkRef.current}
          />
        </>
      )}

      {engineRef.current && gameState?.phase === GamePhase.Playing && !isLocalDestroyed && (
        <TouchControls inputManager={engineRef.current.getInputManager()} />
      )}

      {gameState?.phase === GamePhase.Paused && (
        <PauseOverlay
          onResume={() => engineRef.current?.updateState({ phase: GamePhase.Playing })}
          onRestart={onPlayAgain}
          onExitToMenu={onExitToMenu}
        />
      )}
    </div>
  );
}

// ─── Spectator Overlay ────────────────────────────────────────────────────────

interface SpectatorOverlayProps {
  spectatingCallsign: string;
  onPrev: () => void;
  onNext: () => void;
  onExit: () => void;
}

function SpectatorOverlay({ spectatingCallsign, onPrev, onNext, onExit }: SpectatorOverlayProps) {
  return (
    <div style={{
      position: 'absolute',
      top: 30,
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(10, 20, 35, 0.92)',
      border: '1px solid rgba(255, 60, 60, 0.5)',
      borderRadius: '8px',
      padding: '16px 28px',
      textAlign: 'center',
      fontFamily: "'Orbitron', monospace",
      backdropFilter: 'blur(12px)',
      boxShadow: '0 0 24px rgba(255, 60, 60, 0.3)',
      zIndex: 250,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '8px',
    }}>
      <div style={{ fontSize: 11, letterSpacing: 3, color: '#ff4444', fontWeight: 'bold' }}>
        AIRCRAFT DESTROYED — SPECTATOR MODE
      </div>
      <div style={{ fontSize: 16, color: '#00ff88', fontWeight: 700, margin: '4px 0' }}>
        SPECTATING: {spectatingCallsign || 'WAITING FOR TARGET...'}
      </div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: 1 }}>
        PRESS SPACEBAR TO CYCLE TARGET
      </div>
      <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
        <button
          onClick={onPrev}
          style={{
            background: 'rgba(0,255,136,0.15)',
            border: '1px solid #00ff88',
            color: '#00ff88',
            padding: '6px 16px',
            fontSize: '11px',
            cursor: 'pointer',
            borderRadius: '4px',
            fontFamily: "'Orbitron', monospace",
          }}
        >
          ◄ PREV
        </button>
        <button
          onClick={onNext}
          style={{
            background: 'rgba(0,255,136,0.15)',
            border: '1px solid #00ff88',
            color: '#00ff88',
            padding: '6px 16px',
            fontSize: '11px',
            cursor: 'pointer',
            borderRadius: '4px',
            fontFamily: "'Orbitron', monospace",
          }}
        >
          NEXT ►
        </button>
        <button
          onClick={onExit}
          style={{
            background: 'rgba(255,60,60,0.15)',
            border: '1px solid #ff4444',
            color: '#ff4444',
            padding: '6px 16px',
            fontSize: '11px',
            cursor: 'pointer',
            borderRadius: '4px',
            fontFamily: "'Orbitron', monospace",
          }}
        >
          EXIT MATCH
        </button>
      </div>
    </div>
  );
}

// ─── Inline Scoreboard Overlay ────────────────────────────────────────────────

interface ScoreboardOverlayProps {
  scores:     { uid: string; callsign: string; kills: number; deaths: number }[];
  localUid:   string;
  elapsedSec: number;
}

function ScoreboardOverlay({ scores, localUid, elapsedSec }: ScoreboardOverlayProps) {
  const min = Math.floor(elapsedSec / 60);
  const sec = Math.floor(elapsedSec % 60);

  return (
    <div style={{
      position: 'absolute', top: '50%', left: '50%',
      transform: 'translate(-50%, -50%)',
      background: 'rgba(4,15,30,0.93)',
      border: '1px solid rgba(0,255,136,0.25)',
      padding: '28px 36px',
      minWidth: 380,
      fontFamily: "'Orbitron', monospace",
      backdropFilter: 'blur(16px)',
      zIndex: 200,
    }}>
      <div style={{ fontSize: 10, letterSpacing: 4, color: 'rgba(0,255,136,0.5)', marginBottom: 16 }}>
        SCOREBOARD — {min}:{sec.toString().padStart(2, '0')}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ fontSize: 9, letterSpacing: 3, color: 'rgba(255,255,255,0.3)' }}>
            <th style={{ textAlign: 'left', paddingBottom: 10 }}>PILOT</th>
            <th style={{ textAlign: 'center' }}>K</th>
            <th style={{ textAlign: 'center' }}>D</th>
          </tr>
        </thead>
        <tbody>
          {scores.map((s, i) => (
            <tr key={s.uid}>
              <td style={{ padding: '8px 0', fontSize: 13, fontWeight: 700,
                color: s.uid === localUid ? '#00b4ff' : '#fff' }}>
                {i + 1}. {s.callsign} {s.uid === localUid && '(YOU)'}
              </td>
              <td style={{ textAlign: 'center', color: '#00ff88', fontWeight: 700 }}>{s.kills}</td>
              <td style={{ textAlign: 'center', color: '#ff6060' }}>{s.deaths}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ fontSize: 9, letterSpacing: 2, color: 'rgba(255,255,255,0.2)',
        marginTop: 14, fontFamily: 'Rajdhani, sans-serif', textAlign: 'center' }}>
        HOLD TAB TO KEEP OPEN
      </div>
    </div>
  );
}
