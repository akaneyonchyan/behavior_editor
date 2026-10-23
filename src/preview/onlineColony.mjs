import {GoalScheduler} from './scheduler.mjs'
import {RhythmScheduler} from './rhythmScheduler.mjs'
import {CHARACTERS} from './runtime.mjs'
import {bound} from './preparation.mjs'
import {advanceDayState,clockLabel} from './day.mjs'

// One serialized shared world; each actor owns a separate goal/graph execution stack.
export class OnlineColony{
 constructor(files,lib,world,enabled,params,settings){
  this.enabled={...enabled};this.members={};this.locks=new Map();this.elapsed=0;this.status='ready'
  // This authored graph addresses another partner; exclude it from autonomous competition.
  const solo=files.filter(f=>f.name!=='向任意伙伴炫耀装备物.json')
  for(const [i,c] of CHARACTERS.entries()){
   const Scheduler=settings.rhythm?RhythmScheduler:GoalScheduler
   const s=new Scheduler(solo,lib,world,c.id,{...params,seed:(params.seed||42)+i},{...settings,skipWorldTick:true});this.members[c.id]=s
   const start=s.startNext.bind(s),finish=s.finish.bind(s),evaluate=s.evaluate.bind(s)
   const resourcesFor=steps=>{
    const resources=new Set()
    for(const step of steps){
     if(step.service){for(const o of s.world)if(o.name===step.tool||o.name==='工具柜')resources.add(o.id)}
     else for(const id of Object.values(bound(step.config,s.lib,s.world,c.id))){const o=s.world.find(o=>o.id===id);if(o&&!['partner','environmen'].includes(o.type))resources.add(id)}
    }
    return resources
   }
   const conflict=resources=>[...resources].find(id=>this.locks.has(id)&&this.locks.get(id)!==c.id)
   s.evaluate=(f,g)=>{
    const row=evaluate(f,g),busy=conflict(resourcesFor(row.steps||[]))
    if(busy){row.reasons.push((s.world.find(o=>o.id===busy)?.name||busy)+' 已被'+(CHARACTERS.find(a=>a.id===this.locks.get(busy))?.name||'其他伙伴')+'预约');row.weight=0}
    return row
   }
   s.startNext=()=>{
    const resources=resourcesFor(s.pendingSteps),busy=conflict(resources)
    if(busy){s.waitReason='占位等待：'+(s.world.find(o=>o.id===busy)?.name||busy);s.log(s.waitReason);s.status='waiting';s.nextCheck=s.elapsed+1;s.waits=(s.waits||0)+1;if(s.waits>=3){s.waits=0;s.cooldown('连续占用冲突，换目标')}return}
    s.waits=0;for(const id of resources)this.locks.set(id,c.id);start();if(!s.active&&!s.service)this.release(c.id)
   }
   s.finish=()=>{this.release(c.id);finish()}
  }
  this.world=structuredClone(this.members.pip.world);this.settings=this.members.pip.settings;this.publish()
 }
 release(id){for(const [k,v]of this.locks)if(v===id)this.locks.delete(k)}
 setEnabled(id,on){
  if(!this.members[id]||this.enabled[id]===on)return
  const s=this.members[id];this.enabled[id]=on
  if(!on){this.release(id);for(const o of this.world){if(o.occupied===id)delete o.occupied;if(o.location===id&&o.type==='equippedItem')o.location=this.world.find(o=>o.name==='工具柜')?.id||'storage'}const a=this.world.find(o=>o.id===id);if(a)a.attrs.equipped_slot_tool='0';s.active=null;s.service=null;s.goal=null;s.pendingSteps=[];s.queue=[];s.status='disabled';s.log('关闭伙伴：中断行为并释放场景占用，工具归还')}
  else {s.elapsed=this.elapsed;s.nextCheck=this.elapsed;s.status='waiting';s.log('启用伙伴，重新选择目标')}
  this.publish()
 }
 publish(){for(const [id,s]of Object.entries(this.members)){const a=this.world.find(o=>o.id===id);if(a){a.inactive=!this.enabled[id];a.activity=this.enabled[id]?(s.service?.step.name||s.active?.node()?.data.name||'等待目标'):null;a.activityProgress=s.active?.node()?s.active.progress/s.active.duration(s.active.node()):0}}}
 view(id){const s=this.members[id]||this.members.pip;s.world=this.world;return s}
 clock(){return clockLabel(this.elapsed,this.settings)}
 tick(dt){
  if(this.status==='day-complete')return
  let left=this.settings.dayMode?Math.min(dt,this.settings.daySeconds-this.elapsed):dt
  while(left>1e-8){const slice=Math.min(.1,left);this.elapsed+=slice
   if(this.settings.dayMode)advanceDayState(this.world,slice,this.elapsed,{...this.settings,skipWorldTick:false},null,null,false,()=>{})
   for(const c of CHARACTERS){if(!this.enabled[c.id])continue;const s=this.members[c.id];s.world=structuredClone(this.world);if(s.active)s.active.world=s.world;s.tick(slice);this.world=structuredClone(s.world)}
   left-=slice
  }
  this.status=this.settings.dayMode&&this.elapsed>=this.settings.daySeconds-1e-7?'day-complete':'running'
  if(this.status==='day-complete'){this.elapsed=this.settings.daySeconds;for(const [id,s]of Object.entries(this.members))if(this.enabled[id]){s.elapsed=this.elapsed;s.status='day-complete'}}
  this.publish()
 }
}
