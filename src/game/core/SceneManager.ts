import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { Effect } from '@babylonjs/core/Materials/effect';
import { WorldManager }       from '../world/WorldManager';
import { InputManager }       from '../controls/InputManager';
import { AircraftController } from '../aircraft/AircraftController';
import { CameraManager }      from '../camera/CameraManager';
import type { GameLoop }  from './GameLoop';
import type { GameState } from '../../types';

import { TargetManager }       from '../targets/TargetManager';
import { WeaponManager }       from '../weapons/WeaponManager';
import { EffectManager }       from '../effects/EffectManager';
import { GroundDefenseManager } from '../defenses/GroundDefenseManager';
import { MissionManager }       from '../missions/MissionManager';
import { AudioManager }         from '../audio/AudioManager';
import { AudioEvents }          from '../audio/AudioEvents';
import { EnemyManager }         from '../enemies/EnemyManager';


/**
 * SceneManager — creates and owns the Babylon.js Scene.
 *
 * ─── System initialization order ────────────────────────────────────────────
 *
 *   1. WorldManager.initialize()      — terrain, zones, nature
 *   2. InputManager.initialize()      — attaches event listeners, pointer lock
 *   3. AircraftController.initialize() — spawns jet (needs InputManager)
 *   4. CameraManager.initialize()     — creates cameras from spawn state
 *   5. TargetManager.initialize()     — spawns target drones & ground targets
 *   6. WeaponManager.initialize()     — machine gun, projectile pools, hit detection
 *   7. EffectManager.initialize()     — explosions and particle effects
 *   8. GroundDefenseManager.initialize() — radars, SAMs, AAA guns
 *   9. MissionManager.initialize()    — mission objectives, triggers
 *   10. EnemyManager.initialize()     — AI enemy fighter jets
 *   11. AudioManager.initialize()     — audio nodes and context
 */
export class SceneManager {
  private _scene:             Scene              | null = null;
  private engine:             Engine;
  private worldManager:       WorldManager       | null = null;
  private inputManager:       InputManager       | null = null;
  private aircraftController: AircraftController | null = null;
  private cameraManager:      CameraManager      | null = null;
  private targetManager:      TargetManager      | null = null;
  private weaponManager:      WeaponManager      | null = null;
  private effectManager:      EffectManager      | null = null;
  private groundDefenseManager: GroundDefenseManager | null = null;
  private missionManager:     MissionManager     | null = null;
  private enemyManager:       EnemyManager       | null = null;
  private audioManager:       AudioManager       | null = null;
  private audioEvents:        AudioEvents        | null = null;

  constructor(engine: Engine) {
    this.engine = engine;
  }

  get scene(): Scene | null {
    return this._scene;
  }

  getInputManager(): InputManager | null {
    return this.inputManager;
  }

  getWeaponManager(): WeaponManager | null {
    return this.weaponManager;
  }

  getTargetManager(): TargetManager | null {
    return this.targetManager;
  }

  getAircraftController(): import('../aircraft/AircraftController').AircraftController | null {
    return this.aircraftController;
  }


  // ─── Scene Creation ───────────────────────────────────────────────────────

  createScene(spawnSlotIndex = 0): Scene {
    this._scene = new Scene(this.engine);

    // ── Babylon.js scene settings ──────────────────────────────────────────
    // skipPointerMovePicking: Disables per-frame raycast on mouse move.
    this._scene.skipPointerMovePicking = true;


    this.setupBackground();
    this.setupFog();
    this.setupLights();

    // 1. World
    this.worldManager = new WorldManager();
    this.worldManager.initialize(this._scene);

    // 2. Input
    this.inputManager = new InputManager();
    this.inputManager.initialize(this._scene);

    // 3. Aircraft
    this.aircraftController = new AircraftController(this.inputManager);
    this.aircraftController.setSpawnSlotIndex(spawnSlotIndex);
    this.aircraftController.initialize(this._scene);

    // 4. Camera
    this.cameraManager = new CameraManager(this.aircraftController, this.inputManager);
    this.cameraManager.initialize(this._scene);

    // 5. Targets (drones & ground towers)
    this.targetManager = new TargetManager();
    this.targetManager.setDependencies(this.aircraftController, this.inputManager);
    this.targetManager.initialize(this._scene);

    // 6. Weapons (machine gun & projectiles)
    this.weaponManager = new WeaponManager(
      this.inputManager,
      this.aircraftController,
      this.cameraManager,
      this.targetManager
    );
    this.weaponManager.initialize(this._scene);

    // 7. Effects (Explosions + VFX)
    this.effectManager = new EffectManager(this.cameraManager);
    this.effectManager.initialize(this._scene);
    this.effectManager.setAircraftController(this.aircraftController);

    // 8. Ground Defenses (Radars, SAMs, AAA Guns)
    this.groundDefenseManager = new GroundDefenseManager();
    this.groundDefenseManager.setDependencies(this.aircraftController, this.targetManager);
    this.groundDefenseManager.initialize(this._scene);

    // 9. Mission Manager Framework
    this.missionManager = new MissionManager();
    this.missionManager.setDependencies(this.aircraftController, this.targetManager);
    this.missionManager.initialize(this._scene);

    // 10. Enemy AI Fighter Jets
    this.enemyManager = new EnemyManager();
    this.enemyManager.setDependencies(this.aircraftController, this.targetManager);
    this.enemyManager.initialize(this._scene);

    // 10. Audio (initialize last — needs scene ready for first-gesture context)
    this.audioManager = new AudioManager();
    this.audioManager.initialize();
    this.audioEvents  = new AudioEvents(this.audioManager);
    this.audioEvents.bind();
    this.audioEvents.startEngine();

    return this._scene;
  }

  /**
   * Register systems into the GameLoop in the required update order.
   *
   * PERF FIX: CameraManager is now registered BEFORE TargetManager so that
   * target screen-space projection (_computeScreenPos) uses the camera transform
   * that has already been updated for the current frame. Previously, projection
   * ran with last frame's camera state, causing a 1-frame reticle lag during
   * rapid camera movement.
   *
   * Correct update order:
   *   InputManager → WorldManager → AircraftController → CameraManager →
   *   TargetManager → GroundDefenseManager → MissionManager → EnemyManager →
   *   WeaponManager → EffectManager
   */
  registerSystems(loop: GameLoop): void {
    if (this.inputManager)         loop.registerSystem(this.inputManager);
    if (this.worldManager)         loop.registerSystem(this.worldManager);
    if (this.aircraftController)   loop.registerSystem(this.aircraftController);
    if (this.cameraManager)        loop.registerSystem(this.cameraManager);        // ← moved before TargetManager
    if (this.targetManager)        loop.registerSystem(this.targetManager);
    if (this.groundDefenseManager) loop.registerSystem(this.groundDefenseManager);
    if (this.missionManager)       loop.registerSystem(this.missionManager);
    if (this.enemyManager)         loop.registerSystem(this.enemyManager);
    if (this.weaponManager)        loop.registerSystem(this.weaponManager);
    if (this.effectManager)        loop.registerSystem(this.effectManager);
  }

  /** Wire GameEngine.updateState → AircraftController → React HUD (10 Hz). */
  setStateUpdater(fn: (partial: Partial<GameState>) => void): void {
    this.aircraftController?.setStateUpdater(fn);
  }

  /**
   * Clears singleplayer AI systems (EnemyManager, GroundDefenseManager, MissionManager)
   * so players in a multiplayer match only fight each other.
   */
  prepareMultiplayerMode(): void {
    if (this.enemyManager) {
      this.enemyManager.dispose();
      this.enemyManager = null;
    }
    if (this.groundDefenseManager) {
      this.groundDefenseManager.dispose();
      this.groundDefenseManager = null;
    }
    if (this.missionManager) {
      this.missionManager.dispose();
      this.missionManager = null;
    }
    this.targetManager?.clearTargets();
    console.log('[SceneManager] Prepared multiplayer mode — AI enemies & SAM defenses cleared.');
  }

  getCameraManager(): CameraManager | null {
    return this.cameraManager;
  }

  // ─── Private Setup ────────────────────────────────────────────────────────

  private setupBackground(): void {
    const scene = this._scene!;
    // Fallback clear color
    scene.clearColor = new Color4(0.70, 0.82, 0.94, 1.0);

    // ── Gradient sky dome ──────────────────────────────────────────────────
    // Custom vertex+fragment shader:
    //   Top:     vibrant stylized azure blue  rgb(62, 132, 214)
    //   Horizon: warm soft sky haze           rgb(180, 210, 240)
    //   Below:   warm desert ochre tint       rgb(190, 185, 128)
    Effect.ShadersStore['skyGradientVertexShader'] = `
      precision highp float;
      attribute vec3 position;
      uniform mat4 worldViewProjection;
      varying float vY;
      void main() {
        gl_Position = worldViewProjection * vec4(position, 1.0);
        vY = position.y;
      }
    `;
    Effect.ShadersStore['skyGradientFragmentShader'] = `
      precision highp float;
      varying float vY;
      void main() {
        float t = clamp(vY, -1.0, 1.0);
        // Below horizon (warm desert ground haze)
        vec3 groundCol  = vec3(0.75, 0.72, 0.50);
        // Horizon band (soft warm sky blue)
        vec3 horizonCol = vec3(0.72, 0.82, 0.94);
        // Zenith (clear stylized azure)
        vec3 zenithCol  = vec3(0.24, 0.52, 0.84);
        vec3 col;
        if (t < 0.0) {
          col = mix(groundCol, horizonCol, t + 1.0);
        } else {
          col = mix(horizonCol, zenithCol, pow(t, 0.65));
        }
        gl_FragColor = vec4(col, 1.0);
      }
    `;

    const skyMat = new ShaderMaterial('skyGradientMat', scene, {
      vertex:   'skyGradient',
      fragment: 'skyGradient',
    }, {
      attributes: ['position'],
      uniforms:   ['worldViewProjection'],
    });
    skyMat.backFaceCulling = false;
    skyMat.disableDepthWrite = true;

    const skyDome = MeshBuilder.CreateSphere('skyDome', {
      diameter: 38000, segments: 12,
    }, scene);
    skyDome.material = skyMat;
    skyDome.infiniteDistance = true;
    skyDome.renderingGroupId = 0;
    skyDome.isPickable = false;
  }

  private setupFog(): void {
    const scene = this._scene!;
    scene.fogMode    = Scene.FOGMODE_EXP2;
    scene.fogDensity = 0.000045;  // soft depth fading for distant low-poly ridges
    scene.fogColor   = new Color3(0.72, 0.82, 0.94); // matches horizon sky blue
  }

  private setupLights(): void {
    const scene = this._scene!;

    // Warm golden directional sunlight — creates crisp facet highlights and shadows
    const sun = new DirectionalLight(
      'sun',
      new Vector3(-0.62, -0.74, -0.26).normalize(),
      scene,
    );
    sun.intensity = 1.65;
    sun.diffuse   = new Color3(1.00, 0.97, 0.84);
    sun.specular  = new Color3(0.15, 0.15, 0.10);

    // Hemispheric ambient light: sky blue from above, warm chartreuse/ochre bounce from below
    const sky = new HemisphericLight('skyAmbient', new Vector3(0, 1, 0), scene);
    sky.intensity   = 0.55;
    sky.diffuse     = new Color3(0.66, 0.78, 0.96);
    sky.groundColor = new Color3(0.50, 0.48, 0.25);
    sky.specular    = new Color3(0, 0, 0);
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  dispose(): void {
    this.audioEvents?.stopEngine();
    this.audioEvents?.dispose();
    this.audioManager?.dispose();
    this.missionManager?.dispose();
    this.groundDefenseManager?.dispose();
    this.effectManager?.dispose();
    this.weaponManager?.dispose();
    this.targetManager?.dispose();
    this.cameraManager?.dispose();
    this.aircraftController?.dispose();
    this.inputManager?.dispose();
    this.worldManager?.dispose();
    this.audioManager       = null;
    this.audioEvents        = null;
    this.missionManager     = null;
    this.groundDefenseManager = null;
    this.effectManager      = null;
    this.weaponManager      = null;
    this.targetManager      = null;
    this.cameraManager      = null;
    this.aircraftController = null;
    this.inputManager       = null;
    this.worldManager       = null;
    this._scene?.dispose();
    this._scene = null;
  }
}
