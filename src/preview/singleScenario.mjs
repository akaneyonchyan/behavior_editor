import {Simulation,definition,DEFAULTS} from './runtime.mjs'
import {prepareIntegrationWorld} from './integration.mjs'
import {initializeDay,DAY_DEFAULTS,prepareMeal,dayBindings} from './day.mjs'
import {bound} from './preparation.mjs'
import {addBuff,removeBuff} from './state.mjs'

// Only for isolated single-graph tests. Autonomous scheduling never calls this.
export function singleScenario(config,lib,source,actor,params={},prepare=true){
 let world=structuredClone(source);const notes=[],p={...DEFAULTS,...params,rhythm:true,stateRules:true,selfClock:true}
 initializeDay(world,DAY_DEFAULTS);prepareIntegrationWorld(world)
 let owner=world.find(o=>o.id===actor);const id=config.previewIntegration
 const set=(o,key,value)=>{if(o.attrs[key]!==value){notes.push(o.name+' · '+(definition(lib,key)?.name||key)+'：'+o.attrs[key]+' → '+value);o.attrs[key]=value}}
 const equip=name=>{
  const tool=world.find(o=>o.type==='equippedItem'&&o.name===name);if(!tool)throw Error('测试场景缺少工具：'+name)
  const old=world.find(o=>o.id===owner.attrs.equipped_slot_tool);if(old&&old!==tool)old.location='storage'
  for(const other of world.filter(o=>o.type==='partner'&&o.id!==actor))if(other.attrs.equipped_slot_tool===tool.id)other.attrs.equipped_slot_tool='0'
  tool.location=actor;tool.attrs.durability=Math.max(1,tool.attrs.durability||100);set(owner,'equipped_slot_tool',tool.id)
 }
 if(prepare){
  // Give maintenance graphs a visible result and event graphs their real triggering relationship.
  if(['repair','clean'].includes(id)){const target=world.find(o=>o.name==='桌子');if(target){owner.previewTarget=target.id;set(target,id==='repair'?'durability':'cleanliness',30)}}
  if(id==='wash')set(owner,'cleanliness',30)
  if(id==='unstick'){
   const tree=world.find(o=>o.name==='乔木'),axe=world.find(o=>o.name==='斧头');if(!tree||!axe)throw Error('测试场景缺少树或斧头')
   axe.location='stuck:'+tree.id;tree.stuckTool=axe.id;set(tree,'reczz28PBpzFKg4B','1');addBuff(tree,'buff_be_stuck',0,'单行为测试');addBuff(axe,'buff_stuck',0,'单行为测试');notes.push('建立树与斧头的卡住关系')
  }
 }
 const meal=prepareMeal(world,actor,config,0);if(meal.error)throw Error(meal.error);world=meal.world;owner=world.find(o=>o.id===actor)
 const create=()=>new Simulation(config,lib,world,dayBindings(bound(config,lib,world,actor),config,world,actor),actor,p)
 if(prepare){
  for(const r of config.behavior.preconditions?.attributeRules||[]){
   let s=create();if(s.status==='blocked')throw Error(s.error);if(s.condition(r))continue
   if(r.previewOp==='tool'){equip(r.tool);continue}
   const e=world.find(o=>o.id===s.entity(r).id)
   if(r.previewOp==='available'){e.reachable=true;delete e.occupied;e.attrs.durability=100;notes.push(e.name+'：设置为可使用');continue}
   const d=definition(lib,r.attribute);if(!d)throw Error('无法准备判断项：'+r.attribute)
   if(r.attribute.startsWith('buff:')||d.isBuff){
    if(['不具有指定 Buff 时','为空','不具有（0）'].includes(r.influence)){while(e.buffs[d.id])removeBuff(e,d.id)}else addBuff(e,d.id,0,'单行为测试')
    notes.push(e.name+' · '+d.name+'：'+(e.buffs[d.id]||0));continue
   }
   const before=e.attrs[d.id],n=Number(String(r.influence).match(/\d+(?:\.\d+)?/)?.[0])
   const values=d.kind==='数值'?[50,30,70,0,1,100,n,n-1,n+1,100-p.threshold,p.threshold]:['0','1','小雨','大雨','']
   let found=false
   for(const v of values){if(typeof v==='number'&&(!Number.isFinite(v)||v<0||v>100))continue;e.attrs[d.id]=v;if(create().condition(r)){found=true;break}}
   if(!found){e.attrs[d.id]=before;throw Error('无法自动准备准入条件：'+d.name+' / '+r.influence)}
   if(d.id==='equipped_slot_tool'&&e.attrs[d.id]==='0'){const old=world.find(o=>o.id===before);if(old?.location===actor)old.location='storage'}
   notes.push(e.name+' · '+d.name+'：'+before+' → '+e.attrs[d.id])
  }
  const check=create()
  for(const r of config.behavior.preconditions?.interactObjectRules||[]){const e=world.find(o=>o.id===check.entity(r).id);e.reachable=true;delete e.occupied}
 }
 const simulation=create()
 if(prepare){
  for(const r of config.behavior.preconditions?.attributeRules||[])if(!simulation.condition(r))throw Error('测试条件仍不满足：'+r.attribute+' / '+r.influence)
  simulation.log('单行为测试已准备准入状态，仅影响本次运行副本。')
  for(const note of notes)simulation.log('测试准备：'+note)
 }
 simulation.preparationNotes=notes
 return simulation
}
