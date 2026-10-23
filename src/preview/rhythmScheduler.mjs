import {GoalScheduler} from './scheduler.mjs'
import {executeService} from './preparation.mjs'
import {schedule,applyIdle,RHYTHM_MAP} from './rhythm.mjs'
import DATA from './balance-data.json' with {type:'json'}

export class RhythmScheduler extends GoalScheduler{
 constructor(files,lib,world,actor,params={},settings={}){
  super(files,lib,world,actor,{...params,rhythm:true},{...settings,rhythm:true,startHour:0})
  this.calibrated=true;this.service=null
  this.goals=DATA.goals.map((g,i)=>({...g,scoreWeight:g.weight,id:['energy','satiety','social','leisure','home'][i],attribute:['energy','satiety','social','leisure',null][i],kind:i===4?'home':undefined,threshold:100}))
  for(const f of this.files){
   const id=f.config.previewIntegration
   if(['wood','banyan'].includes(id)){
    for(const r of f.config.behavior.targetRules||[])if(r.previewOp==='quantity')r.amount=2
    for(const n of f.config.graph.nodes)for(const c of n.data.loopConditions||[])for(const r of c.rules||[])if(r.previewOp==='quantity')r.amount=2
   }
   f.notes=(f.notes||[]).filter(n=>!n.includes('min(10')).concat(RHYTHM_MAP[id]?'节奏表补值：'+RHYTHM_MAP[id][1]:[])
  }
 }
 baseScore(g){return g.kind==='home'?100:Math.exp((100-Math.floor(this.value(g)))/10)*(g.scoreWeight||DATA.goals[['energy','satiety','social','leisure'].indexOf(g.attribute)]?.weight||100)/100}
 score(g){if(g.kind==='buff')return 800;return this.baseScore(g)*(schedule(g.attribute,this.elapsed)?.percent||100)/100}
 satisfied(g){return g.kind&&g.kind!=='home'?super.satisfied(g):false}
 supports(f,g){
  const id=f.config.previewIntegration
  if(g.id==='home')return ['wood','banyan','repair','clean','wash'].includes(id)
  if(g.id==='energy')return ['rest','chair'].includes(id)
  if(g.id==='satiety')return id==='eat'
  if(g.id==='leisure')return ['fish','play'].includes(id)
  if(g.id==='social')return false // Paired interactions are disabled; no fabricated social graph.
  return super.supports(f,g)
 }
 evaluate(f,g){
  const row=super.evaluate(f,g),id=f.config.previewIntegration
  if(g.id==='home'){
   const target=id==='wash'?this.world.find(o=>o.id===this.actor):this.world.find(o=>o.name==='桌子'),key=id==='repair'?'durability':'cleanliness'
   if(['wash','repair','clean'].includes(id)&&Number(target?.attrs[key]??100)>=70)row.reasons.push('当前无需维护')
   if(['wood','banyan'].includes(id)&&!(this.world.find(o=>o.name==='乔木')?.attrs.reczz28PBhFkUjct>0))row.reasons.push('可采产量已耗尽')
   row.weight=['wash','repair','clean'].includes(id)?200-Number(target?.attrs[key]??100):100
  }else if(g.id==='energy')row.weight=(schedule('energy',this.elapsed)?id==='rest':id==='chair')?200:100
  else if(g.id==='leisure')row.weight=(this.baseScore(g)<DATA.hobbyThreshold?id==='fish':id==='play')?200:100
  else row.weight=100
  if(row.reasons.length)row.weight=0
  return row
 }
 selectGoal(){
  const goals=[...this.goals,...super.extraGoals().filter(g=>g.kind==='buff')]
  this.goalScores=goals.map(g=>{
   const candidates=this.files.filter(f=>this.supports(f,g)).map(f=>this.evaluate(f,g)),eligible=candidates.some(c=>!c.reasons.length),cooldown=Math.max(0,(this.cooldowns[g.id]||0)-this.elapsed)
   return {...g,value:g.kind==='home'?1:this.value(g),weight:eligible&&!cooldown?this.score(g):0,base:g.kind==='buff'?800:this.baseScore(g),eligible,cooldown,candidates}
  })
  const chosen=this.requests.shift()||this.goalScores.reduce((a,g)=>g.weight>0&&(!a||g.weight>a.weight)?g:a,null)
  if(!chosen){
   this.candidates=this.goalScores.flatMap(g=>g.candidates||[])
   const reasons=[...new Set(this.candidates.flatMap(c=>c.reasons))]
   const cooling=this.goalScores.filter(g=>g.cooldown>0&&g.eligible).map(g=>g.name+'冷却剩余 '+Math.ceil(g.cooldown)+' 分钟')
   this.status='waiting';this.nextCheck=this.elapsed+1;this.waitReason=[...cooling,...reasons].join('；')||'暂无可行在线行为，等待属性或占用变化';return
  }
  this.goal=chosen;this.attempts=0;this.waitReason='';this.log('按数值表最高分选择：'+chosen.name+' · '+Number(chosen.weight||this.score(chosen)).toFixed(2));this.plan()
 }
 plan(){
  this.candidates=this.files.filter(f=>this.supports(f,this.goal)).map(f=>this.evaluate(f,this.goal))
  const chosen=this.candidates.filter(c=>!c.reasons.length).sort((a,b)=>b.weight-a.weight)[0]
  if(!chosen){this.cooldown('当前没有可行在线行为');return}
  chosen.kept=true;this.pendingSteps=[...chosen.steps];this.queue=this.pendingSteps.map(f=>f.name);this.attempts++;this.startNext()
 }
 startNext(){
  const next=this.pendingSteps[0]
  if(next?.service){this.pendingSteps.shift();this.service={step:next,progress:0,minutes:2};this.active=null;this.currentFile=null;this.status='running';this.log(next.name+' · 按拿还工具配置执行2分钟');return}
  super.startNext()
 }
 finish(){
  const goal=this.goal
  if(this.service){
   const service=this.service;try{executeService(service.step,this.world,this.actor);this.completed.push({file:service.step.name,status:'done',goal:goal?.id,time:this.elapsed});this.log(service.step.name+'完成，重新比较目标')}catch(e){this.log('准备未完成：'+e.message);if(goal)this.cooldowns[goal.id]=this.elapsed+10}
   this.service=null
  }else{
   const s=this.active;if(!s||this.handled)return;this.handled=true;this.world=structuredClone(s.world)
   for(const id of s.held){const o=this.world.find(o=>o.id===id);if(o?.occupied===this.actor)delete o.occupied}s.held.clear()
   this.completed.push({file:this.currentFile.name,status:s.status,goal:goal?.id,time:this.elapsed});this.rounds+=s.metrics.rounds||0
   if(s.status==='done')this.statistics[this.currentFile.name]=(this.statistics[this.currentFile.name]||0)+1
   if(goal?.kind==='file')goal.result=['done','exited'].includes(s.status)&&this.verifyFile(s)
   if(s.status!=='done'&&goal)this.cooldowns[goal.id]=this.elapsed+10
   this.log('在线图'+(s.status==='done'?'完成':'返回')+'；保留实际属性、装备和产物，重新竞争目标')
  }
  this.pendingSteps=[];this.queue=[];this.goal=null;this.status='waiting';this.nextCheck=this.elapsed+.1
 }
 advance(dt){
  if(this.service){this.elapsed+=dt;applyIdle(this.world,this.actor,dt);this.service.progress+=dt;if(this.service.progress>=this.service.minutes)this.finish();return}
  if(this.status!=='running'||!this.active)applyIdle(this.world,this.actor,dt)
  super.advance(dt)
 }
}
