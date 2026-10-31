import * as THREE from "three";
import { SeededRNG } from "../../engine/prng";
import { STYLE_PACK_V1 } from "../../style/stylePack";

/**
 * Deliverable 4: Stanford University Identity Kit
 * Recognizable Hoover Tower silhouette, Main Quad red-tile arcades,
 * seeded courtyard trees, and deterministic snow/environment adaptation.
 */
export class StanfordCampusKit {
  public readonly id: string;
  public readonly root: THREE.Group;
  private readonly snowGroup: THREE.Group;
  private readonly snowParticles: {
    mesh: THREE.Mesh;
    basePos: THREE.Vector3;
    speed: number;
    phase: number;
  }[] = [];
  private readonly roofMaterials: THREE.MeshStandardMaterial[] = [];

  constructor(id: string, seed: number) {
    this.id = id;
    this.root = new THREE.Group();
    this.root.name = id;

    const rng = new SeededRNG(seed);

    const sandstoneMat = new THREE.MeshStandardMaterial({
      color: STYLE_PACK_V1.colors.stanfordSandstone,
      roughness: 0.85,
    });
    const redTileMat = new THREE.MeshStandardMaterial({
      color: STYLE_PACK_V1.colors.stanfordTileRed,
      roughness: 0.65,
    });
    this.roofMaterials.push(redTileMat);

    // Campus Base Plinth
    const plinth = new THREE.Mesh(
      new THREE.CylinderGeometry(8.5, 9.2, 1.2, 32),
      new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.9 })
    );
    plinth.position.y = -0.6;
    plinth.receiveShadow = true;
    this.root.add(plinth);

    // Landmark Silhouette: Hoover Tower
    const towerGroup = new THREE.Group();
    const towerShaft = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 7.2, 1.8),
      sandstoneMat
    );
    towerShaft.position.y = 3.6;
    towerShaft.castShadow = true;
    towerShaft.receiveShadow = true;

    const towerBelfry = new THREE.Mesh(
      new THREE.CylinderGeometry(1.15, 1.25, 1.5, 8),
      sandstoneMat
    );
    towerBelfry.position.y = 7.95;

    const towerDome = new THREE.Mesh(
      new THREE.SphereGeometry(
        1.12,
        16,
        12,
        0,
        Math.PI * 2,
        0,
        Math.PI * 0.55
      ),
      redTileMat
    );
    towerDome.position.y = 8.6;
    towerGroup.add(towerShaft, towerBelfry, towerDome);
    towerGroup.position.set(0, 0, -1.8);
    this.root.add(towerGroup);

    // Main Quad Buildings (Modular sandstone + red tile roofs)
    const quadOffsets: [number, number, number, number][] = [
      [-3.4, 0, 1.2, 0],
      [3.4, 0, 1.2, 0],
      [0, 0, 3.2, Math.PI * 0.5],
      [-3.4, 0, -2.2, 0],
      [3.4, 0, -2.2, 0],
    ];

    for (const [x, y, z, rotY] of quadOffsets) {
      const bldg = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 1.4, 3.2),
        sandstoneMat
      );
      body.position.y = 0.7;
      body.castShadow = true;

      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(1.9, 0.85, 4),
        redTileMat
      );
      roof.position.y = 1.82;
      roof.rotation.y = Math.PI * 0.25;
      roof.scale.set(0.95, 1, 1.8);

      bldg.add(body, roof);
      bldg.position.set(x, y, z);
      bldg.rotation.y = rotY;
      this.root.add(bldg);
    }

    // Seeded Trees around Courtyard
    const treeMat = new THREE.MeshStandardMaterial({
      color: STYLE_PACK_V1.colors.stanfordTreeGreen,
      roughness: 0.8,
    });
    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * Math.PI * 2 + rng.range(-0.1, 0.1);
      const radius = rng.range(5.2, 7.4);
      const tree = new THREE.Mesh(
        new THREE.ConeGeometry(0.55, 1.8, 8),
        treeMat
      );
      tree.position.set(
        Math.cos(angle) * radius,
        0.9,
        Math.sin(angle) * radius
      );
      tree.castShadow = true;
      this.root.add(tree);
    }

    // Seeded Time-Addressable Snow Particles (Deliverable 2 & 6)
    this.snowGroup = new THREE.Group();
    const snowMat = new THREE.MeshBasicMaterial({
      color: STYLE_PACK_V1.colors.snowWhite,
    });
    const snowGeom = new THREE.SphereGeometry(0.09, 6, 6);
    for (let i = 0; i < 80; i++) {
      const mesh = new THREE.Mesh(snowGeom, snowMat);
      const basePos = new THREE.Vector3(
        rng.range(-8, 8),
        rng.range(0.5, 11),
        rng.range(-8, 8)
      );
      this.snowParticles.push({
        mesh,
        basePos,
        speed: rng.range(1.4, 2.6),
        phase: rng.range(0, Math.PI * 2),
      });
      this.snowGroup.add(mesh);
    }
    this.root.add(this.snowGroup);
  }

  /**
   * Pure time-addressable snow state — no stateful particle integration.
   */
  public applyEnvironment(snowIntensity: number, timeSeconds: number): void {
    const clamped = Math.max(0, Math.min(1, snowIntensity));
    this.snowGroup.visible = clamped > 0.01;

    // Blend roof tint toward snow white as snowIntensity increases
    const baseRed = new THREE.Color(STYLE_PACK_V1.colors.stanfordTileRed);
    const snowColor = new THREE.Color(STYLE_PACK_V1.colors.snowWhite);
    for (const mat of this.roofMaterials) {
      mat.color.copy(baseRed).lerp(snowColor, clamped * 0.65);
    }

    if (!this.snowGroup.visible) return;

    const maxHeight = 11.0;
    for (const p of this.snowParticles) {
      const fallOffset = (timeSeconds * p.speed) % maxHeight;
      let y = p.basePos.y - fallOffset;
      if (y < 0.2) y += maxHeight;
      const driftX = Math.sin(timeSeconds * 1.5 + p.phase) * 0.35;
      p.mesh.position.set(p.basePos.x + driftX, y, p.basePos.z);
      p.mesh.scale.setScalar(clamped);
    }
  }
}
