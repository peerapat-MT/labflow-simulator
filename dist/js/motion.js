// Presentation only: never writes to the clinical simulation clock or records.
export const clamp01=x=>Math.max(0,Math.min(1,x));
export const ease=x=>{const t=clamp01(x);return t*t*(3-2*t);};
const distance=(a,b)=>Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]);
export class MotionPath {
  constructor(position=[0,0,0]){this.position=[...position];this.target=[...position];this.points=[[...position]];this.lengths=[];this.total=0;this.elapsed=0;this.duration=0;this.moving=false;}
  setTarget(target,{waypoints=[],duration}={}){
    if(distance(this.target,target)<.012)return false;
    this.target=[...target];this.points=[[...this.position],...waypoints.map(p=>[...p]),[...target]];this.lengths=[];this.total=0;
    for(let i=1;i<this.points.length;i++){this.total+=distance(this.points[i-1],this.points[i]);this.lengths.push(this.total);}
    this.elapsed=0;this.duration=duration??Math.max(.25,Math.min(1.7,this.total/4.5));this.moving=this.total>.001;return true;
  }
  tick(dt,reduced=false){
    if(!this.moving||dt<=0)return this.position;
    this.elapsed+=dt;const progress=reduced?1:clamp01(this.elapsed/this.duration);const length=ease(progress)*this.total;
    let index=this.lengths.findIndex(n=>n>=length);if(index<0)index=this.lengths.length-1;
    const before=index?this.lengths[index-1]:0,segment=this.lengths[index]-before,alpha=segment?(length-before)/segment:1;
    const from=this.points[index],to=this.points[index+1];for(let axis=0;axis<3;axis++)this.position[axis]=from[axis]+(to[axis]-from[axis])*alpha;
    if(progress>=1){this.position=[...this.target];this.moving=false;}return this.position;
  }
  snap(target=this.target){this.position=[...target];this.target=[...target];this.moving=false;this.elapsed=this.duration;return this.position;}
}
export function patientRoute(from,to){
  if(Math.abs(from[0]-to[0])>1.5&&from[2]>3&&to[2]>3)return [[from[0],0,6.55],[to[0],0,6.55]];
  return [];
}
export function specimenRoute(from,to){
  if(Math.abs(from[2]-to[2])>3||Math.abs(from[0]-to[0])>5)return [[from[0],1.1,.85],[to[0],1.1,.85]];
  return [];
}
export function dampAngle(current,target,dt,speed=12){const delta=Math.atan2(Math.sin(target-current),Math.cos(target-current));return current+delta*(1-Math.exp(-speed*dt));}
