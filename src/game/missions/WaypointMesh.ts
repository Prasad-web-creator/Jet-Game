import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Mesh } from '@babylonjs/core/Meshes/mesh';

export class WaypointMesh {
  readonly id: string;
  readonly name: string;
  readonly radius: number;
  readonly order: number;

  private root: Mesh;
  private ringMesh: Mesh;
  private isPassed = false;

  constructor(
    id: string,
    name: string,
    scene: Scene,
    position: Vector3,
    radius = 35,
    order = 1
  ) {
    this.id = id;
    this.name = name;
    this.radius = radius;
    this.order = order;

    this.root = new Mesh(`wp_root_${id}`, scene);
    this.root.position.copyFrom(position);

    // Flat disc marker — no animation, no floating ring
    const ringMat = new StandardMaterial(`wp_ring_mat_${id}`, scene);
    ringMat.emissiveColor = new Color3(0.0, 0.80, 0.50);
    ringMat.diffuseColor  = new Color3(0.0, 1.00, 0.60);
    ringMat.alpha         = 0.55;
    ringMat.backFaceCulling = false;

    // Flat disc on the ground — no floating torus
    this.ringMesh = MeshBuilder.CreateDisc(
      `wp_disc_${id}`,
      { radius: radius, tessellation: 24 },
      scene
    );
    this.ringMesh.rotation.x = Math.PI / 2; // lay flat on ground
    this.ringMesh.material   = ringMat;
    this.ringMesh.parent     = this.root;
    this.ringMesh.isPickable = false;
  }

  getPosition(): Vector3 {
    return this.root.position;
  }

  getIsPassed(): boolean {
    return this.isPassed;
  }

  setPassed(): void {
    this.isPassed = true;
    this.ringMesh.visibility = 0;
  }

  update(_dt: number, playerPos: Vector3): boolean {
    if (this.isPassed) return false;

    // No animation — static flat disc on ground
    // Collision Check vs Player Position
    const dist = Vector3.Distance(this.root.position, playerPos);
    if (dist <= this.radius + 10) {
      this.setPassed();
      console.log(`[WaypointMesh] 🎯 WAYPOINT PASSED: ${this.name}!`);
      return true;
    }
    return false;
  }

  dispose(): void {
    this.root.dispose();
  }
}
