import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import type { CameraManager } from '../camera/CameraManager';

export interface ExplosionEffect {
  root: Mesh;
  sphere: Mesh;
  light: PointLight;
  particles: ParticleSystem;
  smokeParticles: ParticleSystem;
  active: boolean;
  timer: number;
}

export class ExplosionPool {
  private pool: ExplosionEffect[] = [];
  private cameraManager: CameraManager | null = null;

  constructor(scene: Scene, poolSize = 10, cameraManager?: CameraManager) {
    this.cameraManager = cameraManager ?? null;

    const explosionMat = new StandardMaterial('explosionMat', scene);
    explosionMat.diffuseColor = new Color3(1.0, 0.4, 0.0);
    explosionMat.emissiveColor = new Color3(1.0, 0.2, 0.0);
    explosionMat.alpha = 0.8;

    for (let i = 0; i < poolSize; i++) {
      const root = new Mesh(`explosion_root_${i}`, scene);
      
      const sphere = MeshBuilder.CreateSphere(`e_sphere_${i}`, { diameter: 1, segments: 12 }, scene);
      sphere.material = explosionMat;
      sphere.parent = root;
      sphere.isVisible = false;
      sphere.isPickable = false;

      const light = new PointLight(`e_light_${i}`, Vector3.Zero(), scene);
      light.diffuse = new Color3(1.0, 0.5, 0.1);
      light.intensity = 0;
      light.range = 50;
      light.parent = root;

      // Fire/Sparks
      const ps = new ParticleSystem(`e_sparks_${i}`, 200, scene);
      ps.particleTexture = new Texture('https://raw.githubusercontent.com/BabylonJS/Babylon.js/master/packages/tools/playground/public/textures/flare.png', scene);
      ps.emitter = root;
      ps.minEmitBox = new Vector3(-1, -1, -1);
      ps.maxEmitBox = new Vector3(1, 1, 1);
      ps.color1 = new Color4(1.0, 0.8, 0.2, 1.0);
      ps.color2 = new Color4(1.0, 0.3, 0.0, 1.0);
      ps.colorDead = new Color4(0.2, 0.0, 0.0, 0.0);
      ps.minSize = 0.5;
      ps.maxSize = 2.5;
      ps.minLifeTime = 0.3;
      ps.maxLifeTime = 1.0;
      ps.emitRate = 1000;
      ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
      ps.gravity = new Vector3(0, -5, 0);
      ps.direction1 = new Vector3(-1, -1, -1);
      ps.direction2 = new Vector3(1, 1, 1);
      ps.minEmitPower = 5;
      ps.maxEmitPower = 20;
      ps.updateSpeed = 0.02;

      // Smoke
      const smokePs = new ParticleSystem(`e_smoke_${i}`, 100, scene);
      smokePs.particleTexture = new Texture('https://raw.githubusercontent.com/BabylonJS/Babylon.js/master/packages/tools/playground/public/textures/flare.png', scene);
      smokePs.emitter = root;
      smokePs.minEmitBox = new Vector3(-2, -2, -2);
      smokePs.maxEmitBox = new Vector3(2, 2, 2);
      smokePs.color1 = new Color4(0.3, 0.3, 0.3, 0.8);
      smokePs.color2 = new Color4(0.1, 0.1, 0.1, 0.5);
      smokePs.colorDead = new Color4(0, 0, 0, 0);
      smokePs.minSize = 2.0;
      smokePs.maxSize = 8.0;
      smokePs.minLifeTime = 1.5;
      smokePs.maxLifeTime = 3.0;
      smokePs.emitRate = 300;
      smokePs.blendMode = ParticleSystem.BLENDMODE_STANDARD;
      smokePs.gravity = new Vector3(0, 2, 0);
      smokePs.direction1 = new Vector3(-0.5, 0.5, -0.5);
      smokePs.direction2 = new Vector3(0.5, 1.5, 0.5);
      smokePs.minEmitPower = 2;
      smokePs.maxEmitPower = 5;

      this.pool.push({
        root,
        sphere,
        light,
        particles: ps,
        smokeParticles: smokePs,
        active: false,
        timer: 0,
      });
    }
  }

  setCameraManager(cameraManager: CameraManager): void {
    this.cameraManager = cameraManager;
  }

  trigger(position: Vector3, scale = 1.0, shakeCamera = true): void {
    const effect = this.pool.find(p => !p.active);
    if (!effect) return;

    effect.active = true;
    effect.timer = 0;
    effect.root.position.copyFrom(position);
    
    effect.sphere.scaling.setAll(scale);
    effect.sphere.isVisible = true;
    
    effect.light.intensity = 5 * scale;
    effect.light.range = 50 * scale;
    
    effect.particles.targetStopDuration = 0.2;
    effect.particles.start();
    
    effect.smokeParticles.targetStopDuration = 0.5;
    effect.smokeParticles.start();

    if (shakeCamera && this.cameraManager) {
      this.cameraManager.triggerExplosion(scale * 1.5);
    }
  }

  update(dt: number): void {
    for (const effect of this.pool) {
      if (!effect.active) continue;

      effect.timer += dt;
      
      // Expand sphere and fade out quickly
      if (effect.timer < 0.3) {
        effect.sphere.scaling.addInPlace(new Vector3(dt * 30, dt * 30, dt * 30));
        effect.light.intensity = Math.max(0, effect.light.intensity - dt * 15);
      } else {
        effect.sphere.isVisible = false;
        effect.light.intensity = 0;
      }

      // Turn off effect after smoke finishes
      if (effect.timer > 3.0) {
        effect.active = false;
      }
    }
  }

  dispose(): void {
    for (const effect of this.pool) {
      effect.root.dispose();
      effect.particles.dispose();
      effect.smokeParticles.dispose();
    }
    this.pool = [];
  }
}
