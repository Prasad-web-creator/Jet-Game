import { useState, useCallback, useEffect, useRef } from 'react';
import GameCanvas from '../components/GameCanvas';
import HUD from '../ui/hud/HUD';
import { TouchControls } from '../ui/mobile';
import { GameOverOverlay } from '../ui/menus/GameOverOverlay';
import { VictoryOverlay } from '../ui/menus/VictoryOverlay';
import { PauseOverlay } from '../ui/menus/PauseOverlay';
import type { GameEngine } from '../game/core/GameEngine';
import type { GameState } from '../types';
import { GamePhase } from '../types';

interface GamePageProps {
  missionId?: string;
  onExitToMenu?: () => void;
}

function GamePage({ missionId, onExitToMenu }: GamePageProps) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [fps, setFps] = useState(0);
  const engineRef = useRef<GameEngine | null>(null);

  /**
   * BUG-1 FIX: Store the unsubscribe function in a ref so the cleanup
   * useEffect can call it when GamePage unmounts (user exits to menu).
   * Previously, the returned `unsub` from handleEngineReady was discarded.
   */
  const unsubRef = useRef<(() => void) | null>(null);

  // ─── FPS polling ─────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      if (engineRef.current) {
        setFps(Math.round(engineRef.current.getFps()));
      }
    }, 500);
    return () => clearInterval(id);
  }, []);

  // ─── Unsubscribe from engine state on unmount ─────────────────────────────
  // BUG-1 FIX: Clean up the engine's onStateChange subscription when the
  // GamePage unmounts so stale setState calls don't fire after exit.
  useEffect(() => {
    return () => {
      unsubRef.current?.();
      unsubRef.current = null;
    };
  }, []);

  // ─── Escape Key Pause Listener ────────────────────────────────────────────
  // BUG-9 FIX: Use a ref instead of gameState as dependency to avoid
  // re-registering the keydown listener 10× per second.
  const gameStateRef = useRef<GameState | null>(null);
  gameStateRef.current = gameState;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const current = gameStateRef.current;
      if (e.key === 'Escape' && current) {
        if (current.phase === GamePhase.Playing) {
          engineRef.current?.updateState({ phase: GamePhase.Paused });
        } else if (current.phase === GamePhase.Paused) {
          engineRef.current?.updateState({ phase: GamePhase.Playing });
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Registered once; reads live state via ref

  // ─── Engine ready callback ────────────────────────────────────────────────
  const handleEngineReady = useCallback((engine: GameEngine) => {
    engineRef.current = engine;

    // BUG-1 FIX: Store unsub reference so it can be called on unmount.
    const unsub = engine.onStateChange((state) => setGameState({ ...state }));
    unsubRef.current = unsub;

    // Set initial playing state — this triggers the first push
    engine.updateState({ phase: GamePhase.Playing });

    if (missionId) {
      console.log(`[GamePage] Starting selected mission: ${missionId}`);
    }
  }, [missionId]);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      id="game-page"
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: '#040814',
      }}
    >
      {/* Babylon.js 3D canvas — fills the entire viewport */}
      <GameCanvas onEngineReady={handleEngineReady} />

      {/* HTML HUD overlay — positioned above the canvas */}
      {gameState && gameState.phase === GamePhase.Playing && <HUD gameState={gameState} fps={fps} />}

      {/* Mobile Touch Controls overlay — feeds into InputManager */}
      {gameState && gameState.phase === GamePhase.Playing && engineRef.current && (
        <TouchControls inputManager={engineRef.current.getInputManager()} />
      )}

      {/* Pause Menu Overlay */}
      {gameState?.phase === GamePhase.Paused && (
        <PauseOverlay
          onResume={() => engineRef.current?.updateState({ phase: GamePhase.Playing })}
          onRestart={() => window.location.reload()}
          onExitToMenu={() => onExitToMenu ? onExitToMenu() : window.location.reload()}
        />
      )}

      {/* Game Over Screen */}
      {gameState?.phase === GamePhase.GameOver && (
        <GameOverOverlay
          score={gameState.score}
          onRestart={() => window.location.reload()}
        />
      )}

      {/* Mission Victory Screen */}
      {gameState?.phase === GamePhase.Victory && (
        <VictoryOverlay
          missionName={gameState.currentMission?.name ?? 'MISSION COMPLETE'}
          rewards={gameState.currentMission?.rewards ?? { score: 1000 }}
          onNextMission={() => window.location.reload()}
        />
      )}
    </div>
  );
}

export default GamePage;
