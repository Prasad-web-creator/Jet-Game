/**
 * BoostFlameSystem — Afterburner exhaust particle system for the player aircraft.
 *
 * Attaches a blue-white flame cone behind the jet engines.
 * Activates on boost start, deactivates (with fade) on boost stop.
 * The emitter follows the aircraft mesh every frame.
 */

import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Mesh } from '@babylonjs/core/Meshes/mesh';

const FLARE_URL = 'https://raw.githubusercontent.com/BabylonJS/Babylon.js/master/packages/tools/playground/public/textures/flare.png';

export class BoostFlameSystem {
  private ps: ParticleSystem | null = null;
  private emitterRoot: Mesh | null = null;
  private _active = false;
  private _fadeTimer = 0;

  initialize(scene: Scene): void {
    this.emitterRoot = new Mesh('boost_emitter', scene);
    this.emitterRoot.isPickable = false;

    const ps = new ParticleSystem('boost_flame', 200, scene);
    ps.particleTexture = new Texture(FLARE_URL, scene, false, false,
      Texture.BILINEAR_SAMPLINGMODE, null, () => { /* silent fallback */ });

    ps.emitter    = this.emitterRoot;
    ps.minEmitBox = new Vector3(-0.5, -0.2, 0);
    ps.maxEmitBox = new Vector3(0.5,  0.2,  0);

    // Blue-white core → orange outer flame
    ps.color1    = new Color4(0.6, 0.8, 1.0, 1.0); // blue-white
    ps.color2    = new Color4(0.9, 0.6, 0.2, 0.9); // orange
    ps.colorDead = new Color4(0.4, 0.2, 0.0, 0.0); // dark fade

    ps.minSize     = 0.3;
    ps.maxSize     = 1.2;
    ps.minLifeTime = 0.08;
    ps.maxLifeTime = 0.22;
    ps.emitRate    = 300;

    // Emit backward along -Z (behind the aircraft)
    ps.direction1 = new Vector3(-0.3, -0.3, -8.0);
    ps.direction2 = new Vector3(0.3,   0.3, -6.0);
    ps.minEmitPower = 6;
    ps.maxEmitPower = 12;
    ps.gravity      = Vector3.Zero();
    ps.updateSpeed  = 0.015;

    ps.stop(); // Start inactive
    this.ps = ps;
  }

  /** Update emitter to follow aircraft. Call every frame. */
  update(dt: number, aircraftPosition: Vector3, aircraftForward: Vector3): void {
    if (!this.emitterRoot || !this.ps) return;

    // Position emitter 2m behind aircraft
    const behindOffset = aircraftForward.scale(-2.0);
    this.emitterRoot.position.copyFrom(aircraftPosition.add(behindOffset));

    // Handle fade-out after boost stops
    if (this._fadeTimer > 0) {
      this._fadeTimer -= dt;
      if (this._fadeTimer <= 0) {
        this._fadeTimer = 0;
      }
    }
  }

  /** Activate the afterburner flame. */
  start(): void {
    if (this._active || !this.ps) return;
    this._active    = true;
    this._fadeTimer = 0;
    this.ps.start();
  }

  /** Deactivate the afterburner flame (fade naturally). */
  stop(): void {
    if (!this._active || !this.ps) return;
    this._active    = false;
    this._fadeTimer = 0.3;
    this.ps.stop(); // Stop emitting; existing particles fade out
  }

  get isActive(): boolean { return this._active; }

  dispose(): void {
    this.ps?.dispose();
    this.emitterRoot?.dispose();
    this.ps          = null;
    this.emitterRoot = null;
  }
}
