// Runtime instances only; never writes the public content library. Times are world seconds.
export const BUFF_PROFILES={
 preview_pain:{seconds:180},
 design_dizzy:{seconds:360},
 buff_10001:{group:'emotion',capacity:10,seconds:600,pad:[60,30,10]},
 buff_10003:{group:'emotion',capacity:10,seconds:600,pad:[40,60,-20]},
 emotion_surprise_pos:{group:'emotion',capacity:10,seconds:600,pad:[40,60,-20]},
 emotion_disgust:{group:'emotion',capacity:10,seconds:600,pad:[-60,-30,60]},
 mood_enraptured:{group:'emotion',capacity:10,seconds:600,pad:[30,10,-10]},
 mood_weary:{group:'emotion',capacity:10,seconds:600,pad:[-20,-10,10]},
}
export const DEFAULT_BUFF_SECONDS=600
export function buffProfile(id){
 const known=BUFF_PROFILES[id],emotion=/^(emotion_|mood_)/.test(id)
 return {seconds:DEFAULT_BUFF_SECONDS,...(emotion?{group:'emotion',capacity:10}:{}),...known,
  ...(id==='design_fishing_bait'?{group:'fishing-bait',capacity:1}:{}),
  durationBasis:['buff_10001','buff_10003'].includes(id)?'文档示例：600秒':known?'预览暂定时长':'预览暂定：600秒（原规则未提供时长）'}
}
export const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v))
export function effectiveValue(entity,attribute){
 if(!(attribute in entity.attrs))throw Error('对象不具有属性：'+attribute)
 const base=entity.attrs[attribute];if(typeof base!=='number')return base
 if(attribute==='freshness')return base
 const layers=entity.buffInstances||[];const add=layers.reduce((v,b)=>v+(b.add?.[attribute]||0),0),mul=layers.reduce((v,b)=>v*(b.multiply?.[attribute]??1),1)
 return clamp((base+add)*mul)
}
function recount(e){
 e.buffs={};for(const b of e.buffInstances)e.buffs[b.buffId]=(e.buffs[b.buffId]||0)+1
 e.pad=(e.padBase||[0,0,0]).map((v,i)=>v+e.buffInstances.reduce((n,b)=>n+(b.pad?.[i]||0),0))
}
export function addBuff(e,id,now,source,profile){
 const p={...buffProfile(id),...structuredClone(profile||{})}
 if(profile?.seconds!==undefined&&!profile.durationBasis)p.durationBasis='显式配置时长'
 if(!(p.seconds>0)||!Number.isFinite(p.seconds)||!Number.isFinite(now)||now<0||!Number.isFinite(now+p.seconds))throw Error('Buff 必须有正数的有限时长和有效获得时间')
 if(p.completions!=null&&(!Number.isInteger(p.completions)||p.completions<1||!p.nodeId))throw Error('Buff 节点完成条件必须有节点和正整数次数')
 if(p.requiredRelation&&(!p.requiredRelation.itemId||!p.requiredRelation.holderId))throw Error('Buff 持有关系必须指定物品与持有者')
 if(p.capacity!=null&&(!Number.isInteger(p.capacity)||p.capacity<1))throw Error('非法 Buff 容量')
 for(const [key,v] of Object.entries(p.add||{}))if(!(key in e.attrs)||typeof e.attrs[key]!=='number'||!Number.isFinite(v)||['freshness','weather'].includes(key))throw Error('Buff 不能修正该属性')
 for(const [key,v] of Object.entries(p.multiply||{}))if(!(key in e.attrs)||typeof e.attrs[key]!=='number'||!Number.isFinite(v)||v<0||['freshness','weather'].includes(key))throw Error('Buff 不能修正该属性')
 e.buffInstances||=[];e.buffSequence=(e.buffSequence||0)+1
 const layer={...p,id:e.buffSequence,buffId:id,source,obtained:now,expires:now+p.seconds,remaining:p.completions??null}
 e.buffInstances.push(layer)
 const group=e.buffInstances.filter(b=>b.group&&b.group===p.group).sort((a,b)=>a.obtained-b.obtained||a.id-b.id)
 const removed=p.capacity?group.slice(0,Math.max(0,group.length-p.capacity)):[]
 e.buffInstances=e.buffInstances.filter(b=>!removed.includes(b));recount(e);return layer
}
export function removeBuff(e,id){const first=e.buffInstances?.find(b=>b.buffId===id);if(first){e.buffInstances=e.buffInstances.filter(b=>b!==first);recount(e)}}
export function expireBuffs(e,now,world){
 // Old in-memory layers receive a finite deadline based on their original acquisition, never a refresh.
 for(const b of e.buffInstances||[])if(!Number.isFinite(b.expires)){const p=buffProfile(b.buffId);b.seconds=Number.isFinite(b.seconds)&&b.seconds>0?b.seconds:p.seconds;b.obtained=Number.isFinite(b.obtained)?b.obtained:now;b.expires=b.obtained+b.seconds;b.durationBasis=p.durationBasis}
 const removed=(e.buffInstances||[]).filter(b=>b.expires<=now||(b.requiredRelation&&world&&world.find(o=>o.id===b.requiredRelation.itemId)?.location!==b.requiredRelation.holderId))
 if(removed.length){e.buffInstances=e.buffInstances.filter(b=>!removed.includes(b));recount(e)}return removed
}
export function expireWorldBuffs(world,now){return world.flatMap(e=>expireBuffs(e,now,world).map(layer=>({entity:e,layer})))}
export function completeBuffNode(e,nodeId,eventId,eligibleIds){
 for(const b of e.buffInstances||[])if((!eligibleIds||eligibleIds.has(b.id))&&b.nodeId===nodeId&&b.remaining!=null&&b.lastEvent!==eventId&&!b.completedEvents?.includes(eventId)){b.remaining--;b.lastEvent=eventId;(b.completedEvents||=[]).push(eventId)}
 e.buffInstances=(e.buffInstances||[]).filter(b=>b.remaining==null||b.remaining>0);recount(e)
}
export function initializeState(world){
 for(const e of world){if(e.buffInstances){expireBuffs(e,0,world);continue}const counts={...e.buffs};e.buffInstances=[];e.padBase=[0,0,0];for(const [id,n]of Object.entries(counts))for(let i=0;i<n;i++)addBuff(e,id,0,'初始场景')}
}
