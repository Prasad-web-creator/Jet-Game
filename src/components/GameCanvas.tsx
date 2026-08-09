import { useRef, useEffect, useCallback, useState } from 'react';
import { GameEngine } from '../game/core/GameEngine';
import type { EngineStatus } from '../game/core/GameEngine';

/**
 * GameCanvas — React ↔ Babylon.js bridge.
 *
 * Responsibilities (React side only — no game logic here):
 *   1. Render a <canvas> that fills its container
 *   2. On mount: create GameEngine, initialize with canvas, start render loop
 *   3. On unmount: dispose all Babylon.js resources (no memory leaks)
 *   4. ResizeObserver on the wrapper div — precise, frame-accurate resize
 *   5. StrictMode guard — prevents double-initialization in React 19 dev mode
 *
 * The component exposes an optional `onEngineReady` callback so parent
 * components (GamePage) can subscribe to engine events without holding
 * a ref to the engine themselves.
 */

export interface GameCanvasProps {
  onEngineReady?: (engine: GameEngine) => void;
  spawnSlotIndex?: number;
}

function GameCanvas({ onEngineReady, spawnSlotIndex = 0 }: GameCanvasProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const engineRef  = useRef<GameEngine | null>(null);

  /** Prevents double-init in React 19 StrictMode (which double-invokes effects) */
  const didInitRef = useRef(false);

  const [engineStatus, setEngineStatus] = useState<EngineStatus>('idle');

  // ─── Engine lifecycle ─────────────────────────────────────────────────────

  const initEngine = useCallback(() => {
    if (didInitRef.current || !canvasRef.current) return;
    didInitRef.current = true;

    const engine = new GameEngine();

    // Track status changes for the loading overlay
    engine.onStatusChange((status) => setEngineStatus(status));

    engine.initialize(canvasRef.current, spawnSlotIndex);
    engine.start();
    engineRef.current = engine;

    onEngineReady?.(engine);
  }, [onEngineReady, spawnSlotIndex]);

  const disposeEngine = useCallback(() => {
    engineRef.current?.dispose();
    engineRef.current = null;
    didInitRef.current = false;
    setEngineStatus('idle');
  }, []);

  // ─── Mount / Unmount ──────────────────────────────────────────────────────

  useEffect(() => {
    initEngine();
    return disposeEngine;
  }, [initEngine, disposeEngine]);

  // ─── ResizeObserver ───────────────────────────────────────────────────────
  // Observes the wrapper div's bounding box.
  // More precise than window.resize — fires when any ancestor CSS changes size.

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const observer = new ResizeObserver(() => {
      engineRef.current?.resize();
    });

    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  // ─── Render ───────────────────────────────────────────────────────────────

  const isLoading = engineStatus === 'idle' || engineStatus === 'initializing';

  return (
    <div
      ref={wrapperRef}
      id="game-canvas-wrapper"
      style={{ position: 'relative', width: '100%', height: '100%' }}
    >
      {/* The Babylon.js render target */}
      <canvas
        ref={canvasRef}
        id="game-canvas"
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          outline: 'none',
          touchAction: 'none', // prevent mobile scroll while dragging the scene
        }}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* Loading overlay — shown while Babylon initializes */}
      {isLoading && (
        <div
          id="game-loading-overlay"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(4, 8, 20, 0.92)',
            color: 'rgba(0, 255, 136, 0.9)',
            fontFamily: "'Orbitron', monospace",
            gap: '16px',
            pointerEvents: 'none',
          }}
        >
          <div className="engine-spinner" />
          <span style={{ fontSize: '12px', letterSpacing: '4px' }}>
            INITIALIZING ENGINE
          </span>
        </div>
      )}

      {/* Error overlay */}
      {engineStatus === 'error' && (
        <div
          id="game-error-overlay"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(20, 4, 4, 0.95)',
            color: 'rgba(255, 80, 80, 0.95)',
            fontFamily: "'Orbitron', monospace",
            fontSize: '14px',
            letterSpacing: '2px',
          }}
        >
          ⚠ ENGINE INITIALIZATION FAILED
        </div>
      )}
    </div>
  );
}

export default GameCanvas;
