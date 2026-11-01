import * as THREE from 'three';

type V3 = [number, number, number];
export type DegreeCameraPoint = { at: number; position: V3; target: V3 };
export type DegreeWorld = {
  root: THREE.Group;
  cameraPath: DegreeCameraPoint[];
  fov: number;
  sample(seconds: number, progress: number): void;
};
type Motion = (seconds: number, filmSeconds: number) => void;
const P = {
  ground:'#191c22', stone:'#34373d', joint:'#25282e', wall:'#262a32', recess:'#161a21',
  ivory:'#eee3ca', paper:'#fff1d3', brass:'#ac8d52', brassDark:'#73613e', crimson:'#aa3346',
  cloth:'#77766f', wood:'#685442', skin:'#d5ab87', darkSkin:'#ad7c61', hair:'#302b2a',
  glass:'#59656b', green:'#647b69', warm:'#e6bb73', black:'#14171d', ink:'#4c4a43',
};
const TAU=Math.PI*2;
const clamp=(v:number)=>THREE.MathUtils.clamp(v,0,1);
const smooth=(v:number)=>{const u=clamp(v);return u*u*(3-2*u);};
const wrap=(v:number)=>((v%1)+1)%1;
const geometries=new Map<string,THREE.BufferGeometry>();
const materials=new Map<string,THREE.MeshStandardMaterial>();
function geometry(key:string,make:()=>THREE.BufferGeometry){if(!geometries.has(key))geometries.set(key,make());return geometries.get(key)!;}
function material(color:string,glow=0){const key=`${color}/${glow}`;if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness:.78,metalness:color===P.brass?.45:.04,emissive:glow?color:0,emissiveIntensity:glow}));return materials.get(key)!;}
function group(p?:THREE.Object3D,at:V3=[0,0,0]){const g=new THREE.Group();g.position.set(...at);p?.add(g);return g;}
function part(p:THREE.Object3D,g:THREE.BufferGeometry,at:V3,size:V3,c:string,glow=0){const m=new THREE.Mesh(g,material(c,glow));m.position.set(...at);m.scale.set(...size);m.castShadow=true;m.receiveShadow=true;p.add(m);return m;}
const box=(p:THREE.Object3D,at:V3,size:V3,c:string,glow=0)=>part(p,geometry('box',()=>new THREE.BoxGeometry()),at,size,c,glow);
const ball=(p:THREE.Object3D,at:V3,size:V3,c:string)=>part(p,geometry('sphere',()=>new THREE.SphereGeometry(1,12,8)),at,size,c);
const cylinder=(p:THREE.Object3D,at:V3,r:number,h:number,c:string,glow=0)=>part(p,geometry('cylinder',()=>new THREE.CylinderGeometry(1,1,1,12)),at,[r,h,r],c,glow);
function beam(p:THREE.Object3D,a:V3,b:V3,r:number,c:string){const aa=new THREE.Vector3(...a),bb=new THREE.Vector3(...b);const m=cylinder(p,aa.clone().add(bb).multiplyScalar(.5).toArray() as V3,r,aa.distanceTo(bb),c);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),bb.sub(aa).normalize());return m;}
function ring(p:THREE.Object3D,at:V3,r:number,tube:number,c:string){return part(p,geometry(`ring/${tube/r}`,()=>new THREE.TorusGeometry(1,tube/r,6,28)),at,[r,r,r],c);}
function text(p:THREE.Object3D,words:string,at:V3,w:number,h:number,color=P.ivory){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;
  const ctx=canvas.getContext('2d')!;ctx.clearRect(0,0,1024,256);ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='600 100px Georgia, serif';
  const measured=ctx.measureText(words).width;if(measured>960)ctx.font=`600 ${Math.floor(96000/measured)}px Georgia, serif`;ctx.fillText(words,512,132);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const m=new THREE.Mesh(geometry('text-plane',()=>new THREE.PlaneGeometry()),new THREE.MeshStandardMaterial({map:texture,transparent:true,alphaTest:.2,roughness:1,side:THREE.DoubleSide}));m.position.set(...at);m.scale.set(w,h,1);p.add(m);return m;
}
function books(p:THREE.Object3D,at:V3,count=3){const g=group(p,at);for(let i=0;i<count;i++){const b=group(g,[0,i*.11,0]);b.rotation.y=(i%2?1:-1)*.06;box(b,[0,.045,0],[.52,.09,.36],[P.crimson,P.brassDark,P.cloth][i%3]);box(b,[0,.05,.015],[.48,.052,.34],P.ivory);}return g;}
function desk(p:THREE.Object3D,at:V3,w=1.8,d=.85,h=.95){const g=group(p,at);g.name='degree-desk';box(g,[0,h,0],[w,.12,d],P.wood);box(g,[0,h+.068,0],[w-.06,.018,d-.06],P.ivory);for(const x of [-w/2+.13,w/2-.13])for(const z of [-d/2+.12,d/2-.12])box(g,[x,h/2,z],[.075,h,.075],P.brassDark);beam(g,[-w/2+.13,.25,0],[w/2-.13,.25,0],.035,P.brassDark);return g;}
function stool(p:THREE.Object3D,at:V3){const g=group(p,at);cylinder(g,[0,.46,0],.25,.1,P.wood);for(let i=0;i<3;i++)beam(g,[Math.cos(i*TAU/3)*.2,0,Math.sin(i*TAU/3)*.2],[0,.42,0],.025,P.brassDark);return g;}
function credential(p:THREE.Object3D,at:V3,changing=false){
  const g=group(p,at);box(g,[.16,-.09,0],[.66,.45,.025],P.brass);
  const sheet=box(g,[.16,-.09,.018],[.61,.4,.014],P.paper);
  if(changing)sheet.material=new THREE.MeshStandardMaterial({color:P.paper,roughness:.85,metalness:.01});
  text(g,'DEGREE',[.16,-.015,.032],.43,.105,P.ink);
  for(let i=0;i<2;i++)box(g,[.12,-.11-i*.045,.034],[.32-i*.07,.012,.006],P.brassDark);
  const seal=cylinder(g,[.37,-.2,.04],.045,.012,P.crimson);seal.rotation.x=Math.PI/2;
  box(g,[.35,-.265,.037],[.035,.08,.008],P.crimson).rotation.z=.18;
  box(g,[.39,-.265,.037],[.035,.08,.008],P.crimson).rotation.z=-.18;
  return {root:g,sheet};
}

type Person={root:THREE.Group;body:THREE.Group;head:THREE.Group;arms:THREE.Group[];forearms:THREE.Group[];hands:THREE.Group[];legs:THREE.Group[];shins:THREE.Group[];pose:(time:number,distance?:number,moving?:number,seated?:number)=>void};
function person(p:THREE.Object3D,at:V3,shirt=P.crimson,variant=0,scale=1):Person{
  const root=group(p,at);root.name=`degree-person-${variant}`;root.scale.setScalar(scale);const body=group(root);
  const skin=variant%3===1?P.darkSkin:P.skin,hair=variant%4===2?'#766b5e':P.hair;
  const legs:THREE.Group[]=[],shins:THREE.Group[]=[],arms:THREE.Group[]=[],forearms:THREE.Group[]=[],hands:THREE.Group[]=[];
  for(const side of [-1,1]){
    const leg=group(body,[side*.12,.83,0]);legs.push(leg);box(leg,[0,-.2,0],[.17,.42,.2],P.stone);
    const shin=group(leg,[0,-.42,0]);shins.push(shin);box(shin,[0,-.16,0],[.155,.34,.185],P.stone);ball(shin,[0,-.35,.065],[.105,.065,.17],P.black);
  }
  box(body,[0,1.075,0],[.45,.52,.31],shirt);ball(body,[0,1.3,0],[.235,.13,.165],shirt);
  box(body,[0,1.18,.166],[.15,.32,.022],P.ivory);
  for(const side of [-1,1])box(body,[side*.075,1.32,.18],[.075,.11,.018],P.paper).rotation.z=side*.32;
  for(let i=0;i<3;i++)ball(body,[.065,1.14-i*.095,.18],[.014,.014,.009],P.brass);
  for(const side of [-1,1]){
    const arm=group(body,[side*.285,1.32,0]);arms.push(arm);box(arm,[0,-.135,0],[.145,.28,.17],shirt);
    const forearm=group(arm,[0,-.28,0]);forearms.push(forearm);box(forearm,[0,-.115,0],[.13,.24,.155],shirt);box(forearm,[0,-.235,0],[.135,.045,.16],P.ivory);
    const hand=group(forearm,[0,-.27,.01]);hands.push(hand);ball(hand,[0,0,0],[.075,.085,.065],skin);ball(hand,[-side*.05,.015,.037],[.03,.04,.03],skin);
  }
  cylinder(body,[0,1.42,0],.07,.12,skin);
  const head=group(body,[0,1.66,0]);ball(head,[0,0,0],[.23,.265,.215],skin);ball(head,[0,.09,-.055],[.235,.2,.195],hair);
  for(let i=0;i<4;i++)ball(head,[-.16+i*.1,.205,.085],[.075,.07,.075],hair);
  const eyes:THREE.Mesh[]=[];
  for(const side of [-1,1]){
    ball(head,[side*.23,-.015,0],[.045,.065,.04],skin);
    eyes.push(ball(head,[side*.085,.025,.2],[.041,.05,.019],P.ivory));
    eyes.push(ball(head,[side*.085,.023,.218],[.02,.028,.012],P.black));
    box(head,[side*.085,.105,.193],[.085,.019,.018],hair).rotation.z=side*.05;
    if(variant%4===1)ring(head,[side*.087,.025,.237],.061,.008,P.brassDark);
  }
  if(variant%4===1)box(head,[0,.035,.241],[.05,.014,.014],P.brassDark);
  ball(head,[0,-.045,.235],[.034,.045,.041],skin);box(head,[0,-.128,.2],[.075,.016,.014],P.ink);
  const pose=(time:number,distance=0,moving=0,seated=0)=>{
    const stride=distance*TAU/(.82*scale)+variant*.71,s=Math.sin(stride),m=clamp(moving),sit=clamp(seated);
    body.position.y=Math.abs(s)*.022*m-.42*sit;body.rotation.z=Math.sin(stride)*.018*m;
    head.rotation.set(sit*.08,.07*Math.sin(time*.8+variant),.025*Math.sin(time*.61+variant));
    legs.forEach((leg,i)=>{const a=s*(i?-1:1);leg.rotation.set(a*.38*m*(1-sit)-Math.PI/2*sit,0,0);shins[i].rotation.set(Math.max(0,-a)*.38*m*(1-sit)+Math.PI/2*sit,0,0);});
    arms.forEach((arm,i)=>{arm.rotation.set(s*(i?1:-1)*.32*m-.08,0,(i?-1:1)*.035);forearms[i].rotation.set(-.12,0,0);});
    const blink=wrap(time*.22+variant*.17),lid=blink>.96?Math.max(.12,Math.abs(blink-.98)/.02):1;
    eyes.forEach((eye,i)=>eye.scale.y=(i%2?.028:.05)*lid);
  };
  pose(0);return {root,body,head,arms,forearms,hands,legs,shins,pose};
}
/** Two-bone reach; segment lengths stay fixed and all poses are absolute. */
function reach(actor:Person,side:number,target:V3){
  const arm=actor.arms[side],forearm=actor.forearms[side];const direction=new THREE.Vector3(...target).sub(arm.position);
  const distance=THREE.MathUtils.clamp(direction.length(),.04,.548);direction.normalize();
  const a=(.28*.28-.27*.27+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,.28*.28-a*a));
  const bend=new THREE.Vector3(0,-1,0).addScaledVector(direction,direction.y);if(bend.lengthSq()<.001)bend.set(0,0,1);bend.normalize();
  const elbow=direction.clone().multiplyScalar(a).addScaledVector(bend,height);
  arm.quaternion.setFromUnitVectors(new THREE.Vector3(0,-1,0),elbow.clone().normalize());
  const wrist=direction.multiplyScalar(distance).sub(elbow).normalize();
  forearm.quaternion.copy(arm.quaternion).invert().multiply(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,-1,0),wrist));
}
function upright(actor:Person,side:number,prop:THREE.Object3D){prop.quaternion.copy(actor.arms[side].quaternion).multiply(actor.forearms[side].quaternion).invert();}
function walker(p:THREE.Object3D,motions:Motion[],from:V3,to:V3,begin:number,end:number,variant:number,shirt=P.cloth,scale=1){
  const actor=person(p,from,shirt,variant,scale),length=new THREE.Vector3(...from).distanceTo(new THREE.Vector3(...to));
  const yaw=Math.atan2(to[0]-from[0],to[2]-from[2]);
  motions.push((t,s)=>{const u=clamp((s-begin)/(end-begin)),v=smooth(u),moving=smooth(u/.08)*smooth((1-u)/.08);actor.root.position.set(THREE.MathUtils.lerp(from[0],to[0],v),from[1],THREE.MathUtils.lerp(from[2],to[2],v));actor.root.rotation.y=yaw;actor.pose(t,length*v,moving);});return actor;
}
function windowBay(p:THREE.Object3D,x:number,y:number,z:number,lit:boolean){
  box(p,[x,y,z],[1.3,1.45,.11],P.recess);box(p,[x,y,z+.07],[1.12,1.27,.025],lit?P.warm:P.glass,lit?.35:0);
  for(const xx of [-.61,0,.61])box(p,[x+xx,y,z+.095],[.035,1.43,.04],P.brassDark);
  box(p,[x,y,z+.1],[1.26,.04,.04],P.brassDark);box(p,[x,y-.77,z+.09],[1.5,.12,.25],P.stone);
}
function streetlamp(p:THREE.Object3D,at:V3){const g=group(p,at);cylinder(g,[0,1.25,0],.045,2.5,P.brassDark);cylinder(g,[0,.1,0],.11,.2,P.stone);ball(g,[0,2.52,0],[.16,.23,.16],P.warm);cylinder(g,[0,2.77,0],.18,.05,P.brassDark);return g;}
function plant(p:THREE.Object3D,at:V3){const g=group(p,at);cylinder(g,[0,.22,0],.23,.44,P.stone);for(let i=0;i<4;i++){const a=i*TAU/4;beam(g,[0,.3,0],[Math.cos(a)*.16,.9+i%2*.17,Math.sin(a)*.16],.018,P.brassDark);const leaf=ball(g,[Math.cos(a)*.18,.8+i%2*.17,Math.sin(a)*.18],[.14,.3,.065],P.green);leaf.rotation.z=Math.cos(a)*.35;}return g;}
function monitor(p:THREE.Object3D,motions:Motion[],at:V3,offset=0){const g=group(p,at);box(g,[0,.06,0],[.55,.12,.36],P.stone);box(g,[0,.25,-.08],[.09,.35,.08],P.brassDark);box(g,[0,.53,-.08],[.84,.58,.14],P.ivory);box(g,[0,.53,.001],[.73,.46,.025],P.recess);
  for(let i=0;i<5;i++){const line=box(g,[-.06,.4+i*.065,.018],[.46-i%3*.08,.016,.009],i===0?P.warm:P.ivory,.15);motions.push(t=>{line.position.y=.35+wrap(t*.2+offset+i*.2)*.34;});}
  const keyboard=box(g,[0,.045,.39],[.77,.08,.3],P.cloth);for(let i=0;i<9;i++)box(g,[-.32+i*.08,.091,.38],[.045,.012,.16],P.ivory);return {root:g,keyboard};}
function openBook(p:THREE.Object3D,motions:Motion[],at:V3,offset=0){const g=group(p,at);box(g,[0,.03,0],[.7,.06,.43],P.crimson);box(g,[-.18,.075,0],[.32,.035,.39],P.paper);box(g,[.18,.075,0],[.32,.035,.39],P.paper);
  const page=group(g,[0,.105,0]);box(page,[.16,0,0],[.32,.009,.37],P.ivory);
  motions.push(t=>{page.rotation.z=Math.PI*smooth(wrap(t*.12+offset));});return g;
}
function clockFace(p:THREE.Object3D,motions:Motion[],at:V3,r=.43,speed=.8){const g=group(p,at);const back=cylinder(g,[0,0,0],r,.1,P.brass);back.rotation.x=Math.PI/2;const face=cylinder(g,[0,0,.06],r*.9,.02,P.ivory);face.rotation.x=Math.PI/2;
  for(let i=0;i<12;i++){const a=i*TAU/12;const tick=box(g,[Math.sin(a)*r*.73,Math.cos(a)*r*.73,.082],[.018,.055,.01],P.ink);tick.rotation.z=-a;}
  const minute=group(g,[0,0,.1]),hour=group(g,[0,0,.11]);box(minute,[0,r*.33,0],[.022,r*.66,.015],P.crimson);box(hour,[0,r*.22,0],[.035,r*.44,.015],P.ink);
  motions.push(t=>{minute.rotation.z=-t*speed;hour.rotation.z=-t*speed/12;});return g;
}
function batch(source:THREE.Group,root:THREE.Group){
  const buckets=new Map<string,{parts:THREE.Mesh[];draw:THREE.InstancedMesh}>();
  source.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const key=`${o.geometry.uuid}/${(o.material as THREE.Material).uuid}/${o.castShadow}`;if(!buckets.has(key))buckets.set(key,{parts:[],draw:null!});buckets.get(key)!.parts.push(o);});
  for(const b of buckets.values()){const first=b.parts[0];b.draw=new THREE.InstancedMesh(first.geometry,first.material,b.parts.length);b.draw.castShadow=first.castShadow;b.draw.receiveShadow=first.receiveShadow;b.draw.frustumCulled=false;root.add(b.draw);}
  root.userData.degreeStats={draws:buckets.size,triangles:[...buckets.values()].reduce((n,b)=>n+b.parts.length*(b.parts[0].geometry.index?.count??b.parts[0].geometry.attributes.position.count)/3,0),instances:[...buckets.values()].reduce((n,b)=>n+b.parts.length,0)};
  return ()=>{source.updateMatrixWorld(true);for(const {parts,draw} of buckets.values()){parts.forEach((m,i)=>draw.setMatrixAt(i,m.matrixWorld));draw.instanceMatrix.needsUpdate=true;}};
}

export function buildDegreeWorld(seed:number):DegreeWorld{
  const root=group(),source=group(),motions:Motion[]=[];root.name='degree-renewal-connected-world';
  const seedPhase=((Math.floor(seed)%997)+997)%997/997;
  // This is a single permanent streetscape. No zone visibility switches or set resets.
  box(source,[23,-.18,0],[100,.3,45],P.ground);
  box(source,[23,-.025,.7],[76,.08,5.3],P.stone);
  for(let i=0;i<57;i++)for(let row=0;row<3;row++)box(source,[-14+i*1.3,.021,-.7+row*1.35],[1.25,.009,1.28],(i+row)%3?P.stone:'#3b3d41');
  for(const z of [-2.05,3.37]){box(source,[23,.04,z],[76,.1,.16],P.brassDark);box(source,[23,.096,z],[76,.012,.025],P.brass);}
  // Connected real building volumes recede behind the promenade; the upper walls
  // stay charcoal so centered white captions retain contrast without text boxes.
  for(let i=0;i<10;i++){
    const x=-7+i*6.3,h=4.4+(i%3)*.35;
    box(source,[x,h/2,-5.6],[6.25,h,3.1],i%2?P.wall:'#22262e');
    box(source,[x,h+.08,-5.6],[6.35,.16,3.25],P.joint);
    box(source,[x,.16,-3.97],[6.25,.32,.2],P.joint);
    for(const dx of [-2.6,2.6])box(source,[x+dx,2,-3.98],[.11,4,.13],P.joint);
    for(const dx of [-1.8,0,1.8])windowBay(source,x+dx,1.17,-3.99,i>=6);
    for(let row=0;row<9;row++)box(source,[x,2.4+row*.21,-4.025],[6.2,.012,.012],'#2c3038');
  }
  // A continuous exposed service pipe and paving joints carry the eye between places.
  beam(source,[-12,.42,-3.5],[55,.42,-3.5],.05,P.brassDark);
  for(let x=-6;x<55;x+=4.5){cylinder(source,[x,.25,-3.5],.08,.5,P.joint);plant(source,[x+.6,0,-2.7]);}
  for(const x of [-3.5,4.1,12,21.7,30.5,39.4,49])streetlamp(source,[x,0,-2.6]);

  // 2026: a civic doorway, stamped papers, and the beginning of one graduate's trip.
  for(const x of [-1.7,1.7]){box(source,[x,1.85,-2.85],[.28,3.7,.4],P.brassDark);box(source,[x,1.85,-2.61],[.09,3.5,.02],P.brass);}
  box(source,[0,3.65,-2.85],[3.7,.25,.45],P.stone);box(source,[0,1.45,-3.05],[2.9,2.9,.12],P.recess);
  for(const x of [-.72,.72]){box(source,[x,1.4,-2.94],[1.34,2.65,.11],P.wall);box(source,[x,1.35,-2.87],[.055,.35,.05],P.brass);}
  const lawDesk=desk(source,[0,0,-.5],2.8,1.05,.95);text(lawDesk,'CIVIC OFFICE',[0,.69,.54],1.5,.19,P.brass);
  box(lawDesk,[-.65,1.025,-.1],[.63,.018,.52],P.paper);const lawTitle=text(lawDesk,'5 YEARS',[-.65,1.041,-.1],.48,.15,P.ink);lawTitle.rotation.x=-Math.PI/2;
  books(lawDesk,[.8,1.03,-.15],3);
  const official=person(source,[-.95,0,-1.1],P.cloth,3);
  const stamp=group(official.hands[1]);box(stamp,[0,-.15,0],[.32,.075,.25],P.crimson);cylinder(stamp,[0,-.045,0],.045,.14,P.brass);ball(stamp,[0,.04,0],[.09,.055,.07],P.wood);
  motions.push(t=>{official.pose(t);reach(official,1,[.3,1.22+.25*(.5+.5*Math.cos(t*2.6)),.5]);upright(official,1,stamp);official.head.rotation.x=.13;});
  const outgoing=group(lawDesk);box(outgoing,[.2,1.028,.05],[.56,.02,.43],P.paper);
  motions.push(t=>{outgoing.position.x=.34*wrap(t*.23);outgoing.rotation.y=.04*Math.sin(t);});

  // Five physically present renewal readers connect the story's checkpoints.
  for(const [i,x]of [5.7,13.8,23,31.8,40.6].entries()){
    const kiosk=group(source,[x,0,-1.55]);box(kiosk,[0,.59,0],[.43,1.18,.42],P.joint);box(kiosk,[0,1.19,0],[.55,.12,.55],P.brassDark);
    box(kiosk,[0,.99,.225],[.29,.055,.025],P.black);const status=ball(kiosk,[.15,1.16,.3],[.035,.035,.018],P.crimson);
    const receipt=box(kiosk,[0,1.24,.1],[.22,.012,.3],P.paper);
    motions.push((t,s)=>{status.scale.setScalar(.025+.01*(.5+.5*Math.sin(t*3+i)));receipt.position.z=.08+.13*(.5+.5*Math.sin(t*(.75+i*.09)+i));});
    const routeMark=ring(source,[x,.03,1.5],.27,.018,P.brassDark);routeMark.rotation.x=-Math.PI/2;
  }
  walker(source,motions,[2.9,0,-.15],[5.3,0,-.15],4,15,7,P.cloth);

  // 2031: the intern teaches; the executive brings a briefcase to the same desk.
  const classDesk=desk(source,[9.5,0,-.4],1.8,.9);monitor(classDesk,motions,[0,1.03,0],seedPhase);
  const intern=person(source,[8.15,0,-.5],P.crimson,2);
  motions.push(t=>{intern.pose(t);reach(intern,1,[.55,1.1+.14*Math.sin(t*2.1),.2]);intern.head.rotation.y=.45+.08*Math.sin(t);});
  const executive=person(source,[10.85,0,-.35],P.cloth,5);executive.root.rotation.y=-.45;
  const briefcase=group(source,[11.23,0,-.35]);box(briefcase,[0,.18,0],[.42,.31,.14],P.wood);ring(briefcase,[0,.4,0],.065,.016,P.brass);
  const notes=group(executive.hands[0],[0,0,.04]);box(notes,[.06,-.04,0],[.28,.32,.025],P.paper);for(let i=0;i<4;i++)box(notes,[.06,.06-i*.055,.02],[.2,.008,.004],P.brassDark);
  const pencil=group(executive.hands[1]);beam(pencil,[0,0,0],[-.21,-.12,.04],.012,P.brass);ball(pencil,[-.21,-.12,.04],[.012,.012,.012],P.ink);
  motions.push(t=>{executive.pose(t);executive.head.rotation.y=-.25;executive.head.rotation.x=.1;reach(executive,0,[-.22,1.2,.4]);reach(executive,1,[.08,1.28+.025*Math.sin(t*5),.4]);upright(executive,0,notes);upright(executive,1,pencil);});
  books(classDesk,[.6,1.03,-.1],2);

  // 2036: a staggered queue leads into a factory building its own teaching lab.
  for(let i=0;i<3;i++)walker(source,motions,[12.35+i*1.03,0,-.15],[12.8+i*1.03,0,-.15],22+i*.8,29+i*.8,8+i,[P.cloth,P.brassDark,P.crimson][i]);
  const belt=group(source,[17.1,0,-1.05]);box(belt,[0,.7,0],[2.7,.22,.85],P.brassDark);box(belt,[0,.83,0],[2.6,.05,.72],P.black);
  for(const x of [-1.1,1.1])box(belt,[x,.34,0],[.12,.68,.65],P.stone);
  for(let i=0;i<12;i++){const roller=cylinder(belt,[-1.2+i*.22,.82,0],.045,.74,P.cloth);roller.rotation.x=Math.PI/2;}
  for(let i=0;i<4;i++){const parcel=group(belt);box(parcel,[0,.98,0],[.35,.27,.39],P.wood);box(parcel,[0,1.12,0],[.065,.012,.4],P.ivory);motions.push(t=>{parcel.position.x=-1.1+wrap(t*.19+i*.25)*2.2;});}
  const flywheel=group(belt,[-1.36,.7,.45]);ring(flywheel,[0,0,0],.31,.045,P.brass);for(let i=0;i<4;i++)box(flywheel,[0,0,0],[.025,.58,.035],P.brass).rotation.z=i*Math.PI/4;motions.push(t=>{flywheel.rotation.z=t*2.8;});
  const press=group(belt,[.65,0,0]);for(const x of [-.32,.32])box(press,[x,1.25,-.32],[.07,1,.07],P.stone);box(press,[0,1.73,-.32],[.8,.1,.12],P.brassDark);
  const ram=group(press);box(ram,[0,1.38,-.1],[.42,.16,.46],P.brass);motions.push(t=>{ram.position.y=-.2*(.5+.5*Math.sin(t*2.8));});
  // Steel uprights and roof rails are lifted from a nearby stack into a lab bay.
  const lab=group(source,[20.05,0,-1.55]);
  for(let i=0;i<6;i++){
    const vertical=i<4,x=i%2?1.1:-1.1,z=i<2?-.62:.62;
    const member=box(lab,[x,1.1,z],vertical?[.07,2.2,.07]:[2.3,.07,.07],P.brassDark);
    const home=new THREE.Vector3(vertical?x:0,vertical?1.1:2.2,vertical?z:(i===4?-.62:.62));
    const start=new THREE.Vector3(-.65+i*.15,.16+i*.06,-1.4);
    motions.push((t,s)=>{const u=smooth((s-24-i*.9)/5.5);member.position.lerpVectors(start,home,u);member.position.y+=Math.sin(u*Math.PI)*.8;member.rotation.z=vertical?(1-u)*Math.PI/2:0;});
  }
  const lunchDesk=desk(source,[20.05,0,-1.1],1.5,.7,.86);openBook(lunchDesk,motions,[0,.94,0],.2);cylinder(lunchDesk,[.53,1.02,0],.07,.16,P.ivory);
  stool(source,[19.6,0,-.25]);const lunchLearner=person(source,[19.6,0,-.25],P.cloth,12);lunchLearner.root.rotation.y=.75;
  motions.push(t=>{lunchLearner.pose(t,0,0,1);reach(lunchLearner,1,[.25,1.42,.34]);lunchLearner.head.rotation.x=.12;});
  const labTeacher=person(source,[21.15,0,-.3],P.brassDark,13);motions.push(t=>{labTeacher.pose(t);reach(labTeacher,0,[-.48,1.28+.1*Math.sin(t*1.7),.2]);});
  walker(source,motions,[22,0,-.3],[23.6,0,-.3],31,40,14,P.cloth);

  // 2041: one parent checks a clock, studies, then responds to a moving child.
  const timeClock=group(source,[25.65,0,-.55]);box(timeClock,[0,.8,0],[.13,1.6,.15],P.brassDark);clockFace(timeClock,motions,[0,1.73,.04],.39,1.7);
  const pendulum=group(timeClock,[0,1.34,.03]);beam(pendulum,[0,0,0],[0,-.55,0],.018,P.brass);cylinder(pendulum,[0,-.55,0],.085,.045,P.brass).rotation.x=Math.PI/2;motions.push(t=>{pendulum.rotation.z=Math.sin(t*2.4)*.3;});
  const study=desk(source,[27.4,0,-.65],1.55,.72,.9);openBook(study,motions,[0,.98,0],.4);books(study,[.53,.98,0],2);
  const child=person(source,[28.55,0,-.1],P.ivory,16,.6);
  const toy=ball(source,[28.7,.16,.1],[.16,.16,.16],P.crimson);
  motions.push(t=>{const a=t*.7+seedPhase;child.root.position.set(28.65+Math.sin(a)*.35,0,-.25+Math.cos(a)*.3);child.root.rotation.y=Math.atan2(Math.cos(a),-Math.sin(a));child.pose(t,t*.25,1);toy.position.set(28.65+Math.sin(a+.5)*.55,.16,-.25+Math.cos(a+.5)*.45);});
  const satchel=group(source,[27.9,0,.1]);box(satchel,[0,.24,0],[.45,.46,.24],P.wood);ring(satchel,[0,.51,0],.1,.025,P.brassDark);

  // 2046: shared study space and a low, visible childcare corner beside it.
  const nightDesk=desk(source,[36.05,0,.19],1.2,.72,.95);openBook(nightDesk,motions,[0,1.03,0],.65);books(nightDesk,[.35,1.03,-.12],2);stool(source,[35.2,0,.85]);
  const shared=desk(source,[33.8,0,-1.2],1.7,.72,.88);monitor(shared,motions,[0,.96,0],.4);
  stool(source,[33.25,0,-.35]);const neighbor=person(source,[33.25,0,-.35],P.cloth,17);neighbor.root.rotation.y=.4;
  motions.push(t=>{neighbor.pose(t,0,0,1);reach(neighbor,1,[.25,1.45,.36]);neighbor.head.rotation.x=.12;});
  for(const x of [37.6,38.65]){box(source,[x,.035,-.4],[.85,.06,1.4],P.brassDark);for(let i=0;i<3;i++)box(source,[x-.25+i*.23,.14,-.55],[.16,.16,.16],[P.crimson,P.ivory,P.brass][i]);}
  const kid1=person(source,[37.5,0,-.35],P.crimson,18,.56),kid2=person(source,[38.6,0,-.8],P.ivory,19,.6);
  const playWheel=group(source,[38.1,.27,-1.2]);ring(playWheel,[0,0,0],.25,.04,P.brass);for(let i=0;i<3;i++)box(playWheel,[0,0,0],[.025,.46,.03],P.ivory).rotation.z=i*Math.PI/3;
  motions.push(t=>{kid1.pose(t);reach(kid1,1,[.32,1.18,.2]);kid1.head.rotation.y=Math.sin(t*1.4)*.3;kid2.pose(t,t*.12,.55);kid2.root.position.x=38.6+Math.sin(t*.8)*.2;kid2.root.rotation.y=-.8;playWheel.rotation.z=t*1.6;});
  const caregiver=person(source,[38.3,0,-2],P.cloth,20);motions.push(t=>{caregiver.pose(t);reach(caregiver,0,[-.35,1.2,.35]);caregiver.head.rotation.y=.18*Math.sin(t*.7);});

  // 2051: teaching and learning remain next to each other, without changing sets.
  const lectern=desk(source,[43.15,0,-.45],1.3,.72,1.04);openBook(lectern,motions,[0,1.12,0],.8);
  for(const [i,z]of [-.65,.95].entries()){
    stool(source,[44.25,0,z]);const attendee=person(source,[44.25,0,z],i?P.cloth:P.ivory,22+i);attendee.root.rotation.y=-Math.PI/2;
    motions.push(t=>{attendee.pose(t,0,0,1);reach(attendee,0,[-.27,1.2,.3]);attendee.head.rotation.y=.05*Math.sin(t*.8+i);});
  }
  const lectureModel=group(lectern,[.35,1.19,0]);cylinder(lectureModel,[0,.08,0],.13,.16,P.brassDark);const mechanism=group(lectureModel,[0,.34,0]);ring(mechanism,[0,0,0],.22,.025,P.brass);box(mechanism,[0,0,0],[.025,.42,.025],P.crimson);motions.push(t=>{mechanism.rotation.z=t*.8;});

  // The same graduate and credential physically travel through the whole world.
  const graduate=person(source,[1.15,0,.85],P.crimson,1);graduate.root.name='degree-recurring-graduate';
  const diploma=credential(graduate.hands[0],[0,0,.045],true);diploma.root.name='degree-recurring-credential';
  const ivory=new THREE.Color(P.paper),red=new THREE.Color(P.crimson);
  const legs:{begin:number;end:number;from:V3;to:V3;detour?:boolean}[]=[
    {begin:5,end:16,from:[1.15,0,.85],to:[8.8,0,.85]},
    {begin:20,end:28,from:[8.8,0,.85],to:[17.2,0,.85]},
    {begin:32,end:40,from:[17.2,0,.85],to:[26.8,0,.85]},
    {begin:44,end:52,from:[26.8,0,.85],to:[35.2,0,.85]},
    {begin:55,end:60,from:[35.2,0,.85],to:[42.4,0,.65],detour:true},
  ];
  motions.push((t,s)=>{
    let at:V3=[1.15,0,.85],distance=0,moving=0,yaw=0;
    for(const leg of legs){const length=new THREE.Vector3(...leg.from).distanceTo(new THREE.Vector3(...leg.to));if(s<leg.begin)break;if(s>=leg.end){distance+=length;at=leg.to;continue;}const u=clamp((s-leg.begin)/(leg.end-leg.begin)),v=smooth(u);distance+=length*v;at=[THREE.MathUtils.lerp(leg.from[0],leg.to[0],v),0,THREE.MathUtils.lerp(leg.from[2],leg.to[2],v)];moving=smooth(u/.08)*smooth((1-u)/.08);yaw=Math.atan2(leg.to[0]-leg.from[0],leg.to[2]-leg.from[2])*moving;
      if(leg.detour){const turn=clamp((at[0]-leg.from[0])/2.1);at[2]+=.35*Math.sin(Math.PI*turn);const slope=(leg.to[2]-leg.from[2])/(leg.to[0]-leg.from[0])+(turn<1?.35*Math.PI/2.1*Math.cos(Math.PI*turn):0);yaw=Math.atan2(1,slope)*moving;}break;}
    const seated=smooth((s-52)/.6)*(1-smooth((s-54.4)/.6));
    if(seated>0)yaw=Math.PI/2*seated;
    graduate.root.position.set(...at);graduate.root.rotation.y=yaw;graduate.pose(t,distance,moving,seated);
    reach(graduate,0,[-.3,1.08+seated*.3,.36]);upright(graduate,0,diploma.root);
    if(s<5){reach(graduate,1,[.35,1.3,.28]);graduate.head.rotation.y=-.2;}
    if(s>=16&&s<=20){reach(graduate,1,[.35,1.36,.25]);graduate.head.rotation.y=-.35;}
    if(s>=28&&s<=32){reach(graduate,1,[.43,1.26,.2]);graduate.head.rotation.y=.4;}
    if(s>=40&&s<=44){const turn=.5+.5*Math.sin(t*1.5);reach(graduate,1,[.28+.3*turn,1.28,.27-.1*turn]);graduate.head.rotation.y=-.2+.7*turn;}
    if(seated>0){reach(graduate,1,[.27,1.5,.35]);graduate.head.rotation.x=.16;}
    if(s>=60){const speaking=.5+.5*Math.sin(t*1.8);reach(graduate,1,[.4+.14*speaking,1.22+.23*speaking,.18]);graduate.head.rotation.y=.15+.16*Math.sin(t*.8);reach(graduate,0,[-.3,1.28,.4]);upright(graduate,0,diploma.root);}
    let expires=0;for(const yearAt of [12,24,36,48])expires=Math.max(expires,smooth((s-yearAt)/.6)*(1-smooth((s-yearAt-2.3)/.7)));
    expires=Math.max(expires,smooth((s-64)/1.4));(diploma.sheet.material as THREE.MeshStandardMaterial).color.lerpColors(ivory,red,expires);
  });
  const cap=group(source);box(cap,[0,0,0],[.48,.055,.48],P.black);cylinder(cap,[0,-.09,0],.18,.15,P.black);beam(cap,[0,.04,0],[.27,.025,.16],.012,P.brass);beam(cap,[.27,.025,.16],[.27,-.14,.16],.012,P.brass);
  cap.position.set(.7,1.18,-.2);cap.rotation.y=.3;

  // Each node is part of one continuous route. Parent owns spline interpolation.
  const route:[number,number][]=[
    [0,0],[4,1],[5,1.35],[8,3],[12,6.2],[14,7.8],[16,8.6],[18,9.3],[20,9.8],
    [22,10.7],[24,13.3],[26,15.3],[28,16.7],[30,17.7],[32,18.3],[34,19.6],[36,22.3],
    [38,25],[40,26.2],[42,27.1],[44,27.8],[46,28.9],[48,31.6],[50,33.7],[52,34.7],
    [54,35.7],[55,36.1],[56,36.7],[58,39.8],[60,41.9],[64,42.6],[68,43.1],[72,43.55],
  ];
  const cameraPath:DegreeCameraPoint[]=route.map(([seconds,x])=>({at:seconds/72,position:[x+1.15,4.4+Math.sin(seconds*.1)*.08,12+Math.sin(seconds*.08)*.15],target:[x,2.5,0]}));
  const update=batch(source,root);
  const sample=(seconds:number,progress:number)=>{const t=Number.isFinite(seconds)?seconds:0,s=clamp(Number.isFinite(progress)?progress:0)*72;motions.forEach(fn=>fn(t,s));update();};
  root.userData.degreeRoute={checkpoints:[0,12,24,36,48,60,72],oneConnectedWorld:true,graduateId:graduate.root.name,credentialId:diploma.root.name};
  sample(0,0);return {root,cameraPath,fov:42,sample};
}
