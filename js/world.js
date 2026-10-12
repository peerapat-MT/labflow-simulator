import * as THREE from '../vendor/three.module.js';
import {OrbitControls} from '../vendor/OrbitControls.js';
import {GLTFLoader} from '../vendor/GLTFLoader.js';
import {RoomEnvironment} from '../vendor/RoomEnvironment.js';
import {MotionPath,patientRoute,specimenRoute,dampAngle,ease} from './motion.js';

export const STATIONS=[
  {id:'registration',name:'01 ขึ้นบัตร',x:-9,z:4.9,color:'#6dd6ff'},
  {id:'collection',name:'02 เจาะเลือด / เก็บตัวอย่าง',x:-4.5,z:4.6,color:'#58e3da'},
  {id:'transport',name:'03 กระสวย / ส่งสำรอง',x:.3,z:4.8,color:'#ffce7c'},
  {id:'reception',name:'04 รับสิ่งส่งตรวจ',x:5.9,z:4.4,color:'#f6b985'},
  {id:'preparation',name:'05 เตรียม / ปั่นแยก',x:-8.4,z:-2.8,color:'#8ebdff'},
  {id:'hematology',name:'06 โลหิตวิทยา',x:-3.1,z:-3,color:'#c4a1ff'},
  {id:'chemistry',name:'07 เคมีคลินิก',x:2.2,z:-3,color:'#58e3da'},
  {id:'urinalysis',name:'08 จุลทรรศน์ / ภูมิคุ้มกัน',x:7.6,z:-3,color:'#80b6ff'},
  {id:'approval',name:'09 LIS → อนุมัติ → HIS',x:10.1,z:1.8,color:'#80d3ff'},
];
const material=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.5,...extra});
const hiddenMatrix=new THREE.Matrix4().makeScale(0,0,0);
const yAxis=new THREE.Vector3(0,1,0);

// Each body part has one GPU draw call for every person, including articulated limbs.
// Cloned transforms share Blender geometry; no meshes are allocated during playback.
class PeopleBatch {
  constructor(template,scene,capacity=88){
    this.capacity=capacity;this.entries=new Map();this.slots=Array(capacity).fill(null);this.free=Array.from({length:capacity},(_,i)=>capacity-1-i);
    const sources=[];template.traverse(o=>{if(o.isMesh)sources.push(o);});
    this.batches=sources.map(o=>{const m=o.material.clone();if(m.name==='Scrubs')m.color.set('#ffffff');const mesh=new THREE.InstancedMesh(o.geometry,m,capacity);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;mesh.userData.peopleBatch=this;for(let i=0;i<capacity;i++){mesh.setMatrixAt(i,hiddenMatrix);mesh.setColorAt(i,new THREE.Color('#ffffff'));}scene.add(mesh);return {mesh,tint:m.name==='Scrubs'};});
    this.roots=Array.from({length:capacity},()=>{const root=template.clone(true),parts=[];root.traverse(o=>{if(o.isMesh)parts.push(o);});const joints={};for(const name of ['leftArm','rightArm','leftLeg','rightLeg','leftKnee','rightKnee'])joints[name]=root.getObjectByName(name);return {root,parts,joints};});
  }
  add(id,position,color,selection,staff=false){
    if(this.entries.has(id))return this.entries.get(id);if(!this.free.length)return null;
    const slot=this.free.pop(),rig=this.roots[slot];rig.root.position.set(...position);rig.root.rotation.set(0,Math.PI,0);for(const j of Object.values(rig.joints))if(j)j.rotation.set(0,0,0);
    const entry={id,slot,...rig,motion:new MotionPath(position),phase:slot*.63,seated:false,seatOffset:0,staff,selection};
    this.entries.set(id,entry);this.slots[slot]=entry;
    for(const b of this.batches){b.mesh.setColorAt(slot,new THREE.Color(b.tint?color:'#ffffff'));b.mesh.instanceColor.needsUpdate=true;}return entry;
  }
  remove(id){const e=this.entries.get(id);if(!e)return;for(const b of this.batches)b.mesh.setMatrixAt(e.slot,hiddenMatrix);this.slots[e.slot]=null;this.free.push(e.slot);this.entries.delete(id);}
  tick(dt,reduced){
    for(const e of this.entries.values()){
      const oldX=e.motion.position[0],oldZ=e.motion.position[2];const position=e.motion.tick(dt,reduced);e.root.position.set(...position);
      const dx=position[0]-oldX,dz=position[2]-oldZ,moving=Math.hypot(dx,dz)>.0001;
      if(moving){e.root.rotation.y=dampAngle(e.root.rotation.y,Math.atan2(dx,dz),dt);e.phase+=Math.min(1,Math.hypot(dx,dz))*6;}
      else e.root.rotation.y=dampAngle(e.root.rotation.y,e.seated?0:Math.PI,dt);
      const sitting=e.seated&&!e.motion.moving;
      const target={leftArm:moving?Math.sin(e.phase)*.38:sitting?-.3:0,rightArm:moving?-Math.sin(e.phase)*.38:sitting?-.3:0,leftLeg:sitting?-Math.PI/2:moving?-Math.sin(e.phase)*.42:0,rightLeg:sitting?-Math.PI/2:moving?Math.sin(e.phase)*.42:0,leftKnee:sitting?Math.PI/2:moving?Math.max(0,Math.sin(e.phase))*.65:0,rightKnee:sitting?Math.PI/2:moving?Math.max(0,-Math.sin(e.phase))*.65:0};
      if(dt>0)for(const [name,value]of Object.entries(target)){const j=e.joints[name];if(j)j.rotation.x+=(value-j.rotation.x)*(reduced?1:1-Math.exp(-16*dt));}
      if(dt>0)e.seatOffset+=((sitting?-.17:0)-e.seatOffset)*(reduced?1:1-Math.exp(-14*dt));e.root.position.y+=e.seatOffset;
      e.root.updateMatrixWorld(true);this.batches.forEach((b,i)=>b.mesh.setMatrixAt(e.slot,e.parts[i].matrixWorld));
    }
    let count=this.slots.length;while(count&&!this.slots[count-1])count--;for(const b of this.batches){b.mesh.count=count;b.mesh.instanceMatrix.needsUpdate=true;}
  }
}

class SpecimenBatch {
  constructor(scene,capacity=180){
    this.capacity=capacity;this.entries=new Map();this.slots=Array(capacity).fill(null);this.free=Array.from({length:capacity},(_,i)=>capacity-1-i);this.transform=new THREE.Object3D();
    const body=new THREE.CylinderGeometry(.075,.066,.34,10);body.translate(0,.2,0);
    const cap=new THREE.CylinderGeometry(.083,.083,.08,10);cap.translate(0,.41,0);
    const label=new THREE.CylinderGeometry(.077,.077,.12,10,1,true);label.translate(0,.2,0);
    this.batches=[body,cap,label].map((geo,i)=>{const mesh=new THREE.InstancedMesh(geo,material(i===0?'#aed6e2':'#ffffff',{roughness:i===0?.24:.5}),capacity);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.castShadow=false;mesh.frustumCulled=false;mesh.userData.specimenBatch=this;for(let j=0;j<capacity;j++)mesh.setMatrixAt(j,hiddenMatrix);scene.add(mesh);return mesh;});
  }
  target(id,pos,color,initial=false){
    let e=this.entries.get(id);if(!e){if(!this.free.length)return;const slot=this.free.pop();e={id,slot,motion:new MotionPath(initial?pos:[-4,1.1,4.7]),selection:{kind:'specimen',id}};this.entries.set(id,e);this.slots[slot]=e;}
    e.motion.setTarget(pos,{waypoints:specimenRoute(e.motion.position,pos)});this.batches[1].setColorAt(e.slot,new THREE.Color(color));this.batches[1].instanceColor.needsUpdate=true;
  }
  remove(id){const e=this.entries.get(id);if(!e)return;for(const b of this.batches)b.setMatrixAt(e.slot,hiddenMatrix);this.slots[e.slot]=null;this.free.push(e.slot);this.entries.delete(id);}
  tick(dt,reduced){for(const e of this.entries.values()){this.transform.position.set(...e.motion.tick(dt,reduced));this.transform.updateMatrix();for(const b of this.batches)b.setMatrixAt(e.slot,this.transform.matrix);}let count=this.slots.length;while(count&&!this.slots[count-1])count--;for(const b of this.batches){b.count=count;b.instanceMatrix.needsUpdate=true;}}
}

export class LabWorld {
  constructor(container,labelContainer,onSelect,onStatus=()=>{}){
    this.container=container;this.labelContainer=labelContainer;this.onSelect=onSelect;this.onStatus=onStatus;this.labels=[];this.trips=new Map();this.tripPool=[];this.loaded=false;this.selection=null;this.quality='auto';this.frames=0;this.frameTimes=[];this.frameIntervals=[];this.reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#0b1b30');
    this.camera=new THREE.OrthographicCamera(-17,17,12,-12,.1,180);this.camera.position.set(25,29,34);
    this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.9;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;container.appendChild(this.renderer.domElement);
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.dampingFactor=.085;this.controls.minZoom=.7;this.controls.maxZoom=2.8;this.controls.maxPolarAngle=Math.PI*.46;this.controls.minPolarAngle=.01;this.controls.target.set(0,.2,0);this.controls.update();this.controls.addEventListener('start',()=>this.cameraMove=null);
    const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(this.renderer);this.environment=pmrem.fromScene(room,.06);this.scene.environment=this.environment.texture;this.scene.environmentIntensity=.65;room.dispose();pmrem.dispose();
    this.scene.add(new THREE.HemisphereLight('#d8efff','#496583',1.8));this.sun=new THREE.DirectionalLight('#f0f7ff',3.5);this.sun.position.set(-7,23,14);this.sun.castShadow=true;this.sun.shadow.mapSize.set(1024,1024);Object.assign(this.sun.shadow.camera,{left:-19,right:19,top:17,bottom:-17,near:1,far:60});this.sun.shadow.normalBias=.035;this.sun.shadow.bias=-.0002;this.scene.add(this.sun);
    const rim=new THREE.DirectionalLight('#6eb9ff',1);rim.position.set(12,12,-12);this.scene.add(rim);
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),material('#0b1c31',{roughness:.85}));ground.rotation.x=-Math.PI/2;ground.position.y=-.45;ground.receiveShadow=true;this.scene.add(ground);
    const grid=new THREE.GridHelper(70,35,'#174361','#113049');grid.position.y=-.44;this.scene.add(grid);
    this.buildOverlays();this.specimens=new SpecimenBatch(this.scene);this.setQuality('auto');
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);this.resize();this.bindPicking();
    this.ready=this.loadAssets();
  }
  async loadAssets(){
    try{
      const loader=new GLTFLoader();const [lab,person]=await Promise.all([loader.loadAsync('assets/models/lab-environment.glb'),loader.loadAsync('assets/models/lab-person.glb')]);
      this.environmentModel=lab.scene;lab.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});this.scene.add(lab.scene);
      this.people=new PeopleBatch(person.scene,this.scene);
      const staff=[[-10.5,3.8],[-8.4,3.8],[-4.9,4.35],[-2.9,4.35],[-.9,4.35],[6,3.25],[-8.1,-1.7],[-2.7,-3.3],[2.5,-2.8],[8.6,-3.3],[10.35,3.14]];
      staff.forEach(([x,z],i)=>this.people.add(`staff-${i}`,[x,0,z],'#e5f3f7',null,true));
      this.loaded=true;if(this.engine)this.update(this.engine,true);this.onStatus('ready');return true;
    }catch(error){console.warn('Lab assets unavailable',error);this.onStatus('error');return false;}
  }
  buildOverlays(){
    this.floorHits=[];
    for(const s of STATIONS){
      const floor=new THREE.Mesh(new THREE.PlaneGeometry(s.id==='approval'?2.5:4.4,s.id==='approval'?3:4.4),new THREE.MeshBasicMaterial({color:s.color,transparent:true,opacity:.075,depthWrite:false}));floor.rotation.x=-Math.PI/2;floor.position.set(s.x,.13,s.z);floor.userData.select={kind:'station',id:s.id};this.scene.add(floor);this.floorHits.push(floor);
      const el=document.createElement('button');el.className='station-label';el.innerHTML=`<span class="station-dot" style="background:${s.color}"></span>${s.name}<b>0</b>`;el.addEventListener('click',()=>this.onSelect({kind:'station',id:s.id}));this.labelContainer.appendChild(el);this.labels.push({el,station:s,point:new THREE.Vector3()});
    }
    this.tubeCurve=new THREE.CatmullRomCurve3([[.3,2.085,5.8],[.3,3.1,5.8],[.8,3.35,5.8],[5.4,3.35,5.85],[5.9,3.1,5.85],[5.9,2.085,5.85]].map(p=>new THREE.Vector3(...p)));
    this.pipe=new THREE.Mesh(new THREE.TubeGeometry(this.tubeCurve,64,.085,10,false),material('#72bdd5',{metalness:.55,roughness:.25,transparent:true,opacity:.45,depthWrite:false}));this.scene.add(this.pipe);
    this.carrierGeometry=new THREE.CylinderGeometry(.16,.16,.56,12);this.carrierMaterial=material('#ffcb72',{metalness:.45,roughness:.26});
    this.selectionRing=new THREE.Mesh(new THREE.RingGeometry(.37,.43,40),new THREE.MeshBasicMaterial({color:'#4bdeff',side:THREE.DoubleSide,depthTest:false,transparent:true,opacity:.9}));this.selectionRing.rotation.x=-Math.PI/2;this.selectionRing.renderOrder=4;this.selectionRing.visible=false;this.scene.add(this.selectionRing);
  }
  bindPicking(){
    const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();let down;
    this.renderer.domElement.addEventListener('pointerdown',e=>down=[e.clientX,e.clientY]);
    this.renderer.domElement.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;const rect=this.renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,this.camera);
      const targets=[...(this.people?.batches.map(b=>b.mesh)||[]),...this.specimens.batches,...[...this.trips.values()].map(t=>t.mesh),...this.floorHits];
      for(const hit of ray.intersectObjects(targets,false)){const batch=hit.object.userData.peopleBatch||hit.object.userData.specimenBatch;const selection=batch?batch.slots[hit.instanceId]?.selection:hit.object.userData.select;if(selection){this.onSelect(selection);return;}}
    });
  }
  resize(){this.dirty=true;const w=this.container.clientWidth,h=this.container.clientHeight;if(!w||!h)return;const aspect=w/h,half=Math.max(9.5,17/aspect);Object.assign(this.camera,{left:-half*aspect,right:half*aspect,top:half,bottom:-half});this.camera.updateProjectionMatrix();this.renderer.setSize(w,h,false);}
  setQuality(value){this.quality=value;this.pixelRatio=value==='high'?Math.min(devicePixelRatio,2):value==='low'?.8:Math.min(devicePixelRatio,1.4);this.renderer.setPixelRatio(this.pixelRatio);this.renderer.shadowMap.enabled=value!=='low';const size=value==='high'?2048:1024;if(this.sun.shadow.mapSize.x!==size){this.sun.shadow.map?.dispose();this.sun.shadow.map=null;this.sun.shadow.mapSize.set(size,size);}this.resize();}
  setView(top=false){this.moveCamera(top?new THREE.Vector3(0,40,.05):new THREE.Vector3(25,29,34),new THREE.Vector3(0,.2,0),1);}
  moveCamera(position,target,zoom){this.cameraMove={from:this.camera.position.clone(),to:position,targetFrom:this.controls.target.clone(),targetTo:target,zoomFrom:this.camera.zoom,zoomTo:zoom,time:0};}
  focusSelection(){let pos=this.selectedPosition();if(!pos)return false;const target=new THREE.Vector3(...pos);target.y=.5;const offset=this.camera.position.clone().sub(this.controls.target);this.moveCamera(target.clone().add(offset),target,1.65);return true;}
  setLabels(visible){this.labelContainer.hidden=!visible;}
  clear(){if(this.people)for(const [id,e]of this.people.entries)if(!e.staff)this.people.remove(id);for(const id of [...this.specimens.entries.keys()])this.specimens.remove(id);for(const t of this.trips.values()){t.mesh.visible=false;this.tripPool.push(t.mesh);}this.trips.clear();this.selection=null;}
  update(engine,initial=false){
    this.dirty=true;if(this.engine&&this.engine!==engine){this.clear();initial=true;}this.engine=engine;if(!this.loaded)return;
    const seen=new Set(),samples=new Set(),indices={},next=key=>(indices[key]=(indices[key]||0)+1)-1,resultMap=new Map();for(const r of engine.results){if(!resultMap.has(r.specimenId))resultMap.set(r.specimenId,[]);resultMap.get(r.specimenId).push(r);}
    for(const p of engine.patients){
      const collected=p.latestCollectedAt??p.collectedAt;if(p.completedAt!=null||p.status==='nextService'&&engine.time-collected>30)continue;seen.add(p.id);let x,z,seated=false;
      if(['registrationQueue','registering'].includes(p.status)){const i=next('registration');x=p.status==='registering'?-10.5+(i%2)*2.1:-11.2+(i%6)*.65;z=p.status==='registering'?5.05:6.8+Math.floor(i/6)*.5;}
      else if(['collecting','collectingRecollection'].includes(p.status)){const jobs=engine.pools.collection?.active||[],i=jobs.findIndex(j=>j.id===p.id||engine.specimen(j.id)?.patientId===p.id);x=-5.6+(Math.max(i,0)%3)*2;z=4.6;seated=true;}
      else if(p.status==='nextService'){x=4;z=6.65;}
      else{const i=next('collection');x=-5.8+(i%9)*.58;z=6.35+Math.floor(i/9)*.48;}
      const pos=[x,0,z],e=this.people.add(p.id,initial?pos:[-12,0,6.8],p.priority==='STAT'?'#e78f9f':'#459dcd',{kind:'patient',id:p.id});if(e){e.seated=seated;e.motion.setTarget(pos,{waypoints:patientRoute(e.motion.position,pos)});}
    }
    for(const [id,e]of this.people.entries)if(!e.staff&&!seen.has(id))this.people.remove(id);
    for(const s of engine.specimens){
      if(['rejected','inTransit'].includes(s.status))continue;const rs=resultMap.get(s.id)||[];if(rs.length&&rs.every(r=>r.status==='hisAvailable'))continue;let pos;
      if(['tubeQueue','courierQueue','transportHeld'].includes(s.status)){const i=next('transport');pos=[-.75+(i%7)*.23,1.13,5.3+Math.floor(i/7)*.19];}
      else if(['receptionQueue','receiving','held'].includes(s.status)){const i=next('reception');pos=[4.95+(i%7)*.23,1.16,4.45+Math.floor(i/7)*.19];}
      else if(['clotting','centrifugeQueue','centrifuging','preparing','routing'].includes(s.status)){const i=next('preparation');pos=[-9.5+(i%10)*.23,.94,-2.85+(Math.floor(i/10)%4)*.2];}
      else if(rs.length){const d=rs[0].department,base={hematology:[-2.6,1.17,-4.5],chemistry:[1.7,1.3,-3.6],urinalysis:[9.65,.98,-4.6],immunology:[2.45,.94,-6.9]}[d],i=next(d);if(base)pos=[base[0]-.4+(i%4)*.2,base[1],base[2]+(Math.floor(i/4)%3)*.15];}
      if(pos){samples.add(s.id);this.specimens.target(s.id,pos,s.status==='held'?'#ff6c82':s.type==='EDTA'?'#b193e3':s.type==='URINE'?'#f2c264':'#ed8c7d',initial);}
    }
    for(const id of [...this.specimens.entries.keys()])if(!samples.has(id))this.specimens.remove(id);
    const trips=new Set();for(const t of engine.trips){if(t.status!=='inTransit')continue;trips.add(t.id);if(!this.trips.has(t.id)){let mesh=this.tripPool.pop();if(!mesh){mesh=new THREE.Mesh(this.carrierGeometry,this.carrierMaterial);mesh.castShadow=true;this.scene.add(mesh);}mesh.visible=true;mesh.userData.select={kind:'trip',id:t.id};this.trips.set(t.id,{mesh,trip:t});}}
    for(const [id,t]of this.trips)if(!trips.has(id)){t.mesh.visible=false;this.tripPool.push(t.mesh);this.trips.delete(id);}
    this.pipe.material.color.set(engine.flags.tubeDown||!engine.config.tube.enabled?'#ff8191':'#72bdd5');
    for(const {el,station:s}of this.labels){let count=s.id==='transport'?(indices.transport||0):s.id==='preparation'?engine.spinQueue.length:s.id==='approval'?engine.metrics().approvalPending:engine.pools[s.id]?.queue.length||0;el.querySelector('b').textContent=count;el.classList.toggle('has-queue',count>0);}
  }
  selectedPosition(){const s=this.selection;if(!s)return null;if(s.kind==='station'){const station=STATIONS.find(x=>x.id===s.id);return station?[station.x,.15,station.z]:null;}const person=this.people?.entries.get(s.id);if(person)return person.root.position.toArray();const specimen=this.specimens.entries.get(s.id);if(specimen)return specimen.motion.position;const trip=this.trips.get(s.id);return trip?trip.mesh.position.toArray():null;}
  select(selection){this.dirty=true;this.selection=selection;for(const l of this.labels)l.el.classList.toggle('selected',selection?.kind==='station'&&selection.id===l.station.id);}
  snap(){this.people?.entries.forEach(e=>e.motion.snap());this.specimens.entries.forEach(e=>e.motion.snap());}
  render(dt=1/60,advancing=true){
    const changed=this.controls.update();if(!advancing&&!this.dirty&&!this.cameraMove&&!changed)return;this.dirty=false;
    const start=performance.now(),motionDt=advancing?dt:0;this.people?.tick(motionDt,this.reducedMotion);this.specimens.tick(motionDt,this.reducedMotion);
    if(this.engine)for(const {mesh,trip:t}of this.trips.values()){const f=Math.max(0,Math.min(1,(this.engine.time-t.startedAt)/(t.arrivalAt-t.startedAt)));if(t.mode==='tube'){mesh.position.copy(this.tubeCurve.getPointAt(f));mesh.quaternion.setFromUnitVectors(yAxis,this.tubeCurve.getTangentAt(f).normalize());}else{mesh.position.set(.3+f*5.4,.65,2.6);mesh.rotation.set(0,0,Math.PI/2);}}
    if(this.cameraMove){const m=this.cameraMove;m.time+=dt;const f=this.reducedMotion?1:ease(Math.min(1,m.time/.7));this.camera.position.lerpVectors(m.from,m.to,f);this.controls.target.lerpVectors(m.targetFrom,m.targetTo,f);this.camera.zoom=m.zoomFrom+(m.zoomTo-m.zoomFrom)*f;this.camera.updateProjectionMatrix();if(f===1)this.cameraMove=null;}
    this.controls.update();const pos=this.selectedPosition();this.selectionRing.visible=!!pos;if(pos){this.selectionRing.position.set(pos[0],pos[1]+.05,pos[2]);this.selectionRing.scale.setScalar(this.selection?.kind==='station'?2.5:1);}
    const w=this.container.clientWidth,h=this.container.clientHeight;for(const {el,station:s,point}of this.labels){point.set(s.x,.2,s.z+1.65).project(this.camera);el.style.left=`${(point.x*.5+.5)*w}px`;el.style.top=`${(-point.y*.5+.5)*h}px`;el.style.display=point.z>1||point.x<-1.15||point.x>1.15?'none':'';}
    this.renderer.render(this.scene,this.camera);this.frames++;this.frameTimes.push(performance.now()-start);if(this.frameTimes.length>120)this.frameTimes.shift();
    if(advancing){this.frameIntervals.push(dt*1000);if(this.frameIntervals.length>120)this.frameIntervals.shift();}
    if(advancing&&this.quality==='auto'&&this.frames%180===0&&this.frameIntervals.reduce((a,b)=>a+b,0)/this.frameIntervals.length>35&&this.pixelRatio>.8){this.pixelRatio=Math.max(.8,this.pixelRatio-.2);this.renderer.setPixelRatio(this.pixelRatio);this.resize();}
  }
  getStats(){return {loaded:this.loaded,frames:this.frames,drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,geometryBuffers:this.renderer.info.memory.geometries,people:this.people?.entries.size||0,specimens:this.specimens.entries.size,quality:this.quality,pixelRatio:this.pixelRatio,meanRenderMs:this.frameTimes.length?this.frameTimes.reduce((a,b)=>a+b,0)/this.frameTimes.length:0};}
}
