import {BalanceSimulation,BALANCE_DATA} from './balance.mjs'
import {CHARACTERS} from './runtime.mjs'

export class Colony{
 constructor(world,enabled,options={}){
  this.world=structuredClone(world);this.enabled={...enabled};this.elapsed=0;this.status='ready';this.locks=new Map();this.members={};this.conflicts=[]
  this.materials=structuredClone(BALANCE_DATA.initial.materials);this.tools={...BALANCE_DATA.initial.tools}
  for(const c of CHARACTERS){
   const s=new BalanceSimulation(this.world,c.id,{...options,beforeStart:(s,step,g)=>this.acquire(s,step,g),afterFinish:s=>this.release(s.actor)})
   s.enabled[2]=0 // No paired social interaction in this scene.
   s.tools=this.tools;s.cooldownGoals={};s.waits=0
   const feasible=s.feasible.bind(s);s.feasible=p=>feasible(p)&&!(s.cooldownGoals[p.name]>s.settled)
   this.members[c.id]=s
  }
  this.settings=this.members.pip.settings;this.publish()
 }
 keys(step){
  if(step.operation==='equip'||step.operation==='return')return ['tool:'+step.tool,'tool-rack']
  if(step.operation==='pickup')return ['warehouse']
  if(step.operation==='gather')return ['resource:'+step.material]
  if(/睡觉/.test(step.name))return ['bed']
  if(/正餐|小吃|烹饪/.test(step.name))return ['dining']
  if(/建筑|家具/.test(step.name))return ['workbench']
  if(step.name==='钓鱼')return ['fishing','resource:4']
  return []
 }
 acquire(s,step,goal){
  const keys=this.keys(step),busy=keys.find(k=>this.locks.has(k)&&this.locks.get(k)!==s.actor)
  if(busy){
   s.waits++;const text='占位等待：'+busy+' 正由其他伙伴使用'
   s.log(text);this.conflicts.push({actor:s.actor,time:this.elapsed,resource:busy});if(this.conflicts.length>200)this.conflicts.shift()
   if(s.waits>=3&&goal){s.cooldownGoals[goal.profile]=s.settled+10;s.waits=0;s.log('等待3分钟，暂避此目标10分钟并重新选择')}
   return {name:'等待（无候选）',operation:'wait'}
  }
  s.waits=0;for(const k of keys)this.locks.set(k,s.actor)
  return step
 }
 release(id){for(const [k,v]of this.locks)if(v===id)this.locks.delete(k)}
 setEnabled(id,on){
  const s=this.members[id];if(!s||this.enabled[id]===on)return
  this.enabled[id]=on
  if(!on){this.release(id);if(s.action){s.log('关闭伙伴：中断当前行为，释放占用；已发生的消耗保留');s.action=null}if(s.tool){this.tools[s.tool]++;s.tool=null}s.status='disabled'}
  else {s.elapsed=this.elapsed;s.settled=Math.floor(this.elapsed);s.status='ready';s.log('启用伙伴：从当前世界时间重新选择目标')}
  this.publish()
 }
 publish(){
  for(const c of CHARACTERS){const s=this.members[c.id],entity=s.world.find(o=>o.id===c.id),target=this.world.find(o=>o.id===c.id);if(target&&entity)Object.assign(target,structuredClone(entity),{inactive:!this.enabled[c.id],activity:this.enabled[c.id]?(s.action?.name||'等待目标'):null,activityProgress:s.action?s.action.progress/s.action.profile.minutes:0})}
 }
 view(id){const s=this.members[id]||this.members.pip;s.world=this.world;return s}
 clock(){return BalanceSimulation.prototype.clock.call({elapsed:this.elapsed,options:{start:0}})}
 tick(dt){
  if(this.status==='day-complete')return
  let left=Math.min(Math.max(0,dt),this.settings.daySeconds-this.elapsed)
  while(left>1e-8){const slice=Math.min(.1,left);this.elapsed+=slice
   const ids=CHARACTERS.map(c=>c.id),offset=Math.floor(this.elapsed)%ids.length
   for(const id of [...ids.slice(offset),...ids.slice(0,offset)]){
    if(!this.enabled[id])continue
    const s=this.members[id];s.world=this.world
    s.materials.forEach((m,i)=>{m.store=this.materials[i].store;m.world=this.materials[i].world})
    s.tick(slice)
    s.materials.forEach((m,i)=>{this.materials[i].store=m.store;this.materials[i].world=m.world})
    const a=s.world.find(o=>o.id===id),target=this.world.find(o=>o.id===id);if(a&&target)Object.assign(target,structuredClone(a))
   }
   left-=slice
  }
  this.status=this.elapsed>=this.settings.daySeconds-1e-7?'day-complete':'running'
  if(this.status==='day-complete'){this.elapsed=this.settings.daySeconds;for(const [id,s]of Object.entries(this.members))if(this.enabled[id])s.tick(Math.max(0,this.elapsed-s.elapsed))}
  this.publish()
 }
}
