import DATA from './balance-data.json' with {type:'json'}

export const NEED_KEYS=['energy','satiety','social','leisure']
export const NEED_NAMES=['体力','饥饿满足度','社交','娱乐']
const ROUTES={'石头':'采石','木材':'伐木','肉':'钓鱼','水果':'采摘'}
const round=n=>Math.round((n+Number.EPSILON)*10000)/10000
export const minuteEffect=(value,recovery,cost,minutes)=>round(Math.max(0,Math.min(100,value+recovery/minutes)-cost/60))
export function needScore(value,weight){return Math.exp((100-Math.floor(value))/10)*weight/100}

// Spreadsheet rhythm model. These actions are numerical samples, not fabricated online graphs.
// Each tick unit is one world minute; fractional rendering ticks never settle partial minutes.
export class BalanceSimulation{
 constructor(world=[],actor='pip',options={},data=DATA){
  this.data=structuredClone(data);this.numeric=true;this.world=structuredClone(world);this.actor=actor
  this.options={days:1,start:0,...options};this.settings={dayMode:true,daySeconds:Math.max(1,Math.min(7,Math.trunc(this.options.days)))*1440}
  const initial={...data.initial,...options.initial}
  this.needs=[...initial.needs];this.materials=structuredClone(initial.materials);this.tools={...initial.tools};this.tool=initial.tool||null
  this.home=initial.home;this.hobby=initial.hobby;this.leisure=initial.leisure;this.enabled=[...initial.enabled]
  this.elapsed=0;this.settled=0;this.status='ready';this.action=null;this.pendingHome=null;this.goal=null;this.goalScores=[];this.logs=[];this.completed=[];this.statistics={};this.timeSpent={};this.skills={};this.history=[];this.lowMinutes=[0,0,0,0];this.queue=[]
  this.syncWorld();this.log('数值表 V3.2：五目标最高分竞争，动作结束后重选；每分钟结算，未运行在线图。')
 }
 profile(name){const p=this.data.actions.find(p=>p.name===name);if(!p||!Number.isInteger(p.minutes)||p.minutes<=0||!['recovery','cost','materials'].every(k=>Array.isArray(p[k])&&p[k].length===(k==='materials'?6:4)&&p[k].every(v=>Number.isFinite(v)&&v>=0)))throw Error('行为缺少完整数值参数：'+name);return p}
 log(text){this.logs.unshift({time:this.elapsed,text});this.logs.length=Math.min(this.logs.length,200)}
 clock(){const m=Math.floor(this.options.start+this.elapsed);return '第'+(Math.floor(m/1440)+1)+'天 '+String(Math.floor(m%1440/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0')}
 syncWorld(){const a=this.world.find(o=>o.id===this.actor);if(a)NEED_KEYS.forEach((k,i)=>a.attrs[k]=this.needs[i])}
 schedule(i){const minute=(this.options.start+this.settled)%1440;return this.data.schedules.find(s=>s.goal===(i===0?'睡眠日程':i===1?'用餐日程':'')&&minute>=s.start&&minute<s.end)}
 toolAvailable(tool){return ['不要求','为空','当前工具'].includes(tool)||this.tool===tool||(this.tools[tool]||0)>0}
 feasible(p){
  if(!this.toolAvailable(p.tool))return false
  if(p.quantity>0){const m=this.materials.find(m=>m.name===p.output);if(!m||m.world<=0)return false}
  return p.materials.every((qty,i)=>{const m=this.materials[i];if(m.carry+m.store>=qty)return true;const route=ROUTES[m.name];return !!route&&this.toolAvailable(this.profile(route).tool)&&m.carry+m.store+m.world>=qty})
 }
 toolStep(tool){
  if(tool==='不要求'||tool==='当前工具'||tool===this.tool)return null
  if(this.tool)return {name:'归还工具',operation:'return',tool:this.tool}
  if(tool!=='为空')return {name:'拿取并装备工具',operation:'equip',tool}
  return null
 }
 nextStep(p){
  for(let i=0;i<6;i++){const m=this.materials[i],missing=p.materials[i]-m.carry;if(missing<=0)continue
   if(m.store>0)return {name:'拿取材料',operation:'pickup',material:i,amount:Math.min(missing,m.store)}
   const route=this.profile(ROUTES[m.name]),toolStep=this.toolStep(route.tool);if(toolStep)return toolStep
   return {name:route.name,operation:'gather',material:i,amount:Math.min(missing,m.world,route.quantity)}
  }
  return this.toolStep(p.tool)||{name:p.name,operation:'main'}
 }
 select(){
  const hobby=this.profile(this.hobby),baseLeisure=needScore(this.needs[3],this.data.goals[3].weight)
  const names=[this.schedule(0)?'睡觉':'打盹',this.schedule(1)?'正餐':'小吃','社交',baseLeisure<this.data.hobbyThreshold&&this.feasible(hobby)?this.hobby:this.leisure,this.pendingHome||this.home]
  this.goalScores=this.data.goals.map((g,i)=>{const p=this.profile(names[i]),base=i===4?g.weight/100:needScore(this.needs[i],g.weight),schedule=this.schedule(i),eligible=!!this.enabled[i]&&this.feasible(p);return {...g,id:i,value:this.needs[i]??1,base,multiplier:(schedule?.percent??100)/100,weight:eligible?base*(schedule?.percent??100)/100:-1,eligible,profile:p.name}})
  const selected=this.goalScores.reduce((best,g)=>g.weight>=0&&(!best||g.weight>best.weight)?g:best,null)
  this.goal=selected;let step
  if(selected){if(selected.id===4&&!this.pendingHome)this.pendingHome=selected.profile;step=this.nextStep(this.profile(selected.profile))}
  else step={name:'等待（无候选）',operation:'main'}
  if(this.options.beforeStart)step=this.options.beforeStart(this,step,selected)
  const p=this.profile(step.name);this.action={...step,profile:p,progress:0,start:this.settled,goal:selected?.id??-1}
  if(step.operation==='main'&&p.debit==='开工')this.debit(p)
  this.queue=[step.name];this.status='running';this.log((selected?selected.name+'（'+selected.weight.toFixed(1)+'分）':'无可行目标')+' → '+step.name+(step.tool?' · '+step.tool:step.material!=null?' · '+this.materials[step.material].name+' ×'+step.amount:''))
  this.moveActor(p.name)
 }
 debit(p){p.materials.forEach((n,i)=>{if(n>this.materials[i].carry)throw Error('已备材料不足：'+this.materials[i].name);this.materials[i].carry-=n})}
 moveActor(name){
  const a=this.world.find(o=>o.id===this.actor);if(!a)return
  const pattern=/睡/.test(name)?/床/:/盹/.test(name)?/椅|凳/:/钓/.test(name)?/钓台/:/工具|材料/.test(name)?/工具柜/:/伐/.test(name)?/乔木|榕树/:null
  const target=pattern&&this.world.find(o=>o.type!=='partner'&&pattern.test(o.name))
  const zones=target?[target.x+2,target.z+2]:/餐|吃|烹/.test(name)?[48,76]:/钓/.test(name)?[70,45]:/伐|采/.test(name)?[30,26]:/工具|材料/.test(name)?[30,65]:/建筑|家具|种田/.test(name)?[69,70]:[32+(this.settled%32),61]
  ;[a.x,a.z]=zones
  if(!target&&/散步|等待/.test(name)){const i=this.world.filter(o=>o.type==='partner').findIndex(o=>o.id===this.actor);a.x+=Math.max(0,i)*1.8;a.z+=(Math.max(0,i)%3)*2.5}
 }
 finish(){
  const a=this.action,p=a.profile
  if(a.operation==='return'){this.tools[a.tool]=(this.tools[a.tool]||0)+1;this.tool=null}
  if(a.operation==='equip'){if(!(this.tools[a.tool]>0))throw Error('工具库存不足：'+a.tool);this.tools[a.tool]--;this.tool=a.tool}
  if(a.operation==='pickup'){const m=this.materials[a.material];m.store-=a.amount;m.carry+=a.amount}
  if(a.operation==='gather'){const m=this.materials[a.material];m.world-=a.amount;m.carry+=a.amount}
  if(a.operation==='main'){
   if(p.debit==='完工')this.debit(p)
   if(p.quantity>0){const m=this.materials.find(m=>m.name===p.output),n=Math.min(p.quantity,m.world);m.world-=n;m.carry+=n}
   if(a.goal===4)this.pendingHome=null
  }
  if(p.skill)this.skills[p.skill].count++
  this.statistics[p.name]=(this.statistics[p.name]||0)+1
  this.completed.push({file:p.name,status:'done',goal:a.goal,time:this.settled,start:a.start,operation:a.operation})
  this.log(p.name+'完成；重新比较五个目标，已备材料与家园待办保留。')
  this.options.afterFinish?.(this,a)
  this.action=null
 }
 minute(){
  if(!this.action)this.select()
  const a=this.action,p=a.profile
  this.needs=this.needs.map((n,i)=>minuteEffect(n,p.recovery[i],p.cost[i],p.minutes))
  this.settled++;a.progress++;this.timeSpent[p.name]=(this.timeSpent[p.name]||0)+1
  this.needs.forEach((n,i)=>{if(n<20)this.lowMinutes[i]++})
  if(p.skill){this.skills[p.skill]??={minutes:0,count:0};this.skills[p.skill].minutes++}
  this.lastProfile=this.data.actions.findIndex(x=>x.name===p.name)+1
  const done=a.progress===p.minutes
  if(done)this.finish()
  this.syncWorld();this.history.push({minute:this.settled,needs:[...this.needs],profile:this.lastProfile,done:done?1:0,goal:a.goal+1})
 }
 tick(dt){
  if(['blocked','day-complete'].includes(this.status)||!Number.isFinite(dt)||dt<=0)return
  const target=Math.min(this.settings.daySeconds,this.elapsed+dt)
  try{while(this.settled+1<=target+1e-7){this.elapsed=this.settled+1;this.minute()}this.elapsed=target;if(!this.action&&this.elapsed<this.settings.daySeconds)this.select();if(this.elapsed>=this.settings.daySeconds){this.status='day-complete';this.log('观察结束；未完成的动作只统计已用时间，不伪造完成。')}}catch(e){this.status='blocked';this.error=e.message;this.log('暂停：'+e.message)}
 }
}
export {DATA as BALANCE_DATA}
