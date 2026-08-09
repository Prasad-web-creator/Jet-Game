import { Scene } from '@babylonjs/core/scene';
import type { GameSystem } from '../core/GameLoop';
import type { GameState } from '../../types';

// ─── InputSnapshot ────────────────────────────────────────────────────────────

/**
 * InputSnapshot — immutable record of the player's input state for one frame.
 *
 * Built once per frame at the top of `InputManager.update()` and then frozen.
 * All game systems that need input read from the SAME snapshot object —
 * no system consumes or mutates the input state independently.
 *
 * One-shot fields (`cameraToggle`, `targetLock`, `pause`, etc.) are `true` for
 * exactly one frame after the key is pressed, then reset to `false`.
 *
 * Held fields (`throttleUp`, `boost`, `rollLeft`, etc.) remain `true` as long
 * as the key / button is held down.
 *
 * Mouse deltas (`mouseDeltaX`, `mouseDeltaY`) accumulate all `mousemove` events
 * since the last frame, then reset to 0 after the snapshot is built.
 */
export interface InputSnapshot {
  // ── Throttle (held) ──────────────────────────────────────────────────────
  /** W / ↑ — increase engine throttle */
  throttleUp:   boolean;
  /** S / ↓ — decrease engine throttle */
  throttleDown: boolean;

  // ── Roll (held) ───────────────────────────────────────────────────────────
  /** A / ← — bank left */
  rollLeft:  boolean;
  /** D / → — bank right */
  rollRight: boolean;

  // ── Mouse (reset each frame) ──────────────────────────────────────────────
  /** Horizontal mouse movement in pixels since the last frame (pointer-locked only) */
  mouseDeltaX:   number;
  /** Vertical mouse movement in pixels since the last frame (pointer-locked only) */
  mouseDeltaY:   number;
  /** True while the pointer is captured (pointer lock active) */
  mouseIsLocked: boolean;

  // ── Speed modifiers (held) ────────────────────────────────────────────────
  /** Space — afterburner: speed increases beyond normal max */
  boost:    boolean;
  /** Shift — air brake: speed decreases toward min */
  airBrake: boolean;

  // ── Touch / Analog Joystick ───────────────────────────────────────────────
  /** Touch joystick X axis [-1, 1] — roll control */
  joystickX:     number;
  /** Touch joystick Y axis [-1, 1] — pitch rate control */
  joystickY:     number;

  // ── Weapons (held — fire rate is controlled by WeaponManager) ────────────
  /** Left mouse button or touch FIRE — machine gun trigger */
  fireGun:     boolean;
  /** Right mouse button or touch MISSILE — missile launch */
  fireMissile: boolean;

  // ── System (one-shot) ────────────────────────────────────────────────────
  /** R / Touch LOCK — request target lock */
  targetLock:   boolean;
  /** G — toggle landing gear */
  toggleGear:   boolean;
  /** F / Touch CAM — cycle camera mode */
  cameraToggle: boolean;
  /** Tab — hold to look backward */
  lookBack:     boolean;
  /** Esc / pointer lock exit — pause the game */
  pause:        boolean;
}

export type TouchAction = 'fireGun' | 'fireMissile' | 'boost' | 'airBrake' | 'targetLock' | 'cameraToggle';

/** All-false / zero-delta snapshot — safe default before the first update(). */
export const DEFAULT_SNAPSHOT: InputSnapshot = {
  throttleUp:    false,
  throttleDown:  false,
  rollLeft:      false,
  rollRight:     false,
  mouseDeltaX:   0,
  mouseDeltaY:   0,
  mouseIsLocked: false,
  joystickX:     0,
  joystickY:     0,
  boost:         false,
  airBrake:      false,
  fireGun:       false,
  fireMissile:   false,
  targetLock:    false,
  toggleGear:    false,
  cameraToggle:  false,
  lookBack:      false,
  pause:         false,
};

// ─── Keys that must not trigger browser default behaviour ─────────────────────
// (page scroll, tab focus, space-to-click, etc.)
const PREVENTED_CODES = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Space', 'Tab',
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ShiftLeft', 'ShiftRight',
  'KeyF', 'KeyR', 'KeyG',
]);

// ─── InputManager ─────────────────────────────────────────────────────────────

/**
 * InputManager — the single source of truth for all player input.
 *
 * Implements `GameSystem` and is registered FIRST in the GameLoop so it runs
 * before aircraft physics or the camera update each frame.
 *
 * ─── Pointer lock ────────────────────────────────────────────────────────────
 *
 *   Pointer lock is requested automatically when the player clicks the game
 *   canvas. While locked:
 *     • The cursor is hidden and confined to the window.
 *     • `mousemove.movementX/Y` feeds `mouseDeltaX/Y`.
 *   When Esc is pressed, the browser releases the pointer lock and fires a
 *   `pointerlockchange` event → InputManager sets `_pausePending = true`.
 *
 * ─── Frame lifecycle ─────────────────────────────────────────────────────────
 *
 *   Browser events accumulate changes asynchronously into private fields.
 *   Each frame:
 *   1. `update()` builds `_snapshot` from the current accumulated state.
 *   2. `update()` resets accumulated delta / one-shot fields.
 *   3. `getSnapshot()` returns the same frozen snapshot to any caller.
 *
 * ─── Adding new key bindings ────────────────────────────────────────────────
 *
 *   To make controls configurable in future:
 *   1. Add a new field to `InputSnapshot`.
 *   2. Map the desired key code in `update()`.
 *   3. Optionally add the code to `PREVENTED_CODES`.
 *
 *   A future `KeyBinding` map (`action → code`) can replace the hard-coded
 *   `_keysDown.has('KeyX')` checks with a lookup.
 */
export class InputManager implements GameSystem {
  readonly name = 'InputManager';

  private _canvas: HTMLCanvasElement | null = null;

  // ── Keyboard ──────────────────────────────────────────────────────────────
  /** Set of currently held key codes (e.g. 'KeyW', 'ArrowLeft'). */
  private _keysDown = new Set<string>();

  // ── Mouse ─────────────────────────────────────────────────────────────────
  /** Accumulated horizontal mouse movement in pixels since the last frame. */
  private _accDeltaX = 0;
  /** Accumulated vertical mouse movement in pixels since the last frame. */
  private _accDeltaY = 0;
  /** Current held state of mouse buttons. */
  private _mouseLeft  = false;
  private _mouseRight = false;
  private _pointerLocked = false;

  // ── Touch Controls ────────────────────────────────────────────────────────
  private _touchJoystickX = 0;
  private _touchJoystickY = 0;
  private _touchButtons = new Map<TouchAction, boolean>();

  // ── One-shot pending flags ────────────────────────────────────────────────
  private _cameraTogglePending = false;
  private _targetLockPending   = false;
  private _toggleGearPending   = false;
  private _pausePending        = false;

  // ── Current frame snapshot ────────────────────────────────────────────────
  private _snapshot: InputSnapshot = { ...DEFAULT_SNAPSHOT };

  // ─── Touch API ────────────────────────────────────────────────────────────

  /** Set virtual joystick position [-1, 1] for X and Y axes. */
  setTouchJoystick(x: number, y: number): void {
    this._touchJoystickX = Math.max(-1, Math.min(1, x));
    this._touchJoystickY = Math.max(-1, Math.min(1, y));
  }

  /** Set touch action button state (fire, missile, boost, brake, lock, camera). */
  setTouchButton(action: TouchAction, pressed: boolean): void {
    this._touchButtons.set(action, pressed);
    if (pressed) {
      if (action === 'targetLock')   this._targetLockPending   = true;
      if (action === 'cameraToggle') this._cameraTogglePending = true;
    }
  }

  // ─── GameSystem ───────────────────────────────────────────────────────────

  initialize(scene: Scene): void {
    this._canvas = scene.getEngine().getRenderingCanvas() as HTMLCanvasElement;

    // Keyboard
    window.addEventListener('keydown',     this._onKeyDown,     { passive: false });
    window.addEventListener('keyup',       this._onKeyUp);

    // Mouse
    window.addEventListener('mousemove',   this._onMouseMove,   { passive: true });
    window.addEventListener('mousedown',   this._onMouseDown);
    window.addEventListener('mouseup',     this._onMouseUp);
    window.addEventListener('contextmenu', this._onContextMenu, { passive: false });

    // Pointer lock
    this._canvas?.addEventListener('click',         this._onCanvasClick);
    document.addEventListener('pointerlockchange', this._onPointerLockChange);

    console.log('[InputManager] Ready. Click the game canvas to lock mouse & enable aim.');
  }

  /**
   * Called once per frame by the GameLoop (before aircraft + camera updates).
   * Builds the snapshot, then resets one-shot / delta fields.
   */
  update(_dt: number, _gameState: GameState): void {
    const isTouchBoost = !!this._touchButtons.get('boost');
    const isTouchBrake = !!this._touchButtons.get('airBrake');
    const isTouchFire  = !!this._touchButtons.get('fireGun');
    const isTouchMsl   = !!this._touchButtons.get('fireMissile');

    this._snapshot = {
      throttleUp:    this._keysDown.has('KeyW')      || this._keysDown.has('ArrowUp'),
      throttleDown:  this._keysDown.has('KeyS')      || this._keysDown.has('ArrowDown'),
      rollLeft:      this._keysDown.has('KeyA')      || this._keysDown.has('ArrowLeft'),
      rollRight:     this._keysDown.has('KeyD')      || this._keysDown.has('ArrowRight'),
      mouseDeltaX:   this._accDeltaX,
      mouseDeltaY:   this._accDeltaY,
      mouseIsLocked: this._pointerLocked,
      joystickX:     this._touchJoystickX,
      joystickY:     this._touchJoystickY,
      boost:         this._keysDown.has('Space')     || isTouchBoost,
      airBrake:      this._keysDown.has('ShiftLeft') || this._keysDown.has('ShiftRight') || isTouchBrake,
      fireGun:       this._mouseLeft                 || isTouchFire,
      fireMissile:   this._mouseRight                || isTouchMsl,
      targetLock:    this._targetLockPending,
      toggleGear:    this._toggleGearPending,
      cameraToggle:  this._cameraTogglePending,
      lookBack:      this._keysDown.has('Tab'),
      pause:         this._pausePending,
    };

    // Reset accumulated / one-shot state — the snapshot captured them above
    this._accDeltaX          = 0;
    this._accDeltaY          = 0;
    this._cameraTogglePending = false;
    this._targetLockPending   = false;
    this._toggleGearPending   = false;
    this._pausePending        = false;
  }

  /**
   * Returns the current frame's input snapshot.
   * The same object is returned to all callers within the same frame —
   * do NOT mutate it.
   */
  getSnapshot(): Readonly<InputSnapshot> {
    return this._snapshot;
  }

  /** Programmatically request pointer lock (e.g. from a 'Click to Fly' overlay). */
  requestPointerLock(): void {
    this._canvas?.requestPointerLock();
  }

  /** Release pointer lock without triggering a pause (e.g. opening the menu). */
  releasePointerLock(): void {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  dispose(): void {
    window.removeEventListener('keydown',     this._onKeyDown);
    window.removeEventListener('keyup',       this._onKeyUp);
    window.removeEventListener('mousemove',   this._onMouseMove);
    window.removeEventListener('mousedown',   this._onMouseDown);
    window.removeEventListener('mouseup',     this._onMouseUp);
    window.removeEventListener('contextmenu', this._onContextMenu);

    if (this._canvas) {
      this._canvas.removeEventListener('click', this._onCanvasClick);
    }
    document.removeEventListener('pointerlockchange', this._onPointerLockChange);

    if (document.pointerLockElement) document.exitPointerLock();

    this._keysDown.clear();
    this._canvas = null;
    console.log('[InputManager] Disposed.');
  }

  // ─── Event handlers ───────────────────────────────────────────────────────
  // Arrow functions so `this` is always the InputManager instance.

  private _onKeyDown = (e: KeyboardEvent): void => {
    this._keysDown.add(e.code);

    // One-shot triggers (captured at event time, consumed next update())
    if (e.code === 'KeyF')   this._cameraTogglePending = true;
    if (e.code === 'KeyR')   this._targetLockPending   = true;
    if (e.code === 'KeyG')   this._toggleGearPending   = true;
    if (e.code === 'Escape') {
      // While pointer is locked, Esc is intercepted by the browser to exit
      // pointer lock — we detect that via pointerlockchange instead.
      // When already unlocked, treat Esc as a pause command.
      if (!this._pointerLocked) this._pausePending = true;
    }

    // Prevent browser default for game keys (scroll, tab-navigation, etc.)
    if (PREVENTED_CODES.has(e.code)) {
      e.preventDefault();
    }
  };

  private _onKeyUp = (e: KeyboardEvent): void => {
    this._keysDown.delete(e.code);
  };

  private _onMouseMove = (e: MouseEvent): void => {
    if (!this._pointerLocked) return; // ignore mouse when cursor is free
    this._accDeltaX += e.movementX;
    this._accDeltaY += e.movementY;
  };

  private _onMouseDown = (e: MouseEvent): void => {
    if (e.button === 0) this._mouseLeft  = true;
    if (e.button === 2) this._mouseRight = true;
  };

  private _onMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) this._mouseLeft  = false;
    if (e.button === 2) this._mouseRight = false;
  };

  /** Prevent the right-click context menu from appearing during gameplay. */
  private _onContextMenu = (e: Event): void => {
    e.preventDefault();
  };

  private _onCanvasClick = (): void => {
    if (!this._pointerLocked) {
      // requestPointerLock returns a promise in modern browsers.
      // Catch WrongDocumentError thrown in non-user-gesture contexts (e.g., automated tests).
      const result = this._canvas?.requestPointerLock();
      if (result instanceof Promise) {
        result.catch(() => { /* pointer lock requires a real user gesture */ });
      }
    }
  };

  private _onPointerLockChange = (): void => {
    const nowLocked = document.pointerLockElement === this._canvas;
    if (this._pointerLocked && !nowLocked) {
      // Pointer lock was released (Esc or focus lost) → pause
      this._pausePending = true;
    }
    this._pointerLocked = nowLocked;
    console.log(`[InputManager] Pointer lock → ${nowLocked ? 'LOCKED 🎯' : 'UNLOCKED'}`);
  };
}
