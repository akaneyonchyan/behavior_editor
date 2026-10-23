import {Simulation,bindingsFor,inspect,definition} from './runtime.mjs'
import {integrationBindings,toolFor} from './integration.mjs'
import {removeBuff} from './state.mjs'

export function bound(config,lib,world,actor){return integrationBindings(bindingsFor(config,lib,world,actor),config,world,actor)}
// Plan against a clone. No inventory/equipment mutation reaches the live scene until a step executes.
export function preparationPath(file,files,lib,world,actor,params,stack=[]){
 if(stack.includes(file.name)||stack.length>=6)return {error:'前置目标出现循环或超过6层：'+file.name}
 const predicted=structuredClone(world),a=predicted.find(e=>e.id===actor),steps=[]
 const prepare=f=>{
  const path=preparationPath(f,files,lib,predicted,actor,params,[...stack,file.name]);if(path.error)throw Error(path.error)
  steps.push(...path.steps);predicted.splice(0,predicted.length,...path.predicted)
 }
 const service=(action,tool)=>steps.push({service:true,name:'预览准备：'+(action==='equip'?'拿取':'归还')+tool,action,tool})
 try{
  if(file.config.previewIntegration==='take'){
   const axe=toolFor(predicted,actor,'斧头'),cabinet=predicted.find(e=>e.name==='工具柜')
   if(!axe||axe.attrs.durability<=0||!cabinet)throw Error('工具架没有可用斧头')
   if(axe.location==='ground'){steps.push({service:true,name:'预览准备：捡回落地斧头并归架',action:'recover',tool:'斧头'});axe.location=cabinet.id}
  }
  const check=new Simulation(file.config,lib,predicted,bound(file.config,lib,predicted,actor),actor,params)
  if(check.status==='blocked')throw Error(check.error)
  for(const r of file.config.behavior.preconditions?.attributeRules||[]){
   // Re-evaluate after each prerequisite because earlier steps can satisfy this one.
   const sim=new Simulation(file.config,lib,predicted,bound(file.config,lib,predicted,actor),actor,params)
   if(sim.condition(r))continue
   if(r.previewOp==='tool'||(r.attribute==='equipped_slot_tool'&&r.influence==='为空')){
    const current=predicted.find(e=>e.id===predicted.find(e=>e.id===actor).attrs.equipped_slot_tool)
    if(current){
     if(current.name==='斧头'){
      const put=files.find(f=>f.config.previewIntegration==='put');if(!put)throw Error('缺少在线前置行为：将装备槽中的斧头放入工具柜');prepare(put)
     }else{service('return',current.name);current.location=predicted.find(e=>e.name==='工具柜')?.id||'storage';predicted.find(e=>e.id===actor).attrs.equipped_slot_tool='0'}
    }
    if(r.previewOp==='tool'){
     let t=toolFor(predicted,actor,r.tool)
     if(!t&&r.tool==='斧头'){
      const tree=predicted.find(e=>e.stuckTool),unstick=files.find(f=>f.config.previewIntegration==='unstick')
      if(tree&&unstick){prepare(unstick);t=toolFor(predicted,actor,r.tool)}
     }
     if(!t||t.attrs.durability<=0){
      const item=predicted.find(e=>e.type==='equippedItem'&&e.name===r.tool),holder=predicted.find(e=>e.id===item?.location&&e.type==='partner')
      throw Error('缺少可用工具：'+r.tool+'（'+(holder?'由'+holder.name+'持有':item?.location?.startsWith('stuck:')?'卡在对象上':item?.attrs.durability<=0?'已损坏':'场景无可用实例')+'）')
     }
     if(t.location===actor)continue
     if(r.tool==='斧头'){
      const take=files.find(f=>f.config.previewIntegration==='take');if(!take)throw Error('缺少在线前置行为：从工具架拿取斧头');prepare(take)
     }else{service('equip',r.tool);predicted.find(e=>e.id===actor).attrs.equipped_slot_tool=t.id;t.location=actor}
    }
   }else throw Error('前置条件尚未满足：'+(definition(lib,r.attribute)?.name||r.attribute||r.previewOp)+' / '+r.influence)
  }
  // Bait is optional: use its real online preparation graph if available, never make it mandatory.
  if(file.config.previewIntegration==='fish'&&!predicted.find(e=>e.id===actor).buffs.design_fishing_bait){
   const bait=files.find(f=>f.config.previewIntegration==='bait');if(bait){const path=preparationPath(bait,files,lib,predicted,actor,params,[...stack,file.name]);if(!path.error){steps.push(...path.steps);predicted.splice(0,predicted.length,...path.predicted)}}
  }
  const final=new Simulation(file.config,lib,predicted,bound(file.config,lib,predicted,actor),actor,params)
  for(const r of file.config.behavior.preconditions?.attributeRules||[])if(!final.condition(r))throw Error('前置计划无法满足 '+r.attribute)
  for(const r of file.config.behavior.preconditions?.interactObjectRules||[]){const o=final.entity(r);if(o.reachable===false||o.type!=='environmen'&&o.occupied&&o.occupied!==actor)throw Error(o.name+' 当前不可达或被占用')}
  steps.push(file)
  // Only declared, deterministic preparation effects are forecast; stochastic action results are never forecast.
  const owner=predicted.find(e=>e.id===actor),p=file.config.previewIntegration
  if(p==='take'){const t=toolFor(predicted,actor,'斧头');if(!t)throw Error('工具架无斧头');owner.attrs.equipped_slot_tool=t.id;t.location=actor}
  if(p==='put'){const t=predicted.find(e=>e.id===owner.attrs.equipped_slot_tool),cabinet=predicted.find(e=>e.name==='工具柜');if(!t||!cabinet)throw Error('无法归还斧头');t.location=cabinet.id;owner.attrs.equipped_slot_tool='0'}
  if(p==='bait')owner.buffs.design_fishing_bait=(owner.buffs.design_fishing_bait||0)+1
  if(p==='unstick'){
   const tree=predicted.find(e=>e.stuckTool),item=predicted.find(e=>e.id===tree?.stuckTool)
   if(!item)throw Error('没有关联的卡住工具');removeBuff(tree,'buff_be_stuck');removeBuff(item,'buff_stuck');tree.attrs.reczz28PBpzFKg4B='0';delete tree.stuckTool;item.location=actor;owner.attrs.equipped_slot_tool=item.id
  }
  if(steps.length>12)throw Error('准备链超过12步')
  return {steps,predicted}
 }catch(e){return {error:e.message}}
}
export function executeService(step,world,actor){
 const a=world.find(e=>e.id===actor),cabinet=world.find(e=>e.name==='工具柜')
 if(step.action==='recover'){
  const item=world.find(e=>e.name===step.tool&&e.location==='ground');if(!item||!cabinet)throw Error('落地工具位置已变化');item.location=cabinet.id;item.x=cabinet.x;item.z=cabinet.z
 }else if(step.action==='return'){
  const item=world.find(e=>e.id===a.attrs.equipped_slot_tool);if(!item||item.name!==step.tool||!cabinet)throw Error('归还前场景已变化，需要重规划')
  item.location=cabinet.id;a.attrs.equipped_slot_tool='0'
 }else{
  if(a.attrs.equipped_slot_tool&&a.attrs.equipped_slot_tool!=='0')throw Error('拿取前工具槽已被占用')
  const item=toolFor(world,actor,step.tool);if(!item||item.attrs.durability<=0)throw Error('拿取前工具已不可用')
  a.attrs.equipped_slot_tool=item.id;item.location=actor
 }
}
