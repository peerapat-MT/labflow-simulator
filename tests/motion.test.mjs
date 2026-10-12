import test from 'node:test';
import assert from 'node:assert/strict';
import {MotionPath,patientRoute,dampAngle} from '../dist/js/motion.js';
test('waypoint movement is continuous, bounded, and ends exactly at destination',()=>{
 const m=new MotionPath([0,0,0]);m.setTarget([8,0,6],{waypoints:[[0,0,6]],duration:2});let before=[...m.position];
 for(let i=0;i<120;i++){m.tick(1/60);assert.ok(Math.hypot(...m.position.map((x,j)=>x-before[j]))<.4);assert.ok(m.position[2]>=0&&m.position[2]<=6);assert.ok(m.position[0]>=0&&m.position[0]<=8);before=[...m.position];}
 m.tick(.01);assert.deepEqual(m.position,[8,0,6]);assert.equal(m.moving,false);
});
test('pausing freezes animation; reduced motion snaps only during advancing presentation',()=>{
 const m=new MotionPath();m.setTarget([10,0,0]);m.tick(.1);const p=[...m.position];m.tick(0);assert.deepEqual(m.position,p);m.tick(.01,true);assert.deepEqual(m.position,[10,0,0]);
});
test('retargeting starts at the current interpolated position without a jump',()=>{
 const m=new MotionPath();m.setTarget([10,0,0],{duration:2});m.tick(.5);const before=[...m.position];m.setTarget([-4,0,3],{duration:1});assert.deepEqual(m.position,before);assert.equal(m.setTarget([-4,0,3]),false);m.tick(.016);assert.ok(Math.hypot(...m.position.map((v,i)=>v-before[i]))<.05);
});
test('frame intervals do not change final motion position and patient route uses the front aisle',()=>{
 const a=new MotionPath(),b=new MotionPath();a.setTarget([5,0,8],{duration:2});b.setTarget([5,0,8],{duration:2});for(let i=0;i<60;i++)a.tick(1/60);for(let i=0;i<30;i++)b.tick(1/30);for(let j=0;j<3;j++)assert.ok(Math.abs(a.position[j]-b.position[j])<1e-9);
 const route=patientRoute([-9,0,5.2],[-4,0,4.8]);assert.equal(route.length,2);assert.equal(route[0][2],6.55);assert.ok(Math.abs(dampAngle(Math.PI-.1,-Math.PI+.1,.1)-Math.PI)<.11);
});
