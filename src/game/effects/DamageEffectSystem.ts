/**
 * DamageEffectSystem — Manages smoke and fire particle effects attached to
 * damaged aircraft (player and enemies).
 *
 * Damage levels:
 *   > 70% HP : no effect
 *   30-70%   : smoke (particle system attached to mesh)
 *   < 30%    : smoke + fire (critical damage)
 *   0%       : effects removed (aircraft is being destroyed by ExplosionPool)
 *
 * Usage:
 *   system.setDamageState(mesh, health, maxHealth)  — call when HP changes
 *   system.removeEffects(mesh)                      — call on destruction
 *   system.update(dt)                               — call every frame
 */

import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';

const FLARE_URL = 'https://raw.githubusercontent.com/BabylonJS/Babylon.js/master/packages/tools/playground/public/textures/flare.png';

interface AircraftDamageEffects {
  smoke: ParticleSystem;
  fire: ParticleSystem | null;
  meshId: string;
}

export class DamageEffectSystem {
  private effects = new Map<string, AircraftDamageEffects>();
  private scene: Scene;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  /**
   * Update damage visual state for an aircraft mesh.
   * @param mesh      The aircraft root mesh
   * @param health    Current health
   * @param maxHealth Maximum health
   */
  setDamageState(mesh: AbstractMesh, health: number, maxHealth: number): void {
    if (maxHealth <= 0) return;
    const pct = Math.max(0, health / maxHealth);

    if (pct > 0.70) {
      // No damage — remove any existing effects
      this.removeEffects(mesh);
      return;
    }

    const effect = this.getOrCreate(mesh);

    // Smoke intensity scales with damage
    const smokeRate = 20 + (1 - pct) * 180; // 20 at 70%, 200 at 0%
    effect.smoke.emitRate = smokeRate;

    if (!effect.smoke.isStarted()) {
      effect.smoke.start();
    }

    // Fire only at critical health
    if (pct < 0.30) {
      if (!effect.fire) {
        effect.fire = this.createFirePs(mesh);
      }
      if (!effect.fire.isStarted()) {
        effect.fire.start();
      }
      // Scale fire with damage
      const fireRate = 20 + (0.30 - pct) / 0.30 * 100;
      effect.fire.emitRate = fireRate;
    } else if (effect.fire) {
      effect.fire.stop();
    }
  }

  /** Remove all effects from an aircraft (call on destruction). */
  removeEffects(mesh: AbstractMesh): void {
    const key = mesh.uniqueId.toString();
    const effect = this.effects.get(key);
    if (!effect) return;

    effect.smoke.stop();
    effect.smoke.dispose();
    effect.fire?.stop();
    effect.fire?.dispose();
    this.effects.delete(key);
  }

  update(_dt: number): void {
    // Particle systems are self-updating — nothing needed here per frame
  }

  dispose(): void {
    for (const effect of this.effects.values()) {
      effect.smoke.stop();
      effect.smoke.dispose();
      effect.fire?.stop();
      effect.fire?.dispose();
    }
    this.effects.clear();
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private getOrCreate(mesh: AbstractMesh): AircraftDamageEffects {
    const key = mesh.uniqueId.toString();
    if (this.effects.has(key)) return this.effects.get(key)!;

    const smoke = this.createSmokePs(mesh);
    const effect: AircraftDamageEffects = { smoke, fire: null, meshId: key };
    this.effects.set(key, effect);
    return effect;
  }

  private createSmokePs(mesh: AbstractMesh): ParticleSystem {
    const ps = new ParticleSystem(`dmg_smoke_${mesh.uniqueId}`, 60, this.scene);
    ps.particleTexture = new Texture(FLARE_URL, this.scene, false, false,
      Texture.BILINEAR_SAMPLINGMODE, null, () => { /* silent fallback */ });

    ps.emitter     = mesh as any;
    ps.minEmitBox  = new Vector3(-0.5, -0.5, -0.5);
    ps.maxEmitBox  = new Vector3(0.5,  0.5,  0.5);

    ps.color1    = new Color4(0.35, 0.35, 0.35, 0.8);
    ps.color2    = new Color4(0.15, 0.15, 0.15, 0.5);
    ps.colorDead = new Color4(0.05, 0.05, 0.05, 0.0);

    ps.minSize     = 0.5;
    ps.maxSize     = 2.0;
    ps.minLifeTime = 0.8;
    ps.maxLifeTime = 1.8;
    ps.emitRate    = 20;

    ps.direction1 = new Vector3(-0.3, 0.5, -0.3);
    ps.direction2 = new Vector3(0.3,  1.5,  0.3);
    ps.minEmitPower = 1;
    ps.maxEmitPower = 3;
    ps.gravity      = new Vector3(0, 0.5, 0); // Smoke rises
    ps.updateSpeed  = 0.025;

    return ps;
  }

  private createFirePs(mesh: AbstractMesh): ParticleSystem {
    const ps = new ParticleSystem(`dmg_fire_${mesh.uniqueId}`, 40, this.scene);
    ps.particleTexture = new Texture(FLARE_URL, this.scene, false, false,
      Texture.BILINEAR_SAMPLINGMODE, null, () => { /* silent fallback */ });

    ps.emitter     = mesh as any;
    ps.minEmitBox  = new Vector3(-0.3, -0.3, -0.3);
    ps.maxEmitBox  = new Vector3(0.3,  0.3,  0.3);

    ps.color1    = new Color4(1.0, 0.6, 0.1, 0.9);
    ps.color2    = new Color4(1.0, 0.2, 0.0, 0.8);
    ps.colorDead = new Color4(0.3, 0.1, 0.0, 0.0);

    ps.minSize     = 0.2;
    ps.maxSize     = 0.7;
    ps.minLifeTime = 0.15;
    ps.maxLifeTime = 0.35;
    ps.emitRate    = 30;

    ps.direction1 = new Vector3(-0.2, 0.3, -0.2);
    ps.direction2 = new Vector3(0.2,  1.0,  0.2);
    ps.minEmitPower = 2;
    ps.maxEmitPower = 5;
    ps.gravity      = new Vector3(0, -1.0, 0); // Fire pulled slightly downward
    ps.updateSpeed  = 0.02;

    return ps;
  }
}
