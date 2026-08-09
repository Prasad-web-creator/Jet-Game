/**
 * RemotePlayerManager — Babylon.js mesh management for remote players.
 *
 * Creates/updates/disposes aircraft meshes for every remote player in the match.
 * Reads interpolated positions from NetworkManager and applies them each frame.
 * Shows callsign labels using dynamic textures above each aircraft.
 */
import { Scene } from '@babylonjs/core/scene';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import type { NetworkManager } from './NetworkManager';
import type { InterpolatedState } from '../../firebase/multiplayer/networkTypes';
import type { GameSystem } from '../core/GameLoop';
import type { GameState } from '../../types';
import { TargetType } from '../../types';
import { TargetEntity, type TargetManager } from '../targets/TargetManager';
import { globalEventBus } from '../core/EventBus';

// ─── RemoteAircraft — one remote player's visual representation ───────────────

interface RemoteAircraft {
  uid:          string;
  callsign:     string;
  rootMesh:     Mesh;
  label:        Mesh;
  smoke:        ParticleSystem | null;
  tracers:      ParticleSystem | null;
  targetEntity: TargetEntity | null;
  lastState:    InterpolatedState | null;
}

// ─── RemotePlayerManager ──────────────────────────────────────────────────────

export class RemotePlayerManager implements GameSystem {
  readonly name = 'RemotePlayerManager';

  private _scene:           Scene | null = null;
  private readonly _networkManager: NetworkManager;
  private readonly _targetManager?: TargetManager | null;
  private readonly _remotes        = new Map<string, RemoteAircraft>();

  // Shared materials (created once)
  private _bodyMat:  StandardMaterial | null = null;
  private _labelMat: StandardMaterial | null = null;

  constructor(networkManager: NetworkManager, targetManager?: TargetManager | null) {
    this._networkManager = networkManager;
    this._targetManager  = targetManager;
  }

  initialize(scene: Scene): void {
    this._scene = scene;
    this._bodyMat = new StandardMaterial('remote_body_mat', scene);
    this._bodyMat.diffuseColor  = new Color3(0.9, 0.2, 0.1); // Red — enemy
    this._bodyMat.emissiveColor = new Color3(0.2, 0.03, 0.02);

    this._labelMat = new StandardMaterial('remote_label_mat', scene);
    this._labelMat.backFaceCulling = false;
  }

  /**
   * Called once per frame from GameEngine loop.
   * Syncs remote meshes with latest interpolated network states.
   */
  update(_dt: number, _state: GameState): void {
    if (!this._scene) return;
    const uids = this._networkManager.getRemoteUids();
    const scoreboard = this._networkManager.getScoreboard();

    // Spawn new remotes
    for (const uid of uids) {
      if (!this._remotes.has(uid)) {
        const pScore = scoreboard.find(s => s.uid === uid);
        const callsign = pScore?.callsign ?? uid.substring(0, 6);
        this._spawnRemote(uid, callsign);
      }
    }

    // Remove disconnected remotes
    for (const uid of this._remotes.keys()) {
      if (!uids.includes(uid)) this._removeRemote(uid);
    }

    // Update positions
    for (const [uid, remote] of this._remotes) {
      const state = this._networkManager.getInterpolatedState(uid);
      if (!state) continue;

      remote.lastState = state;
      remote.rootMesh.position.set(state.x, state.y, state.z);
      remote.rootMesh.rotation.set(-state.pitch, state.yaw, -state.roll);

      // Move label above aircraft
      remote.label.position.set(state.x, state.y + 12, state.z);

      // Damage smoke effect
      if (state.health < 30 && remote.smoke && !remote.smoke.isStarted()) {
        remote.smoke.start();
      } else if (state.health >= 30 && remote.smoke?.isStarted()) {
        remote.smoke.stop();
      }

      // Gun tracer VFX & Combat Log Event
      if (state.gunFiring && remote.tracers && !remote.tracers.isStarted()) {
        remote.tracers.start();
        globalEventBus.emit('COMBAT_LOG_EVENT', {
          text: `🔥 PILOT ${remote.callsign} FIRED MACHINE GUN`,
          type: 'gun',
        });
      } else if (!state.gunFiring && remote.tracers?.isStarted()) {
        remote.tracers.stop();
      }

      // Hide mesh if destroyed
      const isDestroyed = typeof state.health === 'number' && state.health <= 0;
      remote.rootMesh.isVisible = !isDestroyed;
      remote.label.isVisible    = !isDestroyed;
      if (isDestroyed && remote.tracers?.isStarted()) remote.tracers.stop();

      // Sync TargetEntity state for HUD lock-on & Radar map
      if (remote.targetEntity) {
        remote.targetEntity.health = typeof state.health === 'number' ? state.health : 1000;
        remote.targetEntity.isDestroyed = isDestroyed;
      }
    }
  }

  private _spawnRemote(uid: string, callsign: string): void {
    if (!this._scene) return;
    const root = new Mesh(`remote_root_${uid}`, this._scene);
    root.scaling.copyFromFloats(2.0, 2.0, 2.0); // Make remote players 2x larger for visibility

    // Fuselage
    const fuse = MeshBuilder.CreateCylinder(`remote_fuse_${uid}`,
      { height: 12, diameter: 1.6, tessellation: 8 }, this._scene);
    fuse.rotation.x  = Math.PI / 2;
    fuse.material    = this._bodyMat!;
    fuse.parent      = root;

    // Wings
    const wing = MeshBuilder.CreateBox(`remote_wing_${uid}`,
      { width: 14, height: 0.3, depth: 4 }, this._scene);
    wing.position.z = 1;
    wing.material   = this._bodyMat!;
    wing.parent     = root;

    // Tail fin
    const tail = MeshBuilder.CreateBox(`remote_tail_${uid}`,
      { width: 0.3, height: 4, depth: 3 }, this._scene);
    tail.position.set(0, 1.5, -5);
    tail.material = this._bodyMat!;
    tail.parent   = root;

    root.isPickable = false;

    // Callsign label
    const labelPlane = MeshBuilder.CreatePlane(`remote_label_${uid}`,
      { width: 12, height: 3 }, this._scene);
    const tex = new DynamicTexture(`remote_tex_${uid}`, { width: 256, height: 64 }, this._scene);
    tex.drawText(callsign, null, 44, 'bold 28px Orbitron, monospace',
      '#00ff88', 'transparent', true);
    const mat = new StandardMaterial(`remote_lmat_${uid}`, this._scene);
    mat.diffuseTexture    = tex;
    mat.emissiveTexture   = tex;
    mat.backFaceCulling   = false;
    mat.disableLighting   = true;
    labelPlane.material   = mat;
    labelPlane.isPickable = false;
    labelPlane.billboardMode = Mesh.BILLBOARDMODE_Y;

    // Damage smoke
    const smoke = new ParticleSystem(`remote_smoke_${uid}`, 60, this._scene);
    smoke.particleTexture = new Texture(
      'https://raw.githubusercontent.com/BabylonJS/Babylon.js/master/packages/tools/playground/public/textures/flare.png',
      this._scene
    );
    smoke.emitter     = root;
    smoke.color1      = new Color4(0.2, 0.2, 0.2, 0.8);
    smoke.color2      = new Color4(0.1, 0.1, 0.1, 0.6);
    smoke.colorDead   = new Color4(0, 0, 0, 0);
    smoke.minSize     = 1.5;
    smoke.maxSize     = 4.0;
    smoke.minLifeTime = 0.5;
    smoke.maxLifeTime = 1.5;
    smoke.emitRate    = 30;

    // Muzzle / tracer stream
    const tracers = new ParticleSystem(`remote_tracers_${uid}`, 100, this._scene);
    tracers.particleTexture = new Texture(
      'https://raw.githubusercontent.com/BabylonJS/Babylon.js/master/packages/tools/playground/public/textures/flare.png',
      this._scene
    );
    tracers.emitter     = root;
    tracers.color1      = new Color4(1.0, 0.9, 0.2, 1.0);
    tracers.color2      = new Color4(1.0, 0.4, 0.0, 0.8);
    tracers.colorDead   = new Color4(1, 0, 0, 0);
    tracers.minSize     = 0.6;
    tracers.maxSize     = 1.2;
    tracers.minLifeTime = 0.1;
    tracers.maxLifeTime = 0.4;
    tracers.emitRate    = 80;

    // TargetEntity for HUD Lock-on & Radar Map contact tracking
    let targetEntity: TargetEntity | null = null;
    if (this._targetManager) {
      targetEntity = new TargetEntity(
        uid,
        callsign,
        TargetType.Aircraft,
        fuse,
        1000,
        8.0
      );
      this._targetManager.addTarget(targetEntity);
    }

    this._remotes.set(uid, { uid, callsign, rootMesh: root, label: labelPlane, smoke, tracers, targetEntity, lastState: null });
    console.log(`[RemotePlayerManager] Spawned remote: ${callsign}`);

    globalEventBus.emit('COMBAT_LOG_EVENT', {
      text: `🛩️ PILOT ${callsign} SPAWNED IN MATCH`,
      type: 'spawn',
    });
  }

  private _removeRemote(uid: string): void {
    const r = this._remotes.get(uid);
    if (!r) return;
    globalEventBus.emit('COMBAT_LOG_EVENT', {
      text: `🚪 PILOT ${r.callsign} DISCONNECTED`,
      type: 'info',
    });
    if (r.targetEntity && this._targetManager) {
      this._targetManager.removeTarget(r.targetEntity);
    }
    r.smoke?.dispose();
    r.tracers?.dispose();
    r.rootMesh.dispose();
    r.label.dispose();
    this._remotes.delete(uid);
    console.log(`[RemotePlayerManager] Removed remote: ${r.callsign}`);
  }

  dispose(): void {
    for (const uid of [...this._remotes.keys()]) this._removeRemote(uid);
    this._bodyMat?.dispose();
    this._labelMat?.dispose();
  }
}
