import * as THREE from 'three';

type V3 = [number, number, number];
export type BostonJourneyCameraPoint = { at: number; position: V3; target: V3 };
export type BostonJourneyWorld = {
  root: THREE.Group;
  cameraPath: BostonJourneyCameraPoint[];
  fov: number;
  sample(seconds: number, progress: number): void;
};
type Motion = (seconds: number) => void;
const C = {
  stone:'#a99b81', paving:'#8e9285', edge:'#c8bda2', sandstone:'#c6a576',
  ivory:'#e9dfc7', paper:'#f3e9cf', brick:'#914f40', terra:'#995945',
  roof:'#344c48', water:'#285e68', ripple:'#56848a', glass:'#547b81',
  dark:'#243438', recess:'#273b40', wood:'#75543b', brass:'#aa8953',
  red:'#9c3547', green:'#526f50', leaf:'#729061', skin:'#d3a982',
  darkSkin:'#a77557', hair:'#3e302b', warm:'#cba56a', solar:'#294d62',
};
const TAU=Math.PI*2, DEG=Math.PI/180;
const clamp=(v:number)=>THREE.MathUtils.clamp(v,0,1);
const smooth=(v:number)=>{const t=clamp(v);return t*t*(3-2*t);};
const wrap=(v:number)=>((v%1)+1)%1;
const geometries=new Map<string,THREE.BufferGeometry>();
const materials=new Map<string,THREE.MeshStandardMaterial>();
function geo(key:string,make:()=>THREE.BufferGeometry){if(!geometries.has(key))geometries.set(key,make());return geometries.get(key)!;}
function mat(color:string){if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.86,metalness:color===C.brass?.18:.015}));return materials.get(color)!;}
function group(parent?:THREE.Object3D,at:V3=[0,0,0]){const g=new THREE.Group();g.position.set(...at);parent?.add(g);return g;}
function mesh(p:THREE.Object3D,g:THREE.BufferGeometry,at:V3,size:V3,c:string){const m=new THREE.Mesh(g,mat(c));m.position.set(...at);m.scale.set(...size);m.castShadow=true;m.receiveShadow=true;p.add(m);return m;}
const box=(p:THREE.Object3D,at:V3,size:V3,c:string)=>mesh(p,geo('box',()=>new THREE.BoxGeometry()),at,size,c);
const ball=(p:THREE.Object3D,at:V3,size:V3,c:string)=>mesh(p,geo('sphere',()=>new THREE.SphereGeometry(1,10,7)),at,size,c);
const cyl=(p:THREE.Object3D,at:V3,r:number,h:number,c:string)=>mesh(p,geo('cylinder',()=>new THREE.CylinderGeometry(1,1,1,10)),at,[r,h,r],c);
function beam(p:THREE.Object3D,a:V3,b:V3,r:number,c:string){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b);const m=cyl(p,av.clone().add(bv).multiplyScalar(.5).toArray() as V3,r,av.distanceTo(bv),c);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),bv.sub(av).normalize());return m;}
function ring(p:THREE.Object3D,at:V3,r:number,c:string,tube=.035){return mesh(p,geo(`ring:${tube/r}`,()=>new THREE.TorusGeometry(1,tube/r,5,20)),at,[r,r,r],c);}
function roof(p:THREE.Object3D,at:V3,w:number,d:number,h:number,c=C.roof){return mesh(p,geo('roof',()=>new THREE.ConeGeometry(1,1,4).rotateY(Math.PI/4)),at,[w/Math.SQRT2,h,d/Math.SQRT2],c);}
function text(p:THREE.Object3D,words:string,at:V3,w:number,h:number,c=C.ivory){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;const ctx=canvas.getContext('2d')!;
  ctx.clearRect(0,0,1024,256);ctx.fillStyle=c;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 100px Georgia, serif';
  const tw=ctx.measureText(words).width;if(tw>960)ctx.font=`bold ${Math.floor(96000/tw)}px Georgia, serif`;ctx.fillText(words,512,132);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const m=new THREE.Mesh(geo('text',()=>new THREE.PlaneGeometry()),new THREE.MeshStandardMaterial({map:texture,transparent:true,alphaTest:.2,roughness:1}));m.position.set(...at);m.scale.set(w,h,1);p.add(m);return m;
}
/** Local +x follows the quay; +z faces the water. The harbor stays physically present. */
function polar(degrees:number,radius=30,y=.15):V3{const a=degrees*DEG;return[Math.cos(a)*radius,y,22+Math.sin(a)*radius];}
function quay(parent:THREE.Object3D,degrees:number,radius=30){const g=group(parent,polar(degrees,radius));g.rotation.y=-degrees*DEG-Math.PI/2;return g;}
function strip(parent:THREE.Object3D,r0:number,r1:number,y:number,color:string,a0=-174,a1=79){
  const positions:number[]=[],indices:number[]=[],n=Math.ceil((a1-a0)/2);
  for(let i=0;i<=n;i++){const a=(a0+(a1-a0)*i/n)*DEG;for(const r of [r0,r1])positions.push(Math.cos(a)*r,y,22+Math.sin(a)*r);if(i<n){const j=i*2;indices.push(j,j+2,j+1,j+1,j+2,j+3);}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();
  const m=new THREE.Mesh(g,mat(color));m.receiveShadow=true;parent.add(m);return m;
}
function tree(p:THREE.Object3D,at:V3,s=1){const g=group(p,at);g.scale.setScalar(s);cyl(g,[0,1,0],.1,2,C.wood);for(const [x,y,z]of [[-.35,2,0],[.35,2.2,.1],[0,2.65,0]] as V3[])ball(g,[x,y,z],[.65,.7,.6],y>2.3?C.leaf:C.green);return g;}
function planter(p:THREE.Object3D,at:V3,w=1.8){box(p,[at[0],at[1]+.18,at[2]],[w,.36,.65],C.edge);box(p,[at[0],at[1]+.4,at[2]],[w-.12,.17,.5],C.green);for(let i=0;i<3;i++)ball(p,[at[0]+(i-1)*w/3,at[1]+.58,at[2]],[.24,.22,.23],C.leaf);}
function lamp(p:THREE.Object3D,at:V3){const g=group(p,at);cyl(g,[0,1.3,0],.045,2.6,C.dark);cyl(g,[0,.1,0],.13,.2,C.dark);box(g,[0,2.62,0],[.24,.34,.24],C.warm);roof(g,[0,2.86,0],.4,.4,.15);}
function window(p:THREE.Object3D,x:number,y:number,z:number,w=.8,h=1.1){box(p,[x,y,z],[w+.14,h+.16,.09],C.edge);box(p,[x,y,z+.055],[w,h,.04],C.glass);box(p,[x,y,z+.085],[.04,h,.025],C.ivory);box(p,[x,y,z+.087],[w,.04,.025],C.ivory);box(p,[x,y-h/2-.1,z+.08],[w+.25,.11,.2],C.edge);}
function building(p:THREE.Object3D,at:V3,w:number,d:number,h:number,color=C.brick,flat=false){
  const g=group(p,at);box(g,[0,h/2,0],[w,h,d],color);box(g,[0,.16,0],[w+.18,.32,d+.18],C.edge);
  const cols=Math.max(2,Math.floor(w/1.45)),floors=Math.max(1,Math.floor(h/2));
  for(let f=0;f<floors;f++)for(let i=0;i<cols;i++)window(g,-w/2+(i+.5)*w/cols,1.05+f*1.85,d/2+.04,.72,1.05);
  for(const side of[-1,1]){const wall=group(g,[side*w/2,0,0]);wall.rotation.y=side*Math.PI/2;for(let f=0;f<floors;f++)for(let i=0;i<Math.floor(d/1.8);i++)window(wall,-d/2+(i+.5)*1.8,1.05+f*1.85,.04,.7,1.05);}
  if(flat){box(g,[0,h+.1,0],[w+.25,.2,d+.25],C.edge);box(g,[0,h+.23,0],[w-.2,.08,d-.2],C.roof);}else roof(g,[0,h+.55,0],w+.4,d+.4,1.1);
  return g;
}
function solar(p:THREE.Object3D,at:V3,w=1.7,d=1){const g=group(p,at);g.rotation.x=-.22;box(g,[0,0,0],[w+.08,.07,d+.08],C.ivory);box(g,[0,.045,0],[w,.025,d],C.solar);for(let i=1;i<4;i++)box(g,[-w/2+i*w/4,.06,0],[.014,.007,d],C.glass);box(g,[0,.06,0],[w,.007,.014],C.glass);return g;}
function desk(p:THREE.Object3D,at:V3,w=1.8,d=.8){const g=group(p,at);g.name='boston-desk';box(g,[0,.94,0],[w,.14,d],C.wood);for(const x of[-w/2+.12,w/2-.12])for(const z of[-d/2+.1,d/2-.1])box(g,[x,.44,z],[.09,.88,.09],C.dark);return g;}
type Person={root:THREE.Group;body:THREE.Group;head:THREE.Group;arms:THREE.Group[];forearms:THREE.Group[];hands:THREE.Group[];pose:(t:number,distance?:number,moving?:number)=>void};
function person(p:THREE.Object3D,at:V3,shirt=C.red,variant=0):Person{
  const root=group(p,at);root.name=`boston-person-${variant}`;const body=group(root),skin=variant%3===1?C.darkSkin:C.skin;
  const legs:THREE.Group[]=[],shins:THREE.Group[]=[],arms:THREE.Group[]=[],forearms:THREE.Group[]=[],hands:THREE.Group[]=[];
  for(const s of[-1,1]){const leg=group(body,[s*.125,.8,0]);legs.push(leg);box(leg,[0,-.19,0],[.18,.38,.2],C.dark);const shin=group(leg,[0,-.38,0]);shins.push(shin);box(shin,[0,-.18,0],[.16,.36,.18],C.dark);box(shin,[0,-.37,.05],[.2,.1,.32],C.wood);}
  box(body,[0,1.06,0],[.45,.52,.3],shirt);ball(body,[0,1.31,0],[.23,.12,.16],shirt);box(body,[0,1.19,.16],[.14,.26,.02],C.ivory);
  for(const s of[-1,1]){const arm=group(body,[s*.28,1.32,0]);arms.push(arm);box(arm,[0,-.14,0],[.145,.28,.17],shirt);const forearm=group(arm,[0,-.28,0]);forearms.push(forearm);box(forearm,[0,-.12,0],[.13,.24,.15],shirt);const hand=group(forearm,[0,-.27,0]);hands.push(hand);ball(hand,[0,0,0],[.075,.085,.065],skin);}
  cyl(body,[0,1.43,0],.07,.13,skin);const head=group(body,[0,1.67,0]);ball(head,[0,0,0],[.23,.26,.21],skin);ball(head,[0,.1,-.06],[.235,.19,.19],C.hair);
  for(let i=0;i<3;i++)ball(head,[-.14+i*.14,.2,.08],[.09,.065,.07],C.hair);
  const eyes:THREE.Mesh[]=[];for(const s of[-1,1]){ball(head,[s*.23,0,0],[.04,.06,.04],skin);ball(head,[s*.085,.025,.195],[.043,.052,.02],C.ivory);eyes.push(ball(head,[s*.085,.023,.214],[.02,.028,.012],C.dark));box(head,[s*.085,.11,.19],[.085,.018,.018],C.hair);}
  ball(head,[0,-.04,.23],[.035,.045,.04],skin);box(head,[0,-.12,.2],[.08,.016,.015],C.wood);
  const pose=(t:number,distance=0,moving=0)=>{const gait=distance*TAU/.82,s=Math.sin(gait),m=clamp(moving);body.position.y=Math.abs(s)*.025*m;body.rotation.z=s*.015*m;head.rotation.set(.02,.06*Math.sin(t*.7+variant),.02*Math.sin(t*.4+variant));legs.forEach((leg,i)=>{const a=s*(i?-1:1);leg.rotation.x=a*.4*m;shins[i].rotation.x=Math.max(0,-a)*.38*m;});arms.forEach((a,i)=>{a.rotation.set(s*(i?1:-1)*.34*m-.07,0,(i?-1:1)*.025);forearms[i].rotation.set(-.12,0,0);});const blink=wrap(t*.21+variant*.17);eyes.forEach(e=>{e.scale.y=.028*(blink>.965?.15:1);});};pose(0);return{root,body,head,arms,forearms,hands,pose};
}
function reach(a:Person,side:number,target:V3){const arm=a.arms[side],forearm=a.forearms[side],d=new THREE.Vector3(...target).sub(arm.position),distance=THREE.MathUtils.clamp(d.length(),.04,.548);d.normalize();const along=(.28*.28-.27*.27+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,.28*.28-along*along));const bend=new THREE.Vector3(0,-1,0).addScaledVector(d,d.y);if(bend.lengthSq()<.001)bend.set(0,0,1);bend.normalize();const elbow=d.clone().multiplyScalar(along).addScaledVector(bend,height);arm.quaternion.setFromUnitVectors(new THREE.Vector3(0,-1,0),elbow.clone().normalize());forearm.quaternion.copy(arm.quaternion).invert().multiply(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,-1,0),d.multiplyScalar(distance).sub(elbow).normalize()));}
function upright(a:Person,side:number,p:THREE.Object3D){p.quaternion.copy(a.arms[side].quaternion).multiply(a.forearms[side].quaternion).invert();}
function walk(p:THREE.Object3D,motions:Motion[],a:V3,b:V3,start:number,end:number,variant:number,shirt=C.red){const actor=person(p,a,shirt,variant),length=new THREE.Vector3(...a).distanceTo(new THREE.Vector3(...b));motions.push(t=>{const u=clamp((t-start)/(end-start)),v=smooth(u);actor.root.position.lerpVectors(new THREE.Vector3(...a),new THREE.Vector3(...b),v);actor.root.rotation.y=Math.atan2(b[0]-a[0],b[2]-a[2]);actor.pose(t,length*v,smooth(u/.06)*smooth((1-u)/.06));});return actor;}
function computer(p:THREE.Object3D,motions:Motion[],at:V3,modern=false){const g=group(p,at);box(g,[0,.08,0],[.55,.16,.38],C.dark);box(g,[0,.36,-.1],[.1,.6,.09],C.dark);box(g,[0,.6,-.08],[.92,.65,modern?.08:.42],C.ivory);box(g,[0,.6,modern?-.03:.14],[.8,.52,.02],C.recess);for(let i=0;i<5;i++){const line=box(g,[-.1,.4+i*.08,modern?-.014:.155],[.42+i%2*.17,.019,.008],C.leaf);motions.push(t=>{line.scale.x=.75+.25*Math.sin(t*1.7+i);});}box(g,[0,.05,.4],[.85,.1,.28],C.dark);for(let i=0;i<9;i++)box(g,[-.34+i*.085,.105,.4],[.05,.014,.19],C.edge);return g;}
function openWorkshop(p:THREE.Object3D,w:number,d:number,h:number,label:string){box(p,[0,h/2,-d],[w,h,.2],C.brick);for(const x of[-w/2,w/2]){box(p,[x,h/2,-d/2],[.2,h,d],C.brick);box(p,[x,1.65,.1],[.16,3.3,.16],C.dark);}box(p,[0,3.45,-d/2],[w+.3,.2,d+.4],C.roof);box(p,[0,2.95,-d+.13],[w-.4,.08,.03],C.terra);roof(p,[0,h+.45,-d/2],w+.5,d+.5,.9);text(p,label,[0,3.03,-d+.16],w*.73,.35);for(let row=0;row<11;row++)box(p,[0,.2+row*.25,-d+.115],[w-.3,.013,.01],C.terra);}
function ferry(p:THREE.Object3D,motions:Motion[],phase:number){
  const g=group(p);g.name='boston-ferry';
  const hull=geo('ferry-hull',()=>{const s=new THREE.Shape();s.moveTo(-.88,2);s.lineTo(-.88,-1.35);s.lineTo(0,-2.35);s.lineTo(.88,-1.35);s.lineTo(.88,2);s.closePath();return new THREE.ExtrudeGeometry(s,{depth:.6,bevelEnabled:false}).rotateX(-Math.PI/2);});
  mesh(g,hull,[0,.04,0],[1,1,1],C.ivory);box(g,[0,.65,-.15],[1.6,.15,3.7],C.wood);
  box(g,[0,1.13,-.25],[1.5,.9,2.3],C.glass);box(g,[0,1.64,-.25],[1.75,.13,2.55],C.roof);for(const x of[-.72,0,.72])box(g,[x,1.15,.925],[.055,.86,.045],C.ivory);
  for(const x of[-.8,.8])for(const z of[-1.8,1.65]){cyl(g,[x,.95,z],.025,.6,C.brass);beam(g,[x,1.22,-1.8],[x,1.22,1.65],.025,C.brass);}
  ring(g,[0,1.15,1.02],.23,C.red,.055);solar(g,[0,1.74,-.25],1.35,1.7);
  const wakes:THREE.Mesh[]=[];for(let i=0;i<7;i++)for(const s of[-1,1]){const m=box(g,[s*(.7+i*.16),-.02,-2.5-i*.48],[.55,.012,.05],C.ripple);m.rotation.y=s*-.35;m.castShadow=false;wakes.push(m);}
  motions.push(t=>{const u=clamp((t-60)/12),angle=t<60?-63+3*Math.max(0,t-30):27+36*u-20*u*u+2*u*u*u,at=polar(angle,23.1,-.02);g.position.set(...at);g.rotation.y=-angle*DEG;g.rotation.z=.012*Math.sin(t*1.8+phase);wakes.forEach((w,i)=>{w.scale.x=.35+.2*Math.sin(t*3+i);});});return g;
}
function batch(source:THREE.Group,root:THREE.Group){const buckets=new Map<string,{parts:THREE.Mesh[];draw:THREE.InstancedMesh}>();source.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const key=`${o.geometry.uuid}/${(o.material as THREE.Material).uuid}/${o.castShadow}`;if(!buckets.has(key))buckets.set(key,{parts:[],draw:null!});buckets.get(key)!.parts.push(o);});for(const b of buckets.values()){const first=b.parts[0];b.draw=new THREE.InstancedMesh(first.geometry,first.material,b.parts.length);b.draw.castShadow=first.castShadow;b.draw.receiveShadow=first.receiveShadow;b.draw.frustumCulled=false;root.add(b.draw);}root.userData.bostonStats={draws:buckets.size,triangles:[...buckets.values()].reduce((n,b)=>n+b.parts.length*(b.parts[0].geometry.index?.count??b.parts[0].geometry.attributes.position.count)/3,0),instances:[...buckets.values()].reduce((n,b)=>n+b.parts.length,0)};return()=>{source.updateMatrixWorld(true);for(const{parts,draw}of buckets.values()){parts.forEach((m,i)=>draw.setMatrixAt(i,m.matrixWorld));draw.instanceMatrix.needsUpdate=true;}};}

export function buildBostonJourneyWorld(seed:number):BostonJourneyWorld{
  const root=group(),source=group(),motions:Motion[]=[];root.name='boston-connected-waterfront';const phase=((Math.floor(seed)%997)+997)%997/997;
  // Water is above the shared renderer's optional -0.055 ground; land is at +0.15.
  const water=box(source,[0,-.11,22],[500,.16,500],C.water);water.castShadow=false;
  strip(source,26,90,.08,C.paving);strip(source,26,27,.15,C.edge);strip(source,27,33,.15,C.stone);strip(source,38.8,42.2,.16,C.dark);
  for(const r of[39.65,41.25])strip(source,r,r+.075,.31,C.brass);for(let a=-170;a<77;a+=2.4){const tie=quay(source,a,40.5);box(tie,[0,.08,0],[.18,.13,2.2],C.wood);}
  for(let a=-169;a<77;a+=4){const q=quay(source,a,26.55);box(q,[0,-.28,0],[2.1,.65,.65],C.paving);box(q,[0,.1,0],[2.1,.12,.7],C.edge);}
  for(let a=-165;a<74;a+=8){const q=quay(source,a);tree(q,[1.5,0,-7.5],.9);if(a%16!==0)planter(q,[2,0,-1.4],1.4);}
  // Lamps sit in the gaps between focal activities, never across a working face or hand.
  for(const a of[-147,-128,-107,-83,-57,-28,2,29,55]){const q=quay(source,a);lamp(q,[0,0,-1.7]);}
  // A second street and real volumes make the city continuous behind the close action.
  for(let i=0;i<17;i++){const a=-161+i*13.6,q=quay(source,a,49),h=4.6+(i%3)*1.7;building(q,[0,0,0],5.3,4.5,h,i<7?C.brick:C.sandstone,true);if(i>7){solar(q,[-1,h+.4,0]);planter(q,[1.3,h+.3,0],1.4);}}
  // 1885: hands mark a river map while a student arrives along the same quay.
  const founding=quay(source,-137);const mapDesk=desk(founding,[0,0,0],2.45,.9);
  box(mapDesk,[0,1.025,0],[2.15,.025,.77],C.paper);for(let i=0;i<9;i++){const r=box(mapDesk,[-.85+i*.21,1.043,.13*Math.sin(i*.6)],[.3,.009,.11],C.water);r.rotation.y=-.18*Math.cos(i*.6);}
  for(let i=0;i<5;i++)box(mapDesk,[-.8+i*.35,1.045,-.22],[.18,.01,.15],C.sandstone);
  const pin=group(mapDesk,[.25,1.055,.12]);cyl(pin,[0,.025,0],.035,.05,C.brass);ball(pin,[0,.08,0],[.07,.07,.07],C.red);
  const founder=person(founding,[.45,0,1],C.roof,1);founder.root.rotation.y=Math.PI;
  const pen=group(founder.hands[1]);beam(pen,[0,0,0],[0,-.2,.025],.012,C.brass);
  motions.push(t=>{founder.pose(t);founder.head.rotation.x=.22;reach(founder,1,[.23+.065*Math.sin(t*2),1.2,.48]);reach(founder,0,[-.3,1.25,.38]);upright(founder,1,pen);});
  const arrival=walk(founding,motions,[-1.7,0,1.1],[-1.55,0,-.6],0,7,2,C.red);const bag=group(arrival.hands[0]);box(bag,[0,-.16,0],[.32,.32,.17],C.wood);ring(bag,[0,.04,0],.07,C.brass,.014);motions.push(()=>upright(arrival,0,bag));
  building(founding,[.2,0,-5.4],6,3,4.1,C.brick);text(founding,'CHARLES RIVER',[0,2.4,-3.82],3.4,.42);
  // 1891: sandstone arcades and a recognizable red-roofed Stanford-inspired tower.
  const campus=quay(source,-118);building(campus,[0,0,-5],9.2,3.5,4.6,C.sandstone);
  const arcade=group(campus,[0,0,-2.7]);for(let i=0;i<6;i++){const x=-4+i*1.6;cyl(arcade,[x,1.25,0],.12,2.5,C.ivory);box(arcade,[x,2.5,0],[.45,.16,.45],C.ivory);}
  box(arcade,[0,2.75,0],[9,.3,1.1],C.sandstone);roof(arcade,[0,3.1,0],9.4,1.8,.5,C.terra);
  const tower=group(campus,[0,0,-5.4]);box(tower,[0,4.3,0],[1.9,8.6,1.9],C.sandstone);box(tower,[0,6.4,1.01],[1.35,1.65,.05],C.recess);cyl(tower,[0,6.8,1.15],.22,.48,C.brass);box(tower,[0,7.7,0],[2.1,.2,2.1],C.ivory);roof(tower,[0,8.65,0],2.65,2.65,1.1,C.terra);text(campus,'STANFORD',[0,3.7,-3.12],3.1,.48);
  walk(campus,motions,[-2.5,0,.7],[3.3,0,.7],7,16,3,C.red);walk(campus,motions,[-3.3,0,1.6],[2.3,0,1.6],8,17,4,C.roof);
  // 1939: an open working bay, physically adjacent to campus, with real bench clearance.
  const shop=quay(source,-94);openWorkshop(shop,6.7,3.8,3.6,'RIVER WORKS');const bench=desk(shop,[0,0,-.2],1.8,.85);
  const instrument=group(bench,[0,1.02,0]);box(instrument,[0,.27,0],[1.42,.54,.46],C.green);box(instrument,[0,.27,.245],[1.34,.44,.035],C.ivory);
  const dial=ring(instrument,[-.2,.3,.28],.14,C.dark,.02),needle=group(instrument,[-.2,.3,.3]);box(needle,[0,.055,0],[.012,.11,.01],C.red);for(const x of[.13,.3])cyl(instrument,[x,.24,.29],.045,.04,C.dark).rotation.x=Math.PI/2;
  const engineer1=person(shop,[-1.35,0,-.05],C.red,5),engineer2=person(shop,[1.35,0,-.05],C.glass,6);engineer1.root.rotation.y=Math.PI/2;engineer2.root.rotation.y=-Math.PI/2;
  const tool=group(engineer1.hands[1]);cyl(tool,[0,-.05,0],.035,.14,C.brass);beam(tool,[0,-.1,0],[0,-.28,0],.012,C.dark);
  motions.push(t=>{engineer1.pose(t);engineer2.pose(t);reach(engineer1,1,[.12,1.34+.06*Math.sin(t*3.2),.48]);reach(engineer1,0,[-.2,1.23,.4]);upright(engineer1,1,tool);reach(engineer2,0,[-.12,1.28,.48]);reach(engineer2,1,[.24,1.3+.04*Math.sin(t*2.7),.42]);engineer1.head.rotation.x=.15;engineer2.head.rotation.x=.13;needle.rotation.z=Math.sin(t*2.4)*.8;});
  for(let i=0;i<5;i++){box(shop,[-2.2+i*.23,1.5,-3.63],[.12,.42,.08],C.brass);beam(shop,[-2.2+i*.23,1.3,-3.59],[-2.2+i*.23,1.06,-3.59],.015,C.dark);}box(shop,[2.3,.75,-2.8],[1.1,1.5,.65],C.wood);
  // 1951: inventions cross the quay into a working research dock.
  const lab=quay(source,-68);building(lab,[-1.8,0,-5],4.5,3.5,6.5,C.brick,true);building(lab,[3,0,-4.3],3.9,3,4.7,C.sandstone,true);text(lab,'RESEARCH QUAY',[0,2.8,-2.68],4.2,.42);
  const carrier=walk(lab,motions,[-2.5,0,.3],[2.2,0,.3],24,32,7,C.roof);const device=group(carrier.body,[0,1.03,.46]);box(device,[0,0,0],[.7,.48,.38],C.edge);ring(device,[0,.03,.2],.12,C.dark,.02);motions.push(()=>{reach(carrier,0,[-.3,1.08,.4]);reach(carrier,1,[.3,1.08,.4]);});
  const loader=person(lab,[2.9,0,1.6],C.brass,8);const crate=group(loader.hands[0]);box(crate,[.12,-.12,.12],[.4,.34,.32],C.wood);motions.push(t=>{loader.pose(t);reach(loader,0,[-.25,1.12+.18*Math.sin(t*1.2),.4]);reach(loader,1,[.25,1.12+.18*Math.sin(t*1.2),.4]);upright(loader,0,crate);});
  const dock=group(lab,[3.8,0,3.2]);box(dock,[0,-.02,0],[1.65,.22,3.7],C.wood);for(const x of[-.65,.65])for(const z of[-1.6,1.6])cyl(dock,[x,-.25,z],.1,1,C.dark);for(let i=0;i<15;i++)box(dock,[0,.102,-1.65+i*.23],[1.57,.02,.025],C.brass);
  // A small inlet and a raised pedestrian bridge tie the two sides of the research quay.
  const bridge=quay(source,-55);box(bridge,[0,.02,-2],[1.8,.025,9],C.water).castShadow=false;for(let i=0;i<13;i++){const x=-1.7+i*.28,y=.2+.28*Math.sin(Math.PI*i/12);box(bridge,[x,y,.6],[.29,.12,1.8],C.wood);for(const z of[-.18,1.38]){cyl(bridge,[x,y+.43,z],.02,.8,C.dark);if(i<12)beam(bridge,[x,y+.83,z],[x+.28,.2+.28*Math.sin(Math.PI*(i+1)/12)+.83,z],.025,C.dark);}}
  // 1996: travel with the ferry; computer work stays visible in open ground-floor labs.
  const tech=quay(source,-39);openWorkshop(tech,7.6,3.5,3.6,'SILICON HARBOR');building(tech,[-3.7,0,-5.7],3,3,7.4,C.brick,true);building(tech,[3.4,0,-5.2],3.4,3,6.6,C.sandstone,true);
  for(const [i,x]of[-1.7,1.7].entries()){const d=desk(tech,[x,0,-.2],1.65,.85);computer(d,motions,[0,1.02,-.1]);const operator=person(tech,[x,0,.7],i?C.roof:C.red,9+i);operator.root.rotation.y=Math.PI;motions.push(t=>{operator.pose(t);operator.head.rotation.x=.13;reach(operator,0,[-.22,1.12+.025*Math.sin(t*8),.5]);reach(operator,1,[.22,1.12+.025*Math.cos(t*7),.5]);});}
  const boat=ferry(source,motions,phase);
  // 2026: the railway occupies its own outer arc, under homes rather than through pedestrians.
  const station=quay(source,-10);for(const x of[-4.5,-1.5,1.5,4.5]){for(const z of[-13.25,-7.75])box(station,[x,2.05,z],[.3,4.1,.3],C.sandstone);box(station,[x,.35,-7.3],[.22,.7,.7],C.dark);}
  box(station,[0,4.22,-10.5],[10.4,.35,6],C.edge);const homes=building(station,[0,4.4,-10.5],10,5.5,5.5,C.sandstone,true);for(const x of[-3,0,3]){solar(homes,[x,5.85,-.7],2,1.25);planter(homes,[x,5.75,1.75],2.1);}text(station,'HOMES / TRANSIT',[0,3.75,-7.45],5,.38);
  box(station,[0,.33,-7.6],[10.8,.35,1.4],C.edge);for(let i=0;i<12;i++){const h=(i+1)*.23;box(station,[-3.5,h/2,-3.4-i*.27],[1.8,h,.29],C.paving);}walk(station,motions,[-1.8,0,.7],[2.8,0,.7],44,52,11,C.red);walk(station,motions,[-3.5,0,1.65],[1.2,0,1.65],46,54,12,C.green);
  const train:THREE.Group[]=[];for(let car=0;car<3;car++){const g=group(source);g.name=`boston-train-${car}`;box(g,[0,1.15,0],[1.65,1.5,4.6],C.ivory);box(g,[0,.65,0],[1.7,.3,4.65],C.red);box(g,[0,1.94,0],[1.8,.18,4.8],C.roof);for(const x of[-.84,.84])for(const z of[-1.5,-.5,.5,1.5])box(g,[x,1.5,z],[.025,.6,.65],C.glass);for(const x of[-.7,.7])for(const z of[-1.6,1.6]){const w=cyl(g,[x,.4,z],.24,.12,C.dark);w.rotation.z=Math.PI/2;}train.push(g);motions.push(t=>{const a=-24+Math.max(0,t-44)*2.6-car*7.1;g.position.set(...polar(a,40.5));g.rotation.y=-a*DEG;});}
  // The old mill makes actual solar assemblies on a moving line instead of becoming a ruin.
  const mill=quay(source,14);openWorkshop(mill,8.4,4,4.2,'CLEAN ENERGY WORKS');building(mill,[-4.6,0,-4.5],2.5,2.8,8.2,C.brick);cyl(mill,[-5.2,5.8,-5],.48,11.6,C.brick);
  const line=group(mill,[0,0,-.15]);box(line,[0,.78,0],[3.5,.2,.85],C.dark);for(const x of[-1.4,1.4])box(line,[x,.36,0],[.12,.72,.65],C.dark);for(let i=0;i<11;i++){const roller=cyl(line,[-1.5+i*.3,.9,0],.055,.8,C.brass);roller.rotation.x=Math.PI/2;}
  for(let i=0;i<3;i++){const panel=solar(line,[0,1.01,0],.75,.55);motions.push(t=>{panel.position.x=-1.3+wrap(t*.16+i/3)*2.6;panel.rotation.x=0;});}
  const millWorker=person(mill,[2.25,0,-.1],C.green,13);millWorker.root.rotation.y=-Math.PI/2;motions.push(t=>{millWorker.pose(t);reach(millWorker,0,[-.1,1.15,.48]);reach(millWorker,1,[.2,1.22+.12*Math.sin(t*2),.4]);});
  const wheel=group(mill,[-3.45,1.05,.15]);ring(wheel,[0,0,0],.85,C.wood,.08);for(let i=0;i<8;i++)box(wheel,[0,0,0],[.06,1.6,.07],C.brass).rotation.z=i*Math.PI/8;motions.push(t=>{wheel.rotation.z=-t*.7;});
  // 2050: planted workshops above the quay, occupied rooftops, and a real arrival pier.
  const future=quay(source,42);const futureHall=building(future,[0,0,-5],8,4,6.3,C.sandstone,true);for(const x of[-2.7,0,2.7]){solar(futureHall,[x,6.6,-.7],2,1.5);planter(futureHall,[x,6.55,1.5],2.1);}box(future,[0,1.35,-2.94],[1.6,2.7,.06],C.recess);text(future,'THE NEXT WORKSHOP',[0,3.2,-2.93],4.6,.42);
  // Broad, walkable apron; the destination door is on the ground floor above the waterline.
  const futureGrad=walk(future,motions,[-1.4,0,1.1],[-.35,0,-2.45],60,72,14,C.red);const folio=group(futureGrad.hands[0]);box(folio,[0,-.1,0],[.38,.46,.035],C.paper);box(folio,[0,.02,.02],[.25,.015,.01],C.brass);motions.push(()=>upright(futureGrad,0,folio));
  walk(future,motions,[3.5,0,.4],[1.5,0,.4],61,72,15,C.green);const destination=quay(source,48);building(destination,[0,0,-5.6],5.2,4,8.4,C.ivory,true);planter(destination,[0,8.8,-5.4],3.7);tree(destination,[0,8.9,-5.4],.65);
  const arrivalPier=quay(source,45,26.1);box(arrivalPier,[0,.01,0],[1.35,.22,2.5],C.wood);for(const x of[-.5,.5])for(const z of[-1,1])cyl(arrivalPier,[x,-.2,z],.09,.7,C.dark);
  // Ripples travel in world space; no texture, random frame state, or visibility toggles.
  for(let i=0;i<28;i++){const a=-151+i*7.7,r=15+(i%4)*2.25,q=quay(source,a,r),ripple=box(q,[0,-.17,0],[.8,.008,.025],C.ripple);ripple.castShadow=false;motions.push(t=>{ripple.position.x=.4*Math.sin(t*.7+i+phase);ripple.scale.x=.55+.2*Math.sin(t*.8+i);});}
  const cameraPath:BostonJourneyCameraPoint[]=[];
  // Close human passages, a water-side tracking arc, then an accelerating aerial reveal.
  const route:[number,number,number,number,number,number][]=[
    [0,-138,18.2,4.5,30,2.45],[3,-137,18.1,4.6,30,2.45],[5,-135.7,18,4.7,30,2.5],
    [8,-122,17.5,5.4,30,3.1],[12,-117,17.8,5.25,30,3],[14,-112,18,5,30,2.8],
    [16,-95,17,4.8,30,2.55],[18,-94.2,17.2,4.6,30,2.5],[20,-93.9,17.6,4.55,30,2.5],[22,-93.5,17.9,4.6,30,2.5],
    [24,-73,18,4.8,30,2.55],[26,-70,18.3,4.65,30,2.5],[29,-66,17,4.8,30,2.5],
    [32,-57,10,5.6,24,2.5],[35,-48,10,5.6,24,2.5],[37,-42,10.5,5.6,25,2.6],
    [40,-39,17,4.8,30,2.6],[42,-37,17.2,4.8,30,2.6],
    [44,-24,17.5,5.4,31,3.3],[47,-12,16.5,6.2,32,3.9],[50,-9,16.8,6.3,32,3.9],
    [53,11,17.8,5,30,2.7],[56,15.5,18,4.8,30,2.55],[58,17,18,4.8,30,2.55],
    [61,38,17.5,5.2,30,2.8],[64,41,17,5.5,30,2.9],[65,42,15,6.5,30,3.4],
  ];
  for(const[t,a,r,h,tr,ty]of route)cameraPath.push({at:t/72,position:polar(a,r,h),target:polar(a,tr,ty)});
  cameraPath.push({at:68/72,position:[5,25,65],target:[22,8,40]},{at:70/72,position:[0,54,118],target:[13,15,26]},{at:1,position:[0,84,181],target:[4,19,17]});
  root.userData.bostonRoute={radius:30,center:[0,22],waterLevel:-.03,quayLevel:.15,notes:'All districts permanently present. Train radius 40.5; ferry radius 23.1; promenade radius 27–33. Final 65–72s intentionally pulls out from human scale.'};
  const update=batch(source,root);
  const sample=(seconds:number,_progress:number)=>{const t=THREE.MathUtils.clamp(seconds,0,72);for(const motion of motions)motion(t);update();};sample(0,0);
  return{root,cameraPath,fov:44,sample};
}
