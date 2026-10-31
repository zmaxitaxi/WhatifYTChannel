import * as THREE from 'three';

/** Code-native clay assets. All motion is sampled from absolute time. */
export type StudentExpression = 'neutral' | 'happy' | 'surprised' | 'worried' | 'confused';
export type StudentVisual = {
  root: THREE.Group;
  sample(seconds: number, expression: StudentExpression, walking?: boolean, phase?: number): void;
};
export type CampusVisual = { root: THREE.Group; sample(seconds: number, transformation: number): void };
export type SkyVisual = { root: THREE.Group; sample(seconds: number, camera: THREE.Camera): void };
export const MODEL_DIMENSIONS = { personHeight: 1.76, campusRadius: 21, towerHeight: 28 } as const;

type V3 = [number, number, number];
const TAU = Math.PI * 2;
const clamp = (n: number) => THREE.MathUtils.clamp(n, 0, 1);
const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };
const wrap = (n: number, span: number) => ((n % span) + span) % span;
const geometryCache = new Map<string, THREE.BufferGeometry>();
const materialCache = new Map<string, THREE.MeshStandardMaterial>();

function geometry(key: string, make: () => THREE.BufferGeometry) {
  if (!geometryCache.has(key)) geometryCache.set(key, make());
  return geometryCache.get(key)!;
}
function material(color: string, glow = 0) {
  const key = `${color}/${glow}`;
  if (!materialCache.has(key)) materialCache.set(key, new THREE.MeshStandardMaterial({
    color, roughness: 0.83, metalness: 0.025,
    emissive: glow ? color : '#000000', emissiveIntensity: glow,
  }));
  return materialCache.get(key)!;
}
function part(parent: THREE.Object3D, shape: THREE.BufferGeometry, color: string, position: V3, scale: V3 = [1, 1, 1], glow = 0) {
  const node = new THREE.Mesh(shape, material(color, glow));
  node.position.set(...position); node.scale.set(...scale);
  node.castShadow = true; node.receiveShadow = true; parent.add(node);
  return node;
}
const box = (p: THREE.Object3D, dimensions: V3, at: V3, color: string, glow = 0) =>
  part(p, geometry('box', () => new THREE.BoxGeometry()), color, at, dimensions, glow);
const ball = (p: THREE.Object3D, radii: V3, at: V3, color: string, glow = 0) =>
  part(p, geometry('ball', () => new THREE.SphereGeometry(1, 16, 10)), color, at, radii, glow);
const capsule = (p: THREE.Object3D, dimensions: V3, at: V3, color: string) =>
  part(p, geometry('capsule', () => new THREE.CapsuleGeometry(0.5, 1, 4, 10)), color, at,
    [dimensions[0], dimensions[1] / 2, dimensions[2]]);
const cylinder = (p: THREE.Object3D, radius: number, height: number, at: V3, color: string, glow = 0) =>
  part(p, geometry('cylinder', () => new THREE.CylinderGeometry(1, 1, 1, 16)), color, at, [radius, height, radius], glow);
const cone = (p: THREE.Object3D, radius: number, height: number, at: V3, color: string, sides = 16) =>
  part(p, geometry(`cone${sides}`, () => new THREE.ConeGeometry(1, 1, sides)), color, at, [radius, height, radius]);
function group(parent?: THREE.Object3D, at: V3 = [0, 0, 0]) {
  const node = new THREE.Group(); node.position.set(...at); parent?.add(node); return node;
}
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let n = Math.imul(seed ^ seed >>> 15, 1 | seed);
    n = n + Math.imul(n ^ n >>> 7, 61 | n) ^ n;
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
}
function bar(parent: THREE.Object3D, start: V3, end: V3, radius: number, color: string, glow = 0) {
  const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end);
  const node = cylinder(parent, radius, a.distanceTo(b), a.clone().add(b).multiplyScalar(0.5).toArray() as V3, color, glow);
  node.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
  return node;
}
function ring(parent: THREE.Object3D, radius: number, thickness: number, at: V3, color: string, glow = 0) {
  return part(parent, geometry(`ring/${thickness / radius}`, () => new THREE.TorusGeometry(1, thickness / radius, 6, 32)), color, at, [radius, radius, radius], glow);
}

/** One instanced draw per shared primitive/material, retaining source transforms for animation. */
function instanceParts(source: THREE.Group, destination: THREE.Group) {
  source.updateMatrixWorld(true);
  const buckets = new Map<string, { parts: THREE.Mesh[]; draw: THREE.InstancedMesh }>();
  source.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    const key = `${node.geometry.uuid}/${(node.material as THREE.Material).uuid}/${node.castShadow}`;
    if (!buckets.has(key)) buckets.set(key, { parts: [], draw: null! });
    buckets.get(key)!.parts.push(node);
  });
  for (const bucket of buckets.values()) {
    const first = bucket.parts[0];
    bucket.draw = new THREE.InstancedMesh(first.geometry, first.material, bucket.parts.length);
    bucket.draw.castShadow = first.castShadow; bucket.draw.receiveShadow = first.receiveShadow;
    // Animated crowds move outside the first sampled bounds. Do not retain stale instance bounds.
    bucket.draw.frustumCulled = false;
    destination.add(bucket.draw);
  }
  const update = () => {
    source.updateMatrixWorld(true);
    for (const { parts, draw } of buckets.values()) {
      for (let index = 0; index < parts.length; index++) draw.setMatrixAt(index, parts[index].matrixWorld);
      draw.instanceMatrix.needsUpdate = true;
    }
  };
  update(); return update;
}

export function buildStudent(options: { shirt?: string; skin?: string; hair?: string; variant?: number } = {}): StudentVisual {
  const variant = Math.abs(Math.floor(options.variant ?? 0));
  const skin = options.skin ?? '#dfb48e', shirt = options.shirt ?? '#943d45', hair = options.hair ?? '#493b35';
  const root = group(); root.name = 'clay-student';
  const body = group(root);
  const torso = group(body, [0, 0.91, 0]);
  capsule(torso, [0.43, 0.55, 0.31], [0, 0.02, 0], shirt);
  // Hoodie hem, front pocket, drawstrings and a small stitched chest patch.
  capsule(torso, [0.405, 0.105, 0.3], [0, -0.19, 0], shirt);
  ball(torso, [0.13, 0.066, 0.025], [0, -0.083, 0.15], shirt);
  for (const side of [-1, 1]) {
    bar(torso, [side * 0.045, 0.22, 0.12], [side * 0.055, 0.065, 0.166], 0.009, '#efdfcc');
    ball(torso, [0.012, 0.018, 0.011], [side * 0.055, 0.062, 0.167], '#e0c7a6');
    box(torso, [0.046, 0.32, 0.028], [side * 0.145, 0.045, 0.142], '#3c4c57').rotation.z = side * 0.12;
  }
  box(torso, [0.048, 0.047, 0.012], [0.096, 0.108, 0.172], '#e6ceaa');
  // A visibly padded backpack, side pocket, handle, zip seam.
  capsule(torso, [0.36, 0.43, 0.19], [0, 0.01, -0.21], '#445c68');
  capsule(torso, [0.28, 0.2, 0.07], [0, -0.075, -0.315], '#607984');
  box(torso, [0.25, 0.012, 0.012], [0, 0.015, -0.356], '#e1bf7e');
  const handle = ring(torso, 0.057, 0.013, [0, 0.247, -0.216], '#344651'); handle.scale.y *= 0.7;
  capsule(torso, [0.061, 0.15, 0.07], [0.184, -0.066, -0.22], '#8bc4c1');
  cylinder(torso, 0.022, 0.034, [0.184, 0.018, -0.22], '#f5eee0');

  const legs: THREE.Group[] = [], arms: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const leg = group(body, [side * 0.115, 0.71, 0]); legs.push(leg);
    capsule(leg, [0.15, 0.58, 0.17], [0, -0.265, 0], '#3e555c');
    box(leg, [0.153, 0.065, 0.17], [0, -0.516, 0.003], '#31464e');
    capsule(leg, [0.17, 0.13, 0.29], [0, -0.635, 0.045], '#e3dccb');
    box(leg, [0.174, 0.033, 0.255], [0, -0.681, 0.053], '#b9b6ac');
    for (const z of [0.07, 0.105]) box(leg, [0.1, 0.011, 0.018], [0, -0.567, z], '#fff8e9');
    const arm = group(torso, [side * 0.235, 0.165, 0]); arms.push(arm);
    capsule(arm, [0.15, 0.395, 0.17], [side * 0.024, -0.176, 0], shirt);
    capsule(arm, [0.133, 0.065, 0.145], [side * 0.035, -0.34, 0], shirt);
    ball(arm, [0.072, 0.085, 0.068], [side * 0.035, -0.405, 0.011], skin);
    ball(arm, [0.033, 0.047, 0.036], [side * -0.018, -0.388, 0.046], skin);
  }
  cylinder(body, 0.075, 0.14, [0, 1.205, 0], skin);
  // Hood behind the neck, keeping the familiar original red-hoodie silhouette.
  ball(torso, [0.19, 0.12, 0.14], [0, 0.248, -0.068], shirt);
  const head = group(body, [0, 1.455, 0.008]);
  ball(head, [0.248, 0.264, 0.231], [0, 0, 0], skin);
  ball(head, [0.252, 0.235, 0.225], [0, 0.055, -0.06], hair);
  ball(head, [0.226, 0.23, 0.205], [0, -0.013, 0.047], skin);
  for (const side of [-1, 1]) {
    ball(head, [0.05, 0.072, 0.04], [side * 0.236, -0.018, 0.014], skin);
    ball(head, [0.022, 0.039, 0.017], [side * 0.257, -0.018, 0.046], '#bf8c71');
  }
  // Soft, sculpted hair locks, kept above the eyes rather than covering the face.
  for (let i = 0; i < 5; i++) {
    const lock = ball(head, [0.078, 0.075, 0.075], [-0.165 + i * 0.079, 0.198 + 0.013 * Math.sin(i * 2), 0.105 - Math.abs(i - 2) * 0.018], hair);
    lock.rotation.z = (i - 2) * -0.15;
  }
  if (variant % 4 === 2) ball(head, [0.1, 0.11, 0.095], [0, 0.135, -0.225], hair);
  if (variant % 4 === 3) {
    for (const side of [-1, 1]) capsule(head, [0.075, 0.3, 0.1], [side * 0.212, -0.053, -0.056], hair);
  }
  const eyes: THREE.Group[] = [], brows: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const eye = group(head, [side * 0.093, 0.027, 0.222]); eyes.push(eye);
    ball(eye, [0.054, 0.064, 0.024], [0, 0, 0], '#fff8eb');
    ball(eye, [0.027, 0.035, 0.014], [0.006, -0.003, 0.023], '#2c4547');
    ball(eye, [0.014, 0.022, 0.009], [0.008, -0.003, 0.033], '#243234');
    ball(eye, [0.009, 0.011, 0.006], [0.015, 0.01, 0.04], '#ffffff');
    const brow = capsule(head, [0.099, 0.024, 0.025], [side * 0.095, 0.121, 0.216], hair); brows.push(brow);
    if (variant % 3 === 1) {
      const frame = ring(head, 0.073, 0.009, [side * 0.096, 0.026, 0.266], '#334750'); frame.scale.y *= 0.85;
      bar(head, [side * 0.166, 0.037, 0.262], [side * 0.226, 0.027, 0.06], 0.009, '#334750');
    }
  }
  if (variant % 3 === 1) bar(head, [-0.024, 0.035, 0.269], [0.024, 0.035, 0.269], 0.008, '#334750');
  ball(head, [0.039, 0.052, 0.052], [0, -0.045, 0.247], skin);
  ball(head, [0.044, 0.027, 0.043], [0, -0.066, 0.265], skin);
  const mouth = ball(head, [0.06, 0.021, 0.012], [0, -0.133, 0.23], '#723f3d');
  const teeth = ball(head, [0.044, 0.009, 0.008], [0, -0.127, 0.24], '#fff6e5');

  const sample: StudentVisual['sample'] = (seconds, expression, walking = false, phase = 0) => {
    const stride = Math.sin(seconds * 5.5 + phase), lift = walking ? Math.abs(Math.sin(seconds * 5.5 + phase)) * 0.018 : 0;
    body.position.set(0, lift, 0); body.rotation.set(0, 0, 0); body.scale.set(1, 1, 1);
    torso.rotation.set(0, 0, walking ? Math.sin(seconds * 5.5 + phase) * 0.017 : 0);
    head.rotation.set(0, walking ? stride * 0.025 : Math.sin(seconds * 0.65 + phase) * 0.018,
      expression === 'confused' ? -0.12 : expression === 'worried' ? 0.045 : 0);
    legs.forEach((leg, i) => leg.rotation.set(walking ? stride * (i ? -0.36 : 0.36) : 0, 0, 0));
    arms.forEach((arm, i) => arm.rotation.set(walking ? stride * (i ? 0.3 : -0.3) : 0, 0,
      (i ? -1 : 1) * (expression === 'surprised' ? 0.23 : 0.06)));
    const blinkPhase = wrap(seconds + phase * 0.37, 4.6);
    const blink = blinkPhase > 4.44 ? Math.max(0.13, Math.abs(blinkPhase - 4.52) / 0.08) : 1;
    eyes.forEach(eye => eye.scale.set(1, (expression === 'surprised' ? 1.2 : expression === 'happy' ? 0.91 : 1) * blink, 1));
    brows.forEach((brow, i) => {
      brow.position.y = expression === 'surprised' ? 0.15 : expression === 'confused' ? (i ? 0.155 : 0.118) : 0.121;
      brow.rotation.set(0, 0, (i ? -1 : 1) * (expression === 'worried' ? 0.3 : expression === 'happy' ? -0.1 : 0.02));
    });
    mouth.scale.set(expression === 'surprised' ? 0.032 : expression === 'happy' ? 0.07 : 0.06,
      expression === 'surprised' ? 0.05 : expression === 'happy' ? 0.031 : 0.014, 0.012);
    mouth.rotation.z = expression === 'confused' ? 0.12 : 0;
    mouth.position.y = expression === 'worried' ? -0.122 : -0.133;
    teeth.scale.set(expression === 'happy' ? 0.048 : 0.001, expression === 'happy' ? 0.012 : 0.001, 0.008);
    teeth.position.y = -0.122; teeth.rotation.set(0, 0, 0);
  };
  sample(0, 'neutral'); return { root, sample };
}

const SAND = '#d9be92', TRIM = '#f0dcb7', ROOF = '#a94f40', WINDOW = '#4e6e74';
function hipRoof(parent: THREE.Object3D, width: number, depth: number, height: number, y: number) {
  // Rotate the unit geometry before stretching it: rotating a nonuniformly
  // scaled cone at object level turns long arcade roofs into diagonal slabs.
  const shape = geometry('hip-roof', () => new THREE.ConeGeometry(1, 1, 4).rotateY(Math.PI / 4));
  return part(parent, shape, ROOF, [0, y, 0], [width / Math.SQRT2, height, depth / Math.SQRT2]);
}
function windowFrame(parent: THREE.Group, x: number, y: number, z: number, width = 0.64, height = 0.95) {
  box(parent, [width + 0.15, height + 0.16, 0.08], [x, y, z], TRIM);
  box(parent, [width, height, 0.095], [x, y + 0.015, z + 0.04], WINDOW);
  box(parent, [0.045, height, 0.03], [x, y, z + 0.1], '#b4c8bf');
  box(parent, [width, 0.045, 0.03], [x, y - 0.05, z + 0.102], '#b4c8bf');
  box(parent, [width + 0.22, 0.09, 0.2], [x, y - height / 2 - 0.08, z + 0.04], TRIM);
}
function arch(parent: THREE.Group, at: V3, width: number, rise: number, depth: number, color = TRIM) {
  const geo = geometry('arcade-arch', () => {
    const shape = new THREE.Shape();
    shape.moveTo(1, 0); shape.absarc(0, 0, 1, 0, Math.PI, false);
    shape.lineTo(-0.75, 0); shape.absarc(0, 0, 0.75, Math.PI, 0, true); shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, curveSegments: 10, steps: 1 });
    g.translate(0, 0, -0.5); return g;
  });
  return part(parent, geo, color, at, [width / 2, rise, depth]);
}
function arcade(parent: THREE.Group, length: number, bays: number, at: V3, rotate = 0) {
  const gallery = group(parent, at); gallery.rotation.y = rotate;
  const spacing = length / bays;
  box(gallery, [length + 0.4, 0.18, 1.8], [0, 0.08, 0], TRIM);
  box(gallery, [length + 0.48, 0.3, 1.7], [0, 3.35, 0], SAND);
  hipRoof(gallery, length + 0.7, 2.1, 0.55, 3.7);
  for (let i = 0; i <= bays; i++) {
    const x = -length / 2 + i * spacing;
    cylinder(gallery, 0.16, 2.45, [x, 1.4, 0.45], TRIM);
    box(gallery, [0.46, 0.18, 0.5], [x, 0.26, 0.45], SAND);
    box(gallery, [0.46, 0.17, 0.52], [x, 2.55, 0.45], TRIM);
    if (i < bays) arch(gallery, [x + spacing / 2, 2.58, 0.45], spacing, 0.69, 0.45);
  }
}
function building(parent: THREE.Group, x: number, z: number, width: number, depth: number, height: number, rotate = 0) {
  const node = group(parent, [x, 0, z]); node.rotation.y = rotate;
  box(node, [width + 0.3, 0.28, depth + 0.3], [0, 0.14, 0], '#c4ad8a');
  box(node, [width, height, depth], [0, height / 2, 0], SAND);
  box(node, [width + 0.16, 0.18, depth + 0.16], [0, height - 0.1, 0], TRIM);
  box(node, [width + 0.05, 0.12, depth + 0.05], [0, 2.7, 0], '#c6a779');
  hipRoof(node, width + 0.65, depth + 0.7, 1.45, height + 0.66);
  const count = Math.floor(width / 1.5);
  for (let i = 0; i < count; i++) {
    const xx = -width / 2 + (i + 0.5) * width / count;
    windowFrame(node, xx, height - 1.25, depth / 2 + 0.05);
    if (Math.abs(xx) > 0.8) windowFrame(node, xx, 1.47, depth / 2 + 0.05, 0.67, 1.16);
  }
  for (const side of [-1, 1]) {
    const wall = group(node, [side * width / 2, 0, 0]); wall.rotation.y = side * Math.PI / 2;
    for (const xx of [-depth / 3, depth / 3]) windowFrame(wall, xx, height - 1.3, 0.055);
  }
  box(node, [1.22, 2.1, 0.14], [0, 1.15, depth / 2 + 0.04], '#785f4b');
  box(node, [0.06, 2, 0.04], [0, 1.17, depth / 2 + 0.13], '#c1a67a');
  for (const side of [-1, 1]) ball(node, [0.035, 0.035, 0.035], [side * 0.14, 1.1, depth / 2 + 0.18], '#e4c583');
  arch(node, [0, 2.15, depth / 2 + 0.13], 1.55, 0.65, 0.24);
  for (let i = 0; i < 2; i++) box(node, [1.9 + i * 0.35, 0.12, 0.4], [0, 0.18 - i * 0.06, depth / 2 + 0.35 + i * 0.32], TRIM);
  return node;
}
function tower(parent: THREE.Group) {
  const node = group(parent, [-6.3, 0, -9.3]);
  box(node, [5.6, 0.4, 5.6], [0, 0.2, 0], '#c3ab84');
  box(node, [4.25, 21.5, 4.25], [0, 10.75, 0], SAND);
  for (const y of [0.7, 3.25, 18.7, 21.2]) box(node, [4.6, 0.28, 4.6], [0, y, 0], TRIM);
  for (const x of [-1.9, 1.9]) for (const z of [-1.9, 1.9]) box(node, [0.28, 17.8, 0.28], [x, 10.1, z], '#e2caa2');
  box(node, [5.15, 3.6, 5.15], [0, 22.4, 0], '#e6cca1');
  for (let side = 0; side < 4; side++) {
    const face = group(node); face.rotation.y = side * Math.PI / 2;
    for (const x of [-1.15, 1.15]) {
      box(face, [0.9, 2.05, 0.1], [x, 22.3, 2.61], '#415c60');
      arch(face, [x, 23.27, 2.67], 1.18, 0.52, 0.18);
      for (const y of [21.6, 21.93, 22.26, 22.59]) box(face, [0.82, 0.085, 0.12], [x, y, 2.7], '#9b8f72');
    }
    for (const y of [5.5, 9.2, 12.9, 16.6]) {
      box(face, [0.65, 1.25, 0.08], [0, y, 2.16], '#58706c');
      box(face, [0.87, 0.1, 0.18], [0, y - 0.66, 2.22], TRIM);
    }
  }
  box(node, [5.45, 0.3, 5.45], [0, 24.32, 0], TRIM);
  hipRoof(node, 5.8, 5.8, 2.7, 25.8);
  cylinder(node, 0.17, 0.65, [0, 27.45, 0], '#d1b280');
  ball(node, [0.22, 0.22, 0.22], [0, 27.78, 0], '#d1b280');
}
function tree(parent: THREE.Group, x: number, z: number, height: number, palette: number, palm = false) {
  const node = group(parent, [x, 0, z]);
  const trunk = palm ? height * 0.78 : height * 0.55;
  cylinder(node, palm ? 0.15 : 0.18, trunk, [0, trunk / 2, 0], '#8b7150');
  if (palm) {
    for (let i = 0; i < 7; i++) {
      const leaf = ball(node, [0.25, 0.13, height * 0.31], [0, trunk + 0.12, 0], i % 2 ? '#5d8062' : '#73915f');
      const angle = i / 7 * TAU; leaf.position.x = Math.sin(angle) * height * 0.22; leaf.position.z = Math.cos(angle) * height * 0.22;
      leaf.rotation.set(-0.22, angle, 0);
    }
    ball(node, [0.36, 0.3, 0.36], [0, trunk, 0], '#8e8054');
  } else {
    const colors = ['#66846c', '#7c956d', '#8c9d71'];
    ball(node, [height * 0.28, height * 0.34, height * 0.28], [0, height * 0.72, 0], colors[palette % 3]);
    ball(node, [height * 0.2, height * 0.23, height * 0.2], [-height * 0.19, height * 0.6, height * 0.06], colors[(palette + 1) % 3]);
    ball(node, [height * 0.18, height * 0.23, height * 0.2], [height * 0.19, height * 0.65, -height * 0.07], colors[palette % 3]);
  }
}
function bench(parent: THREE.Group, x: number, z: number, rotation = 0) {
  const node = group(parent, [x, 0, z]); node.rotation.y = rotation;
  for (const offset of [-0.19, 0, 0.19]) box(node, [1.8, 0.09, 0.15], [0, 0.53, offset], '#9c7855');
  for (const y of [0.76, 0.96]) box(node, [1.8, 0.15, 0.08], [0, y, -0.22], '#9c7855');
  for (const side of [-1, 1]) {
    box(node, [0.09, 0.5, 0.47], [side * 0.65, 0.25, 0], '#475a58');
    box(node, [0.07, 0.55, 0.08], [side * 0.65, 0.73, -0.22], '#475a58');
    box(node, [0.08, 0.08, 0.5], [side * 0.8, 0.74, 0], '#475a58');
  }
}
function lamp(parent: THREE.Group, x: number, z: number) {
  cylinder(parent, 0.075, 3.1, [x, 1.55, z], '#455b59');
  cylinder(parent, 0.16, 0.2, [x, 0.1, z], '#455b59');
  box(parent, [0.38, 0.5, 0.38], [x, 3.14, z], '#f6e2b1', 0.3);
  box(parent, [0.45, 0.08, 0.45], [x, 2.86, z], '#455b59');
  const top = cone(parent, 0.35, 0.28, [x, 3.52, z], '#455b59', 4); top.rotation.y = Math.PI / 4;
  for (const dx of [-0.18, 0.18]) for (const dz of [-0.18, 0.18]) box(parent, [0.04, 0.53, 0.04], [x + dx, 3.14, z + dz], '#455b59');
}

function futureNeighborhood(parent: THREE.Group) {
  const raw = group(), solid = group(parent); solid.name = 'imagined-tech-neighborhood';
  const city: [number, number, number, number, number][] = [
    [-14, -13.5, 3.7, 3.4, 12], [-10.5, -16.7, 3.2, 3.2, 17], [-3.6, -17.6, 3.9, 3.1, 15],
    [1.6, -18, 3.6, 3.1, 22], [7.1, -17.5, 4, 3.2, 17.5], [12.5, -14, 3.6, 3.5, 13.5],
  ];
  city.forEach(([x, z, width, depth, height], i) => {
    const node = group(raw, [x, 0, z]);
    box(node, [width + 0.5, 0.5, depth + 0.5], [0, 0.25, 0], '#a7b9b3');
    box(node, [width, height, depth], [0, height / 2, 0], i % 2 ? '#7ba6ac' : '#648b98');
    for (let y = 1; y < height; y += 1.35) {
      box(node, [width + 0.07, 0.11, depth + 0.07], [0, y, 0], '#bdd7cc');
      for (const sx of [-1, 0, 1]) box(node, [width / 5, 0.65, 0.07], [sx * width / 3, y + 0.49, depth / 2 + 0.06], '#c0e8dc', 0.16);
    }
    for (const side of [-1, 1]) box(node, [0.13, height, depth + 0.1], [side * (width / 2 - 0.12), height / 2, 0], '#dbe8d8');
    box(node, [width + 0.25, 0.3, depth + 0.25], [0, height + 0.05, 0], '#dbe8d8');
    box(node, [width * 0.7, 0.35, depth * 0.65], [0, height + 0.35, 0], '#8caa76');
    if (i === 3) {
      cylinder(node, 0.055, 2.7, [0, height + 1.4, 0], '#def0db');
      ball(node, [0.15, 0.15, 0.15], [0, height + 2.8, 0], '#96f1d4', 0.8);
    }
  });
  // Elevated research links communicate collaboration without baked labels or numbers.
  for (const [x, z, length, y] of [[-1.2, -17.8, 4.8, 8.5], [4.5, -17.5, 3, 11]]) {
    box(raw, [length, 1.1, 1.25], [x, y, z], '#b8d8cf');
    box(raw, [length, 0.55, 1.3], [x, y + 0.1, z], '#5e9098');
    box(raw, [length, 0.075, 1.36], [x, y - 0.47, z], '#8aecd5', 0.5);
  }
  // Research pavilion: glazed walls, visible robot arm, rooftop observatory.
  const lab = group(raw, [14.3, 0, -4.5]);
  box(lab, [6.4, 0.3, 5.8], [0, 0.15, 0], '#c9cec0');
  box(lab, [6, 4.3, 5.2], [0, 2.3, 0], '#9ebbc0');
  box(lab, [6.35, 0.28, 5.5], [0, 4.55, 0], '#e5e5d4');
  box(lab, [5.5, 2.9, 0.08], [0, 2.25, 2.65], '#496f7d');
  for (const x of [-2.7, -0.9, 0.9, 2.7]) box(lab, [0.13, 3.2, 0.17], [x, 2.25, 2.7], '#d9e6dc');
  box(lab, [6.6, 0.12, 0.5], [0, 4.38, 2.85], '#95efd6', 0.6);
  cylinder(lab, 1.45, 0.4, [0.6, 4.84, -0.2], '#e3e4d5');
  ball(lab, [1.37, 1.12, 1.37], [0.6, 5.06, -0.2], '#bccfca');
  box(lab, [0.16, 1.1, 1.5], [0.6, 5.6, 0.43], '#617e8b').rotation.x = -0.45;
  // Open-air experimental robot, larger than the delivery bots so it reads in a wide shot.
  const robotArm = group(raw, [10.8, 0, 10.4]);
  cylinder(robotArm, 0.85, 0.35, [0, 0.2, 0], '#9fb1ad');
  cylinder(robotArm, 0.42, 1.1, [0, 0.85, 0], '#e5d6a6');
  bar(robotArm, [0, 1.35, 0], [0.7, 2.5, 0], 0.22, '#e7c776');
  ball(robotArm, [0.32, 0.32, 0.32], [0.7, 2.5, 0], '#546d77');
  bar(robotArm, [0.7, 2.5, 0], [-0.4, 3.1, 0], 0.18, '#e7c776');
  ball(robotArm, [0.23, 0.23, 0.23], [-0.4, 3.1, 0], '#546d77');
  for (const s of [-1, 1]) bar(robotArm, [-0.4, 3.1, 0], [-0.6, 2.7, s * 0.19], 0.08, '#d3ded5');
  // Solar parking/pergola with individual cells, battery cabinets and charging posts.
  const solar = group(raw, [-14, 0, 6.8]);
  for (const x of [-2.7, 2.7]) for (const z of [-1.7, 1.7]) cylinder(solar, 0.12, 3.2, [x, 1.6, z], '#c8d2c6');
  const panel = group(solar, [0, 3.3, 0]); panel.rotation.x = -0.16;
  box(panel, [6.7, 0.16, 4.6], [0, 0, 0], '#dbe0cf');
  for (let x = 0; x < 6; x++) for (let z = 0; z < 4; z++) {
    box(panel, [0.97, 0.045, 0.96], [-2.75 + x * 1.1, 0.105, -1.65 + z * 1.1], '#35667c');
    box(panel, [0.023, 0.05, 0.96], [-2.75 + x * 1.1, 0.11, -1.65 + z * 1.1], '#9bcbc5');
  }
  for (const x of [-2, 0, 2]) {
    box(solar, [0.6, 1.3, 0.5], [x, 0.7, -1.8], '#d7e1d4');
    box(solar, [0.37, 0.3, 0.06], [x, 0.95, -1.52], '#76d4ba', 0.3);
  }
  // Wind power with a separately sampled rotor.
  const turbine = group(raw, [-16, 0, -5.4]);
  cylinder(turbine, 0.19, 11.4, [0, 5.7, 0], '#dbe4d6');
  capsule(turbine, [0.65, 0.65, 1.25], [0, 11.3, 0], '#e3e9db');
  const rotor = group(parent, [-16, 11.3, -4.65]);
  ball(rotor, [0.34, 0.34, 0.27], [0, 0, 0], '#e3e9db');
  for (let i = 0; i < 3; i++) {
    const blade = group(rotor); blade.rotation.z = i / 3 * TAU;
    const shape = capsule(blade, [0.29, 3.9, 0.12], [0.13, 1.85, 0], '#e3e9db'); shape.rotation.z = -0.1;
  }
  instanceParts(raw, solid);
  return { rotor };
}

function deliveryRobot(parent: THREE.Group, color: string) {
  const node = group(parent);
  capsule(node, [0.68, 0.55, 0.73], [0, 0.52, 0], '#e4e9dc');
  box(node, [0.46, 0.19, 0.045], [0, 0.62, 0.366], '#355964');
  for (const x of [-0.12, 0.12]) ball(node, [0.043, 0.043, 0.02], [x, 0.63, 0.398], color, 0.65);
  for (const x of [-0.34, 0.34]) for (const z of [-0.2, 0.2]) {
    const wheel = cylinder(node, 0.16, 0.09, [x, 0.19, z], '#3c5057'); wheel.rotation.z = Math.PI / 2;
  }
  cylinder(node, 0.019, 0.37, [0, 0.98, -0.16], '#546e72');
  ball(node, [0.055, 0.055, 0.055], [0, 1.18, -0.16], color, 0.4);
  box(node, [0.5, 0.06, 0.5], [0, 0.82, 0], color);
  return node;
}
function flyingPod(parent: THREE.Group) {
  const node = group(parent);
  ball(node, [0.8, 0.32, 0.43], [0, 0, 0], '#e3e8d8');
  ball(node, [0.43, 0.21, 0.33], [0.04, 0.2, 0.02], '#5e95a0');
  for (const x of [-0.65, 0.65]) {
    box(node, [0.18, 0.1, 1.4], [x, 0, 0], '#b7cdc5');
    for (const z of [-0.57, 0.57]) {
      const hoop = ring(node, 0.26, 0.04, [x, 0.03, z], '#7faca9'); hoop.rotation.x = Math.PI / 2;
      cylinder(node, 0.07, 0.05, [x, 0.03, z], '#455f6a');
    }
  }
  ball(node, [0.07, 0.055, 0.055], [0.65, 0.1, 0.2], '#a3f3cf', 0.8);
  return node;
}

export function buildCampus(seed: number, variant: 'california' | 'boston_tech'): CampusVisual {
  const root = group(); root.name = `stanford-${variant}`;
  const raw = group(), staticScene = group(root), random = rng(seed);
  const grass = '#a4b58b';
  part(raw, geometry('island', () => new THREE.CylinderGeometry(21, 20.4, 1.2, 80)), '#c2ae88', [0, -0.65, 0]);
  cylinder(raw, 20.95, 0.1, [0, -0.01, 0], grass);
  // Main approach, crosswalk and circular plaza; all surfaces sit close to y=0.
  box(raw, [3.6, 0.06, 36.5], [0, 0.055, 1.5], '#e4d3b5');
  box(raw, [32, 0.065, 3.5], [0, 0.058, 7.4], '#e4d3b5');
  cylinder(raw, 4.5, 0.08, [0, 0.06, 2], '#dfd0b4');
  for (const x of [-2, 2]) box(raw, [0.13, 0.1, 27], [x, 0.08, 5.2], '#ecddbf');
  for (const x of [-7.5, 7.5]) box(raw, [1.5, 0.05, 17], [x, 0.06, -1.6], '#e4d3b5');
  tower(raw);
  building(raw, -12, -6.6, 7, 5.3, 5.8, Math.PI / 2);
  building(raw, -11.8, 1.2, 6.6, 4.5, 4.7, Math.PI / 2);
  building(raw, 11.2, -6.5, 7.2, 5.2, 5.6, -Math.PI / 2);
  building(raw, 11.1, 1.4, 6.7, 4.5, 4.6, -Math.PI / 2);
  const church = building(raw, 2.6, -11.3, 8.7, 5.7, 6.8);
  // Memorial-Church-like central gable and round window, with clear sandstone/red roof identity.
  const gable = cone(church, 1, 2, [0, 7.2, 3], SAND, 3);
  gable.rotation.y = Math.PI; gable.scale.set(4.3, 2.1, 0.42);
  const rose = ring(church, 0.8, 0.16, [0, 5.2, 2.98], TRIM);
  const roseGlass = cylinder(church, 0.64, 0.08, [0, 5.2, 3.02], '#59797d'); roseGlass.rotation.x = Math.PI / 2;
  for (let i = 0; i < 8; i++) {
    const spoke = box(church, [0.055, 1.27, 0.08], [0, 5.2, 3.09], '#c0bf9b'); spoke.rotation.z = i / 8 * Math.PI;
  }
  rose.name = 'rose-window';
  arcade(raw, 16.4, 8, [1.8, 0, -5.8]);
  arcade(raw, 7, 4, [-7.7, 0, -1.9], Math.PI / 2);
  arcade(raw, 7, 4, [8.1, 0, -1.9], -Math.PI / 2);
  // Low planting beds and a fountain kept away from the central walking route.
  for (const x of [-4.8, 4.8]) {
    cylinder(raw, 1.6, 0.22, [x, 0.12, 3.5], '#c6b493');
    cylinder(raw, 1.47, 0.08, [x, 0.25, 3.5], '#7f9869');
    for (let i = 0; i < 8; i++) ball(raw, [0.17, 0.12, 0.17], [x + Math.cos(i / 8 * TAU), 0.35, 3.5 + Math.sin(i / 8 * TAU)], i % 2 ? '#d0bd7e' : '#a27268');
  }
  const fountain = group(raw, [4.9, 0, 11.2]);
  cylinder(fountain, 1.85, 0.3, [0, 0.2, 0], '#d5c3a2');
  cylinder(fountain, 1.6, 0.055, [0, 0.37, 0], '#84b9bd');
  cylinder(fountain, 0.25, 1, [0, 0.77, 0], TRIM);
  cylinder(fountain, 0.76, 0.2, [0, 1.23, 0], TRIM);
  ball(fountain, [0.12, 0.28, 0.12], [0, 1.48, 0], '#9bcfd0');
  for (const [x, z, rotation] of [[-4.5, 9.8, 0], [-4.5, 14.4, Math.PI], [variant === 'boston_tech' ? 14.5 : 8.8, 9.8, Math.PI / 2], [4.5, 15.1, Math.PI]]) bench(raw, x, z, rotation);
  for (const x of [-2.8, 2.8]) for (const z of [-2, 8, 15.7]) lamp(raw, x, z);
  for (let i = 0; i < 18; i++) {
    const angle = i / 18 * TAU + random() * 0.12, radius = 17.5 + random() * 1.7;
    const x = Math.sin(angle) * radius, z = Math.cos(angle) * radius;
    if (Math.abs(x) < 3.6 && z > 0) continue;
    const height = 3.5 + random() * 1.8;
    // Keep the robotics demonstration's viewing wedge open. Low planting here
    // replaces the two tall perimeter crowns that otherwise surround its camera.
    if (variant === 'boston_tech' && x > 3 && x < 15 && z > 10) {
      ball(raw, [0.75, 0.27, 0.65], [x, 0.25, z], '#82996e');
    } else tree(raw, x, z, height, i, variant === 'california' && i % 3 === 0);
  }
  if (variant === 'california') for (const x of [-5.8, 5.8]) tree(raw, x, 16.8, 5.6, 1, true);
  // Bicycle rack with two deliberately simple but readable campus bicycles.
  for (const dx of [-0.7, 0.7]) {
    const bike = group(raw, [-9 + dx, 0, 10.7]);
    for (const z of [-0.48, 0.48]) {
      const wheel = ring(bike, 0.34, 0.04, [0, 0.4, z], '#405754'); wheel.rotation.y = Math.PI / 2;
    }
    for (const [a, b] of [
      [[0, 0.4, -0.48], [0, 0.43, 0]], [[0, 0.43, 0], [0, 0.96, -0.15]], [[0, 0.96, -0.15], [0, 0.4, -0.48]],
      [[0, 0.43, 0], [0, 0.86, 0.31]], [[0, 0.86, 0.31], [0, 0.96, -0.15]], [[0, 0.4, 0.48], [0, 1.08, 0.27]],
    ] as [V3, V3][]) bar(bike, a, b, 0.025, '#9e5850');
    box(bike, [0.22, 0.06, 0.24], [0, 1.03, -0.16], '#405754');
    bar(bike, [-0.24, 1.08, 0.27], [0.24, 1.08, 0.27], 0.025, '#405754');
  }
  instanceParts(raw, staticScene);

  const crowdSource = group(), crowdDraws = group(root);
  const shirts = ['#943d45', '#d5aa61', '#558588', '#6174a0', '#d6c9aa', '#a9716d'];
  const skins = ['#dfb48e', '#b97d56', '#82563f', '#edc7a1', '#c49372'];
  const hairs = ['#493b35', '#302f2b', '#a37c52', '#624433'];
  const people = Array.from({ length: 20 }, (_, i) => {
    const person = buildStudent({ shirt: shirts[i % shirts.length], skin: skins[i % skins.length], hair: hairs[i % hairs.length], variant: i });
    crowdSource.add(person.root);
    const size = 0.91 + random() * 0.13; person.root.scale.setScalar(size);
    return { person, offset: random(), phase: random() * TAU, i };
  });
  const updateCrowd = instanceParts(crowdSource, crowdDraws);

  const future = group(root); future.name = 'future-transformation';
  let rotor: THREE.Group | undefined;
  const robots: THREE.Group[] = [], pods: THREE.Group[] = [], ideaNodes: THREE.Mesh[] = [];
  if (variant === 'boston_tech') {
    ({ rotor } = futureNeighborhood(future));
    robots.push(deliveryRobot(future, '#89d9c2'), deliveryRobot(future, '#e2c477'), deliveryRobot(future, '#97c8e2'));
    pods.push(flyingPod(future), flyingPod(future));
    // A connected orbital invention motif above the lab, intentionally symbolic.
    const ideas = group(future, [13.5, 8.7, -3.9]);
    ball(ideas, [0.36, 0.36, 0.36], [0, 0, 0], '#ecda8f', 0.65);
    for (let i = 0; i < 3; i++) {
      const orbit = ring(ideas, 1.4, 0.035, [0, 0, 0], '#b2e9d2', 0.4);
      orbit.rotation.set(Math.PI / 3, i / 3 * Math.PI, 0);
      ideaNodes.push(ball(ideas, [0.14, 0.14, 0.14], [0, 0, 0], '#d5f5c8', 0.65));
    }
  }
  const sample: CampusVisual['sample'] = (seconds, transformation) => {
    for (const { person, offset, phase, i } of people) {
      const walking = i < 14;
      if (i < 8) {
        const forward = i % 2 === 0, z = wrap(offset * 18 + seconds * 0.47, 18) - 2;
        person.root.position.set(forward ? -0.95 : 0.95, 0.1, forward ? 16 - z : z);
        person.root.rotation.set(0, forward ? Math.PI : 0, 0);
      } else if (i < 14) {
        const forward = i % 2 === 0, x = wrap(offset * 25 + seconds * 0.43, 25) - 12.5;
        person.root.position.set(forward ? x : -x, 0.1, forward ? 6.55 : 8.25);
        person.root.rotation.set(0, forward ? Math.PI / 2 : -Math.PI / 2, 0);
      } else {
        const positions: V3[] = [[-4, 0.1, 11.8], [-4.8, 0.1, 11.5], [6.3, 0.1, 13.2], [7, 0.1, 13], [-6.5, 0.1, -1.8], [5.8, 0.1, -2.3]];
        if (variant === 'boston_tech') { positions[2] = [9.45, 0.1, 11.4]; positions[3] = [11.6, 0.1, 11.5]; }
        person.root.position.set(...positions[i - 14]); person.root.rotation.set(0, (i % 2 ? -1 : 1) * 0.9, 0);
        if (variant === 'boston_tech' && (i === 16 || i === 17)) person.root.rotation.y = i === 16 ? 0.75 : -0.75;
      }
      person.sample(seconds, i % 4 === 0 ? 'happy' : 'neutral', walking, phase);
    }
    updateCrowd();
    const t = smooth(transformation);
    future.visible = variant === 'boston_tech' && t > 0;
    future.scale.set(1, Math.max(0.001, t), 1);
    if (rotor) rotor.rotation.set(0, 0, seconds * 0.53);
    robots.forEach((robot, i) => {
      const z = wrap(seconds * 0.62 + i * 6, 18) - 1;
      robot.position.set(i === 0 ? -1.3 : i === 1 ? 1.35 : 7.2, 0.08, i === 1 ? 16 - z : z);
      robot.rotation.set(0, i === 1 ? Math.PI : 0, 0);
    });
    pods.forEach((pod, i) => {
      const angle = seconds * 0.14 + i * Math.PI;
      pod.position.set(Math.cos(angle) * 11, 11 + i * 4 + Math.sin(seconds * 0.6 + i) * 0.35, -7 + Math.sin(angle) * 6);
      pod.rotation.set(Math.sin(angle) * 0.045, -angle, Math.cos(angle) * 0.06);
    });
    ideaNodes.forEach((node, i) => {
      const angle = seconds * 0.7 + i * TAU / 3;
      node.position.set(Math.cos(angle) * 1.4, Math.sin(angle) * 0.8, Math.sin(angle + i) * 0.9);
      node.scale.setScalar(0.14);
    });
  };
  sample(0, variant === 'boston_tech' ? 1 : 0);
  return { root, sample };
}

/** Optional campus context, separate from the 21-unit core used by relocation shots. */
export function buildSurroundings(seed: number): CampusVisual {
  const root = group(); root.name = 'continuing-campus-surroundings';
  const raw = group(), random = rng(seed ^ 0x4ac2de);
  // A continuous main approach leaves the foreground student and landmark sightline clear.
  box(raw, [5.6, 0.045, 48], [0, 0.012, 43], '#e4d3b5');
  for (const side of [-1, 1]) {
    const x = side * 2.93;
    box(raw, [0.16, 0.085, 47], [x, 0.04, 42.5], '#ecddbf');
    // Low sandstone wings face into the campus rather than turning their backs to it.
    building(raw, side * 22.5, 27, 12.4, 6.6, 5.3, -side * Math.PI / 2);
    building(raw, side * 22, 44.5, 10.8, 6.3, 4.7, -side * Math.PI / 2);
    building(raw, side * 22, -28, 12.4, 6.6, 5.4, side * 0.08);
    arcade(raw, 9.5, 5, [side * 18.5, 0, 27], -side * Math.PI / 2);
    arcade(raw, 8.1, 4, [side * 18.2, 0, 44.5], -side * Math.PI / 2);
    // Paths join academic entrances to the central walk, making the grounds continuous.
    for (const z of [27, 44.5, 56]) {
      box(raw, [17, 0.05, 2.25], [side * 11.4, 0.018, z], '#e4d3b5');
      for (const dz of [-1.2, 1.2]) box(raw, [17, 0.06, 0.1], [side * 11.4, 0.033, z + dz], '#ecddbf');
    }
    for (const z of [23, 35, 48.5, 58]) {
      tree(raw, side * (7.3 + random() * 0.6), z, 4.5 + random() * 1.0, Math.floor(random() * 3));
      tree(raw, side * (29 + random() * 2), z - 2, 5.4 + random() * 1.3, Math.floor(random() * 3));
    }
    // Planting pockets and seating occupy the sides, never the central walking corridor.
    for (const z of [32, 51]) {
      bench(raw, side * 6, z, -side * Math.PI / 2);
      lamp(raw, side * 4.2, z - 1.8);
      cylinder(raw, 1.5, 0.22, [side * 12.4, 0.12, z], '#c6b493');
      cylinder(raw, 1.36, 0.08, [side * 12.4, 0.25, z], '#7f9869');
      for (let i = 0; i < 7; i++) {
        const angle = i / 7 * TAU;
        ball(raw, [0.19, 0.15, 0.19], [side * 12.4 + Math.cos(angle), 0.38, z + Math.sin(angle)], i % 2 ? '#cfb87c' : '#a57169');
      }
    }
    // Soft hedge groups articulate the open lawn without becoming solid visual walls.
    for (const z of [21, 37, 53]) for (let i = 0; i < 4; i++) {
      ball(raw, [0.8, 0.6, 0.65], [side * (12.2 + i * 0.95), 0.55, z], i % 2 ? '#82996e' : '#6d8967');
    }
    for (const z of [-25, -16, -5, 9]) tree(raw, side * (26 + random() * 3), z, 4.8 + random() * 1.5, Math.floor(random() * 3));
  }
  for (const x of [-29, -17, -9, 1, 10, 18, 29]) tree(raw, x, -33 - random() * 3, 5.8 + random() * 1.4, Math.floor(random() * 3));
  instanceParts(raw, root);
  // The scenery is static; leave root placement/visibility under the caller's control.
  return { root, sample(_seconds: number, _transformation: number) {} };
}

export function buildSky(seed: number): SkyVisual {
  const root = group(); root.name = 'soft-dimensional-sky';
  const random = rng(seed ^ 0x7359ad), clouds: { node: THREE.Group; x: number; y: number; z: number; phase: number }[] = [];
  // Broad cloud banks live well beyond the campus. Sun/cloud geometry never casts scene shadows.
  for (let i = 0; i < 11; i++) {
    const angle = (i / 11) * TAU;
    const x = Math.sin(angle) * (145 + random() * 30), z = Math.cos(angle) * (145 + random() * 30);
    const y = 36 + random() * 35, node = group(root, [x, y, z]);
    const size = 5.5 + random() * 4.5;
    for (let puff = 0; puff < 5; puff++) {
      const cloud = ball(node, [size * (0.8 + random() * 0.2), size * (0.38 + random() * 0.27), size * 0.55],
        [(puff - 2) * size * 0.68, (puff === 2 ? 0.9 : 0.1) * size * 0.4, Math.sin(puff) * size * 0.2], puff % 2 ? '#f3f1df' : '#fff8e8', 0.12);
      cloud.castShadow = false; cloud.receiveShadow = false;
    }
    node.rotation.y = angle; clouds.push({ node, x, y, z, phase: random() * TAU });
  }
  const sun = new THREE.Mesh(geometry('sun', () => new THREE.SphereGeometry(1, 24, 16)), new THREE.MeshBasicMaterial({ color: '#ffdf91' }));
  sun.position.set(-27, 36, -170); sun.scale.setScalar(10); root.add(sun);
  const halo = new THREE.Mesh(geometry('sun-halo', () => new THREE.SphereGeometry(1, 24, 16)), new THREE.MeshBasicMaterial({ color: '#ffe4a7', transparent: true, opacity: 0.1, depthWrite: false, side: THREE.BackSide }));
  halo.position.copy(sun.position); halo.scale.setScalar(12.5); root.add(halo);
  const sample: SkyVisual['sample'] = (seconds, camera) => {
    // A camera-oriented sky dome keeps the sun/cloud bank visible when a shot
    // tilts down over the island; its distant geometry has no scene parallax.
    camera.getWorldPosition(root.position); camera.getWorldQuaternion(root.quaternion); root.scale.set(1, 1, 1);
    clouds.forEach(({ node, x, y, z, phase }) => {
      node.position.set(x + Math.sin(seconds * 0.028 + phase) * 3, y + Math.sin(seconds * 0.021 + phase) * 0.45, z);
    });
    sun.position.set(-27, 36, -170); halo.position.copy(sun.position);
  };
  return { root, sample };
}
