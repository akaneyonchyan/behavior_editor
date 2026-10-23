import {allRules,refKey} from './runtime.mjs'
import {clamp,initializeState,expireBuffs} from './state.mjs'
export const DAY_DEFAULTS={dayMode:false,daySeconds:1440,worldSecondsPerSecond:60,startHour:8,foodStock:32,foodBites:3,energyCost:6,satietyCost:8,leisureCost:5,cleanlinessDecay:2}
export function dayConfig(file){
 const config=structuredClone(file.config),notes=[...file.notes]
 if(file.name==='在空地吃小吃.json'){
  config.previewProfile='eat'
  for(const {r} of allRules(config)){if(r.attribute==='equipped_slot_food'&&r.influence==='食物')r.influence='不为空'}
  for(const n of config.graph.nodes)for(const c of n.data?.loopConditions||[])if(c.maxIterations==='食物可食用次数')c.maxIterations=3
  notes.push('进食预览：场景食物库存供餐，每份3口；逐口消耗，低新鲜度恢复减半；生病概率暂取10%。原图不改写。')
 }
 if(file.name==='雨中踩水坑.json'){
  config.previewProfile='play'
  for(const n of config.graph.nodes)for(const b of n.data?.branches||[])for(const r of b.weightFactors||[])if(r.attribute==='leisure'&&r.influenceType==='具体值')r.influenceType='未达目标'
  notes.push('踩水预览：“没玩够”的具体值按娱乐未达本次目标阈值解释，天气由场景统一读取。')
 }
 if(file.name==='在床上睡觉.json')config.previewProfile='rest'
 if(file.name==='洗手池清洗自己.json')config.previewProfile='wash'
 return {...file,config,notes}
}
export function initializeDay(world,settings){
 initializeState(world)
 for(const e of world){
  if(e.type==='food'){e.stock=settings.foodStock;e.bites=0;e.freshnessMax=48*3600;e.expiresAt=e.freshnessMax;e.attrs.freshness=e.freshnessMax}
  if(e.type!=='partner'){for(const a of ['durability','cleanliness'])if(a in e.attrs)e.attrs[a]=100}
  if(e.type==='environmen'&&'weather' in e.attrs)e.attrs.weather='小雨'
 }
}
// Explicit scene supply, not a fabricated online preparation behavior. Finite stock.
export function prepareMeal(world,actor,config,now){
 if(config.previewProfile!=='eat')return {world}
 const copy=structuredClone(world),a=copy.find(e=>e.id===actor)
 let food=copy.find(e=>e.id===a.foodRef&&e.bites>0&&e.expiresAt>now)
 const needsPortion=!food
 if(!food)food=copy.find(e=>e.type==='food'&&!e.placeholder&&e.stock>0&&e.expiresAt>now)
 if(!food)return {world:copy,error:'场景食物库存不足或已变质'}
 if(needsPortion){food.stock--;food.bites=3}
 a.foodRef=food.id;a.attrs.equipped_slot_food=food.id
 return {world:copy,food}
}
export function dayBindings(bindings,config,world,actor){
 if(config.previewProfile!=='eat')return bindings
 const a=world.find(e=>e.id===actor);for(const {r}of allRules(config))if(r.source==='object:food')bindings[refKey(r)]=a.foodRef||''
 return bindings
}
export function advanceDayState(world,dt,elapsed,settings,actor,profile,active,log){
 const seconds=dt*settings.worldSecondsPerSecond,now=elapsed*settings.worldSecondsPerSecond,hour=(settings.startHour+now/3600)%24
 for(const e of settings.skipWorldTick?[]:world){
  for(const b of expireBuffs(e,now))log(e.name+' · Buff到期：'+b.buffId)
  if(e.type==='environmen'&&'weather'in e.attrs)e.attrs.weather=hour>=8&&hour<20?'小雨':'晴天'
  if(e.type==='food'&&e.expiresAt!=null)e.attrs.freshness=Math.max(0,e.expiresAt-now)
  if('cleanliness'in e.attrs)e.attrs.cleanliness=clamp(e.attrs.cleanliness-settings.cleanlinessDecay*seconds/3600)
 }
 const a=world.find(e=>e.id===actor);if(!active||!a||settings.rhythm)return
 // Need costs belong to this running behavior; idle/planning never consumes needs.
 for(const [key,cost,exempt]of [['energy',settings.energyCost,'rest'],['satiety',settings.satietyCost,'eat'],['leisure',settings.leisureCost,'play']])if(key in a.attrs&&profile!==exempt)a.attrs[key]=clamp(a.attrs[key]-cost*seconds/3600)
}
export function clockLabel(elapsed,settings){const minutes=Math.floor(settings.startHour*60+elapsed*settings.worldSecondsPerSecond/60);return '第'+(Math.floor(minutes/1440)+1)+'天 '+String(Math.floor(minutes/60)%24).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0')}
