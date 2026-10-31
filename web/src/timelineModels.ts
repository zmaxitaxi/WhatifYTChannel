import * as THREE from 'three';
import { buildStudent } from './models';

/** Fictional alternate-history sets. Geometry is authored locally, then batched.
 * No lights, captions, render loops, global time, or renderer ownership here. */
export type TimelineSceneId = 'founding'|'campus_1891'|'garage_west'|'workshop_east'|'research_park'|'sand_hill'|'silicon_harbor'|'computer_lab'|'ferry'|'world_network'|'housing'|'future';
type V3 = [number, number, number];
export type TimelineVisual = {
  root: THREE.Group;
  camera: { from: V3; to: V3; target: V3; fov: number };
  sample(seconds: number, progress: number): void;
};
type Motion = (seconds: number, progress: number) => void;
type WalkPath = { to: V3; start?: number; end?: number };
const TAU = Math.PI * 2;
/** Travel distance drives the gait, so feet stop cycling when a walker stops. */
function walkPose(at: V3, path: WalkPath, progress: number, scale = 1) {
  const u = THREE.MathUtils.clamp((progress-(path.start??0))/((path.end??1)-(path.start??0)),0,1);
  const dx=path.to[0]-at[0],dz=path.to[2]-at[2],distance=Math.hypot(dx,dz)*u;
  return {u,distance,gait:distance*TAU/(.82*scale),yaw:Math.atan2(dx,dz),moving:u>0&&u<1};
}
const C = {
  brick: '#a55b4c', red: '#8c263b', pale: '#ead6ae', stone: '#bcb8a6',
  slate: '#364d59', glass: '#76b6c4', wood: '#886044', darkWood: '#4e3c34',
  water: '#438b9c', grass: '#83966a', leaf: '#526f56', gold: '#cfa65d',
  white: '#f5eddb', black: '#263a43', terra: '#c97953', teal: '#418e8f',
};
const shapes = new Map<string, THREE.BufferGeometry>();
const surfaces = new Map<string, THREE.MeshStandardMaterial>();
const smooth = (n: number) => { const t = THREE.MathUtils.clamp(n, 0, 1); return t*t*(3-2*t); };
const wrap = (n: number) => ((n % 1) + 1) % 1;
function geo(key: string, make: () => THREE.BufferGeometry) {
  if (!shapes.has(key)) shapes.set(key, make());
  return shapes.get(key)!;
}
function mat(color: string, glow = 0) {
  const key = `${color}:${glow}`;
  if (!surfaces.has(key)) surfaces.set(key, new THREE.MeshStandardMaterial({
    color, roughness: .76, metalness: color === C.gold ? .32 : .03,
    emissive: glow ? color : '#000000', emissiveIntensity: glow,
  }));
  return surfaces.get(key)!;
}
function group(parent?: THREE.Object3D, at: V3 = [0,0,0]) {
  const g = new THREE.Group(); g.position.set(...at); parent?.add(g); return g;
}
function part(p: THREE.Object3D, geometry: THREE.BufferGeometry, at: V3, size: V3, color: string, glow = 0) {
  const m = new THREE.Mesh(geometry, mat(color, glow));
  m.position.set(...at); m.scale.set(...size); m.castShadow = true; m.receiveShadow = true; p.add(m); return m;
}
const box = (p: THREE.Object3D, at: V3, size: V3, c: string, glow = 0) => part(p, geo('box',()=>new THREE.BoxGeometry()),at,size,c,glow);
const ball = (p: THREE.Object3D, at: V3, size: V3, c: string) => part(p,geo('sphere',()=>new THREE.SphereGeometry(1,12,8)),at,size,c);
const cyl = (p: THREE.Object3D, at: V3, radius: number, height: number, c: string) => part(p,geo('cyl',()=>new THREE.CylinderGeometry(1,1,1,12)),at,[radius,height,radius],c);
const cone = (p: THREE.Object3D, at: V3, size: V3, c: string) => part(p,geo('cone',()=>new THREE.ConeGeometry(1,1,12)),at,size,c);
function beam(p: THREE.Object3D, a: V3, b: V3, radius: number, color: string) {
  const av = new THREE.Vector3(...a), bv = new THREE.Vector3(...b);
  const m = cyl(p,av.clone().add(bv).multiplyScalar(.5).toArray() as V3,radius,av.distanceTo(bv),color);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),bv.sub(av).normalize()); return m;
}
function torus(p: THREE.Object3D, at: V3, radius: number, c: string, tube = .07) {
  return part(p,geo(`ring:${tube/radius}`,()=>new THREE.TorusGeometry(1,tube/radius,6,24)),at,[radius,radius,radius],c);
}
function roof(p: THREE.Object3D, at: V3, width: number, depth: number, height = 1, color = C.slate) {
  return part(p,geo('roof',()=>new THREE.ConeGeometry(1,1,4).rotateY(Math.PI/4)),at,[width/Math.SQRT2,height,depth/Math.SQRT2],color);
}
function arch(p: THREE.Object3D, at: V3, width: number, height: number, depth: number, c: string) {
  const shape = geo('arch',()=>{
    const s = new THREE.Shape(); s.moveTo(1,0); s.absarc(0,0,1,0,Math.PI,false);
    s.lineTo(-.73,0); s.absarc(0,0,.73,Math.PI,0,true); s.closePath();
    return new THREE.ExtrudeGeometry(s,{depth:1,bevelEnabled:false,curveSegments:12}).translate(0,0,-.5);
  });
  return part(p,shape,at,[width/2,height,depth],c);
}
function sign(p: THREE.Object3D, text: string, at: V3, width: number, height: number, color = C.red) {
  box(p,at,[width+.13,height+.13,.12],C.pale);
  // Canvas access is deferred until construction; no font/network dependency.
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
  const ctx = canvas.getContext('2d')!; ctx.fillStyle = color; ctx.fillRect(0,0,1024,256);
  ctx.fillStyle = C.white; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = 'bold 92px Georgia, serif';
  const tw = ctx.measureText(text).width;
  if (tw > 950) ctx.font = `bold ${Math.floor(92*950/tw)}px Georgia, serif`;
  ctx.fillText(text,512,132);
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshStandardMaterial({map:tex,roughness:.9});
  const m = new THREE.Mesh(geo('plane',()=>new THREE.PlaneGeometry()),material);
  m.position.set(at[0],at[1],at[2]+.068); m.scale.set(width,height,1); p.add(m); return m;
}
function windowPane(p: THREE.Object3D, x: number, y: number, z: number, w = .75, h = 1.1, lit = false) {
  box(p,[x,y,z],[w+.15,h+.16,.12],C.pale);
  box(p,[x,y,z+.075],[w,h,.06],lit ? '#f6ca83' : C.glass,lit ? .25 : 0);
  box(p,[x,y,z+.115],[.045,h,.04],C.white);
  box(p,[x,y-.08,z+.115],[w,.045,.04],C.white);
  box(p,[x,y-h/2-.08,z+.08],[w+.25,.1,.22],C.stone);
}
function brickBuilding(p: THREE.Object3D, at: V3, w: number, d: number, h: number, opts: {color?:string; roof?:boolean; modern?:boolean; lit?:boolean} = {}) {
  const g = group(p,at), color = opts.color ?? C.brick;
  box(g,[0,h/2,0],[w,h,d],color);
  box(g,[0,.18,0],[w+.28,.36,d+.28],C.stone);
  box(g,[0,h-.08,0],[w+.24,.2,d+.24],C.pale);
  const floors = Math.max(1,Math.floor(h/1.8)), cols = Math.max(2,Math.floor(w/1.35));
  for (let f=0;f<floors;f++) {
    const y = .9+f*(h-.8)/floors;
    for (let i=0;i<cols;i++) {
      const x = -w/2+(i+.5)*w/cols;
      windowPane(g,x,y,d/2+.03,opts.modern ? w/cols-.22 : .64,opts.modern ? 1.25 : .95,opts.lit);
    }
    box(g,[0,y+.73,d/2+.04],[w,.07,.08],C.terra);
  }
  for (const side of [-1,1]) {
    const wall = group(g,[side*w/2,0,0]); wall.rotation.y = side*Math.PI/2;
    for (let f=0;f<floors;f++) for (let i=0;i<Math.max(1,Math.floor(d/1.6));i++) {
      const n = Math.max(1,Math.floor(d/1.6)); windowPane(wall,-d/2+(i+.5)*d/n,.9+f*(h-.8)/floors,.03,.6,.95,opts.lit);
    }
  }
  if (opts.roof !== false) roof(g,[0,h+.45,0],w+.5,d+.5,1,C.slate);
  else { box(g,[0,h+.14,0],[w+.2,.25,d+.2],C.pale); box(g,[.4,h+.38,0],[.9,.4,.7],C.slate); }
  return g;
}
function tree(p: THREE.Object3D, at: V3, s = 1, autumn = false) {
  const g = group(p,at); g.scale.setScalar(s); cyl(g,[0,1.05,0],.13,2.1,C.wood);
  for (const [x,y,z] of [[0,2.4,0],[-.45,2.15,.1],[.48,2.2,-.1]] as V3[]) ball(g,[x,y,z],[.7,.9,.65],autumn ? C.terra : C.leaf);
  return g;
}
function lamp(p: THREE.Object3D, at: V3, h = 2.8) {
  const g = group(p,at); cyl(g,[0,h/2,0],.045,h,C.slate); cyl(g,[0,.12,0],.14,.24,C.slate);
  box(g,[0,h,0],[.3,.42,.3],C.gold,.15); roof(g,[0,h+.26,0],.43,.43,.18); return g;
}
function bench(p: THREE.Object3D, at: V3, rotation = 0) {
  const g = group(p,at); g.rotation.y = rotation;
  for (let i=0;i<3;i++) box(g,[0,.51,-.18+i*.17],[1.5,.08,.13],C.wood);
  for (let i=0;i<2;i++) box(g,[0,.82+i*.16,-.3],[1.5,.11,.07],C.wood);
  for (const x of [-.56,.56]) {box(g,[x,.25,0],[.08,.5,.5],C.slate);box(g,[x,.72,-.3],[.07,.65,.07],C.slate);}
}
function railing(p: THREE.Object3D, a: V3, b: V3) {
  beam(p,[a[0],a[1]+.83,a[2]],[b[0],b[1]+.83,b[2]],.045,C.slate);
  beam(p,[a[0],a[1]+.42,a[2]],[b[0],b[1]+.42,b[2]],.025,C.slate);
  const n = Math.ceil(Math.hypot(a[0]-b[0],a[2]-b[2])/.9);
  for(let i=0;i<=n;i++) cyl(p,[THREE.MathUtils.lerp(a[0],b[0],i/n),a[1]+.42,THREE.MathUtils.lerp(a[2],b[2],i/n)],.04,.84,C.slate);
}
function crate(p: THREE.Object3D, at: V3, size = .65, color = C.wood) {
  const g = group(p,at); box(g,[0,size/2,0],[size,size,size],color);
  for(const x of [-.32,.32]) box(g,[x*size,size/2,size/2+.02],[.08*size,size,.04],C.pale);
  for(const y of [.14,.84]) box(g,[0,y*size,size/2+.04],[size,.08*size,.04],C.darkWood);
  return g;
}
function books(p: THREE.Object3D, at: V3, n = 3) {
  const g = group(p,at);
  for(let i=0;i<n;i++){const b=group(g,[0,i*.12,0]);b.rotation.y=(i%2 ? .1 : -.08);box(b,[0,.05,0],[.72,.1,.48],[C.red,C.teal,C.gold][i%3]);box(b,[0,.06,.02],[.66,.065,.46],C.white);}
  return g;
}
function road(p: THREE.Object3D, at: V3, w: number, d: number) {
  box(p,[at[0],at[1]-.04,at[2]],[w,.08,d],C.slate);
  for(let z=-d/2+.6;z<d/2;z+=1.5) box(p,[at[0],at[1]+.008,at[2]+z],[.1,.015,.65],C.pale);
}
function car(p: THREE.Object3D, at: V3, color = C.red, old = false) {
  const g = group(p,at); box(g,[0,.47,0],[1.3,.4,2.4],color);
  box(g,[0,.88,-.2],[1.08,.58,1.25],old ? C.black : color);
  box(g,[0,.92,.44],[.94,.35,.035],C.glass); box(g,[0,.92,-.84],[.94,.35,.035],C.glass);
  const wheels:THREE.Group[]=[];
  for(const x of [-.56,.56]) for(const z of [-.75,.75]) {
    const wheel=group(g,[x,.32,z]);wheels.push(wheel);
    const tire = cyl(wheel,[0,0,0],.31,.18,C.black); tire.rotation.z=Math.PI/2;
    const hub=cyl(wheel,[Math.sign(x)*.09,0,0],.15,.2,C.stone);hub.rotation.z=Math.PI/2;
    for(const angle of [0,Math.PI/2]){const spoke=box(wheel,[Math.sign(x)*.2,0,0],[.015,.27,.035],C.pale);spoke.rotation.x=angle;}
  }
  g.userData.wheels=wheels;
  for(const x of [-.42,.42]) ball(g,[x,.51,1.22],[.14,.12,.05],C.gold);
  box(g,[0,.3,1.27],[1.35,.09,.12],C.stone); return g;
}
function drive(g: THREE.Group, motions: Motion[], from: V3, to: V3, heading?: number) {
  const distance=Math.hypot(to[0]-from[0],to[2]-from[2]);
  g.rotation.y=heading??Math.atan2(to[0]-from[0],to[2]-from[2]);
  const direction=new THREE.Vector3(Math.sin(g.rotation.y),0,Math.cos(g.rotation.y));
  const sign=Math.sign(direction.dot(new THREE.Vector3(to[0]-from[0],0,to[2]-from[2])));
  motions.push((t,p)=>{
    g.position.set(THREE.MathUtils.lerp(from[0],to[0],p),from[1]+Math.sin(t*8)*.008,THREE.MathUtils.lerp(from[2],to[2],p));
    for(const wheel of g.userData.wheels as THREE.Group[])wheel.rotation.x=sign*distance*p/(.31*g.scale.x);
  });
}
function wake(vessel: THREE.Group, motions: Motion[], offset = 0, reverse = false) {
  const direction=reverse?1:-1;
  for(let i=0;i<10;i++) {
    const side=i%2?1:-1,k=Math.floor(i/2);
    const foam=box(vessel,[side*(.7+k*.2),-.03,direction*(2+k*.45)],[.36,.012,.06],'#cae6df');
    foam.castShadow=false;foam.rotation.y=side*.36;
    motions.push(t=>{const q=wrap(t*.65+k*.19+offset);foam.position.z=direction*(2+k*.45+q*.35);foam.scale.x=.36*(.35+Math.sin(q*Math.PI)*.65);});
  }
}
function sail(vessel: THREE.Group, motions: Motion[], from: V3, to: V3, offset = 0) {
  vessel.rotation.y=Math.atan2(to[0]-from[0],to[2]-from[2]);wake(vessel,motions,offset);
  motions.push((t,p)=>{vessel.position.set(THREE.MathUtils.lerp(from[0],to[0],p),from[1]+Math.sin(t*1.7+offset)*.035,THREE.MathUtils.lerp(from[2],to[2],p));vessel.rotation.z=Math.sin(t*1.2+offset)*.018;});
}
function boat(p: THREE.Object3D, at: V3, modern = false, cargo = false) {
  const g = group(p,at);
  const hullShape = geo('hull',()=>{
    const s=new THREE.Shape();s.moveTo(-.9,-1.8);s.lineTo(.9,-1.8);s.lineTo(1,1.15);s.quadraticCurveTo(.8,1.9,0,2.4);s.quadraticCurveTo(-.8,1.9,-1,1.15);s.closePath();
    const shape=new THREE.ExtrudeGeometry(s,{depth:.48,bevelEnabled:true,bevelSegments:1,bevelSize:.08,bevelThickness:.08,curveSegments:6});shape.rotateX(Math.PI/2);return shape;
  });
  part(g,hullShape,[0,.42,0],[1,1,1],modern ? C.white : C.slate);
  box(g,[0,.49,0],[1.7,.12,3.45],C.wood);
  box(g,[0,.93,-.55],[1.25,.83,1.3],modern ? C.white : C.pale);
  box(g,[0,1.02,.11],[1.06,.34,.04],C.glass);
  for(const side of [-1,1]) for(let i=0;i<3;i++) box(g,[side*.637,1,-.98+i*.4],[.03,.33,.26],C.glass);
  box(g,[0,1.4,-.55],[1.43,.12,1.52],modern ? C.teal : C.red);
  if(modern) { box(g,[0,1.49,-.55],[1.17,.04,1.2],C.glass); for(let i=0;i<4;i++)box(g,[-.45+i*.3,1.52,-.55],[.025,.015,1.18],C.white); }
  else cyl(g,[0,1.65,-.75],.18,.5,C.slate);
  railing(g,[-.8,.48,-1.65],[-.8,.48,1.1]); railing(g,[.8,.48,-1.65],[.8,.48,1.1]);
  const life=torus(g,[0,.9,.24],.25,C.terra,.06); life.rotation.y=0;
  if(cargo) for(const x of [-.4,.4]) crate(g,[x,.56,.9],.6,x<0 ? C.terra:C.teal);
  return g;
}
function water(p: THREE.Object3D, motions: Motion[], z = 4, width = 40, depth = 18) {
  box(p,[0,-.22,z],[width,.3,depth],C.water);
  for(let i=0;i<30;i++) {
    const x=-width/2+((i*7.91)%width), zz=z-depth/2+((i*3.17)%depth);
    const wave=box(p,[x,-.055,zz],[.55+(i%4)*.3,.013,.035],'#8bbfc0');
    motions.push(t=>{wave.position.x=x+Math.sin(t*.65+i)*.22;wave.scale.x=(.55+(i%4)*.3)*(1+.16*Math.sin(t+i));});
  }
}
function bridge(p: THREE.Object3D, at: V3, length = 13) {
  const g = group(p,at); const n=4, span=length/n;
  box(g,[0,2.05,0],[length,.35,2.2],C.stone);
  for(let i=0;i<n;i++) {
    const x=-length/2+(i+.5)*span; arch(g,[x,.35,0],span,.95,2.1,C.stone);
    box(g,[x,1.7,0],[span,.32,2.1],C.stone);
  }
  for(let i=0;i<=n;i++) box(g,[-length/2+i*span,.8,0],[.55,1.6,2.4],C.stone);
  for(const z of [-1,1])railing(g,[-length/2,2.23,z],[length/2,2.23,z]);
  for(const x of [-length*.4,length*.4]) lamp(g,[x,2.25,-.84],1.65);
  return g;
}
function waterfront(p: THREE.Object3D, motions: Motion[], modern = false) {
  box(p,[0,-.35,-7],[42,.7,18],C.grass);
  box(p,[0,-.15,-.25],[42,.3,3.5],C.stone);
  box(p,[0,-.4,1.45],[42,.75,.35],C.pale);
  // Continue the river beyond the portrait frustum, including the wider detail-safe cameras.
  water(p,motions,30,90,65);
  for(let x=-18;x<=18;x+=3.8) {lamp(p,[x,0,.2]); if(Math.abs(x)>4)tree(p,[x,0,-2.1],.8);}
  for(let i=0;i<8;i++)brickBuilding(p,[-17+i*4.8,0,-11-(i%2)*2],3.8,3.5,modern ? 4+i%3*1.8 : 3+i%3*.6,{color:[C.brick,C.terra,'#b89070'][i%3],roof:!modern,modern});
}
function person(p: THREE.Object3D, motions: Motion[], at: V3, options: {shirt?:string; variant?:number; scale?:number; turn?:number; path?:WalkPath; worried?:boolean; book?:boolean} = {}) {
  const student = buildStudent({shirt:options.shirt ?? C.red,variant:options.variant??0,skin:(options.variant??0)%2 ? '#b98663':'#dfb48e'});
  p.add(student.root);student.root.position.set(...at);student.root.rotation.y=options.turn??0;student.root.scale.setScalar(options.scale??1);
  if(options.book){const book=books(student.root,[.32,.53,.05],2);book.scale.setScalar(.5);book.rotation.z=.12;}
  motions.push((t,p)=>{
    const pose=options.path?walkPose(at,options.path,p,options.scale??1):undefined;
    student.sample(pose?.moving?pose.gait/5.5:t,options.worried?'worried':'happy',pose?.moving??false,options.variant??0);
    student.root.position.set(...at);
    if(pose&&options.path){student.root.position.lerp(new THREE.Vector3(...options.path.to),pose.u);student.root.rotation.y=pose.yaw;}
  });
  return student.root;
}
/** Period figures use coats, waistcoats and caps instead of modern backpacks. */
function periodPerson(p: THREE.Object3D, motions: Motion[], at: V3, color = C.slate, turn = 0) {
  const g=group(p,at);g.rotation.y=turn;
  const legs:THREE.Group[]=[];
  for(const x of [-.12,.12]){const leg=group(g,[x,.71,0]);legs.push(leg);box(leg,[0,-.33,0],[.16,.65,.21],C.slate);box(leg,[0,-.63,.07],[.19,.15,.34],C.darkWood);}
  box(g,[0,.96,0],[.49,.58,.31],color);box(g,[0,.99,.17],[.18,.44,.03],C.pale);
  for(let i=0;i<3;i++)ball(g,[0,1.12-i*.1,.2],[.02,.02,.015],C.gold);
  cyl(g,[0,1.28,0],.07,.1,'#dfb48e');ball(g,[0,1.5,0],[.23,.25,.21],'#dfb48e');
  ball(g,[0,1.61,-.055],[.235,.17,.19],C.darkWood);
  for(const x of [-.08,.08]){ball(g,[x,1.53,.19],[.03,.035,.018],C.black);box(g,[x,1.61,.19],[.07,.018,.025],C.darkWood);}
  ball(g,[0,1.47,.22],[.035,.045,.045],'#dfb48e');box(g,[0,1.39,.19],[.09,.018,.025],C.darkWood);
  cyl(g,[0,1.75,0],.245,.08,color);box(g,[0,1.72,.15],[.39,.04,.23],color);
  const arms:THREE.Group[]=[],forearms:THREE.Group[]=[];
  for(const s of [-1,1]){const a=group(g,[s*.29,1.16,0]);box(a,[0,-.1,0],[.15,.24,.19],color);const f=group(a,[0,-.23,0]);box(f,[0,-.085,0],[.135,.2,.17],color);ball(f,[0,-.22,.02],[.085,.095,.08],'#dfb48e');arms.push(a);forearms.push(f);}
  motions.push(t=>{arms[0].rotation.x=-.15+.12*Math.sin(t*1.4);arms[1].rotation.x=-.25-.12*Math.sin(t*1.4);forearms.forEach(f=>f.rotation.set(0,0,0));legs.forEach(l=>l.rotation.set(0,0,0));});
  return {root:g,arms,forearms,legs};
}
function walkPeriod(rig: ReturnType<typeof periodPerson>, motions: Motion[], from: V3, to: V3, offset = 0) {
  motions.push((t,p)=>{
    const pose=walkPose(from,{to},p),stride=Math.sin(pose.gait+offset);
    rig.root.position.set(THREE.MathUtils.lerp(from[0],to[0],p),from[1]+Math.abs(stride)*.025,THREE.MathUtils.lerp(from[2],to[2],p));rig.root.rotation.y=pose.yaw;
    rig.legs.forEach((leg,i)=>leg.rotation.x=stride*(i?-.34:.34));
    rig.arms.forEach((arm,i)=>arm.rotation.x=stride*(i?.28:-.28));
  });
}

/** Every primitive, including animated characters, is instanced by shared material.
 * Source transforms are sampled from absolute time; no previous-frame state leaks. */
function batch(source: THREE.Group, root: THREE.Group) {
  const buckets = new Map<string,{parts:THREE.Mesh[];draw:THREE.InstancedMesh}>();
  source.traverse(node=>{
    if(!(node instanceof THREE.Mesh))return;
    const key=`${node.geometry.uuid}/${Array.isArray(node.material)?node.material.map(m=>m.uuid).join(','):node.material.uuid}`;
    if(!buckets.has(key))buckets.set(key,{parts:[],draw:null!});buckets.get(key)!.parts.push(node);
  });
  for(const bucket of buckets.values()) {
    const first=bucket.parts[0];bucket.draw=new THREE.InstancedMesh(first.geometry,first.material,bucket.parts.length);
    bucket.draw.castShadow=first.castShadow;bucket.draw.receiveShadow=first.receiveShadow;bucket.draw.frustumCulled=false;root.add(bucket.draw);
  }
  root.userData.timelineStats={draws:buckets.size,instances:Array.from(buckets.values()).reduce((n,b)=>n+b.parts.length,0),triangles:Array.from(buckets.values()).reduce((n,b)=>n+b.parts.length*(b.parts[0].geometry.index?.count??b.parts[0].geometry.attributes.position.count)/3,0)};
  return ()=>{source.updateMatrixWorld(true);for(const {parts,draw} of buckets.values()){parts.forEach((m,i)=>draw.setMatrixAt(i,m.matrixWorld));draw.instanceMatrix.needsUpdate=true;}};
}

export function buildTimelineScene(id: TimelineSceneId, seed: number): TimelineVisual {
  const source=group(),root=group(),motions:Motion[]=[]; root.name=`timeline-${id}`;
  const phase=(Math.abs(Math.floor(seed))%997)/997*Math.PI*2;
  let camera:TimelineVisual['camera']={from:[15,14,25],to:[12,12,23],target:[0,2,0],fov:42};

  if(id==='founding') {
    // An intimate brass-and-walnut desk; Boston is a pin on a real physical map.
    camera={from:[1.32,23.4,12.67],to:[0.4,22.74,12.01],target:[0,1.2,1.7],fov:46};
    box(source,[0,1.12,0],[7.6,.38,9.6],C.darkWood);
    for(let i=0;i<7;i++)box(source,[-3.24+i*1.08,1.32,0],[1.04,.03,9.5],i%2?C.wood:'#93694b');
    for(const x of [-3.2,3.2])for(const z of [-4.1,4.1])box(source,[x,.53,z],[.3,1.06,.3],C.darkWood);
    const map=group(source,[0,1.37,.2]);box(map,[0,0,0],[6.8,.035,4.3],C.pale);
    const land=geo('usa-map',()=>{const s=new THREE.Shape();s.moveTo(-2.8,1);for(const [x,y]of[[-2.3,1.5],[-.8,1.35],[.6,1.1],[1.2,.8],[2.5,1.15],[2.85,.7],[2.25,.1],[1.65,-.4],[1.5,-1.2],[1.25,-1.1],[.9,-.55],[0,-.6],[-.3,-1],[-1,-.65],[-2,-.35],[-2.7,.2]])s.lineTo(x,y);s.closePath();return new THREE.ShapeGeometry(s).rotateX(-Math.PI/2);});
    part(map,land,[0,.025,0],[1,1,1],'#8d9b73');
    for(let i=0;i<9;i++)box(map,[-3+i*.75,.045,0],[.012,.006,3.9],'#bda77e');
    for(let i=0;i<5;i++)box(map,[0,.045,-1.7+i*.85],[6.4,.006,.012],'#bda77e');
    const west:V3=[-2.5,.07,.3],east:V3=[2.48,.07,-.85];
    for(let i=0;i<16;i++){const u=i/15,dot=ball(map,[THREE.MathUtils.lerp(west[0],east[0],u),.08,THREE.MathUtils.lerp(west[2],east[2],u)-Math.sin(u*Math.PI)*.4],[.035,.015,.035],C.red);motions.push((t,p)=>{const s=.01+.99*smooth((p-u)*18+.5);dot.scale.set(.035*s,.015,.035*s);});}
    for(const at of [west,east]){cyl(map,[at[0],.22,at[2]],.025,.3,C.gold);ball(map,[at[0],.4,at[2]],[.12,.12,.12],at===east?C.red:C.slate);}
    const pin=group(map,east);const seal=cyl(pin,[0,.08,0],.3,.05,C.red);
    motions.push((t,p)=>{seal.scale.x=seal.scale.z=.3*(1+.12*Math.sin(t*2));pin.position.y=east[1]+.8*(1-smooth(p*3));});
    const label=group(source,[2.6,1.43,-1.3]);label.rotation.x=-Math.PI/2;sign(label,'BOSTON',[0,0,0],1.65,.37);
    books(source,[-2.7,1.4,-3.5],4); books(source,[-2.7,1.4,-2.5],2);
    cyl(source,[2.7,1.5,3.1],.25,.23,C.black);cyl(source,[2.7,1.64,3.1],.16,.06,C.gold);
    const quill=group(source,[2.7,1.67,3.1]);beam(quill,[0,0,0],[.5,1.5,0],.02,C.gold);
    const feather=ball(quill,[.42,1.08,0],[.15,.55,.025],C.white);feather.rotation.z=-.35;
    // A writing hand carries the quill across the route, continuously revealing ink.
    const hand=group(quill,[.12,.36,0]);ball(hand,[0,0,0],[.15,.1,.14],'#dfb48e');
    box(hand,[.25,0,0],[.3,.18,.24],C.red);box(hand,[.1,0,0],[.06,.19,.25],C.white);
    for(let i=0;i<3;i++)ball(hand,[-.09,.015,-.08+i*.07],[.09,.045,.035],'#dfb48e');
    motions.push((t,p)=>{quill.position.set(THREE.MathUtils.lerp(west[0],east[0],p),1.47+.018*Math.sin(t*13),.2+THREE.MathUtils.lerp(west[2],east[2],p)-Math.sin(p*Math.PI)*.4);quill.rotation.z=-.2+.06*Math.sin(t*7);});
    const model=group(source,[1.2,1.4,-3.5]);box(model,[0,.22,0],[2,.44,.7],C.brick);roof(model,[0,.52,0],2.2,.9,.25,C.red);box(model,[0,.7,0],[.4,1,.4],C.pale);roof(model,[0,1.25,0],.6,.6,.2);
    sign(source,'STANFORD',[0,1.05,4.82],3,.48);
    cyl(source,[-2.7,1.45,3.1],.45,.1,C.gold);cyl(source,[-2.7,2,3.1],.06,1,C.gold);cone(source,[-2.7,2.65,3.1],[.68,.64,.68],C.teal);
  }

  if(id==='campus_1891') {
    camera={from:[9.1,13.24,33.14],to:[6.83,12.1,32],target:[0,3,-1],fov:43};
    waterfront(source,motions);bridge(source,[-10,0,7],12);
    const quad=group(source,[0,0,-3.5]);
    brickBuilding(quad,[-4,0,-.8],4.4,3.2,4.4,{color:C.brick});brickBuilding(quad,[4,0,-.8],4.4,3.2,4.4,{color:C.brick});
    box(quad,[0,2.4,-1],[3.2,4.8,2.8],C.brick);
    // Imagined nineteenth-century collegiate bell tower, deliberately not Hoover Tower.
    box(quad,[0,5,-1],[1.7,5,1.8],C.brick);box(quad,[0,6.9,-1],[2,.25,2.1],C.pale);
    for(const side of [-1,1]){box(quad,[side*.66,7.7,-.1],[.22,1.4,.25],C.pale);}
    arch(quad,[0,7.8,-.1],1.5,.5,.23,C.pale);cyl(quad,[0,7.65,-.9],.38,.4,C.gold);
    roof(quad,[0,8.75,-1],2.4,2.4,1.2);cyl(quad,[0,9.6,-1],.05,.7,C.gold);
    for(let i=0;i<9;i++){const x=-6.2+i*1.55;box(quad,[x,1.1,1.1],[.22,2.2,.45],C.pale);if(i<8)arch(quad,[x+.775,2.13,1.1],1.55,.6,.45,C.pale);}
    box(quad,[0,2.9,1.1],[13.1,.28,1.2],C.pale);roof(quad,[0,3.28,1.1],13.4,1.7,.6,C.red);
    sign(quad,'STANFORD',[0,3.78,.5],3.1,.57);
    box(source,[0,.025,-.8],[3,.06,4.8],C.pale);for(const x of [-6.9,6.9])tree(source,[x,0,-2],1.05,true);
    const pupil=periodPerson(source,motions,[-3.2,0,-.3],C.red);walkPeriod(pupil,motions,[-3.2,0,-.3],[1.1,0,-.3],.2);
    const tutor=periodPerson(source,motions,[3.5,0,-1.5],C.slate);walkPeriod(tutor,motions,[3.5,0,-1.5],[-.2,0,-1.5],1.8);
    const steam=boat(source,[-1.5,0,4.7]);sail(steam,motions,[-1.5,0,4.7],[4.6,0,4.7],.4);
  }

  if(id==='garage_west') {
    camera={from:[4,9,23],to:[3,8.5,22.5],target:[0,1.8,0.1],fov:43};
    box(source,[0,-.18,0],[30,.35,27],'#b9ad7a');
    const street=group(source,[0,.01,6.8]);street.rotation.y=Math.PI/2;road(street,[0,0,0],4,24);
    box(source,[0,.02,.6],[6.6,.12,7],C.stone);
    const g=group(source,[0,0,-1.3]);box(g,[0,1.65,0],[5.7,3.3,4.6],C.pale);roof(g,[0,3.85,0],6.3,5.3,1.2,C.terra);
    box(g,[0,1.45,2.34],[4.65,2.8,.08],C.wood);
    for(let i=0;i<10;i++)box(g,[-2.14+i*.475,1.45,2.4],[.035,2.7,.045],C.darkWood);
    for(const y of [.45,2.4])box(g,[0,y,2.44],[4.65,.12,.08],C.darkWood);
    for(const x of [-.12,.12])box(g,[x,1.33,2.5],[.05,.24,.04],C.gold);
    sign(g,'GARAGE',[0,3.18,2.36],2.1,.39,C.slate);
    const auto=car(source,[1.4,.05,3.4],C.slate,true);auto.rotation.y=-.2;
    drive(auto,motions,[1.4,.05,3.4],[1.56,.05,2.6],-.2);
    for(let i=0;i<11;i++){const x=-8+i*1.6;box(source,[x,.6,-4.5],[.11,1.2,.16],C.white);}
    for(const y of [.4,.9])box(source,[0,y,-4.5],[17,.09,.12],C.white);
    for(const x of [-7,7])tree(source,[x,0,-2.8],1.5);
    brickBuilding(source,[-8,0,-8],5,5,3.4,{color:'#c5b697'});
    crate(source,[-2.3,.1,1.8],.8);cyl(source,[-3.5,.4,2.2],.28,.8,C.teal);
    const mail=group(source,[3.5,0,3]);box(mail,[0,.65,0],[.12,1.3,.12],C.wood);box(mail,[0,1.4,0],[.55,.4,.7],C.slate);
    const flag=box(mail,[.31,1.54,.05],[.04,.3,.27],C.red);motions.push(t=>{flag.rotation.x=.12*Math.sin(t);});
    const pedestrian=periodPerson(source,motions,[-3,0,4.4],C.terra);walkPeriod(pedestrian,motions,[-3,0,4.4],[-.6,0,4.4],.7);
  }

  if(id==='workshop_east') {
    camera={from:[2.68,6.5,19.55],to:[1.67,6.06,18.99],target:[0,1.65,-0.2],fov:43};
    box(source,[0,-.12,0],[11,.24,9],C.darkWood);
    for(let i=0;i<17;i++)box(source,[-5.1+i*.64,.012,0],[.6,.025,8.9],i%2?C.wood:'#946a4e');
    box(source,[0,2.4,-3.5],[11,4.8,.3],C.brick);
    for(let row=0;row<13;row++)for(let col=0;col<11;col++)box(source,[-5.2+col+(row%2)*.5,.2+row*.35,-3.33],[.89,.025,.025],'#c17b60');
    for(const x of [-3,3])windowPane(source,x,2.8,-3.28,2,2.5);
    for(const x of [-5,5])box(source,[x,2.5,-3.18],[.23,5,.3],C.darkWood);
    const work=group(source,[0,0,.4]);box(work,[0,.98,0],[3.8,.22,1.45],C.wood);
    for(const x of [-1.6,1.6])for(const z of [-.5,.5])box(work,[x,.47,z],[.17,.94,.17],C.darkWood);
    box(work,[0,.28,0],[3.5,.12,1.3],C.darkWood);crate(work,[-1.25,.34,0],.4);books(work,[.7,.34,0],2);
    const instrument=group(work,[0,1.11,0]);box(instrument,[0,.45,0],[1.65,.9,.72],C.teal);
    box(instrument,[0,.45,.38],[1.5,.75,.045],C.pale);
    const dial=cyl(instrument,[-.37,.54,.43],.25,.04,C.white);dial.rotation.x=Math.PI/2;
    const needle=group(instrument,[-.37,.54,.465]);box(needle,[0,.09,0],[.026,.21,.015],C.red);
    for(const x of [.2,.55]){const knob=cyl(instrument,[x,.3,.43],.1,.08,C.black);knob.rotation.x=Math.PI/2;}
    for(let i=0;i<4;i++){cyl(instrument,[-.56+i*.36,1.02,0],.09,.3,C.gold);ball(instrument,[-.56+i*.36,1.2,0],[.08,.1,.08],C.pale);}
    motions.push(t=>{needle.rotation.z=Math.sin(t*2)*.7;});
    const rotor=group(work,[1.4,1.42,0]);torus(rotor,[0,0,0],.29,C.gold,.05);for(let i=0;i<4;i++){const spoke=box(rotor,[0,0,0],[.035,.56,.04],C.slate);spoke.rotation.z=i*Math.PI/4;}
    motions.push(t=>{rotor.rotation.z=-t*5.3;});
    beam(work,[1.4,1.11,0],[1.4,1.42,0],.08,C.black);
    // Both engineers stand beyond the bench ends, on its camera-facing side.
    // Their full arm sweep has clearance from the tabletop and its legs.
    const engineer1=periodPerson(source,motions,[-2.5,0,1.45],C.red,.4);
    const engineer2=periodPerson(source,motions,[2.5,0,1.45],C.teal,-.4);
    const screwdriver=group(engineer1.forearms[1],[0,-.25,.02]);cyl(screwdriver,[0,-.08,0],.045,.16,C.gold);cyl(screwdriver,[0,-.24,0],.014,.2,C.stone);
    const clipboard=group(engineer2.forearms[0],[0,-.2,.08]);box(clipboard,[0,0,0],[.28,.36,.04],C.wood);box(clipboard,[0,0,.025],[.23,.3,.01],C.pale);
    motions.push(t=>{
      engineer1.arms[1].rotation.x=-.8+.32*Math.sin(t*3.1);engineer1.forearms[1].rotation.x=-.8+.2*Math.sin(t*3.1+.6);
      engineer1.arms[0].rotation.x=-.65;engineer1.forearms[0].rotation.x=-.7;
      engineer2.arms[0].rotation.x=-.85;engineer2.forearms[0].rotation.x=-.9;
      engineer2.arms[1].rotation.x=-.55+.45*Math.sin(t*1.9+1.1);engineer2.forearms[1].rotation.x=-.55;
      screwdriver.rotation.y=t*4.2;
    });
    const slide=group(work,[-1.3,1.13,0]);box(slide,[0,.06,0],[.72,.12,.52],C.slate);
    const piston=group(slide);box(piston,[0,.22,0],[.22,.23,.36],C.gold);beam(piston,[0,.22,0],[.28,.22,0],.035,C.stone);
    motions.push(t=>{piston.position.x=Math.sin(t*4.4)*.22;});
    box(source,[0,2.2,-3.05],[3.1,1.8,.08],C.slate);sign(source,'RIVER WORKS',[0,3.95,-3.07],3.7,.55);
    for(let i=0;i<5;i++){box(source,[-1.1+i*.5,2.2,-2.96],[.03,.65,.04],C.gold);ball(source,[-1.1+i*.5,2.56,-2.96],[.09,.1,.04],C.gold);}
    books(source,[-4.2,.06,-1.5],5);crate(source,[4,.03,-2],.9);
    const stool=group(source,[3.7,0,1.4]);cyl(stool,[0,.71,0],.35,.12,C.wood);for(let i=0;i<3;i++)beam(stool,[Math.cos(i*2.094)*.3,0,Math.sin(i*2.094)*.3],[0,.68,0],.04,C.slate);
  }

  if(id==='research_park') {
    camera={from:[9.29,16.06,36.9],to:[6.92,14.29,35.71],target:[1,2.8,-1],fov:43};
    waterfront(source,motions);bridge(source,[-13,0,8],10);
    for(let i=0;i<3;i++) {
      const g=brickBuilding(source,[-4.6+i*4.5,0,-4.5],3.7,4,3.2+i*.7,{roof:false,modern:true,color:i===1?C.pale:C.brick});
      const h=3.2+i*.7;box(g,[0,h+.6,0],[2.9,.15,2.3],C.glass);box(g,[0,h+.35,0],[.1,.45,.1],C.slate);
      motions.push((t,p)=>{g.scale.y=.15+.85*smooth((p-i*.15)/.7);});
    }
    sign(source,'STANFORD RESEARCH',[0,1.3,-.6],4.6,.7);
    for(const x of [-1.6,1.6])box(source,[x,.55,-.6],[.15,1.1,.15],C.slate);
    const crane=group(source,[6.5,0,-7]);box(crane,[0,4,0],[.35,8,.35],C.gold);box(crane,[-1.6,8,0],[7,.25,.25],C.gold);
    for(let i=0;i<6;i++)beam(crane,[-4.8+i,8,0],[-4.3+i,8.6,0],.04,C.gold);
    const hook=group(crane,[-3.5,4,0]);crate(hook,[0,-.6,0],.6,C.pale);
    const cable=cyl(crane,[-3.5,6,0],.025,4,C.slate);
    motions.push((t,p)=>{const y=3.5+3*p,x=-3.5+1.3*p;hook.position.set(x,y,0);cable.position.set(x,(8+y)/2,0);cable.scale.y=8-y;});
    const van=car(source,[-5.4,0,1],C.teal);van.scale.setScalar(.8);drive(van,motions,[-5.4,0,1],[-2.1,0,1]);
    person(source,motions,[1.5,0,-1.4],{scale:.9,shirt:C.red,path:{to:[4.5,0,-1.4]},book:true});
    const barge=boat(source,[5.7,0,6],false,true);sail(barge,motions,[5.7,0,6],[-1.8,0,6],1.4);
  }

  if(id==='sand_hill') {
    camera={from:[5.63,10.01,28.17],to:[3.94,9.45,27.04],target:[0,1,0],fov:43};
    box(source,[0,-.28,0],[34,.55,35],'#a6aa7b');road(source,[0,.015,0],4.8,34);
    for(const x of [-3.1,3.1])box(source,[x,.04,0],[1.1,.08,34],C.pale);
    for(let i=0;i<5;i++){tree(source,[-6-i%2*2,0,-12+i*3.8],1.1+i%3*.16);tree(source,[7+i%2*2,0,-13+i*4],1.1);}
    const post=group(source,[-3.4,0,2]);cyl(post,[0,1.5,0],.06,3,C.slate);sign(post,'SAND HILL RD',[0,2.9,0],3.2,.55,C.teal);
    bench(source,[4.3,0,1],-.25);lamp(source,[3.6,0,-2]);
    const caseGroup=group(source,[0,.18,3.2]);
    box(caseGroup,[0,-.05,0],[1.2,.1,.85],C.slate);
    for(const x of [-.45,.45])for(const z of [-.3,.3])ball(caseGroup,[x,-.1,z],[.085,.085,.085],C.black);
    for(let i=0;i<3;i++){const suitcase=group(caseGroup,[0,i*.52,0]);box(suitcase,[0,.24,0],[1.05,.45,.72],[C.wood,C.red,C.teal][i]);torus(suitcase,[0,.53,0],.13,C.gold,.025);for(const x of [-.36,.36])box(suitcase,[x,.24,.37],[.07,.45,.025],C.pale);}
    for(const z of [-.25,.25])beam(caseGroup,[-.7,0,z],[-.7,1,z],.035,C.slate);
    beam(caseGroup,[-.7,1,-.25],[-.7,1,.25],.04,C.slate);
    motions.push((t,p)=>{caseGroup.position.x=p*3;caseGroup.position.y=.18+Math.sin(t*5)*.008;});
    const porter=periodPerson(source,motions,[-1.2,0,3.2],C.teal);walkPeriod(porter,motions,[-1.2,0,3.2],[1.8,0,3.2],1);
    motions.push(()=>{porter.arms.forEach(a=>a.rotation.x=-1.35);porter.forearms.forEach(a=>a.rotation.x=-.25);});
    const east=group(source,[3.9,0,-4.5]);cyl(east,[0,1.1,0],.05,2.2,C.slate);sign(east,'EAST  →',[0,2,0],2.5,.6,C.slate);
    const auto=car(source,[0,.01,-8],C.pale);drive(auto,motions,[0,.01,-8],[0,.01,-3.9]);
  }

  if(id==='silicon_harbor') {
    camera={from:[9.55,17.86,36.12],to:[7.43,16.27,35.06],target:[0,3,-0.5],fov:44};
    waterfront(source,motions,true);
    for(const [x,z,h] of [[-6,-5,6],[0,-6,8],[5,-4,5]] as V3[]) {
      const b=brickBuilding(source,[x,0,z],4,4,h,{roof:false,modern:true,color:x===0?C.pale:C.brick});
      box(b,[0,h+1,0],[2.8,1.6,2.6],C.glass);box(b,[0,h+1.86,0],[3,.12,2.8],C.white);
      for(let i=0;i<4;i++)box(b,[-1.2+i*.8,h+1,1.33],[.06,1.65,.03],C.pale);
    }
    sign(source,'SILICON HARBOR',[0,2.15,-.8],6,.85);
    for(const x of [-2.4,2.4])box(source,[x,.9,-.8],[.18,1.8,.18],C.slate);
    // Boston-like cable bridge towers are a background silhouette, not foreground clutter.
    const cb=group(source,[-11,0,-3]);box(cb,[0,2,0],[2,.3,20],C.stone);
    for(const z of [-5,5]){for(const side of [-1,1])beam(cb,[side*.8,2,z],[side*.18,7.5,z],.15,C.pale);for(let i=-3;i<=3;i++)beam(cb,[0,7,z],[1,2,z+i*1.25],.025,C.white);}
    const ferry=boat(source,[-3.4,0,6],true);sail(ferry,motions,[-3.4,0,6],[3.8,0,6],2.1);
    person(source,motions,[-4.2,0,-.35],{scale:.8,variant:0,path:{to:[-.6,0,-.35]},book:true});
    person(source,motions,[3.8,0,-.2],{scale:.8,variant:1,path:{to:[.8,0,-.2]}});
    person(source,motions,[-1,0,-1.6],{scale:.8,variant:2,path:{to:[1.2,0,-1.6]},book:true});
    for(const x of [-7,7]){bench(source,[x,0,-.4]);tree(source,[x,0,-1.8],1);}
  }

  if(id==='computer_lab') {
    camera={from:[3.59,8.02,20.41],to:[2.39,7.66,19.81],target:[0,1.8,-0.4],fov:43};
    box(source,[0,-.13,0],[13,.26,11],C.stone);box(source,[0,2.5,-4.5],[13,5,.25],C.pale);
    for(const x of [-4.5,4.5])windowPane(source,x,2.7,-4.33,2.5,3);
    sign(source,'STANFORD COMPUTING',[0,4.25,-4.3],5,.65);
    for(let i=0;i<3;i++) {
      const rack=group(source,[-2.4+i*2.4,0,-3.7]);box(rack,[0,1.35,0],[1.8,2.7,.7],C.slate);box(rack,[0,1.4,.38],[1.6,2.4,.04],C.pale);
      for(let j=0;j<2;j++) {
        const reel=group(rack,[-.4+j*.8,1.95,.48]);cyl(reel,[0,0,0],.31,.06,C.stone).rotation.x=Math.PI/2;
        for(let k=0;k<3;k++){const a=k*Math.PI*2/3;ball(reel,[Math.cos(a)*.17,Math.sin(a)*.17,.05],[.08,.08,.025],C.slate);}
        motions.push(t=>{reel.rotation.z=t*(j ? -1:1)*(1.4+i*.37)+i*.7;});
      }
      for(let j=0;j<5;j++){box(rack,[0,.45+j*.19,.43],[1.4,.1,.06],C.slate);box(rack,[.55,.45+j*.19,.47],[.07,.05,.025],j%2?C.gold:C.teal,.3);}
    }
    for(let i=0;i<2;i++) {
      const desk=group(source,[-1.7+i*3.4,0,.25]);box(desk,[0,1.02,0],[2.6,.15,1.6],C.wood);
      for(const x of [-1.1,1.1])box(desk,[x,.5,0],[.12,1,.95],C.slate);
      const monitor=group(desk,[0,1.12,-.2]);box(monitor,[0,.45,0],[1.15,.88,.85],C.pale);box(monitor,[0,.45,.44],[.92,.65,.035],C.slate);
      for(let line=0;line<5;line++){
        const row=box(monitor,[-.12+(line%2)*.07,.65-line*.1,.465],[.54-(line%3)*.1,.025,.012],'#83d6b4',.4);
        motions.push(t=>{row.position.y=.23+wrap(t*(.28+i*.07)+line*.2)*.43;row.scale.x=(.54-(line%3)*.1)*(.7+.3*Math.sin(t*1.3+line));});
      }
      const cursor=box(monitor,[.3,.25,.47],[.055,.04,.02],'#c8efd9',.5);motions.push(t=>{cursor.scale.x=.055*(.3+.7*(.5+.5*Math.sin(t*5)));});
      box(desk,[0,1.13,.58],[1.3,.1,.45],C.pale);for(let r=0;r<3;r++)for(let k=0;k<9;k++)box(desk,[-.54+k*.13,1.19,.44+r*.12],[.09,.025,.075],C.slate);
      books(desk,[.9,1.12,-.15],2);
    }
    // Desks occupy x [-3,-.4] and [.4,3], z [-.55,1.05].
    // Keep people outside those footprints, with room for backpacks and hands.
    person(source,motions,[-3.25,0,1.85],{shirt:C.red,variant:1,path:{to:[-.75,0,1.85]},book:true});
    person(source,motions,[3.25,0,2.5],{shirt:C.teal,variant:2,path:{to:[1.1,0,2.5]},book:true});
    for(const x of [-5.2,5.2]){cyl(source,[x,.3,-1.6],.38,.6,C.terra);tree(source,[x,.5,-1.6],.55);}
    box(source,[0,.02,2.4],[10,.035,.08],C.gold);
  }

  if(id==='ferry') {
    camera={from:[6.2,9.75,24.72],to:[4.65,9.03,23.69],target:[-0.5,1.2,0.2],fov:43};
    water(source,motions,0,40,35);
    box(source,[-4,-.25,-3],[6,.5,23],C.stone);box(source,[-1.2,.1,1],[2.8,.2,8],C.wood);
    for(let i=0;i<18;i++)box(source,[-1.2,.22,-2.7+i*.44],[2.75,.04,.035],C.darkWood);
    for(const z of [-2.5,.5,3.5])cyl(source,[-.05,.4,z],.13,.9,C.darkWood);
    const canopy=group(source,[-3.8,0,-2]);for(const x of [-1.4,1.4])box(canopy,[x,1.5,0],[.12,3,.12],C.slate);
    roof(canopy,[0,3.2,0],3.8,2.8,.5,C.teal);sign(canopy,'HARBOR SHUTTLE',[0,2.75,1.1],3.2,.5);
    const ferry=boat(source,[2.7,.02,1.6],true);ferry.scale.setScalar(1.5);
    wake(ferry,motions,.8,true);
    motions.push((t,p)=>{ferry.position.z=1.6-4*smooth((p-.2)/.8);ferry.position.y=.02+Math.sin(t*1.4)*.035;ferry.rotation.z=Math.sin(t*1.6)*.012;});
    const gangway=group(source,[-.2,.34,0]);box(gangway,[.9,0,0],[1.8,.12,.85],C.pale);
    motions.push((t,p)=>{gangway.rotation.z=.1+1.35*smooth(p/.22);});
    person(source,motions,[-1.5,.22,1.1],{shirt:C.red,variant:1,path:{to:[-1.1,.22,-.9]},book:true});
    person(source,motions,[-3.2,0,-.9],{shirt:C.teal,variant:2,path:{to:[-3.2,0,1.2]}});
    crate(source,[-1.5,.24,2.7],.7,C.terra);books(source,[-1.5,.97,2.7],2);
    for(let i=0;i<5;i++)brickBuilding(source,[-10+i*4,0,-12],3.2,3.2,3+i%3,{roof:i%2===0,color:i%2?C.pale:C.brick});
    bridge(source,[7,0,-8],11);
    for(const z of [-5,4])lamp(source,[-4.8,0,z]);
  }

  if(id==='world_network') {
    camera={from:[3.37,20.35,29.66],to:[2.23,19.21,28.52],target:[0.3,1,-0.5],fov:44};
    water(source,motions,0,90,100);
    // Three working ports connected by shipping routes, all rooted in the water.
    const ports:V3[]=[[-2.8,0,3],[3,0,-2.5],[-2,0,-7]];
    ports.forEach((at,i)=>{
      const port=group(source,at);box(port,[0,-.08,0],[4.6,.4,3.7],C.stone);
      brickBuilding(port,[-.8,.13,-.5],2.1,1.8,2.2+i*.4,{roof:i!==1,color:i===1?C.pale:C.brick});
      box(port,[1.4,1.2,-.4],[.18,2.4,.18],C.gold);box(port,[.9,2.4,-.4],[1.7,.16,.16],C.gold);
      const cargo=crate(port,[1.55,.4,.7],.48,C.teal),cable=cyl(port,[1.55,1.5,.7],.02,1.8,C.slate);
      // Cargo lifts at distinct rates; cable tops stay connected to the gantry.
      beam(port,[1.55,2.4,-.4],[1.55,2.4,.7],.06,C.gold);
      motions.push(t=>{const y=.35+.75*(.5+.5*Math.sin(t*(.8+i*.23)+i*1.6));cargo.position.y=y;cable.position.y=(2.4+y+.48)/2;cable.scale.y=2.4-y-.48;});
      for(let j=0;j<3;j++)crate(port,[-1.5+j*.8,.14,1],.6,[C.terra,C.teal,C.red][j]);
      sign(port,i===0?'BOSTON':i===1?'PORT 02':'PORT 03',[0,2.9,-.1],2.4,.5,i===0?C.red:C.slate);
      for(const x of [-1.9,1.9])cyl(port,[x,.15,1.5],.1,.5,C.darkWood);
    });
    const shippingLanes:V3[][]=[
      [[-2.8,.02,5.8],[0,.02,6.1],[5.8,.02,4.4],[6.4,.02,-1.7]],
      [[3,.02,-5.6],[3.5,.02,-7.2],[2,.02,-9.7],[1.3,.02,-7.3]],
      [[-2.8,.02,5.8],[0,.02,6.4],[6.5,.02,4.8],[6.6,.02,-1.7]],
    ];
    for(let j=0;j<3;j++) {
      // Water-only lanes leave the quay before turning, avoiding travel through a port.
      const curve=new THREE.CatmullRomCurve3(shippingLanes[j].map(v=>new THREE.Vector3(...v)),false,'centripetal');
      for(let i=0;i<18;i++){const v=curve.getPoint(i/17);box(source,[v.x,.025,v.z],[.13,.015,.13],C.pale);}
      const vessel=boat(source,[0,0,0],true,true);vessel.scale.setScalar(.42);
      wake(vessel,motions,j*.3+phase);
      motions.push((t,p)=>{const u=j===0?.37+p*.58:j===1?.065+p*.83:.04+p*.55,v=curve.getPoint(u),tan=curve.getTangent(u);vessel.position.copy(v);vessel.position.y+=Math.sin(t*1.6+j)*.012;vessel.rotation.y=Math.atan2(tan.x,tan.z);});
    }
    // Lighthouse is the visual punctuation, not a globe or airborne infographic.
    const light=group(source,[3.2,0,2.4]);cyl(light,[0,.05,0],1.2,.4,C.stone);cyl(light,[0,1.6,0],.44,3,C.white);
    cyl(light,[0,2.15,0],.455,.55,C.red);cyl(light,[0,3.2,0],.62,.2,C.slate);cyl(light,[0,3.55,0],.4,.6,C.gold);cone(light,[0,3.99,0],[.65,.4,.65],C.red);
    const optic=group(light,[0,3.55,0]);box(optic,[0,0,.41],[.2,.35,.035],C.white,.45);motions.push(t=>{optic.rotation.y=t*1.1;});
  }

  if(id==='housing') {
    camera={from:[1.77,9.77,29.12],to:[0.65,9.22,28.57],target:[-0.8,2.3,-1],fov:44};
    box(source,[0,-.2,0],[24,.4,25],C.stone);road(source,[0,.01,2.3],7,23);
    box(source,[-3.1,.1,-1],[2.2,.2,16],C.pale);
    for(let i=0;i<3;i++) {
      const b=brickBuilding(source,[-4.5+i*3.5,0,-3.5],3.3,3.2,5.8+i*.35,{roof:false,color:[C.brick,'#bb8063','#8f6658'][i]});
      box(b,[0,1,1.68],[.85,1.9,.08],C.darkWood);arch(b,[0,1.95,1.7],1.2,.55,.12,C.pale);
      for(let s=0;s<3;s++)box(b,[0,.12+s*.14,2.1-s*.15],[1.4,.14,.75-s*.12],C.stone);
      for(const side of [-1,1]){beam(b,[side*.65,.4,2.5],[side*.65,1,1.9],.025,C.slate);}
      box(b,[0,4,1.8],[2.3,.14,.75],C.slate);railing(b,[-1,4.1,2.1],[1,4.1,2.1]);
    }
    sign(source,'ROOM TO LET',[-1,2.65,-1.78],2.8,.6,C.red);
    for(let i=0;i<5;i++) {
      const x=-2.3+i*1.05,z=.3+(i%2)*.25;
      const student=person(source,motions,[x,0,z],{shirt:[C.red,C.teal,C.gold,C.slate,C.terra][i],variant:i,worried:true,scale:.95,path:{to:[x-.55,0,z],start:i*.055,end:.7+i*.055}});
      const suitcase=group(student,[.4,0,-.23]);box(suitcase,[0,.35,0],[.32,.6,.47],[C.wood,C.teal,C.red][i%3]);
      torus(suitcase,[0,.71,0],.09,C.gold,.02);for(const zz of [-.17,.17])ball(suitcase,[0,.06,zz],[.07,.07,.07],C.black);
      motions.push(t=>{suitcase.rotation.z=.035*Math.sin(t*.8+i);});
    }
    lamp(source,[4.3,0,.5]);tree(source,[-6.6,0,-.3],1);bench(source,[4.7,0,-1],-.25);
    const boxes=group(source,[2.9,.18,1.7]);crate(boxes,[0,0,0],.9);crate(boxes,[.05,.9,0],.7);crate(boxes,[-.1,1.6,0],.5);
    box(boxes,[0,-.05,0],[1.1,.1,1.05],C.slate);for(const x of [-.4,.4])for(const z of [-.4,.4])ball(boxes,[x,-.1,z],[.09,.09,.09],C.black);
    for(const x of [-.3,.3])beam(boxes,[x,0,.62],[x,1,.62],.035,C.slate);beam(boxes,[-.3,1,.62],[.3,1,.62],.04,C.slate);
    motions.push((t,p)=>{boxes.position.z=1.7-.9*p;boxes.rotation.z=.012*Math.sin(t*6);});
    const tiny=sign(boxes,'TINY!',[0,2.4,.05],1.4,.45,C.teal);tiny.rotation.z=-.08;
    const mover=periodPerson(source,motions,[2.9,0,2.78],C.wood);walkPeriod(mover,motions,[2.9,0,2.78],[2.9,0,1.88],.4);
    motions.push(()=>{mover.arms.forEach(a=>a.rotation.x=-1.45);mover.forearms.forEach(a=>a.rotation.x=-.25);});
  }

  if(id==='future') {
    camera={from:[2.71,18.16,42.31],to:[1.62,17.08,41.23],target:[0,3,-1],fov:44};
    waterfront(source,motions,true);bridge(source,[-11,0,7],12);
    const college=brickBuilding(source,[0,0,-3.7],7,3.2,4.7,{color:C.brick});
    sign(college,'STANFORD',[0,4.25,1.7],3.6,.58);
    for(let i=0;i<5;i++)arch(college,[-2.8+i*1.4,1.7,1.8],1.2,.5,.2,C.pale);
    const tower=group(source,[0,0,-4.5]);box(tower,[0,5.8,0],[1.8,5,1.8],C.brick);box(tower,[0,8.2,0],[2.2,.3,2.2],C.pale);roof(tower,[0,8.8,0],2.5,2.5,1.1);cyl(tower,[0,9.6,0],.05,.7,C.gold);
    for(const side of [-1,1]) {
      const b=brickBuilding(source,[side*5.6,0,-5],3.7,4.2,side<0?7:9,{roof:false,modern:true,color:C.pale});
      for(let i=0;i<3;i++){box(b,[0,3+i*2.2,2.35],[4,.2,1.1],C.white);for(let j=0;j<4;j++)ball(b,[-1.2+j*.8,3.25+i*2.2,2.35],[.35,.2,.33],C.leaf);}
      box(b,[0,side<0?7.4:9.4,0],[3.3,.15,3.3],C.glass);
    }
    // Pedestrian skybridge set behind the historic focal building.
    box(source,[0,5.8,-7.3],[10,.4,1.1],C.pale);box(source,[0,6.3,-7.3],[10,.6,.9],C.glass);
    for(const x of [-8,8]){tree(source,[x,0,-.5],1.2);bench(source,[x-1,0,.1]);}
    const ferry=boat(source,[4.5,0,5.6],true);sail(ferry,motions,[4.5,0,5.6],[-2.1,0,5.6],2.8);
    const walks:[V3,V3][]=[[[-3,0,-.4],[.2,0,-.4]],[[3.2,0,-1.4],[.3,0,-1.4]],[[-1.8,0,-1.4],[-4.3,0,-1.4]],[[1,0,-.4],[4.5,0,-.4]]];
    walks.forEach(([from,to],i)=>person(source,motions,from,{variant:i,scale:.85,path:{to},shirt:[C.red,C.teal,C.gold,C.red][i],book:i%2===0}));
    const shuttle=car(source,[-5,0,.9],C.white);shuttle.scale.setScalar(.6);drive(shuttle,motions,[-5,0,.9],[4,0,.9]);
    for(const x of [-8,8]) {
      const turbine=group(source,[x,0,-9]);cyl(turbine,[0,5,0],.09,10,C.pale);
      const rotor=group(turbine,[0,10,.15]);ball(rotor,[0,0,0],[.18,.18,.2],C.white);
      for(let i=0;i<3;i++){const blade=group(rotor);blade.rotation.z=i*Math.PI*2/3;box(blade,[0,.9,0],[.13,1.8,.07],C.white);}
      motions.push(t=>{rotor.rotation.z=t*.45;});
    }
  }

  const refresh=batch(source,root);
  const sample=(seconds:number,progress:number)=>{
    const t=Number.isFinite(seconds)?seconds:0,p=THREE.MathUtils.clamp(Number.isFinite(progress)?progress:0,0,1);
    motions.forEach(fn=>fn(t,p));refresh();
  };
  sample(0,0);root.userData.timelineScene=id;root.userData.seed=seed;
  return {root,camera,sample};
}
