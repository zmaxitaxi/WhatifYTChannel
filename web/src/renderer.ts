import * as THREE from 'three';
import Ajv2020 from 'ajv/dist/2020';
import schema from '../../contracts/production.schema.json';
import type { ProductionSpec } from './generated/production';
import { buildCampus, buildStudent, buildSky, buildSurroundings, MODEL_DIMENSIONS } from './models';
import { layoutCaption, tokenizeCaption } from '../../renderer/src/overlays/captionLayout';
import { startHistoryRenderer } from './historyRenderer';
import { startDegreeRenderer } from './degreeRenderer';
import { startBostonJourneyRenderer } from './bostonJourneyRenderer';
import './renderer.css';

export type Diagnostics = {
  frame_index: number; active_shot: string; visible_subjects: string[];
  text_bounds: { id: string; x: number; y: number; width: number; height: number }[];
  missing_resources: string[]; warnings: string[]; render_calls: number; triangles: number;
};
declare global {
  interface Window {
    aether: { ready: boolean; renderFrame: (frame: number) => Diagnostics; dispose: () => void };
    aetherError?: string;
  }
}
const $ = (id: string) => document.getElementById(id)!;
const ease = (value: number) => { const p = THREE.MathUtils.clamp(value, 0, 1); return p * p * (3 - 2 * p); };
const lerp = THREE.MathUtils.lerp;

function buildMap() {
  const root = new THREE.Group();
  const shape = new THREE.Shape();
  const points = [[-8, 3.8], [-4, 4], [0, 3.6], [4, 4.1], [6, 3.2], [8.8, 3.4], [8.1, 1.3], [5.5, 0.2], [4.4, -1.9], [3.4, -2.1], [2.7, -0.7], [0, -1.1], [-1.5, -2.2], [-3.4, -1.2], [-4.5, -0.9], [-5.7, -0.1], [-7, 0.7], [-8, 3.8]];
  points.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y));
  const land = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.35, bevelEnabled: true, bevelSize: 0.15, bevelThickness: 0.15, bevelSegments: 2, steps: 1 }), new THREE.MeshStandardMaterial({ color: '#d7d4b8', roughness: .9 }));
  land.rotation.x = -Math.PI / 2; root.add(land);
  const origin = new THREE.Vector3(-6.7, .5, .4), destination = new THREE.Vector3(7.4, .5, -2.8);
  const curve = new THREE.QuadraticBezierCurve3(origin, new THREE.Vector3(0, 5.5, -1), destination);
  const route = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, .06, 7, false), new THREE.MeshBasicMaterial({ color: '#a34248' })); root.add(route);
  for (const point of [origin, destination]) {
    const marker = new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, .14, 24), new THREE.MeshBasicMaterial({ color: '#a34248' })); marker.position.copy(point); root.add(marker);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.42, .025, 8, 24), new THREE.MeshBasicMaterial({ color: '#a34248' })); ring.position.copy(point); ring.rotation.x = Math.PI / 2; root.add(ring);
  }
  return { root, route, curve };
}

function buildIdeaGlobe() {
  const root = new THREE.Group(), earth = new THREE.Group(); root.add(earth);
  earth.add(new THREE.Mesh(new THREE.SphereGeometry(6.5, 40, 28), new THREE.MeshStandardMaterial({ color: '#5b9cba', roughness: .65 })));
  const lineMaterial = new THREE.LineBasicMaterial({ color: '#e5f1e7', transparent: true, opacity: .35 });
  for (const latitude of [-.6, 0, .6]) {
    const y = Math.sin(latitude) * 6.54, r = Math.cos(latitude) * 6.54;
    const points = Array.from({ length: 65 }, (_, i) => new THREE.Vector3(Math.cos(i / 64 * Math.PI * 2) * r, y, Math.sin(i / 64 * Math.PI * 2) * r));
    earth.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), lineMaterial));
  }
  for (let i = 0; i < 6; i++) {
    const points = Array.from({ length: 65 }, (_, j) => new THREE.Vector3(Math.cos(j / 64 * Math.PI * 2) * 6.54, Math.sin(j / 64 * Math.PI * 2) * 6.54, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), i * Math.PI / 6));
    earth.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), lineMaterial));
  }
  const landMaterial = new THREE.MeshStandardMaterial({ color: '#a8bd83', roughness: 1 });
  const patches = [[-.6,.5,.55,2.7,1.8],[-.65,-.45,.45,1.4,2.3],[.2,.4,.85,2.7,1.5],[.55,-.35,.7,1.5,2.3],[.65,-.65,.25,1.3,.7]];
  for (const [x,y,z,w,h] of patches) {
    const patch = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), landMaterial);
    patch.position.copy(new THREE.Vector3(x,y,z).normalize().multiplyScalar(6.45)); patch.lookAt(patch.position.clone().multiplyScalar(2)); patch.scale.set(w,h,.28); earth.add(patch);
  }
  const routes: { curve: THREE.QuadraticBezierCurve3; pulse: THREE.Mesh }[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = i / 6 * Math.PI * 2;
    const destination = new THREE.Vector3(Math.cos(angle) * 6.6, Math.sin(angle) * 4.3, 3.2);
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-3.6,2.7,4.9), new THREE.Vector3(Math.cos(angle)*10,Math.sin(angle)*8,9), destination);
    earth.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 28, .035, 5, false), new THREE.MeshBasicMaterial({ color: '#f3cc87' })));
    const pulse = new THREE.Mesh(new THREE.SphereGeometry(.15, 8, 6), new THREE.MeshBasicMaterial({ color: '#fff3bb' })); earth.add(pulse); routes.push({curve,pulse});
  }
  return { root, sample(seconds: number) { earth.rotation.y = seconds * .1; routes.forEach(({curve,pulse},i) => pulse.position.copy(curve.getPoint((seconds * .15 + i / 6) % 1))); } };
}

async function main() {
  const requested = new URLSearchParams(location.search).get('spec') || '/spec.json';
  const specUrl = new URL(requested, location.origin);
  if (specUrl.origin !== location.origin) throw new Error('Only local specification URLs are permitted');
  const response = await fetch(specUrl); if (!response.ok) throw new Error('Specification could not be loaded');
  const raw = await response.json();
  const validate = new Ajv2020({ strict:false, allErrors:true, validateFormats:false }).compile(schema);
  if (!validate(raw)) throw new Error(JSON.stringify(validate.errors));
  const spec = raw as unknown as ProductionSpec;
  const supported = new Set(['character_react','campus_establish','campus_relocate','campus_arrive','campus_compare','campus_close','history_scene','degree_journey','boston_journey']);
  if (!['relocation','alternate_history','degree_expiry'].includes(spec.scenario_family) || spec.shots.some(shot => !supported.has(shot.operation))) throw new Error('needs_development: unsupported scenario or operation');
  if(spec.scenario_family==='degree_expiry') { await startDegreeRenderer(spec); return; }
  if(spec.history_journey) { await startBostonJourneyRenderer(spec); return; }
  if(spec.scenario_family==='alternate_history') { await startHistoryRenderer(spec); return; }
  $('composition').classList.add('legacy'); $('timecounter').style.display='none';
  await document.fonts.load('76px "DM Serif Display"');
  await document.fonts.ready;
  const renderer = new THREE.WebGLRenderer({ canvas:$('scene') as HTMLCanvasElement, antialias:true, preserveDrawingBuffer:true });
  renderer.setPixelRatio(1); renderer.setSize(1080,1920); renderer.setViewport(0,0,1080,1920);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#bbdbe5');
  scene.add(new THREE.HemisphereLight('#fff0d8','#8da7a2',2.1));
  const key = new THREE.DirectionalLight('#fff0d4',3.4); key.position.set(-35,70,45); key.castShadow = true;
  key.shadow.mapSize.set(2048,2048); key.shadow.camera.left=-55; key.shadow.camera.right=55; key.shadow.camera.top=55; key.shadow.camera.bottom=-55; key.shadow.camera.far=200; key.shadow.normalBias=.06; scene.add(key);
  const california = buildCampus(spec.campus.layout_seed,'california'), boston = buildCampus(spec.campus.layout_seed,'boston_tech'); scene.add(california.root,boston.root);
  const student = buildStudent(); scene.add(student.root);
  const friends = Array.from({length:4},(_,i) => buildStudent({variant:i+1})); friends.forEach(friend => scene.add(friend.root));
  const sky = buildSky(spec.seed); scene.add(sky.root);
  const surroundings = buildSurroundings(spec.seed); scene.add(surroundings.root);
  const map = buildMap(); scene.add(map.root);
  const globe = buildIdeaGlobe(); globe.root.position.set(16,29,-13); scene.add(globe.root);
  const groundMaterial = new THREE.MeshStandardMaterial({color:'#b0bd94',roughness:1});
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(500,500),groundMaterial); ground.rotation.x=-Math.PI/2; ground.position.y=-.04; ground.receiveShadow=true; scene.add(ground);
  const camera = new THREE.PerspectiveCamera(75,1080/1920,.1,700);
  const measure = document.createElement('canvas').getContext('2d')!;
  measure.font='76px "DM Serif Display"'; measure.letterSpacing='-1.7px';
  const captionLayouts=new Map<string,ReturnType<typeof layoutCaption>>();
  let disposed=false;

  function renderFrame(frame:number):Diagnostics {
    if(disposed) throw new Error('Renderer is disposed');
    if(!Number.isInteger(frame)||frame<0||frame>=spec.output.total_frames) throw new Error('Frame is outside the timeline');
    const shot = spec.shots.find(item => frame>=item.start_frame && frame<item.end_frame)!;
    const p=(frame-shot.start_frame)/(shot.end_frame-shot.start_frame), t=ease(p), seconds=frame/30;
    for(const campus of [california,boston]) { campus.root.visible=false; campus.root.position.set(0,0,0); campus.root.rotation.set(0,0,0); campus.root.scale.setScalar(1); }
    student.root.visible=false; student.root.position.set(0,0,60); student.root.rotation.set(0,0,0); student.root.scale.setScalar(1);
    friends.forEach((friend,i) => { friend.root.visible=false; friend.root.scale.setScalar(.92+i*.035); friend.root.position.set((i%2?1:-1)*(3.4+i*.65),0,54-i*4+Math.sin(seconds*.21+i)*2); friend.root.rotation.y=i%2 ? .3 : -.4; friend.sample(seconds, 'happy', true, i*1.7); });
    map.root.visible=false; map.root.rotation.set(0,0,0); globe.root.visible=false; sky.root.visible=true; ground.visible=true; surroundings.root.visible=true;
    camera.fov=45;
    groundMaterial.color.set('#b0bd94'); scene.background = new THREE.Color('#bbdbe5');
    $('place').textContent=''; $('map-labels').style.display='none'; $('comparison').style.display='none';
    let target=new THREE.Vector3(0,9,0);
    const orbit=(radius:number,height:number,angle:number) => camera.position.set(Math.sin(angle)*radius,height,Math.cos(angle)*radius);
    switch(shot.operation) {
      case 'character_react':
        california.root.visible=true; student.root.visible=true; friends.forEach(friend => friend.root.visible=true);
        camera.fov=75; camera.position.set(lerp(.8,.2,t),1.45,lerp(65,63.8,t)); target.set(0,1.4,60);
        break;
      case 'campus_establish':
        california.root.visible=true; orbit(62,18,lerp(.2,-.18,t)); target.set(0,13,0);
        break;
      case 'campus_relocate': {
        map.root.visible=true; california.root.visible=true; sky.root.visible=false; ground.visible=false; surroundings.root.visible=false; camera.fov=50;
        scene.background=new THREE.Color('#c8dde1'); camera.position.set(3,25,30); target.set(0,1.5,0);
        const travel=ease((p-.1)/.8); california.root.scale.setScalar(.055); california.root.position.copy(map.curve.getPoint(travel)).add(new THREE.Vector3(0,.5,0));
        map.route.geometry.setDrawRange(0,Math.floor(travel*80)*7*6); $('map-labels').style.display='flex';
        break;
      }
      case 'campus_arrive':
        boston.root.visible=true; boston.root.position.y=lerp(3,0,ease(p*3)); groundMaterial.color.set('#b4c9b4');
        if(p<.34){orbit(65,22,lerp(-.22,.12,ease(p/.34)));target.set(0,13,0);}
        else if(p<.65){camera.fov=50;camera.position.set(7.8,3.2,17.5);target.set(10.8,1.8,10.4);}
        else{camera.position.set(36,18,42);target.set(9,8,-4);}
        break;
      case 'campus_compare':
        boston.root.visible=true; globe.root.visible=true; camera.fov=55; orbit(80,36,lerp(-.2,.25,t)); target.set(3,17,-2); groundMaterial.color.set('#b4c9b4');
        break;
      case 'campus_close':
        boston.root.visible=true; student.root.visible=true; friends.forEach(friend => friend.root.visible=true); groundMaterial.color.set('#b4c9b4');
        camera.fov=75; camera.position.set(lerp(.8,.2,t),1.45,lerp(65,63.8,t)); target.set(0,1.4,60);
        break;
    }
    california.sample(seconds,0);
    boston.sample(seconds,shot.operation==='campus_arrive' ? ease(p*1.7) : 1);
    student.sample(seconds,shot.expression,false,0);
    surroundings.sample(seconds,0); globe.sample(seconds); camera.updateProjectionMatrix(); camera.lookAt(target); camera.updateMatrixWorld(true); sky.sample(seconds,camera);
    const caption=spec.captions.find(item => frame>=item.start_frame && frame<item.end_frame);
    if(caption&&!captionLayouts.has(caption.text))captionLayouts.set(caption.text,layoutCaption(tokenizeCaption(caption.text),text=>measure.measureText(text).width,{maxLineWidthPx:748,fontSizePx:76,minFontSizePx:60}));
    const captionLayout=caption?captionLayouts.get(caption.text):undefined;
    $('caption').textContent=captionLayout?.lines.map(line=>line.tokens.map(token=>token.text).join(' ')).join('\n')??'';
    $('caption').style.fontSize=`${captionLayout?.fontSizePx??76}px`;
    renderer.render(scene,camera);
    const textBounds=['caption'].map(id => { const b=$(id).getBoundingClientRect(); return {id,x:b.x,y:b.y,width:b.width,height:b.height}; });
    const warnings:string[]=[];
    for(const b of textBounds) if(b.x<90||b.x+b.width>900.1||b.y<180||b.y+b.height>1620.1) warnings.push(`${b.id} exceeds essential-content margins`);
    if(textBounds[0].height>246) warnings.push('caption wraps beyond two rendered lines');
    if(captionLayout?.overflow)warnings.push('caption cannot fit within two readable lines');
    return {frame_index:frame,active_shot:shot.id,visible_subjects:[california.root.visible?'stanford_california':'',boston.root.visible?'boston_tech_capital':'',student.root.visible?'student_v2':'',globe.root.visible?'global_ideas':'',map.root.visible?'diagrammatic_map':''].filter(Boolean),text_bounds:textBounds,missing_resources:[],warnings,render_calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};
  }
  renderer.compile(scene,camera);
  window.aether={ready:false,renderFrame,dispose(){disposed=true; const geometries=new Set<THREE.BufferGeometry>(), materials=new Set<THREE.Material>(); scene.traverse(object=>{if(object instanceof THREE.Mesh){geometries.add(object.geometry); (Array.isArray(object.material)?object.material:[object.material]).forEach(material=>materials.add(material));}}); geometries.forEach(geometry=>geometry.dispose()); materials.forEach(material=>material.dispose()); renderer.dispose();}};
  if(MODEL_DIMENSIONS.personHeight>MODEL_DIMENSIONS.towerHeight/5) throw new Error('Person/campus scale is inconsistent');
  renderFrame(0); await document.fonts.ready; window.aether.ready=true;
}
main().catch(error=>{window.aetherError=String(error);console.error(error);});
