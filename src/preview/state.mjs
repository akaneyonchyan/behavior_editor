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
export function addBuff(e,id,now,source,profile=BUFF_PROFILES[id]||{}){
 const p=structuredClone(profile)
 if(p.seconds!=null&&(!(p.seconds>0)||!Number.isFinite(p.seconds)))throw Error('非法 Buff 时长')
 if(p.capacity!=null&&(!Number.isInteger(p.capacity)||p.capacity<1))throw Error('非法 Buff 容量')
 for(const [key,v] of Object.entries(p.add||{}))if(!(key in e.attrs)||typeof e.attrs[key]!=='number'||!Number.isFinite(v)||['freshness','weather'].includes(key))throw Error('Buff 不能修正该属性')
 for(const [key,v] of Object.entries(p.multiply||{}))if(!(key in e.attrs)||typeof e.attrs[key]!=='number'||!Number.isFinite(v)||v<0||['freshness','weather'].includes(key))throw Error('Buff 不能修正该属性')
 e.buffInstances||=[];e.buffSequence=(e.buffSequence||0)+1
 const layer={...p,id:e.buffSequence,buffId:id,source,obtained:now,expires:p.seconds==null?null:now+p.seconds,remaining:p.completions??null}
 e.buffInstances.push(layer)
 const group=e.buffInstances.filter(b=>b.group&&b.group===p.group).sort((a,b)=>a.obtained-b.obtained||a.id-b.id)
 const removed=p.capacity?group.slice(0,Math.max(0,group.length-p.capacity)):[]
 e.buffInstances=e.buffInstances.filter(b=>!removed.includes(b));recount(e);return layer
}
export function removeBuff(e,id){const first=e.buffInstances?.find(b=>b.buffId===id);if(first){e.buffInstances=e.buffInstances.filter(b=>b!==first);recount(e)}}
export function expireBuffs(e,now){const removed=(e.buffInstances||[]).filter(b=>b.expires!=null&&b.expires<=now);if(removed.length){e.buffInstances=e.buffInstances.filter(b=>!removed.includes(b));recount(e)}return removed}
export function completeBuffNode(e,nodeId,eventId){
 for(const b of e.buffInstances||[])if(b.nodeId===nodeId&&b.remaining!=null&&b.lastEvent!==eventId){b.remaining--;b.lastEvent=eventId}
 e.buffInstances=(e.buffInstances||[]).filter(b=>b.remaining==null||b.remaining>0);recount(e)
}
export function initializeState(world){
 for(const e of world){if(e.buffInstances)continue;const counts={...e.buffs};e.buffInstances=[];e.padBase=[0,0,0];for(const [id,n]of Object.entries(counts))for(let i=0;i<n;i++)addBuff(e,id,0,'初始场景')}
}
