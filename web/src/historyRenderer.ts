import * as THREE from 'three';
import type { ProductionSpec } from './generated/production';
import type { Diagnostics } from './renderer';
import { buildTimelineScene, type TimelineSceneId } from './timelineModels';
import { buildSky } from './models';
import { layoutCaption, tokenizeCaption } from '../../renderer/src/overlays/captionLayout';

const $ = (id: string) => document.getElementById(id)!;
const smooth = (p: number) => { const x = THREE.MathUtils.clamp(p, 0, 1); return x*x*(3-2*x); };
const emphasis = ['Stanford', 'Boston', 'Charles River', 'Harvard', 'MIT', 'garage', 'HP', 'Hewlett', 'Packard', 'research park', 'Sand Hill Road', 'New England', 'Silicon Valley', 'Silicon Harbor', 'ferry', 'tiny apartments', 'different'];
const indoor = new Set<TimelineSceneId>(['founding','workshop_east','computer_lab']);

export async function startHistoryRenderer(spec: ProductionSpec) {
  if (spec.shots.some(shot => shot.operation !== 'history_scene' || !shot.history)) throw new Error('Alternate-history shots require dated scene metadata');
  await Promise.all([document.fonts.load('600 72px "DM Sans"'),document.fonts.load('400 76px "DM Serif Display"')]);
  await document.fonts.ready;
  const renderer = new THREE.WebGLRenderer({canvas:$('scene') as HTMLCanvasElement,antialias:true,preserveDrawingBuffer:true});
  renderer.setPixelRatio(1); renderer.setSize(1080,1920);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.05;
  renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const scene=new THREE.Scene();
  const hemisphere=new THREE.HemisphereLight('#e8f4ff','#83705d',1.8); scene.add(hemisphere);
  const key=new THREE.DirectionalLight('#fff0d6',3.3); key.position.set(-25,50,35); key.castShadow=true;
  key.shadow.mapSize.set(2048,2048); key.shadow.camera.left=-40; key.shadow.camera.right=40; key.shadow.camera.top=40; key.shadow.camera.bottom=-40; key.shadow.camera.far=150; key.shadow.normalBias=.04; scene.add(key);
  const fill=new THREE.DirectionalLight('#bddbeb',.7); fill.position.set(25,15,-25); scene.add(fill);
  const camera=new THREE.PerspectiveCamera(42,1080/1920,.08,500);
  const sky=buildSky(spec.seed); scene.add(sky.root);
  const groundMaterial=new THREE.MeshStandardMaterial({color:'#bac7b3',roughness:1});
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(400,400),groundMaterial); ground.rotation.x=-Math.PI/2; ground.position.y=-.09; ground.receiveShadow=true; scene.add(ground);
  const ids=[...new Set(spec.shots.map(shot=>shot.history!.scene as TimelineSceneId))];
  const stages=new Map(ids.map(id=>[id,buildTimelineScene(id,spec.seed)]));
  for(const stage of stages.values()){stage.root.visible=false;scene.add(stage.root);}
  const measure=document.createElement('canvas').getContext('2d')!; measure.font='600 72px "DM Sans"'; measure.letterSpacing='-.5px';
  const layouts=new Map(spec.captions.map(caption=>{
    const lineBreakAfter=caption.text.includes('\n')?caption.text.split('\n')[0].trim().split(/\s+/).length:undefined;
    return [caption.id,layoutCaption(tokenizeCaption(caption.text,emphasis),text=>measure.measureText(text).width,{maxLineWidthPx:748,fontSizePx:72,minFontSizePx:60,lineBreakAfter})] as const;
  }));
  let captionId='', disposed=false;
  $('place').style.display='none'; $('map-labels').style.display='none'; $('comparison').style.display='none';

  function renderFrame(frame:number):Diagnostics {
    if(disposed)throw new Error('Renderer is disposed');
    if(!Number.isInteger(frame)||frame<0||frame>=spec.output.total_frames)throw new Error('Frame is outside the timeline');
    const index=spec.shots.findIndex(shot=>frame>=shot.start_frame&&frame<shot.end_frame), shot=spec.shots[index], history=shot.history!;
    // Keep camera travel continuous through the cut; eased tails read as still holds.
    const progress=(frame-shot.start_frame)/(shot.end_frame-shot.start_frame), t=progress, seconds=frame/30;
    let first=index,last=index;
    while(first>0&&spec.shots[first-1].history?.scene===history.scene)first--;
    while(last+1<spec.shots.length&&spec.shots[last+1].history?.scene===history.scene)last++;
    const sceneProgress=(frame-spec.shots[first].start_frame)/(spec.shots[last].end_frame-spec.shots[first].start_frame);
    const stage=stages.get(history.scene as TimelineSceneId)!;
    for(const candidate of stages.values())candidate.root.visible=candidate===stage;
    stage.sample(seconds,sceneProgress);
    const target=new THREE.Vector3(...stage.camera.target);
    camera.position.lerpVectors(new THREE.Vector3(...stage.camera.from),new THREE.Vector3(...stage.camera.to),t);
    camera.fov=stage.camera.fov*(history.framing==='detail'?.85:1);
    camera.lookAt(target); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    const inside=indoor.has(history.scene as TimelineSceneId);
    sky.root.visible=!inside; ground.visible=!inside;
    const background=inside?'#ddc7a5':history.year<1950?'#d2dfd9':history.year<2000?'#c2dce4':'#bbdce8';
    scene.background=new THREE.Color(background); scene.fog=new THREE.Fog(background,95,210);
    key.color.set(inside?'#ffe0b3':history.year<1950?'#fff0d1':'#fff1dc');
    groundMaterial.color.set(history.year<1950?'#b6bea1':'#becbb7');
    sky.sample(seconds,camera);
    $('year').textContent=String(history.year); $('history-location').textContent=history.location;
    const caption=spec.captions.find(cue=>frame>=cue.start_frame&&frame<cue.end_frame), layout=caption?layouts.get(caption.id):undefined;
    if((caption?.id??'')!==captionId){
      captionId=caption?.id??''; $('caption-text').replaceChildren();
      if(layout)for(const line of layout.lines){
        const lineElement=document.createElement('span');lineElement.className='caption-line';
        line.tokens.forEach((token,i)=>{if(i)lineElement.append(document.createTextNode(' '));const word=document.createElement('span');word.textContent=token.text;if(token.emphasis)word.className='caption-emphasis';lineElement.append(word);});
        $('caption-text').append(lineElement);
      }
    }
    $('caption').style.display=caption?'block':'none'; $('caption').style.fontSize=`${layout?.fontSizePx??72}px`;
    $('caption').style.transform=`translateY(${caption?5*(1-smooth((frame-caption.start_frame)/9)):0}px)`;
    renderer.render(scene,camera);
    const textBounds=['caption-text','year','history-location'].map(id=>{const b=$(id).getBoundingClientRect();return{id,x:b.x,y:b.y,width:b.width,height:b.height};});
    const warnings:string[]=[];
    for(const b of textBounds)if(b.width&&b.height&&(b.x<90||b.x+b.width>900.1||b.y<150||b.y+b.height>1620.1))warnings.push(`${b.id} exceeds essential-content margins`);
    if(layout?.overflow)warnings.push('caption cannot fit within two readable lines');
    if((layout?.lines.length??0)>2||textBounds[0].height>170)warnings.push('caption exceeds two readable lines');
    return{frame_index:frame,active_shot:shot.id,visible_subjects:[history.scene],text_bounds:textBounds,missing_resources:[],warnings,render_calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};
  }
  window.aether={ready:false,renderFrame,dispose(){disposed=true;const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();scene.traverse(object=>{if(object instanceof THREE.Mesh){geometries.add(object.geometry);(Array.isArray(object.material)?object.material:[object.material]).forEach(material=>materials.add(material));}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());renderer.dispose();}};
  renderFrame(0); renderer.compile(scene,camera); window.aether.ready=true;
}
