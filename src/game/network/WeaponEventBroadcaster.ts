/**
 * WeaponEventBroadcaster — bridges local weapon fire → NetworkManager.
 *
 * Listens to the local EventBus for MACHINE_GUN_FIRED and MISSILE_HIT events,
 * converts them into HitEvent payloads, and pushes them to RTDB via NetworkManager.
 *
 * Also handles kill detection: when a remote player's health drops to 0
 * as a result of our hit, we publish the kill to the scoreboard.
 */
import { globalEventBus } from '../core/EventBus';
import type { NetworkManager } from './NetworkManager';
import type { HitEvent } from '../../firebase/multiplayer/networkTypes';

export class WeaponEventBroadcaster {
  private readonly _networkManager: NetworkManager;
  private _bound = false;

  constructor(networkManager: NetworkManager) {
    this._networkManager = networkManager;
  }

  bind(): void {
    if (this._bound) return;
    this._bound = true;

    // When a missile hits a target in the world, report to network
    globalEventBus.on('MISSILE_HIT', this._onMissileHit);
    
    // When a machine gun bullet hits a target
    globalEventBus.on('BULLET_HIT', this._onBulletHit);

    // When a target is destroyed by the local player, publish kill
    globalEventBus.on('TARGET_DESTROYED', this._onTargetDestroyed);
  }

  private _onMissileHit = (payload: { position: { x: number; y: number; z: number }; targetId: string | null; damage: number }): void => {
    this._publishHit('missile_hit', payload);
  };

  private _onBulletHit = (payload: { position: { x: number; y: number; z: number }; targetId: string | null; damage: number }): void => {
    this._publishHit('bullet_hit', payload);
  };

  private _publishHit(type: 'missile_hit' | 'bullet_hit', payload: { position: { x: number; y: number; z: number }; targetId: string | null; damage: number }): void {
    if (!payload.targetId) return;
    const nm = this._networkManager;

    // Only publish if targetId is a player UID (not an AI/structure)
    const remoteUids = nm.getRemoteUids();
    if (!remoteUids.includes(payload.targetId)) return;

    const event: Omit<HitEvent, 'confirmed'> = {
      type,
      ts:        Date.now(),
      sourceUid: nm.getLocalUid(),
      targetUid: payload.targetId,
      damage:    payload.damage,
      pos:       payload.position as { x: number; y: number; z: number },
    };
    nm.publishHitEvent(event);
  }

  private _onTargetDestroyed = (payload: { targetId: string }): void => {
    const remoteUids = this._networkManager.getRemoteUids();
    if (!remoteUids.includes(payload.targetId)) return;

    this._networkManager.publishKill(
      this._networkManager.getLocalUid(),
      payload.targetId
    );
  };

  dispose(): void {
    if (!this._bound) return;
    this._bound = false;
    globalEventBus.off('MISSILE_HIT',       this._onMissileHit);
    globalEventBus.off('BULLET_HIT',        this._onBulletHit);
    globalEventBus.off('TARGET_DESTROYED',  this._onTargetDestroyed);
  }
}
