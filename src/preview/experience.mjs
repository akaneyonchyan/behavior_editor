// Observation only: never changes world state, scheduling, or random samples.
let sequence=0
export const SOURCES={initial:['◎','初始目标'],prerequisite:['↳','前置目标'],listener:['ϟ','监听触发'],manual:['▷','手动测试'],system:['◇','系统服务'],unknown:['·','来源未记录']}
export function experience({actor,name,start=0,source='manual',goal='',parent='',trigger='',service=false}){
 return {id:'experience-'+(++sequence),actor,name,start,end:null,status:'running',source,goal,parent,trigger,service,events:[],effects:[],net:[],omitted:0,goalResult:'目标结果未记录'}
}
export function event(record,time,text,kind='node',data={}){
 if(!record)return
 const previous=record.events.at(-1)
 if(previous?.text===text&&previous.kind===kind){previous.count=(previous.count||1)+1;previous.time=time;return}
 record.events.push({id:++sequence,time,text,kind,...data})
 if(record.events.length>1000){record.events.shift();record.omitted++}
 if(kind==='branch'||kind==='condition')record.turn=text
}
const fields={location:'所在位置',stuckTool:'卡住的工具',foodRef:'食物关联',bites:'剩余口数',treasure:'宝藏存在'}
const format=(v,world)=>typeof v==='number'?Number(v.toFixed(2)):world.find(o=>o.id===v)?.name??(v===true?'是':v===false?'否':v==null||v===''||v==='0'?'无':String(v))
export function changes(before,after,lib){
 const rows=[]
 for(const obj of after){
  const old=before.find(o=>o.id===obj.id);if(!old)continue
  for(const area of ['attrs','buffs','inventory','relation']){
   const a=area==='relation'?Object.fromEntries(Object.keys(fields).map(k=>[k,old[k]])):old[area]||{},b=area==='relation'?Object.fromEntries(Object.keys(fields).map(k=>[k,obj[k]])):obj[area]||{}
   for(const key of new Set([...Object.keys(a),...Object.keys(b)])){
    const from=a[key]??(area==='buffs'||area==='inventory'?0:undefined),to=b[key]??(area==='buffs'||area==='inventory'?0:undefined)
    if(from===to||typeof from==='object'||typeof to==='object')continue
    if(typeof from==='number'&&typeof to==='number'&&Math.abs(from-to)<.00001)continue
    const defs=area==='attrs'?lib.attributes:area==='buffs'?lib.buffs:lib.items
    const name=area==='relation'?fields[key]:defs?.find(x=>x.id===key)?.name||key
    rows.push({key:obj.id+':'+area+':'+key,object:obj.name,area,name,from,to,text:obj.name+' · '+name+'：'+format(from,before)+' → '+format(to,after)+(typeof from==='number'&&typeof to==='number'?'（'+(to-from>=0?'+':'')+Number((to-from).toFixed(2))+'）':'')})
   }
  }
 }
 return rows
}
export function effect(record,rows){
 for(const row of rows){
  const delta=typeof row.from==='number'&&typeof row.to==='number'?row.to-row.from:null
  const old=record.effects.find(x=>x.key===row.key)
  if(old){old.to=row.to;old.count=(old.count||1)+1;old.delta=delta==null?null:(old.delta||0)+delta;old.text=delta==null?row.text:row.object+' · '+row.name+'：累计直接变化 '+(old.delta>=0?'+':'')+Number(old.delta.toFixed(2))}
  else record.effects.push({...row,delta})
 }
}
export function syncSimulation(s){
 const r=s.experience;if(!r)return
 r.net=changes(s.initial,s.world,s.lib);r.now=(s.recordOffset||0)+s.elapsed
 if(['done','blocked','exited'].includes(s.status)){r.status=s.status;r.end=r.now;r.reason=s.error|| (s.status==='exited'?'跳出行为，交回调度':'');}
}
export function sourceFor(s,step){
 const goal=s.goal,pre=s.pendingSteps.length>0
 return {source:pre?'prerequisite':step.service?'system':goal?.kind==='file'?'manual':goal?.kind==='buff'?'listener':'initial',goal:goal?.name||'未记录目标',parent:pre?(s.pendingSteps.at(-1)?.config?.behavior?.name||s.pendingSteps.at(-1)?.name||''):'',trigger:goal?.kind==='buff'?'调度检查发现「'+goal.name+'」，参与目标竞争；未中断其他行为':'',service:!!step.service}
}
export function addRecord(s,r){
 s.experiences??=[];s.experiences.push(r)
 if(s.experiences.length>5000){s.experiences.shift();s.omittedExperiences=(s.omittedExperiences||0)+1}
}
export function beginRecord(s,step,simulation){
 closeWaiting(s)
 s.waitReason=''
 const r=simulation?.experience||experience({actor:s.actor,name:step.config?.behavior?.name||step.name,start:s.elapsed})
 Object.assign(r,sourceFor(s,step),{start:s.elapsed,goalId:s.goal?.id,goalScore:s.goal?.weight??null,parentId:s.lastPreparation&&s.lastPreparation.goalId===s.goal?.id?s.lastPreparation.id:null})
 if(simulation){simulation.recordOffset=s.elapsed;r.name=step.config.behavior.name;for(const e of r.events)e.time+=s.elapsed}else s.serviceInitial=structuredClone(s.world||[])
 if(r.source!=='prerequisite')s.lastPreparation=null
 addRecord(s,r);s.currentExperience=r;return r
}
export function closeWaiting(s){if(s.waitExperience){s.waitExperience.end=s.elapsed;s.waitExperience.status='done';s.waitExperience=null}}
// Countdown and candidate ordering are presentation details, not new causes.
export function waitingKey(reason){return [...new Set(reason.split('；').map(x=>x.trim().replace(/冷却剩余\s*\d+(?:\.\d+)?\s*分钟/g,'冷却中')).filter(Boolean))].sort().join('；')}
export function waitingTitle(reason){
 if(!reason)return '正在选择下一个行为'
 const causes=reason.split('；').filter(Boolean)
 if(causes.every(x=>/冷却/.test(x)))return '等待目标冷却结束'
 if(causes.length>1)return '等待资源或准入条件满足'
 const occupied=reason.match(/^(?:占位等待：)(.+)$/)||reason.match(/^(.+?)\s*(?:已被.+预约|被占用)$/)
 if(occupied)return '等待「'+occupied[1].trim()+'」空闲'
 if(reason.includes('无需维护'))return '等待维护需求产生'
 if(reason.includes('已耗尽'))return '暂无可用采集资源'
 if(reason.includes('所有模拟需求目标已满足'))return '等待新的需求产生'
 return reason.length>44?reason.slice(0,44)+'…':reason
}
export function syncWaiting(s){
 // A finished action returns to scheduling for 0.1 minutes without a blocker.
 // Do not turn that internal hand-off into a partner experience.
 if(s.status!=='waiting'||!s.waitReason){closeWaiting(s);return}
 const reason=s.waitReason,key=waitingKey(reason)
 if(s.waitExperience?.waitKey!==key){closeWaiting(s);const r=experience({actor:s.actor,name:waitingTitle(reason),start:s.elapsed,source:'system'});r.kind='wait';r.waitKey=key;r.status='waiting';r.goalResult='尚未执行行为';addRecord(s,r);s.waitExperience=r}
 s.waitExperience.reason=reason
 s.waitExperience.name=waitingTitle(reason)
 s.waitExperience.now=s.elapsed
}
export function finishRecord(s,status,reason=''){
 const r=s.currentExperience;if(!r)return
 r.status=status;r.end=s.elapsed;r.reason=reason
 if(r.source==='prerequisite')s.lastPreparation={id:r.id,goalId:r.goalId}
}
