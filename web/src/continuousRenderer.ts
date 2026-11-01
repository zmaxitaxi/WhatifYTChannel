import * as THREE from 'three';
import type { ProductionSpec } from './generated/production';
import type { Diagnostics } from './renderer';
import { sampleCamera, sampleTimeline, type CameraPoint, type Checkpoint } from './journeyMotion';
import { layoutCaption, tokenizeCaption } from '../../renderer/src/overlays/captionLayout';

const $ = (id: string) => document.getElementById(id)!;

export type ContinuousWorld = {
  root: THREE.Group;
  cameraPath: CameraPoint[];
  fov: number;
  sample(seconds: number, progress: number): void;
};
type JourneyOptions = {
  buildWorld(seed: number): ContinuousWorld;
  checkpoints: Checkpoint[];
  subject: string;
  sunrise?: boolean;
  counter?: { label: string; value(year: number, firstYear: number): number };
};

export async function startContinuousRenderer(spec: ProductionSpec, options: JourneyOptions) {
  const journey = { checkpoints: options.checkpoints };
  $('composition').classList.add('continuous');
  if(options.sunrise)$('composition').classList.add('sunrise');
  for (const id of ['timecounter','place','map-labels','comparison']) $(id).style.display = 'none';
  await document.fonts.load('400 84px "DM Serif Display"');
  await document.fonts.ready;
  const renderer = new THREE.WebGLRenderer({ canvas: $('scene') as HTMLCanvasElement, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(1080,1920);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#0a1015');
  scene.fog = new THREE.Fog('#0a1015',options.sunrise?240:65,options.sunrise?700:150);
  const ambient = new THREE.HemisphereLight('#e2e9ef','#29313a',2.1); scene.add(ambient);
  const key = new THREE.DirectionalLight('#ffe8c7',3.6); key.castShadow = true;
  key.shadow.mapSize.set(2048,2048); key.shadow.camera.left=-23; key.shadow.camera.right=23; key.shadow.camera.top=23; key.shadow.camera.bottom=-23; key.shadow.camera.far=110; key.shadow.normalBias=.025;
  scene.add(key,key.target);
  const fill = new THREE.DirectionalLight('#bdd9ec',.9); fill.position.set(8,14,-12); scene.add(fill);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(600,600),new THREE.MeshStandardMaterial({color:'#101820',roughness:1}));
  ground.rotation.x=-Math.PI/2; ground.position.y=-.055; ground.receiveShadow=true; scene.add(ground);
  const world = options.buildWorld(spec.seed); scene.add(world.root);
  const path = world.cameraPath;
  if(path.length<2 || path[0].at!==0 || path[path.length-1].at!==1 || path.some((n,i)=>i>0&&n.at<=path[i-1].at)) throw new Error('Continuous camera path must span 0..1 in strictly increasing order');
  const camera = new THREE.PerspectiveCamera(world.fov,1080/1920,.08,400);

  const timeline=document.createElement('canvas');timeline.width=810;timeline.height=220;
  timeline.setAttribute('role','img');timeline.setAttribute('aria-label','Story timeline with checkpoints and a moving red dot');
  const ink=timeline.getContext('2d',{willReadFrequently:true})!;
  $('journey-timeline').replaceChildren(timeline);
  // Redraw the whole diagram: overlapping retained SVG paths varied by a few
  // antialiased pixels after out-of-order requests in the pinned browser.
  function drawTimeline(frame:number,progress:number,activeIndex:number){
    ink.clearRect(0,0,810,220);ink.save();ink.textAlign='center';ink.textBaseline='alphabetic';
    ink.fillStyle='#63717a';ink.fillRect(50,99,710,2);
    ink.fillStyle='#eee7d8';ink.fillRect(50,99,Math.floor(710*progress),2);
    ink.font='400 36px "DM Serif Display"';
    for(const point of journey.checkpoints){
      const x=50+710*point.frame/(spec.output.total_frames-1),reached=frame>=point.frame;
      if(options.sunrise){ink.strokeStyle='#08141e';ink.lineWidth=3;ink.lineJoin='round';ink.strokeText(point.year==null?point.label:String(point.year),x,54);}
      ink.fillStyle=reached?'#f4eee2':'#a2afb6';ink.fillText(point.year==null?point.label:String(point.year),x,54);
      ink.beginPath();ink.arc(x,100,7,0,Math.PI*2);ink.fillStyle=reached?'#eee7d8':'#0a1015';ink.fill();ink.lineWidth=2;ink.strokeStyle='#77858c';ink.stroke();
    }
    const x=50+710*progress;ink.fillStyle='#ef565a';ink.globalAlpha=.15;ink.beginPath();ink.arc(x,100,21,0,Math.PI*2);ink.fill();
    ink.globalAlpha=1;ink.beginPath();ink.arc(x,100,12,0,Math.PI*2);ink.fill();
    const point=journey.checkpoints[activeIndex];ink.fillStyle='#f4eee2';ink.font='400 42px "DM Serif Display"';
    if(options.sunrise){ink.strokeStyle='#08141e';ink.lineWidth=3;ink.lineJoin='round';ink.strokeText(point.year==null?point.label:`${point.year} · ${point.label}`,405,197);}
    ink.fillText(point.year==null?point.label:`${point.year} · ${point.label}`,405,197);ink.restore();
    timeline.dataset.progress=String(progress);timeline.dataset.dotX=String(x);
  }
  const counterValue=document.createElement('span'); counterValue.id='renewal-value';
  if(options.counter){
    const label=document.createElement('span'); label.className='counter-label'; label.textContent=options.counter.label;
    $('journey-counter').replaceChildren(label,counterValue); $('journey-counter').style.display='flex';
  }else{ $('journey-counter').replaceChildren(); $('journey-counter').style.display='none'; }
  const measure=document.createElement('canvas').getContext('2d')!; measure.font='400 84px "DM Serif Display"';
  const layouts=new Map(spec.captions.map(cue=>{
    const lineBreakAfter=cue.text.includes('\n')?cue.text.split('\n')[0].trim().split(/\s+/).length:undefined;
    return [cue.id,layoutCaption(tokenizeCaption(cue.text,[]),text=>measure.measureText(text).width,{maxLineWidthPx:810,fontSizePx:84,minFontSizePx:64,lineBreakAfter})] as const;
  }));
  let previousCaption='',disposed=false;

  function renderFrame(frame:number):Diagnostics {
    if(disposed)throw new Error('Renderer is disposed');
    if(!Number.isInteger(frame)||frame<0||frame>=spec.output.total_frames)throw new Error('Frame outside the journey');
    const state=sampleTimeline(journey.checkpoints,frame,spec.output.total_frames);
    const seconds=frame/30, pose=sampleCamera(path,state.progress);
    world.sample(seconds,state.progress);
    if(options.sunrise){
      const daylight=THREE.MathUtils.smoothstep(seconds,40,68);
      const sky=new THREE.Color('#0a1724').lerp(new THREE.Color('#25444c'),daylight);
      scene.background=sky; scene.fog!.color.copy(sky);
      ambient.intensity=2.1+daylight*.55;
      key.color.set('#ffdbb1').lerp(new THREE.Color('#fff2ce'),daylight);
      key.intensity=3.5+daylight*.55;
      renderer.toneMappingExposure=1.1+daylight*.10;
    }
    camera.position.set(...pose.position); camera.lookAt(new THREE.Vector3(...pose.target)); camera.updateMatrixWorld(true);
    key.target.position.set(...pose.target); key.position.set(pose.target[0]-15,pose.target[1]+28,pose.target[2]+18);
    drawTimeline(frame,state.progress,state.activeIndex);
    if(options.counter)counterValue.textContent=String(options.counter.value(state.year,state.firstYear));
    const caption=spec.captions.find(cue=>frame>=cue.start_frame&&frame<cue.end_frame), layout=caption?layouts.get(caption.id):undefined;
    if((caption?.id??'')!==previousCaption){
      previousCaption=caption?.id??''; $('caption-text').replaceChildren();
      if(layout)for(const line of layout.lines){const span=document.createElement('span');span.className='caption-line';span.textContent=line.tokens.map(t=>t.text).join(' ');$('caption-text').append(span);}
    }
    $('caption').style.display=caption?'block':'none'; $('caption').style.fontSize=`${layout?.fontSizePx??84}px`;
    renderer.render(scene,camera);
    const textBounds=['caption-text','journey-timeline','journey-counter'].map(id=>{const b=$(id).getBoundingClientRect();return{id,x:b.x,y:b.y,width:b.width,height:b.height};});
    const warnings:string[]=[];
    for(const b of textBounds)if(b.width&&b.height&&(b.x<90||b.x+b.width>900.1||b.y<150||b.y+b.height>1620.1))warnings.push(`${b.id} exceeds essential margins`);
    if(layout?.overflow || (layout?.lines.length??0)>2)warnings.push('caption exceeds two readable lines');
    const shot=spec.shots.find(beat=>frame>=beat.start_frame&&frame<beat.end_frame)!;
    return{frame_index:frame,active_shot:shot.id,visible_subjects:[options.subject],text_bounds:textBounds,missing_resources:[],warnings,render_calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};
  }
  window.aether={ready:false,renderFrame,dispose(){disposed=true;const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();scene.traverse(o=>{if(o instanceof THREE.Mesh){geometries.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());renderer.dispose();}};
  renderFrame(0); renderer.compile(scene,camera); window.aether.ready=true;
}
