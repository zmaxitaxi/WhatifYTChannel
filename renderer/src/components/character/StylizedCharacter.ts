import * as THREE from "three";
import { CharacterActionName, ExpressionName } from "../../contracts/types";

/**
 * Deliverable 3: Reusable Character System
 * Recognizable eyes, visible nose, readable mouth shapes, hair silhouette,
 * and 5 distinct expressions readable at 360px phone test width.
 */
export class StylizedCharacter {
  public readonly id: string;
  public readonly root: THREE.Group;

  private readonly headGroup: THREE.Group;
  private readonly leftEye: THREE.Mesh;
  private readonly rightEye: THREE.Mesh;
  private readonly leftBrow: THREE.Mesh;
  private readonly rightBrow: THREE.Mesh;
  private readonly mouth: THREE.Mesh;
  private readonly leftArm: THREE.Group;
  private readonly rightArm: THREE.Group;

  constructor(id: string, shirtColorHex = 0x8c1515) {
    this.id = id;
    this.root = new THREE.Group();
    this.root.name = id;

    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xf1c27d,
      roughness: 0.75,
    });
    const hairMat = new THREE.MeshStandardMaterial({
      color: 0x1e1b18,
      roughness: 0.85,
    });
    const featureMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.4,
    });
    const shirtMat = new THREE.MeshStandardMaterial({
      color: shirtColorHex,
      roughness: 0.7,
    });

    // Torso
    const torso = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.32, 0.65, 8, 16),
      shirtMat
    );
    torso.position.y = 0.85;
    torso.castShadow = true;
    this.root.add(torso);

    // Head Group (oversized stylized proportions for phone-screen readability)
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 1.65, 0);
    this.root.add(this.headGroup);

    const headMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.36, 24, 24),
      skinMat
    );
    headMesh.castShadow = true;
    this.headGroup.add(headMesh);

    // Hair Cap Silhouette
    const hairMesh = new THREE.Mesh(
      new THREE.SphereGeometry(
        0.38,
        24,
        16,
        0,
        Math.PI * 2,
        0,
        Math.PI * 0.58
      ),
      hairMat
    );
    hairMesh.position.set(0, 0.04, -0.02);
    hairMesh.rotation.x = -0.18;
    this.headGroup.add(hairMesh);

    // Visible Nose
    const noseMesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.055, 0.14, 12),
      skinMat
    );
    noseMesh.rotation.x = Math.PI * 0.5;
    noseMesh.position.set(0, 0.0, 0.38);
    this.headGroup.add(noseMesh);

    // Eyes
    const eyeGeom = new THREE.SphereGeometry(0.048, 16, 16);
    this.leftEye = new THREE.Mesh(eyeGeom, featureMat);
    this.rightEye = new THREE.Mesh(eyeGeom, featureMat);
    this.leftEye.position.set(-0.12, 0.08, 0.33);
    this.rightEye.position.set(0.12, 0.08, 0.33);
    this.headGroup.add(this.leftEye, this.rightEye);

    // Eyebrows (crucial for worried/surprised/confused readability)
    const browGeom = new THREE.BoxGeometry(0.12, 0.026, 0.03);
    this.leftBrow = new THREE.Mesh(browGeom, featureMat);
    this.rightBrow = new THREE.Mesh(browGeom, featureMat);
    this.leftBrow.position.set(-0.12, 0.18, 0.34);
    this.rightBrow.position.set(0.12, 0.18, 0.34);
    this.headGroup.add(this.leftBrow, this.rightBrow);

    // Mouth
    this.mouth = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.04, 0.04),
      featureMat
    );
    this.mouth.position.set(0, -0.12, 0.34);
    this.headGroup.add(this.mouth);

    // Arms
    this.leftArm = new THREE.Group();
    this.leftArm.position.set(-0.42, 1.15, 0);
    const armMeshL = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.09, 0.45, 6, 12),
      shirtMat
    );
    armMeshL.position.y = -0.22;
    this.leftArm.add(armMeshL);

    this.rightArm = new THREE.Group();
    this.rightArm.position.set(0.42, 1.15, 0);
    const armMeshR = armMeshL.clone();
    this.rightArm.add(armMeshR);

    this.root.add(this.leftArm, this.rightArm);
  }

  /**
   * Pure function of (expression, action, timeSeconds).
   * Resets state every call so arbitrary frame requests are 100% deterministic.
   */
  public applyState(
    expression: ExpressionName,
    action: CharacterActionName,
    timeSeconds: number
  ): void {
    // 1. Reset baseline transforms (fixes out-of-order determinism test!)
    this.headGroup.position.set(0, 1.65, 0);
    this.headGroup.rotation.set(0, 0, 0);
    this.leftEye.scale.set(1, 1, 1);
    this.rightEye.scale.set(1, 1, 1);
    this.leftBrow.rotation.set(0, 0, 0);
    this.rightBrow.rotation.set(0, 0, 0);
    this.leftBrow.position.set(-0.12, 0.18, 0.34);
    this.rightBrow.position.set(0.12, 0.12, 0.34);
    this.mouth.scale.set(1, 1, 1);
    this.mouth.rotation.set(0, 0, 0);

    // 2. Apply Expression
    switch (expression) {
      case "neutral":
        break;
      case "happy":
        this.leftBrow.position.y = 0.2;
        this.rightBrow.position.y = 0.2;
        this.mouth.scale.set(1.35, 1.2, 1);
        break;
      case "surprised":
        this.leftEye.scale.set(1.3, 1.35, 1);
        this.rightEye.scale.set(1.3, 1.35, 1);
        this.leftBrow.position.y = 0.23;
        this.rightBrow.position.y = 0.23;
        this.mouth.scale.set(0.75, 2.4, 1); // Open 'O' mouth
        break;
      case "worried":
        this.leftBrow.rotation.z = 0.28;
        this.rightBrow.rotation.z = -0.28;
        this.mouth.scale.set(0.9, 0.8, 1);
        break;
      case "confused":
        this.leftBrow.position.y = 0.22;
        this.leftBrow.rotation.z = 0.18;
        this.rightBrow.position.y = 0.16;
        this.rightBrow.rotation.z = -0.12;
        this.mouth.rotation.z = 0.15;
        break;
    }

    // 3. Apply Deterministic Pose / Action from timeSeconds
    this.leftArm.rotation.set(0, 0, 0.12);
    this.rightArm.rotation.set(0, 0, -0.12);

    switch (action) {
      case "idle": {
        const breath = Math.sin(timeSeconds * 2.2) * 0.03;
        this.headGroup.rotation.y = Math.sin(timeSeconds * 1.1) * 0.08;
        this.headGroup.position.y = 1.65 + breath * 0.3;
        break;
      }
      case "walking": {
        const swing = Math.sin(timeSeconds * 6.0) * 0.55;
        this.leftArm.rotation.x = swing;
        this.rightArm.rotation.x = -swing;
        this.headGroup.position.y =
          1.65 + Math.abs(Math.cos(timeSeconds * 6.0)) * 0.04;
        break;
      }
      case "pointing": {
        this.rightArm.rotation.x = -Math.PI * 0.48;
        this.rightArm.rotation.z = -0.2;
        this.headGroup.rotation.y = -0.15;
        break;
      }
      case "celebrating": {
        const wave = Math.sin(timeSeconds * 8.0) * 0.2;
        this.leftArm.rotation.z = Math.PI * 0.78 + wave;
        this.rightArm.rotation.z = -Math.PI * 0.78 - wave;
        break;
      }
    }
  }
}
