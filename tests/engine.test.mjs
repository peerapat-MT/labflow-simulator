import test from 'node:test';
import assert from 'node:assert/strict';
import {LabEngine,validateConfig} from '../dist/js/engine.js';
const config={arrivalEnabled:false,rejectPercent:0,autoNotify:false};
function single(extra={},departments=['hematology','chemistry','urinalysis','immunology']){const e=new LabEngine({...config,...extra});e.spawnPatient({priority:'ROUTINE',departments});return e;}
test('end-to-end: all three paths, correct order, linked aliquots, results only after approval',()=>{
 const e=single();e.advance(7200);const p=e.patients[0];assert.ok(p.completedAt);assert.equal(e.results.length,4);
 for(const r of e.results){assert.equal(r.status,'hisAvailable');assert.equal(r.patientId,p.id);assert.equal(r.encounterId,p.encounterId);assert.equal(r.orderId,p.orderId);assert.ok(e.specimen(r.specimenId));assert.ok(r.collectedAt<=r.receivedAt&&r.receivedAt<=r.lisAt&&r.lisAt<=r.verifiedAt&&r.verifiedAt<=r.approvedAt&&r.approvedAt<=r.hisStoredAt&&r.hisStoredAt<=r.hisAt);assert.equal(r.releasedVersion,1);}
 const a=e.specimens.find(s=>s.parentId);assert.ok(a);assert.equal(a.orderId,e.specimen(a.parentId).orderId);assert.equal(a.patientId,p.id);
 assert.equal(e.specimens.find(s=>s.type==='URINE').transportMode,'courier');assert.equal(e.messages.filter(m=>m.status==='ack').length,4);
});
test('manual authorization holds results inside LIS; cannot approve analysis queues',()=>{
 const e=single({autoApprove:false},['hematology']);e.advance(1000);const r=e.results[0];assert.equal(r.status,'awaitingApproval');assert.equal(e.messages.length,0);assert.equal(r.releasedVersion,undefined);assert.equal(e.approve(r.id),true);assert.equal(e.approve(r.id),false);e.advance(200);assert.equal(r.status,'hisAvailable');
 const early=single({autoApprove:false},['chemistry']);early.advance(450);if(early.results.length)assert.equal(early.approve(early.results[0].id),false);
});
test('tube capacity, waiting, allowed route and carrier return constrain dispatch',()=>{
 const e=new LabEngine({...config,tube:{interval:50,capacity:2,carriers:1,travel:90,returnSeconds:50,fallback:false}});
 for(let i=0;i<8;i++){const p=e.spawnPatient({departments:['hematology']});e.createSpecimen(p,'EDTA',['hematology']);}
 e.advance(49);assert.equal(e.trips.length,0);e.advance(1);assert.equal(e.trips[0].specimenIds.length,2);e.advance(100);assert.equal(e.trips.length,1);e.advance(50);assert.equal(e.trips.length,2);assert.ok(e.trips.every(t=>t.specimenIds.length<=t.capacity));
 const x=single({tube:{routes:{collectionReception:false},fallback:true}},['hematology']);x.advance(1200);assert.equal(x.trips.filter(t=>t.mode==='tube').length,0);assert.equal(x.specimens[0].transportMode,'courier');
});
test('outage falls back after waiting threshold; in-flight trip completes',()=>{
 const e=single({tube:{interval:10,capacity:8,travel:100,fallbackAfter:150}},['hematology']);e.advance(140);assert.equal(e.trips[0].status,'inTransit');e.setFlag('tubeDown',true);e.advance(200);assert.ok(e.specimens[0].arrivedAt);const p=e.spawnPatient({departments:['hematology']});const s=e.createSpecimen(p,'EDTA',['hematology']);e.advance(149);assert.equal(s.status,'tubeQueue');e.advance(200);assert.equal(s.transportMode,'courier');
});
test('QC hold invalidates queued authorization and requires new analysis even after quick recovery',()=>{
 const e=single({autoApprove:false},['chemistry']);e.advance(1100);const r=e.results[0];assert.equal(r.status,'awaitingApproval');e.approve(r.id);assert.equal(r.status,'approving');const oldStart=r.analysisStart;e.setFlag('qc:chemistry',false);assert.equal(r.status,'qcHeld');e.setFlag('qc:chemistry',true);e.advance(60);assert.equal(e.messages.length,0);assert.ok(r.analysisStart>oldStart);e.advance(500);assert.equal(r.status,'awaitingApproval');assert.equal(e.counters.reruns,1);e.approve(r.id);e.advance(200);assert.equal(r.status,'hisAvailable');
});
test('HIS failures persist outbox, restore produces one ACK without duplicate releases',()=>{
 const e=single({},['hematology']);e.setFlag('hisDown',true);e.advance(1500);const r=e.results[0];assert.equal(r.status,'interfaceError');assert.equal(r.releasedVersion,undefined);assert.ok(e.counters.interfaceRetries>0);e.setFlag('hisDown',false);e.advance(500);assert.equal(r.status,'hisAvailable');assert.equal(e.messages.filter(m=>m.status==='ack').length,1);assert.equal(e.audit.filter(a=>a.label==='ผลตรวจแสดงใน HIS').length,1);
});
test('correction preserves original HIS result until version 2 authorized and delivered',()=>{
 const e=single({},['hematology']);e.advance(1500);const r=e.results[0],original=structuredClone(r.values);e.updateConfig({...e.config,autoApprove:false});assert.equal(e.correct(r.id,'ตรวจซ้ำ'),true);assert.equal(r.version,2);assert.equal(r.releasedVersion,1);assert.deepEqual(r.hisValues,original);e.advance(200);assert.equal(r.status,'awaitingApproval');assert.deepEqual(r.hisValues,original);e.approve(r.id);e.advance(200);assert.equal(r.releasedVersion,2);assert.equal(r.versions.length,1);assert.deepEqual(r.versions[0].values,original);
});
test('identity mismatch held at reception; replacement gets new ID linked to rejected original',()=>{
 const e=single({},['hematology']);e.patients[0].forceQuality='identity';e.advance(800);const s=e.specimens[0];assert.equal(s.status,'held');assert.equal(e.results.length,0);const requested=e.time,replacement=e.recollect(s.id);assert.equal(s.status,'rejected');assert.notEqual(replacement.id,s.id);assert.equal(replacement.replaces,s.id);assert.equal(replacement.orderId,s.orderId);assert.equal(replacement.collectedAt,null);e.advance(e.config.collectionSeconds-1);assert.equal(replacement.collectedAt,null);e.advance(1800);assert.ok(replacement.collectedAt>=requested+e.config.collectionSeconds);assert.equal(e.results.length,1);assert.equal(e.results[0].status,'hisAvailable');
});
test('critical notification is an independent audited workflow, no external sending',()=>{
 const e=single({},['chemistry']);e.generateValues=()=>[{test:'Potassium',value:6.8,unit:'mmol/L',critical:true}];e.advance(1500);const r=e.results[0];assert.equal(r.status,'hisAvailable');assert.equal(r.criticalStatus,'pending');assert.equal(e.notifyCritical(r.id,'','อ่านทวน'),false);assert.equal(e.notifyCritical(r.id,'แพทย์จำลอง','K 6.8 อ่านทวนแล้ว'),true);assert.equal(r.criticalStatus,'notified');assert.ok(r.history.some(h=>h.label.includes('อ่านทวน')));
});
test('deterministic replay: clock stepping does not change outcomes',()=>{
 const a=new LabEngine({rejectPercent:0}),b=new LabEngine({rejectPercent:0});a.advance(7200);for(let i=0;i<720;i++)b.advance(10);assert.deepEqual(a.snapshot(),b.snapshot());
});
test('validated config rejects impossible values and does not mutate defaults',()=>{
 for(const input of [{seed:NaN},{tube:{capacity:-1}},{tube:{capacity:1.5}},{analyzers:{chemistry:1.5}},{arrivalSeconds:0},{autoApprove:'false'},{tube:{allowed:{URINE:'yes'}}}])assert.throws(()=>validateConfig(input));assert.equal(validateConfig({tube:{capacity:3}}).tube.capacity,3);assert.equal(validateConfig().tube.capacity,8);
});
test('load run maintains resource capacities and unique identifiers',()=>{
 const e=new LabEngine({arrivalSeconds:15,rejectPercent:0});for(let i=0;i<180;i++){e.advance(60);for(const [name,p]of Object.entries(e.pools))assert.ok(p.active.length<=e.capacity(name));}for(const collection of [e.patients,e.specimens,e.results,e.trips])assert.equal(new Set(collection.map(x=>x.id)).size,collection.length);assert.ok(e.results.filter(r=>r.status==='hisAvailable').length>20);assert.doesNotThrow(()=>JSON.stringify(e.snapshot()));
});
