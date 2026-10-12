// Discrete-event engine. The renderer never decides clinical/workflow state.
export const DEPARTMENTS = {
  hematology: {name:'โลหิตวิทยา',short:'CBC',tests:['Hb','WBC','Platelet'],color:'#af83e4'},
  chemistry: {name:'เคมีคลินิก',short:'CHEM',tests:['Glucose','Creatinine','Potassium'],color:'#36b7b0'},
  urinalysis: {name:'จุลทรรศนศาสตร์',short:'UA',tests:['pH','Protein','RBC'],color:'#d0a535'},
  immunology: {name:'ภูมิคุ้มกันวิทยา',short:'IMMUNO',tests:['TSH','CRP'],color:'#648ee6'},
};
export const DEFAULT_CONFIG = {
  facility:'ห้องปฏิบัติการจำลอง · อำนาจเจริญ',basis:'assumed',notes:'ค่าตั้งต้นเพื่อทดลองระบบ ยังไม่ได้ปรับเทียบกับข้อมูลโรงพยาบาล',
  seed:2026,arrivalSeconds:52,arrivalEnabled:true,statPercent:12,urinePercent:35,immunePercent:24,rejectPercent:2,
  registrationStaff:2,registrationSeconds:40,phlebotomyStaff:3,collectionSeconds:95,urineCollectionSeconds:150,
  receptionStaff:2,receptionSeconds:35,routingSeconds:15,clotSeconds:180,edtaPrepSeconds:20,urinePrepSeconds:60,centrifugeCapacity:6,centrifugeSeconds:240,centrifugeWaitSeconds:60,
  tube:{enabled:true,interval:75,capacity:8,travel:35,returnSeconds:35,carriers:2,allowed:{EDTA:true,SERUM:true,URINE:false},routes:{collectionReception:true},fallback:true,fallbackAfter:180},
  courier:{interval:120,capacity:12,travel:90,returnSeconds:60,carriers:1},
  analyzers:{hematology:2,chemistry:2,urinalysis:1,immunology:1},
  analysisSeconds:{hematology:95,chemistry:180,urinalysis:75,immunology:180},
  reviewers:2,reviewSeconds:40,approvers:1,approvalSeconds:60,autoApprove:true,autoNotify:true,
  hisDelay:8,hisDisplayDelay:4,retrySeconds:30,routineSla:3600,statSla:1800,
};
const numericBounds={seed:[1,4294967295],arrivalSeconds:[5,3600],statPercent:[0,100],urinePercent:[0,100],immunePercent:[0,100],rejectPercent:[0,100],registrationStaff:[1,20],registrationSeconds:[1,3600],phlebotomyStaff:[1,30],collectionSeconds:[1,3600],urineCollectionSeconds:[1,7200],receptionStaff:[1,20],receptionSeconds:[1,3600],routingSeconds:[0,3600],clotSeconds:[0,7200],edtaPrepSeconds:[0,7200],urinePrepSeconds:[0,7200],centrifugeCapacity:[1,100],centrifugeSeconds:[1,7200],centrifugeWaitSeconds:[1,3600],reviewers:[1,30],reviewSeconds:[1,3600],approvers:[1,30],approvalSeconds:[1,3600],hisDelay:[1,600],hisDisplayDelay:[0,600],retrySeconds:[1,600],routineSla:[60,86400],statSla:[60,86400]};
export function validateConfig(input={}){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('รูปแบบการตั้งค่าต้องเป็น JSON object');
  const c=structuredClone(DEFAULT_CONFIG);
  for(const key of Object.keys(numericBounds)){if(input[key]!==undefined){const n=Number(input[key]);const [lo,hi]=numericBounds[key];if(!Number.isFinite(n)||n<lo||n>hi)throw new Error(`${key}: ต้องอยู่ระหว่าง ${lo}–${hi}`);c[key]=n;}}
  for(const key of ['arrivalEnabled','autoApprove','autoNotify'])if(input[key]!==undefined){if(typeof input[key]!=='boolean')throw new Error(`${key}: ต้องเป็น true/false`);c[key]=input[key];}
  for(const key of ['facility','notes'])if(input[key]!==undefined)c[key]=String(input[key]).slice(0,300);
  if(input.basis!==undefined){if(!['assumed','local'].includes(input.basis))throw new Error('basis ต้องเป็น assumed หรือ local');c.basis=input.basis;}
  for(const mode of ['tube','courier'])if(input[mode]){
    for(const key of ['interval','capacity','travel','returnSeconds','carriers','fallbackAfter'])if(input[mode][key]!==undefined&&key in c[mode]){
      const n=Number(input[mode][key]),lo=key==='returnSeconds'?0:1,hi=['capacity','carriers'].includes(key)?100:7200;
      if(!Number.isFinite(n)||n<lo||n>hi)throw new Error(`${mode}.${key}: ต้องอยู่ระหว่าง ${lo}–${hi}`);c[mode][key]=n;
    }
    for(const key of ['enabled','fallback'])if(input[mode][key]!==undefined&&key in c[mode]){if(typeof input[mode][key]!=='boolean')throw new Error(`${mode}.${key}: ต้องเป็น true/false`);c[mode][key]=input[mode][key];}
    for(const key of ['allowed','routes'])if(input[mode][key]&&c[mode][key])for(const name of Object.keys(c[mode][key]))if(input[mode][key][name]!==undefined){if(typeof input[mode][key][name]!=='boolean')throw new Error(`${mode}.${key}.${name}: ต้องเป็น true/false`);c[mode][key][name]=input[mode][key][name];}
  }
  for(const group of ['analyzers','analysisSeconds'])if(input[group])for(const d of Object.keys(DEPARTMENTS))if(input[group][d]!==undefined){const n=Number(input[group][d]);if(!Number.isFinite(n)||n<1||n>(group==='analyzers'?20:86400))throw new Error(`${group}.${d}: ค่าไม่ถูกต้อง`);c[group][d]=n;}
  for(const group of ['tube','courier'])for(const key of ['capacity','carriers'])if(!Number.isInteger(c[group][key]))throw new Error(`${group}.${key}: ต้องเป็นจำนวนเต็ม`);
  for(const key of ['seed','registrationStaff','phlebotomyStaff','receptionStaff','centrifugeCapacity','reviewers','approvers'])if(!Number.isInteger(c[key]))throw new Error(`${key}: ต้องเป็นจำนวนเต็ม`);
  for(const v of Object.values(c.analyzers))if(!Number.isInteger(v))throw new Error('จำนวนเครื่องตรวจต้องเป็นจำนวนเต็ม');
  return c;
}
export function formatClock(seconds){const n=Math.floor(seconds+8*3600);return `${String(Math.floor(n/3600)%24).padStart(2,'0')}:${String(Math.floor(n/60)%60).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;}
export function duration(seconds){if(seconds===undefined||seconds===null||!Number.isFinite(seconds))return '—';return seconds<60?`${Math.round(seconds)} วินาที`:`${(seconds/60).toFixed(1)} นาที`;}
export function quantile(items,q){if(!items.length)return null;const a=[...items].sort((x,y)=>x-y);const p=(a.length-1)*q,i=Math.floor(p);return a[i]+(a[Math.min(i+1,a.length-1)]-a[i])*(p-i);}
const prioritySort=(a,b)=>(a.priority==='STAT'?0:1)-(b.priority==='STAT'?0:1)||a.queuedAt-b.queuedAt;
export class LabEngine{
  constructor(config={}){
    this.config=validateConfig(config);this.time=0;this.randomState=this.config.seed;this.serial=0;this.events=[];
    this.patients=[];this.specimens=[];this.results=[];this.trips=[];this.audit=[];this.messages=[];this.pools={};this.spinQueue=[];this.spinBusy=false;this.spinWaitScheduled=false;
    this.flags={tubeDown:false,hisDown:false,chemistryDown:false,qc:{hematology:true,chemistry:true,urinalysis:true,immunology:true}};
    this.counters={rejected:0,recollect:0,reruns:0,interfaceRetries:0};this.arrivalGeneration=0;
    this.schedule(0,'arrival',{generation:0});this.schedule(this.config.tube.interval,'dispatch',{mode:'tube'});this.schedule(this.config.courier.interval,'dispatch',{mode:'courier'});
  }
  random(){let t=this.randomState+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;}
  schedule(delay,type,data={}){const event={at:this.time+Math.max(0,delay),type,data,serial:this.serial++};let low=0,high=this.events.length;while(low<high){const mid=(low+high)>>>1;if(this.events[mid].at<=event.at)low=mid+1;else high=mid;}this.events.splice(low,0,event);return event;}
  advance(seconds){if(!Number.isFinite(seconds)||seconds<0)throw new Error('เวลาไม่ถูกต้อง');const end=this.time+seconds;let iterations=0;while(this.events.length&&this.events[0].at<=end){const e=this.events.shift();this.time=e.at;this.handle(e.type,e.data);if(++iterations>200000)throw new Error('เกินขอบเขตเหตุการณ์ต่อการเดินเวลา');}this.time=end;}
  log(flow,label,entity=null,detail=''){
    const e={at:this.time,flow,label,detail,patientId:entity?.patientId||entity?.id?.startsWith('P-')&&entity.id||null,encounterId:entity?.encounterId||null,orderId:entity?.orderId||null,specimenId:entity?.specimenId||entity?.id?.startsWith('S-')&&entity.id||null,resultId:entity?.id?.startsWith('R-')?entity.id:null};
    this.audit.push(e);if(this.audit.length>10000)this.audit.splice(0,1000);if(entity){entity.history??=[];entity.history.push(e);}return e;
  }
  patient(id){return this.patients.find(p=>p.id===id);} specimen(id){return this.specimens.find(s=>s.id===id);} result(id){return this.results.find(r=>r.id===id);}
  spawnPatient(options={}){
    if(this.patients.length>=2000){if(this.config.arrivalEnabled){this.config.arrivalEnabled=false;this.log('system','ครบ 2,000 ผู้รับบริการ · หยุดการเข้าใหม่เพื่อคุมขนาดรอบ');}return null;}
    const n=this.patients.length+1,code=String(n).padStart(4,'0');
    const p={id:`P-${code}`,patientId:`P-${code}`,encounterId:`V-${code}`,orderId:`O-${code}`,name:`ผู้รับบริการ ${String(n).padStart(3,'0')}`,age:options.age||18+Math.floor(this.random()*65),priority:options.priority|| (this.random()*100<this.config.statPercent?'STAT':'ROUTINE'),departments:options.departments||['hematology','chemistry',...(this.random()*100<this.config.urinePercent?['urinalysis']:[]),...(this.random()*100<this.config.immunePercent?['immunology']:[])],status:'registrationQueue',createdAt:this.time,history:[]};
    if(p.departments.some(d=>!DEPARTMENTS[d]))throw new Error('ห้องตรวจไม่ถูกต้อง');
    this.patients.push(p);this.log('patient','ขึ้นบัตร · เข้าคิวลงทะเบียน',p);this.enqueue('registration',p.id,p.priority,'registration',this.config.registrationSeconds);return p;
  }
  capacity(name){return ({registration:this.config.registrationStaff,collection:this.config.phlebotomyStaff,reception:this.config.receptionStaff,review:this.config.reviewers,approval:this.config.approvers})[name]||this.config.analyzers[name]||1;}
  enqueue(pool,id,priority,stage,seconds,version=null){const p=this.pools[pool]??={queue:[],active:[],busySeconds:0,peakQueue:0};p.queue.push({id,priority,stage,seconds,version,generation:this.result(id)?.generation??0,queuedAt:this.time});p.queue.sort(prioritySort);p.peakQueue=Math.max(p.peakQueue,p.queue.length);this.pump(pool);}
  pump(name){const p=this.pools[name];if(!p)return;if(DEPARTMENTS[name]&&(!this.flags.qc[name]||(name==='chemistry'&&this.flags.chemistryDown)))return;
    while(p.active.length<this.capacity(name)&&p.queue.length){const job=p.queue.shift();const result=this.result(job.id);if(job.version!==null&&(!result||result.version!==job.version||(result.generation??0)!==job.generation))continue;job.startedAt=this.time;p.active.push(job);this.startJob(job);this.schedule(job.seconds,'jobDone',{pool:name,job});}
  }
  startJob(job){const p=this.patient(job.id),s=this.specimen(job.id),r=this.result(job.id);
    if(job.stage==='registration'){p.status='registering';this.log('patient','กำลังลงทะเบียน / ยืนยันครั้งรับบริการ',p);}
    if(job.stage==='collection'){p.status='collecting';p.collectionStart=this.time;this.log('patient','เรียกเจาะเลือด · ยืนยันตัวผู้ป่วย',p);}
    if(job.stage==='recollection'){const patient=this.patient(s.patientId);patient.status='collectingRecollection';s.status='recollecting';s.recollectionStart=this.time;this.log('patient','เรียกผู้ป่วยกลับมาเก็บตัวอย่างใหม่',patient);}
    if(job.stage==='reception'){s.status='receiving';this.log('specimen','ตรวจสอบรหัส ชนิด ปริมาณ และสภาพตัวอย่าง',s);}
    if(job.stage==='analysis'){r.status='analyzing';r.analysisStart=this.time;this.log('specimen',`เริ่มวิเคราะห์ · ${DEPARTMENTS[r.department].name}`,r);}
    if(job.stage==='review'){r.status='verifying';this.log('data','ตรวจสอบผลภายใน LIS',r);}
    if(job.stage==='approval'){r.status='approving';this.log('data','ผู้มีสิทธิ์กำลังอนุมัติผล',r);}
  }
  handle(type,data){
    if(type==='arrival'){if(data.generation!==this.arrivalGeneration)return;if(this.config.arrivalEnabled){this.spawnPatient();this.schedule(this.config.arrivalSeconds*(.65+this.random()*.7),'arrival',data);}return;}
    if(type==='jobDone'){const pool=this.pools[data.pool],i=pool.active.indexOf(data.job);if(i<0)return;pool.active.splice(i,1);pool.busySeconds+=this.time-data.job.startedAt;this.completeJob(data.job);this.pump(data.pool);return;}
    if(type==='otherCollected'){const p=this.patient(data.patientId);this.createSpecimen(p,'URINE',p.departments.filter(d=>d==='urinalysis'));return;}
    if(type==='dispatch'){this.dispatch(data.mode);this.schedule(this.config[data.mode].interval,'dispatch',data);return;}
    if(type==='fallback'){const s=this.specimen(data.id);if(s?.status==='tubeQueue'&&this.config.tube.fallback&&this.time-s.collectedAt>=this.config.tube.fallbackAfter)this.sendBackup(s.id);return;}
    if(type==='tripArrive'){const t=this.trips.find(t=>t.id===data.id);if(!t)return;t.status='returning';for(const id of t.specimenIds){const s=this.specimen(id);s.arrivedAt=this.time;s.status='receptionQueue';this.log('specimen','ถึงจุดรับสิ่งส่งตรวจ · รอรับเข้าระบบ',s,`${t.id} / ${t.mode==='tube'?'กระสวย':'เจ้าหน้าที่นำส่ง'}`);this.enqueue('reception',s.id,s.priority,'reception',this.config.receptionSeconds);}this.schedule(this.config[t.mode].returnSeconds,'tripReturn',data);return;}
    if(type==='tripReturn'){const t=this.trips.find(t=>t.id===data.id);if(t)t.status='complete';return;}
    if(type==='readyPrep'){const s=this.specimen(data.id);if(!s)return;s.status='centrifugeQueue';this.spinQueue.push(s.id);this.log('specimen','รอปั่นแยก · รวม batch',s);this.pumpSpin();return;}
    if(type==='spinStart'){this.spinWaitScheduled=false;this.pumpSpin(true);return;}
    if(type==='spinDone'){this.spinBusy=false;for(const id of data.ids){const s=this.specimen(id);s.preparedAt=this.time;this.log('specimen','ปั่นแยกเสร็จ / เตรียมสิ่งส่งตรวจ',s);this.routeAnalysis(s);}this.pumpSpin();return;}
    if(type==='routeAnalysis'){const s=this.specimen(data.id);if(s){s.preparedAt=this.time;this.routeAnalysis(s);}return;}
    if(type==='notify'){const r=this.result(data.id);if(r&&r.version===data.version&&(r.generation??0)===(data.generation??0))this.notifyCritical(data.id,'ผู้รับผลจำลอง','อ่านทวนแล้ว');return;}
    if(type==='sendAck'){this.receiveAck(data);return;}
    if(type==='retry'){const r=this.result(data.id);if(r&&r.version===data.version&&r.status==='interfaceError')this.sendHis(r);return;}
    if(type==='hisDisplay'){const r=this.result(data.id);if(!r||r.version!==data.version||r.status!=='hisStored')return;r.status='hisAvailable';r.hisAt=this.time;this.log('data','ผลตรวจแสดงใน HIS',r,`ACK ${data.messageId} · v${r.version}`);this.updatePatientComplete(r.patientId);return;}
  }
  completeJob(job){
    const p=this.patient(job.id),s=this.specimen(job.id),r=this.result(job.id);if(job.version!==null&&(r?.version!==job.version||(r.generation??0)!==job.generation))return;
    if(job.stage==='registration'){p.registeredAt=this.time;p.status='collectionQueue';this.log('patient','ยื่นบัตรห้องเจาะเลือด / ตรวจคำสั่งตรวจ',p);this.enqueue('collection',p.id,p.priority,'collection',this.config.collectionSeconds);}
    if(job.stage==='collection'){
      p.collectedAt=this.time;p.status='nextService';this.log('patient','เก็บเลือดเสร็จ · ไปขั้นตอนรับบริการถัดไป',p);
      if(p.departments.includes('hematology'))this.createSpecimen(p,'EDTA',['hematology']);
      const serum=p.departments.filter(d=>['chemistry','immunology'].includes(d));if(serum.length)this.createSpecimen(p,'SERUM',serum);
      if(p.departments.includes('urinalysis'))this.schedule(this.config.urineCollectionSeconds,'otherCollected',{patientId:p.id});
    }
    if(job.stage==='recollection'){const patient=this.patient(s.patientId);patient.status='nextService';patient.latestCollectedAt=this.time;s.collectedAt=this.time;this.log('patient','เก็บตัวอย่างใหม่เสร็จ · รับบริการถัดไป',patient);this.log('specimen','เก็บใหม่และยืนยัน barcode ใหม่',s,`แทน ${s.replaces}`);this.prepareTransport(s);}
    if(job.stage==='reception'){
      if(s.quality!=='acceptable'){s.status='held';this.log('specimen','พักสิ่งส่งตรวจ · ต้องพิจารณาเก็บใหม่',s,s.quality==='identity'?'รหัสบนภาชนะไม่ตรงคำสั่งตรวจ':'คุณภาพตัวอย่างไม่ผ่านเกณฑ์จำลอง');return;}
      s.receivedAt=this.time;s.status='routing';this.log('specimen','รับสิ่งส่งตรวจ / กระจายไปห้องตรวจ',s);
      if(s.type==='SERUM'){s.status='clotting';const wait=Math.max(0,s.collectedAt+this.config.clotSeconds-this.time);this.log('specimen','รอครบเวลาเตรียม serum ตามค่าที่กำหนด',s);this.schedule(wait+this.config.routingSeconds,'readyPrep',{id:s.id});}
      else{ s.status='preparing';this.schedule(this.config.routingSeconds+(s.type==='URINE'?this.config.urinePrepSeconds:this.config.edtaPrepSeconds),'routeAnalysis',{id:s.id});}
    }
    if(job.stage==='analysis'){
      if(!this.flags.qc[r.department]){r.status='qcHeld';this.log('data','พักผล · QC ไม่ผ่าน ต้องตรวจซ้ำหลังแก้ไข',r);return;}
      r.analysisEnd=this.time;r.values=this.generateValues(r);r.status='lisDraft';r.lisAt=this.time;r.critical=r.values.some(v=>v.critical);r.criticalStatus=r.critical?'pending':'none';
      this.log('data','รายงานผล = บันทึกผลภายใน LIS',r,`v${r.version} · ยังไม่ส่ง HIS`);
      if(r.critical){this.log('data','พบค่าวิกฤต · รอแจ้ง/อ่านทวน',r);if(this.config.autoNotify)this.schedule(30,'notify',{id:r.id,version:r.version,generation:r.generation??0});}
      this.enqueue('review',r.id,r.priority,'review',this.config.reviewSeconds,r.version);
    }
    if(job.stage==='review'){r.verifiedAt=this.time;r.status='awaitingApproval';this.log('data','ตรวจสอบผลแล้ว · รอผู้มีสิทธิ์อนุมัติ',r);if(this.config.autoApprove)this.approve(r.id,'ผู้อนุมัติจำลอง');}
    if(job.stage==='approval'){
      if(!this.flags.qc[r.department]){r.status='qcHeld';this.log('data','ยกเลิกการปล่อยผล · QC ไม่ผ่าน',r);return;}
      r.approvedAt=this.time;r.status='approved';this.log('data','อนุมัติผล / พร้อมปล่อยผลจาก LIS',r,`v${r.version} · ${r.approver}`);this.sendHis(r);
    }
  }
  createSpecimen(p,type,departments,options={}){
    const s={id:`S-${String(this.specimens.length+1).padStart(5,'0')}`,patientId:p.id,encounterId:p.encounterId,orderId:p.orderId,type,departments,priority:p.priority,collectedAt:this.time,status:'collected',quality:options.quality||p.forceQuality|| (this.random()*100<this.config.rejectPercent?'hemolysis':'acceptable'),history:[],...options};
    this.specimens.push(s);this.log('specimen',`เก็บและติด barcode · ${type}`,s);this.prepareTransport(s);return s;
  }
  prepareTransport(s){const allowed=this.config.tube.allowed[s.type]&&this.config.tube.routes.collectionReception;
    s.status=allowed?'tubeQueue':this.config.tube.fallback?'courierQueue':'transportHeld';
    this.log('specimen',s.status==='tubeQueue'?'รอเที่ยวกระสวย':s.status==='courierQueue'?'รอส่งสำรอง · เส้นทางกระสวยไม่อนุญาต':'พักขนส่ง · ต้องเลือกการนำส่ง',s);
    if(s.status==='tubeQueue')this.schedule(this.config.tube.fallbackAfter,'fallback',{id:s.id});
  }
  sendBackup(id){const s=this.specimen(id);if(!s||!['tubeQueue','transportHeld'].includes(s.status))return false;s.status='courierQueue';this.log('specimen','เปลี่ยนเป็นการส่งสำรองโดยเจ้าหน้าที่',s);return true;}
  dispatch(mode){const cfg=this.config[mode];if(mode==='tube'&&(!cfg.enabled||this.flags.tubeDown||!cfg.routes.collectionReception))return;
    const active=this.trips.filter(t=>t.mode===mode&&t.status!=='complete').length;if(active>=cfg.carriers)return;
    let queue=this.specimens.filter(s=>s.status===(mode==='tube'?'tubeQueue':'courierQueue'));
    if(mode==='tube'){for(const s of queue)if(!cfg.allowed[s.type]){s.status=cfg.fallback?'courierQueue':'transportHeld';this.log('specimen','ชนิดตัวอย่างไม่อยู่ในเส้นทางกระสวยที่อนุญาต',s);}queue=queue.filter(s=>s.status==='tubeQueue');}
    queue.sort((a,b)=>prioritySort({...a,queuedAt:a.collectedAt},{...b,queuedAt:b.collectedAt}));const batch=queue.slice(0,cfg.capacity);if(!batch.length)return;
    const t={id:`T-${String(this.trips.length+1).padStart(4,'0')}`,mode,specimenIds:batch.map(s=>s.id),startedAt:this.time,arrivalAt:this.time+cfg.travel,returnAt:this.time+cfg.travel+cfg.returnSeconds,status:'inTransit',capacity:cfg.capacity};this.trips.push(t);
    for(const s of batch){s.status='inTransit';s.transportMode=mode;s.tripId=t.id;s.dispatchedAt=this.time;this.log('specimen',mode==='tube'?'ออกเที่ยวกระสวย':'เจ้าหน้าที่นำส่งออกเดินทาง',s,`${t.id} · ${batch.length}/${cfg.capacity}`);}this.schedule(cfg.travel,'tripArrive',{id:t.id});
  }
  recollect(id){const s=this.specimen(id);if(!s||s.status!=='held')return false;s.status='rejected';s.rejectedAt=this.time;this.counters.rejected++;this.counters.recollect++;this.log('specimen','ปฏิเสธสิ่งส่งตรวจ / ขอเก็บใหม่',s,s.quality);const p=this.patient(s.patientId);p.status='recollectionQueue';
    const replacement={id:`S-${String(this.specimens.length+1).padStart(5,'0')}`,patientId:p.id,encounterId:p.encounterId,orderId:p.orderId,type:s.type,departments:[...s.departments],priority:p.priority,quality:'acceptable',replaces:s.id,status:'recollectionQueue',collectedAt:null,history:[]};this.specimens.push(replacement);s.replacedBy=replacement.id;this.log('specimen','ออกคำขอเก็บใหม่ · รอคิวเก็บตัวอย่าง',replacement,`แทน ${s.id}`);this.enqueue('collection',replacement.id,p.priority,'recollection',s.type==='URINE'?this.config.urineCollectionSeconds:this.config.collectionSeconds);return replacement;
  }
  pumpSpin(force=false){if(this.spinBusy||!this.spinQueue.length)return;if(this.spinQueue.length<this.config.centrifugeCapacity&&!force){if(!this.spinWaitScheduled){this.spinWaitScheduled=true;this.schedule(this.config.centrifugeWaitSeconds,'spinStart');}return;}
    this.spinBusy=true;const ids=this.spinQueue.splice(0,this.config.centrifugeCapacity);this.spinIds=ids;this.spinStartedAt=this.time;this.spinEnd=this.time+this.config.centrifugeSeconds;
    for(const id of ids){const s=this.specimen(id);s.status='centrifuging';this.log('specimen','กำลังปั่นแยกสิ่งส่งตรวจ',s,`batch ${ids.length}/${this.config.centrifugeCapacity}`);}this.schedule(this.config.centrifugeSeconds,'spinDone',{ids});
  }
  routeAnalysis(s){s.status='distributed';for(const [index,department] of s.departments.entries()){
    let analyticalSpecimen=s;
    if(index>0){analyticalSpecimen={...s,id:`S-${String(this.specimens.length+1).padStart(5,'0')}`,parentId:s.id,departments:[department],status:'distributed',history:[]};this.specimens.push(analyticalSpecimen);this.log('specimen','แบ่ง aliquot พร้อมรหัสเชื่อมหลอดต้นทาง',analyticalSpecimen,`parent ${s.id}`);}
    const r={id:`R-${String(this.results.length+1).padStart(5,'0')}`,patientId:s.patientId,encounterId:s.encounterId,orderId:s.orderId,specimenId:analyticalSpecimen.id,department,priority:s.priority,status:'analysisQueue',version:1,versions:[],history:[],collectedAt:s.collectedAt,receivedAt:s.receivedAt,attempts:0};this.results.push(r);this.log('specimen',`เข้าคิวเครื่องตรวจ · ${DEPARTMENTS[department].name}`,r);this.enqueue(department,r.id,r.priority,'analysis',this.config.analysisSeconds[department],r.version);
  }}
  generateValues(r){const x=this.random(),critical=x<.035;const round=n=>Math.round(n*100)/100;
    const definitions={
      hematology:[['Hb',round(11+x*4),'g/dL',false],['WBC',round(4+x*7),'10³/µL',false],['Platelet',critical?38:Math.round(150+x*200),'10³/µL',critical]],
      chemistry:[['Glucose',Math.round(80+x*70),'mg/dL',false],['Creatinine',round(.6+x*.7),'mg/dL',false],['Potassium',critical?6.8:round(3.7+x*.9),'mmol/L',critical]],
      urinalysis:[['pH',round(5+x*3),'',false],['Protein',x>.8?'1+':'Negative','',false],['RBC',`${Math.floor(x*4)}–${Math.floor(x*4)+2}`,'/HPF',false]],
      immunology:[['TSH',round(.5+x*3.5),'µIU/mL',false],['CRP',round(1+x*8),'mg/L',false]],
    };return definitions[r.department].map(([test,value,unit,flag])=>({test,value,unit,critical:flag}));
  }
  approve(id,actor='ผู้อนุมัติฝึกปฏิบัติ'){const r=this.result(id);if(!r||r.status!=='awaitingApproval'||!r.verifiedAt||!this.flags.qc[r.department])return false;r.approver=actor;r.status='approvalQueue';this.log('data','ส่งเข้าคิวอนุมัติผล',r,actor);this.enqueue('approval',r.id,r.priority,'approval',this.config.approvalSeconds,r.version);return true;}
  notifyCritical(id,receiver,readback){const r=this.result(id);if(!r||r.criticalStatus!=='pending'||!receiver.trim()||!readback.trim())return false;r.criticalStatus='notified';r.criticalNotifiedAt=this.time;r.criticalReceiver=receiver;r.criticalReadback=readback;this.log('data','แจ้งค่าวิกฤตและบันทึกการอ่านทวน',r,`${receiver} · ${readback}`);return true;}
  sendHis(r){if(!r.approvedAt||!['approved','interfaceError'].includes(r.status))return false;r.status='sending';r.attempts++;const messageId=`MSG-${r.id}-V${r.version}`;r.messageId=messageId;this.messages.push({id:messageId,resultId:r.id,version:r.version,attempt:r.attempts,at:this.time,status:'sent'});this.log('data','ส่งผลอนุมัติจาก LIS → HIS',r,`${messageId} · attempt ${r.attempts}`);this.schedule(this.config.hisDelay,'sendAck',{id:r.id,version:r.version,messageId,attempt:r.attempts});return true;}
  receiveAck(data){const r=this.result(data.id);if(!r||r.version!==data.version||r.attempts!==data.attempt||r.status!=='sending')return;const m=[...this.messages].reverse().find(m=>m.id===data.messageId&&m.attempt===data.attempt);
    if(this.flags.hisDown){r.status='interfaceError';if(m)m.status='error';this.counters.interfaceRetries++;this.log('data','HIS ไม่ตอบรับ · เก็บใน outbox และรอ retry',r,data.messageId);this.schedule(Math.min(120,this.config.retrySeconds*2**Math.min(3,r.attempts-1)),'retry',{id:r.id,version:r.version});return;}
    r.status='hisStored';r.hisStoredAt=this.time;if(m)m.status='ack';r.releasedVersion=r.version;r.hisValues=structuredClone(r.values);this.log('data','HIS รับและบันทึกผลแล้ว (ACK)',r,data.messageId);this.schedule(this.config.hisDisplayDelay,'hisDisplay',data);
  }
  correct(id,reason='ทบทวนผลจำลอง'){const r=this.result(id);if(!r||r.status!=='hisAvailable'||!reason.trim())return false;
    r.versions.push({version:r.version,values:structuredClone(r.values),approvedAt:r.approvedAt,hisAt:r.hisAt,approver:r.approver,reason});r.version++;r.generation=(r.generation??0)+1;r.status='verifying';r.correctionReason=reason;r.approvedAt=null;r.verifiedAt=null;r.hisAt=null;r.attempts=0;r.lisAt=this.time;r.values=structuredClone(r.values);const v=r.values[0];if(typeof v.value==='number')v.value=Math.round(v.value*1.02*100)/100;
    this.patient(r.patientId).completedAt=null;this.log('data','สร้างผลแก้ไขเวอร์ชันใหม่ · เก็บผลเดิมใน audit',r,`v${r.version} · ${reason}`);this.enqueue('review',r.id,r.priority,'review',this.config.reviewSeconds,r.version);return true;
  }
  setFlag(name,value){if(name.startsWith('qc:')){const department=name.split(':')[1];if(!(department in this.flags.qc)||this.flags.qc[department]===Boolean(value))return;this.flags.qc[department]=Boolean(value);this.log('system',`QC ${DEPARTMENTS[department].name} ${value?'ผ่าน':'ไม่ผ่าน'}`);
    if(!value)for(const r of this.results.filter(r=>r.department===department&&['analysisQueue','analyzing','lisDraft','verifying','awaitingApproval','approvalQueue','approving'].includes(r.status))){r.needsRerun=r.analysisStart!=null;if(r.values){r.discardedDrafts??=[];r.discardedDrafts.push({at:this.time,values:structuredClone(r.values),reason:'QC hold'});}r.generation=(r.generation??0)+1;r.status='qcHeld';r.values=null;r.critical=false;r.criticalStatus='none';r.approvedAt=null;r.verifiedAt=null;this.log('data','พักผลและยกเลิกงานปล่อยผล · QC ไม่ผ่าน',r);}
    if(value){for(const r of this.results.filter(r=>r.department===department&&r.status==='qcHeld')){r.status='analysisQueue';r.approvedAt=null;r.verifiedAt=null;if(r.needsRerun)this.counters.reruns++;this.log('data','แก้ QC แล้ว · ส่งวิเคราะห์ใหม่',r);this.enqueue(department,r.id,r.priority,'analysis',this.config.analysisSeconds[department],r.version);}this.pump(department);this.pump('review');this.pump('approval');}return;}
    if(!(name in this.flags)||name==='qc')return;this.flags[name]=Boolean(value);this.log('system',`${name}: ${value?'ขัดข้อง':'กลับมาทำงาน'}`);if(name==='chemistryDown'&&!value)this.pump('chemistry');
    if(name==='hisDown'&&!value)for(const r of this.results.filter(r=>r.status==='interfaceError'))this.sendHis(r);
  }
  updateConfig(input){const old=this.config;this.config=validateConfig(input);this.log('system','ปรับพารามิเตอร์ระบบ',null,this.config.basis==='local'?'ค่าจากระบบจริงที่ผู้ใช้ระบุ':'ค่าจำลอง');for(const name of Object.keys(this.pools))this.pump(name);
    if(old.arrivalEnabled!==this.config.arrivalEnabled||old.arrivalSeconds!==this.config.arrivalSeconds){this.arrivalGeneration++;if(this.config.arrivalEnabled)this.schedule(this.config.arrivalSeconds,'arrival',{generation:this.arrivalGeneration});}
    if(this.config.autoApprove)for(const r of this.results.filter(r=>r.status==='awaitingApproval'))this.approve(r.id);
    if(this.config.autoNotify)for(const r of this.results.filter(r=>r.criticalStatus==='pending'))this.schedule(1,'notify',{id:r.id,version:r.version,generation:r.generation??0});
    for(const s of this.specimens.filter(s=>s.status==='tubeQueue'))this.schedule(0,'fallback',{id:s.id});
  }
  updatePatientComplete(id){const p=this.patient(id),rs=this.results.filter(r=>r.patientId===id);if(!p)return;
    const fulfilled=new Set(rs.filter(r=>r.status==='hisAvailable').map(r=>r.department));if(p.departments.every(d=>fulfilled.has(d))){p.completedAt=this.time;this.log('data','ผลครบทุกห้องตรวจ / ครั้งรับบริการเสร็จสมบูรณ์',p);}
  }
  metrics(){const complete=this.results.filter(r=>r.status==='hisAvailable'),patients=this.patients.filter(p=>p.completedAt!=null),lab=complete.map(r=>r.approvedAt-r.receivedAt),e2e=patients.map(p=>p.completedAt-p.createdAt),waiting=this.patients.filter(p=>['collectionQueue','recollectionQueue'].includes(p.status)).length;
    const populations={routine:complete.filter(r=>r.priority==='ROUTINE'),stat:complete.filter(r=>r.priority==='STAT')};const sla={};for(const [key,items] of Object.entries(populations)){const limit=key==='stat'?this.config.statSla:this.config.routineSla;sla[key]={n:items.length,onTime:items.filter(r=>r.approvedAt-r.receivedAt<=limit).length,limit};}
    return {patients:this.patients.length,completedPatients:patients.length,specimens:this.specimens.length,completedResults:complete.length,waiting,labP50:quantile(lab,.5),labP95:quantile(lab,.95),e2eP50:quantile(e2e,.5),e2eP95:quantile(e2e,.95),approvalPending:this.results.filter(r=>['awaitingApproval','approvalQueue','approving'].includes(r.status)).length,hisPending:this.results.filter(r=>['interfaceError','sending','hisStored'].includes(r.status)).length,criticalPending:this.results.filter(r=>r.criticalStatus==='pending').length,tubeQueue:this.specimens.filter(s=>s.status==='tubeQueue').length,courierQueue:this.specimens.filter(s=>s.status==='courierQueue').length,held:this.specimens.filter(s=>s.status==='held').length,sla,lab,e2e,...this.counters};
  }
  utilization(pool){const p=this.pools[pool];if(!p||!this.time)return 0;const busy=p.busySeconds+p.active.reduce((n,j)=>n+this.time-j.startedAt,0);return Math.min(100,100*busy/(this.time*this.capacity(pool)));}
  snapshot(){return {schemaVersion:1,synthetic:true,config:this.config,time:this.time,clock:formatClock(this.time),flags:this.flags,metrics:this.metrics(),patients:this.patients,specimens:this.specimens,results:this.results,trips:this.trips,messages:this.messages,audit:this.audit};}
}
export const STATUS={registrationQueue:'รอขึ้นบัตร',registering:'ลงทะเบียน',collectionQueue:'รอยื่นบัตร/เจาะเลือด',collecting:'กำลังเก็บเลือด',recollectionQueue:'รอเก็บใหม่',collectingRecollection:'กำลังเก็บตัวอย่างใหม่',recollecting:'กำลังเก็บใหม่',nextService:'เก็บเลือดแล้ว',tubeQueue:'รอเที่ยวกระสวย',courierQueue:'รอส่งสำรอง',transportHeld:'พักขนส่ง',inTransit:'กำลังนำส่ง',receptionQueue:'รอรับตัวอย่าง',receiving:'กำลังตรวจรับ',held:'พัก/ขอเก็บใหม่',rejected:'ปฏิเสธ',routing:'กำลังกระจาย',clotting:'รอเตรียม serum',centrifugeQueue:'รอปั่นแยก',centrifuging:'กำลังปั่นแยก',preparing:'เตรียมตัวอย่าง',distributed:'กระจายแล้ว',analysisQueue:'รอตรวจวิเคราะห์',analyzing:'กำลังตรวจ',qcHeld:'พักผล · QC',lisDraft:'บันทึกใน LIS',verifying:'ตรวจสอบผล',awaitingApproval:'รออนุมัติ',approvalQueue:'คิวอนุมัติ',approving:'กำลังอนุมัติ',approved:'อนุมัติแล้ว',sending:'กำลังส่ง HIS',interfaceError:'HIS error / retry',hisStored:'HIS บันทึกแล้ว',hisAvailable:'ผลถึง HIS แล้ว'};
