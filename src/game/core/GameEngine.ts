import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { SceneManager } from './SceneManager';
import { GameLoop } from './GameLoop';
import type { GameState } from '../../types';
import { createDefaultGameState, GamePhase } from '../../types';
import { isMobile, getHardwareScaling } from '../../utils/platformDetect';
import { globalEventBus } from './EventBus';

/** Engine lifecycle status — readable by React via callbacks */
export type EngineStatus = 'idle' | 'initializing' | 'running' | 'error';

/**
 * GameEngine — owns the Babylon.js Engine and Scene lifecycle.
 *
 * Responsibilities:
 * - Create and manage the Babylon.js Engine (with DPR support)
 * - Own and drive the render loop (pure Babylon, no React state)
 * - Coordinate SceneManager (scene setup) and GameLoop (system updates)
 * - Hold the master GameState; notify React subscribers via callbacks
 * - Handle resize via ResizeObserver (registered externally) AND window resize
 *
 * This class contains NO React code. Communication with React
 * happens through GameState callbacks only.
 */
export class GameEngine {
  private engine: Engine | null = null;
  private sceneManager: SceneManager | null = null;
  private gameLoop: GameLoop | null = null;
  private _isRunning = false;
  private _status: EngineStatus = 'idle';
  private _gameState: GameState = createDefaultGameState();

  /** Callbacks registered by React components */
  private onStateChangeCallbacks: Array<(state: GameState) => void> = [];
  private onStatusChangeCallbacks: Array<(status: EngineStatus) => void> = [];

  // ─── Getters ─────────────────────────────────────────────────────────────

  get isRunning(): boolean {
    return this._isRunning;
  }

  get status(): EngineStatus {
    return this._status;
  }

  get gameState(): GameState {
    return this._gameState;
  }

  get scene(): Scene | null {
    return this.sceneManager?.scene ?? null;
  }

  /**
   * Current FPS as reported by the Babylon engine.
   * Safe to call at any time — returns 0 if engine isn't running.
   */
  getFps(): number {
    return this.engine?.getFps() ?? 0;
  }

  /**
   * Returns the InputManager instance for touch or custom control binding.
   */
  getInputManager() {
    return this.sceneManager?.getInputManager() ?? null;
  }

  getWeaponManager() {
    return this.sceneManager?.getWeaponManager() ?? null;
  }

  getTargetManager() {
    return this.sceneManager?.getTargetManager() ?? null;
  }

  /**
   * Returns the player AircraftController for multiplayer state reading.
   */
  getAircraftController() {
    return this.sceneManager?.getAircraftController() ?? null;
  }

  getCameraManager() {
    return this.sceneManager?.getCameraManager() ?? null;
  }

  prepareMultiplayerMode(): void {
    this.sceneManager?.prepareMultiplayerMode();
  }

  /**
   * Register an additional GameSystem (e.g. NetworkManager) into the running
   * game loop. The system's initialize() is called immediately with the active
   * scene; update() is called every frame thereafter.
   */
  registerAdditionalSystem(system: import('./GameLoop').GameSystem & { initialize?: (scene: import('@babylonjs/core/scene').Scene) => void }): void {
    if (!this.gameLoop || !this.sceneManager?.scene) {
      console.warn('[GameEngine] Cannot register system — engine not initialized.');
      return;
    }
    system.initialize?.(this.sceneManager.scene);
    this.gameLoop.registerAdditional(system);
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  /**
   * Initialize the Babylon engine with the given canvas.
   * Call once from the React canvas component on mount.
   *
   * @param canvas - The HTMLCanvasElement to render into
   */
  initialize(canvas: HTMLCanvasElement): void {
    if (this.engine) {
      console.warn('[GameEngine] Already initialized — call dispose() first.');
      return;
    }

    this.setStatus('initializing');

    try {
      const mobile = isMobile();
      const scaling = getHardwareScaling();

      this.engine = new Engine(canvas, true, {
        preserveDrawingBuffer: true,
        stencil:              true,
        antialias:            !mobile,         // AA off on mobile for perf
        adaptToDeviceRatio:   false,           // We manage DPR manually below
        powerPreference:      'high-performance',
      });

      // Apply hardware scaling — renders at lower resolution on mobile retina
      // scaling = 1.5 means render at 1/1.5 = ~67% of native resolution
      if (scaling > 1.0) {
        this.engine.setHardwareScalingLevel(scaling);
        console.log(`[GameEngine] Mobile retina detected (DPR=${window.devicePixelRatio.toFixed(1)}). Hardware scaling: ${scaling}x`);
      }

      this.sceneManager = new SceneManager(this.engine);
      this.sceneManager.createScene();

      this.gameLoop = new GameLoop();
      // Wire world systems (WorldManager, AircraftController) into the game loop
      this.sceneManager.registerSystems(this.gameLoop);

      // Bridge: AircraftController → GameEngine.updateState → React HUD
      // Allows the physics loop to push live SPD/ALT/HDG to the HUD at 10 Hz.
      this.sceneManager.setStateUpdater((partial) => this.updateState(partial));

      // Global event bus bindings
      import('../core/EventBus').then(({ globalEventBus }) => {
        globalEventBus.on('PLAYER_DESTROYED', () => {
          console.log('[GameEngine] Player destroyed, transitioning to GameOver phase in 3 seconds.');
          setTimeout(() => {
            this.updateState({ phase: GamePhase.GameOver });
          }, 3000);
        });
      });

      // Global resize fallback (canvas-level ResizeObserver is preferred —
      // registered externally in GameCanvas.tsx)
      window.addEventListener('resize', this.handleWindowResize);

      console.log('[GameEngine] Initialized. Engine version:', Engine.Version);
    } catch (err) {
      console.error('[GameEngine] Initialization failed:', err);
      this.setStatus('error');
    }
  }

  /** Start the render + game loop. Call after initialize(). */
  start(): void {
    if (!this.engine || !this.sceneManager) {
      console.error('[GameEngine] Cannot start — not initialized.');
      return;
    }
    if (this._isRunning) return;

    this._isRunning = true;

    let _firstFrame = true;

    this.engine.runRenderLoop(() => {
      const scene = this.sceneManager!.scene;
      if (!scene || !this._isRunning) return;

      // BUG-4 FIX: Cap deltaTime to 100 ms on the first frame.
      // getDeltaTime() on frame-0 returns the full scene initialization time
      // (~8–10 s on a slow machine), which teleports the aircraft kilometers
      // forward and triggers every SAM battery before the player sees anything.
      const rawDt = this.engine!.getDeltaTime();
      const clampedDt = _firstFrame ? Math.min(rawDt, 50) : Math.min(rawDt, 100);
      _firstFrame = false;
      const deltaTime = clampedDt / 1000; // ms → seconds

      this.gameLoop?.update(deltaTime, this._gameState);

      // Babylon render
      scene.render();
    });

    this.setStatus('running');
    console.log('[GameEngine] Started.');
  }

  /** Stop the render loop without disposing resources. */
  stop(): void {
    this._isRunning = false;
    this.engine?.stopRenderLoop();
    console.log('[GameEngine] Stopped.');
  }

  /**
   * Fully dispose all Babylon.js resources.
   * Must be called when the React canvas component unmounts.
   */
  dispose(): void {
    this.stop();
    window.removeEventListener('resize', this.handleWindowResize);

    this.gameLoop?.dispose();
    this.sceneManager?.dispose();
    this.engine?.dispose();

    this.gameLoop = null;
    this.sceneManager = null;
    this.engine = null;
    this._gameState = createDefaultGameState();
    this.setStatus('idle');

    /**
     * BUG-3 FIX: Clear the global EventBus on dispose.
     * All game systems register listeners on globalEventBus during initialize().
     * Without this clear(), every session adds new listeners that remain active
     * after the engine is torn down, causing ghost audio, mission triggers, etc.
     * All game-system dispose() methods are called above before this clear().
     */
    globalEventBus.clear();

    console.log('[GameEngine] Disposed — all resources freed.');
  }

  /**
   * Trigger a resize — call this from a ResizeObserver in GameCanvas.
   * Safe to call even if the engine isn't running yet.
   */
  resize(): void {
    this.engine?.resize();
  }

  // ─── State & Subscription ────────────────────────────────────────────────

  /** Update a slice of GameState and notify all React subscribers. */
  updateState(partial: Partial<GameState>): void {
    this._gameState = { ...this._gameState, ...partial };
    for (const cb of this.onStateChangeCallbacks) cb(this._gameState);
  }

  /**
   * Subscribe to GameState changes. Returns an unsubscribe function.
   * Example: const unsub = engine.onStateChange(setState); // in useEffect
   */
  onStateChange(callback: (state: GameState) => void): () => void {
    this.onStateChangeCallbacks.push(callback);
    return () => {
      this.onStateChangeCallbacks = this.onStateChangeCallbacks.filter(
        (cb) => cb !== callback,
      );
    };
  }

  /**
   * Subscribe to engine status changes.
   * Useful for showing a loading indicator while Babylon initializes.
   */
  onStatusChange(callback: (status: EngineStatus) => void): () => void {
    this.onStatusChangeCallbacks.push(callback);
    return () => {
      this.onStatusChangeCallbacks = this.onStatusChangeCallbacks.filter(
        (cb) => cb !== callback,
      );
    };
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private setStatus(status: EngineStatus): void {
    this._status = status;
    for (const cb of this.onStatusChangeCallbacks) cb(status);
  }

  private handleWindowResize = (): void => {
    this.engine?.resize();
  };
}
