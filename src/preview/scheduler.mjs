import {CATALOG,integrateFile,integrationLibrary,prepareIntegrationWorld} from './integration.mjs'
import {bound,preparationPath,executeService} from './preparation.mjs'
import {DAY_DEFAULTS,dayConfig,initializeDay,prepareMeal,dayBindings,advanceDayState,clockLabel} from './day.mjs'
import {effectiveValue} from './state.mjs'
import {Simulation,DEFAULTS,makeWorld,bindingsFor,inspect,definition} from './runtime.mjs'

// Preview-only goal definitions. No formal goal/score tables exist in the snapshot yet.
// One autonomous goal per need; behavior.targetRules declares candidate eligibility.
export const GOAL_PRESETS=[
 {attribute:'energy',name:'恢复精力'},
 {attribute:'satiety',name:'恢复饱腹'},
 {attribute:'leisure',name:'满足娱乐'},
 {attribute:'cleanliness',name:'清洁自己'},
]
export const SCHEDULER_DEFAULTS={maxAttempts:3,failCooldownSec:30,recheckSec:2,maxCandidates:3}
const increases=['增加','增','提升至期望状态','恢复到本次目标期望','达到期望','达到本次目标期望','较高时']
export function schedulerConfig(file){
 const config=structuredClone(file.config),notes=[]
 // This exact published rule explicitly says the upstream goal supplies its expectation.
 if(file.name==='洗手池清洗自己.json')for(const n of config.graph.nodes)for(const c of n.data?.loopConditions||[])for(const r of c.rules||[]){
  if(r.id==='clean_goal_met'&&r.attribute==='cleanliness'&&r.influence==='处于指定状态时'){r.influence='达到本次目标期望';notes.push('清洗循环的“指定状态”取当前清洁目标阈值（预览映射）。')}
 }
 return {...file,config,notes}
}
export function makeScenarioWorld(lib,params,files){
 const world=makeWorld(lib,params)
 for(const f of files)for(const o of makeWorld(lib,params,f.config)){
  if(!o.placeholder||world.some(e=>e.type===o.type&&e.name===o.name))continue
  world.push({...o,id:'scene-placeholder-'+world.length})
 }
 return world
}
export class GoalScheduler{
 constructor(files,lib,world,actor,params={},settings={}){
  this.settings={...DAY_DEFAULTS,...SCHEDULER_DEFAULTS,...settings};this.files=files.map(schedulerConfig).map(f=>this.settings.dayMode?dayConfig(f):f);this.lib=integrationLibrary(lib);this.files=this.files.map(integrateFile);this.world=structuredClone(world);this.actor=actor;this.params={...DEFAULTS,...params};this.random=this.params.seed>>>0
  this.elapsed=0;this.status='ready';this.logs=[];this.active=null;this.currentFile=null;this.goal=null;this.queue=[];this.attempts=0;this.cooldowns={};this.nextCheck=0;this.completed=[];this.candidates=[];this.goalScores=[];this.handled=false
  if(this.settings.dayMode)initializeDay(this.world,this.settings);prepareIntegrationWorld(this.world);this.executionCount=0;this.statistics={};this.pendingSteps=[];this.requests=[];this.rounds=0;
  this.goals=GOAL_PRESETS.filter(g=>{const d=definition(lib,g.attribute);return d?.kind==='数值'&&d.objectTypes?.includes('partner')}).map(g=>({...g,id:g.attribute,threshold:this.params.threshold}))
 }
 log(text){this.logs.unshift({time:this.elapsed,text});this.logs=this.logs.slice(0,200)}
 randomValue(){this.random=(Math.imul(1664525,this.random)+1013904223)>>>0;return this.random/4294967296}
 pick(rows){const total=rows.reduce((n,r)=>n+r.weight,0);if(!(total>0))return null;let p=this.randomValue()*total;return rows.find(r=>(p-=r.weight)<0)||rows.at(-1)}
 value(g){if(g.kind)return this.extraValue(g);const e=this.world.find(o=>o.id===this.actor);return Number(effectiveValue(e,g.attribute))}
 satisfied(g){if(g.kind==='buff')return this.value(g)===0;return this.value(g)>=g.threshold}
 score(g){if(g.kind)return g.kind==='buff'?800:g.kind==='object'?Math.exp((100-this.value(g))/15):60;return Math.exp((100-this.value(g))/10)}
 supports(f,g){if(g.files)return g.files.includes(f.config.previewIntegration);return (f.config.behavior.targetRules||[]).some(r=>{const item=this.lib.items?.find(i=>'item:'+i.id===r.objectName);return r.source==='object:partner'&&(!r.objectName||r.objectName==='本行为伙伴'||item?.name==='行为伙伴')&&r.attribute===g.attribute&&increases.includes(r.influence)})}
 evaluate(f,g){
  const prepared=this.settings.dayMode?prepareMeal(this.world,this.actor,f.config,this.elapsed*this.settings.worldSecondsPerSecond):{world:this.world};if(prepared.error)return {file:f,reasons:[prepared.error],weight:0};const candidateWorld=prepared.world;const bindings=dayBindings(bound(f.config,this.lib,candidateWorld,this.actor),f.config,candidateWorld,this.actor),issues=inspect(f.config,this.lib,candidateWorld,bindings)
  if(issues.length)return {file:f,reasons:issues.map(i=>i.where+'：'+i.text),weight:0}
  const path=preparationPath(f,this.files,this.lib,candidateWorld,this.actor,{...this.params,stateRules:this.settings.dayMode}),reasons=path.error?[path.error]:[]
  // Explicit simulated behavior score, separate from first-round goal score.
  // Current supported paths contain one graph: average = behavior score; cost factor = 1.
  const weights=GOAL_PRESETS.filter(other=>this.supports(f,other));const weight=(weights.reduce((n,other)=>n+this.score(other),0)||60)/Math.max(1,path.steps?.length||1)
  return {file:f,reasons,steps:path.steps||[],weight:reasons.length?0:weight}
 }
 cooldown(reason){this.log(this.goal.name+'：'+reason+'；冷却 '+this.settings.failCooldownSec+' 秒');this.cooldowns[this.goal.id]=this.elapsed+this.settings.failCooldownSec;this.goal=null;this.queue=[];this.pendingSteps=[];this.status='waiting';this.nextCheck=this.elapsed+this.settings.recheckSec}
 plan(){
  this.candidates=this.files.filter(f=>this.supports(f,this.goal)).map(f=>this.evaluate(f,this.goal))
  const pool=this.candidates.filter(c=>!c.reasons.length)
  // Equal probability without replacement. Never rank candidates before narrowing.
  for(let i=pool.length-1;i>0;i--){const j=Math.floor(this.randomValue()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]]}
  const kept=pool.slice(0,this.settings.maxCandidates);for(const c of this.candidates)c.kept=kept.includes(c)
  const chosen=this.pick(kept);if(!chosen){this.cooldown('当前没有可执行的正分路径');return}
  this.pendingSteps=[...chosen.steps];this.queue=this.pendingSteps.map(f=>f.name);this.attempts++
  this.log('目标「'+this.goal.name+'」→ '+this.queue.join(' → ')+'（尝试 '+this.attempts+'/'+this.settings.maxAttempts+'）')
  this.startNext()
 }
 selectGoal(){
  this.goalScores=[...this.goals,...this.extraGoals()].map(g=>({...g,value:this.value(g),weight:this.satisfied(g)||(this.cooldowns[g.id]||0)>this.elapsed?0:this.score(g),cooldown:Math.max(0,(this.cooldowns[g.id]||0)-this.elapsed)}))
  const chosen=this.requests.shift()||this.pick(this.goalScores)
  if(!chosen){this.status='waiting';this.nextCheck=this.elapsed+this.settings.recheckSec;const reason=this.goals.every(g=>this.satisfied(g))?'所有模拟需求目标已满足，等待属性变化':'没有正分可选目标，等待失败冷却';if(this.waitReason!==reason)this.log(reason);this.waitReason=reason;return}
  this.waitReason='';this.goal=chosen;this.attempts=0;this.log('属性选目标：'+chosen.name+'（当前 '+(chosen.value??this.value(chosen))+' → '+chosen.threshold+'，目标分 '+(chosen.weight??this.score(chosen)).toFixed(1)+'）');this.plan()
 }
 finish(){
  const s=this.active;if(!s||this.handled)return;this.handled=true;this.world=structuredClone(s.world)
  // Terminal graph result returns to the external policy. Only its own reservations are released.
  for(const id of s.held){const o=this.world.find(o=>o.id===id);if(o?.occupied===this.actor)delete o.occupied}if(s.held.size)this.log('外部调度回收本次行为预约');s.held.clear()
  this.completed.push({file:this.currentFile.name,status:s.status,goal:this.goal.id,time:this.elapsed});this.completed=this.completed.slice(-1000);this.statistics[this.currentFile.name]=(this.statistics[this.currentFile.name]||0)+1
  this.rounds+=s.metrics?.rounds||0
  if(this.goal.kind==='file'&&this.goal.file===this.currentFile.name){
   this.goal.result=['done','exited'].includes(s.status)&&this.verifyFile(s);
  }
  if(s.status==='done'&&this.pendingSteps.length){this.active=null;this.startNext();return}
  this.pendingSteps=[];this.queue=[]
  if(this.satisfied(this.goal)){this.log('实际结果验证：'+this.goal.name+'已达成（'+this.value(this.goal)+'）；清空队列，重新选择目标');this.goal=null;this.status='waiting';this.nextCheck=this.elapsed+.5}
  else if(this.attempts>=this.settings.maxAttempts)this.cooldown('实际执行后仍未达成，尝试次数已用完')
  else {this.log('实际结果验证：目标未达成'+(s.error?'；'+s.error:'')+'，保留当前状态，围绕原目标重规划');this.status='waiting';this.nextCheck=this.elapsed+this.settings.recheckSec}
 }
 extraValue(g){
  const a=this.world.find(e=>e.id===this.actor),target=this.world.find(e=>e.id===g.target)
  if(g.kind==='buff')return g.id==='unstick'&&target?.stuckTool?1:(target||a).buffs[g.buff]||0
  if(g.kind==='object')return target?.attrs[g.attribute]??100
  if(g.kind==='stock')return a.inventory[g.item]||0
  if(g.kind==='rounds')return this.rounds
  if(g.kind==='file')return g.result?1:0
  return 0
 }
 extraGoals(){
  if(!this.settings.dayMode||this.settings.scenarioOnly)return []
  const a=this.world.find(e=>e.id===this.actor),list=[]
  for(const [buff,p]of [['design_dizzy','dizzy'],['buff_showoff','showoff'],['emotion_super_happy','laugh']])if(a.buffs[buff])list.push({id:buff,name:'解除'+(this.lib.buffs.find(b=>b.id===buff)?.name||buff),kind:'buff',buff,files:[p],threshold:0})
  const tree=this.world.find(e=>e.name==='乔木'&&e.type==='environmentItem');if(tree?.stuckTool||tree?.buffs.buff_be_stuck)list.push({id:'unstick',name:'解除树与斧头的卡住关系',kind:'buff',buff:'buff_be_stuck',target:tree.id,files:['unstick'],threshold:0})
  const target=this.world.find(e=>e.name==='桌子');if(target)for(const [attribute,p]of [['durability','repair'],['cleanliness','clean']])list.push({id:'object-'+attribute,name:p==='repair'?'修理桌子':'打扫桌子',kind:'object',attribute,target:target.id,files:[p],threshold:70})
  const wood=this.lib.items.find(i=>i.name==='木材');if(wood)list.push({id:'wood-stock',name:'储备50份木材',kind:'stock',item:wood.id,files:['wood','banyan'],threshold:50})
  if(this.files.some(f=>f.config.previewIntegration==='fish'))list.push({id:'fishing-rounds',name:'完成6轮钓鱼',kind:'rounds',files:['fish'],threshold:6})
  return list.filter(g=>this.files.some(f=>this.supports(f,g)))
 }
 requestBehavior(name){
  const f=this.files.find(f=>f.name===name);if(!f)return false
  this.requests.push({id:'request:'+name,name:f.config.behavior.name,kind:'file',file:name,files:[f.config.previewIntegration],threshold:1,result:false});this.log('加入目标队列：'+name);this.nextCheck=this.elapsed;return true
 }
 verifyFile(s){
  if(s.config.previewIntegration==='fish')return (s.metrics.rounds||0)>=3
  const rules=s.config.behavior.targetRules||[];return rules.length?rules.every(r=>s.condition(r)):true
 }
 startNext(){
  try{
   while(this.pendingSteps.length){
    const step=this.pendingSteps.shift();this.queue=[step.name,...this.pendingSteps.map(f=>f.name)]
    if(step.service){executeService(step,this.world,this.actor);this.log(step.name+'（公共库实例转移，缺少对应在线准备稿）');continue}
    if(this.settings.dayMode){const meal=prepareMeal(this.world,this.actor,step.config,this.elapsed*this.settings.worldSecondsPerSecond);if(meal.error)throw Error(meal.error);this.world=meal.world;if(meal.food)this.log('场景供餐：从有限库存装备 '+meal.food.name)}
    const s=new Simulation(step.config,this.lib,this.world,dayBindings(bound(step.config,this.lib,this.world,this.actor),step.config,this.world,this.actor),this.actor,{...this.params,seed:this.randomValue()*4294967296,stateRules:this.settings.dayMode,worldNow:this.elapsed*this.settings.worldSecondsPerSecond,executionId:++this.executionCount})
    if(s.status==='blocked')throw Error(s.error)
    for(const r of step.config.behavior.preconditions?.attributeRules||[])if(!s.condition(r))throw Error('执行前条件已变化：'+r.attribute)
    this.currentFile=step;this.active=s;this.handled=false;this.status='running';for(const note of step.notes||[])this.log(note);return
   }
  }catch(e){this.active=null;this.pendingSteps=[];this.queue=[];if(this.attempts>=this.settings.maxAttempts)this.cooldown(e.message);else{this.log('准备链重规划：'+e.message);this.status='waiting';this.nextCheck=this.elapsed+this.settings.recheckSec}}
 }
 clock(){return clockLabel(this.elapsed,this.settings)}
 tick(dt){
  if(!this.settings.dayMode){this.advance(dt);return}
  let remaining=Math.min(Math.max(0,dt),this.settings.daySeconds-this.elapsed)
  while(remaining>1e-8){const slice=Math.min(.1,remaining);this.advance(slice);remaining-=slice}
  if(this.elapsed>=this.settings.daySeconds-1e-7&&this.status!=='day-complete'){this.elapsed=this.settings.daySeconds;this.status='day-complete';this.log('24小时预览完成；保留当前节点与场景状态，不伪造行为完成。')}
 }
 advance(dt){
  this.elapsed+=dt
  if(this.settings.dayMode){
   const active=this.status==='running'&&this.active,world=active?this.active.world:this.world;
   advanceDayState(world,dt,this.elapsed,this.settings,this.actor,active?this.active.config.previewProfile:null,!!active,text=>this.log(text));
   this.world=world;if(active)this.active.params.worldNow=this.elapsed*this.settings.worldSecondsPerSecond;
  }
  if(this.status==='running'&&this.active){const s=this.active,previous=s.logs[0];try{s.tick(dt)}catch(e){s.status='blocked';s.error=e.message;s.log('暂停：'+e.message)}this.world=structuredClone(s.world);const end=s.logs.indexOf(previous);for(const l of s.logs.slice(0,end<0?s.logs.length:end).reverse())this.log(l.text);if(['done','blocked','exited'].includes(s.status))this.finish();return}
  if(this.elapsed<this.nextCheck)return
  if(this.goal&&this.satisfied(this.goal)){this.log('目标已满足，取消剩余步骤');this.goal=null}
  if(this.goal)this.plan();else this.selectGoal()
 }
}

