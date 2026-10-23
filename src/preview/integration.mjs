// Preview-only interpretations. Never writes source graphs or the public library.
import {addBuff,removeBuff} from './state.mjs'
export const CATALOG=[
 ['从工具架拿取斧头','take','准备'],['伙伴原地晕倒','dizzy','事件'],['原地摔倒','fall','事件'],
 ['向任意伙伴炫耀装备物','showoff','事件'],['在床上睡觉','rest','需求'],['在搓饵台制作鱼饵Buff','bait','准备'],
 ['在空地吃小吃','eat','需求'],['坐在椅子上休息恢复精力','chair','需求'],['将装备槽中的斧头放入工具柜','put','准备'],
 ['斧头被树卡住','unstick','事件'],['极度兴奋大笑','laugh','事件'],['洗手池清洗自己','wash','需求'],
 ['用扳手维修交互物','repair','对象维护'],['用抹布打扫交互物','clean','对象维护'],
 ['用斧头砍伐树木获取木材','wood','采集'],['用斧头砍榕树','banyan','采集'],['钓鱼','fish','采集'],['雨中踩水坑','play','需求'],
].map(([name,id,category])=>({name:name+'.json',id,category}))
export const profileOf=file=>CATALOG.find(x=>x.name===file.name)
export const OP_NAMES=['tool','available','quantity','rounds','craft','equip','unequip','yield','damage','weightCost','stuck','unstick','flight','finished']
const key=r=>JSON.stringify([r.source||r.objectType||'',r.objectName||''])
function rows(c){return [...(c.behavior.targetRules||[]),...(c.behavior.preconditions?.attributeRules||[]),...(c.behavior.preconditions?.interactObjectRules||[]),...c.graph.nodes.flatMap(n=>[...(n.data.effectRules||[]),...(n.data.occupiedResources||[]),...(n.data.branches||[]).flatMap(b=>b.weightFactors||[]),...(n.data.loopConditions||[]).flatMap(x=>x.rules||[])])]}
export const actorRule=(attribute,influence)=>({source:'object:partner',objectName:'',attribute,influence})
export function integrationLibrary(source){
 const lib=structuredClone(source)
 const dur=lib.attributes.find(x=>x.id==='durability');if(dur&&!dur.objectTypes.includes('equippedItem'))dur.objectTypes.push('equippedItem')
 for(const [id,name]of [['preview_pain','疼痛（预览占位）'],['preview_early','提前咬钩（预览占位）']])if(!lib.buffs.some(b=>b.id===id))lib.buffs.push({id,name,kind:'枚举',enabled:true,objectTypes:['partner'],previewOnly:true})
 return lib
}
export function integrateFile(file){
 const profile=profileOf(file);if(!profile)return file
 const config=structuredClone(file.config),notes=[...(file.notes||[])],id=profile.id
 config.previewIntegration=id
 const note=t=>notes.push(t),node=n=>config.graph.nodes.find(x=>x.id===n),op=(r,name,extra={})=>Object.assign(r,{previewOp:name,...extra})
 if(['wood','banyan','repair','clean','fish','take','put','unstick'].includes(id))note('装备保留同一物品实例与耐久；装备关系复用物件耐久定义。对象别名绑定到本次同一目标。')
 for(const r of rows(config)){
  if(['超开心','超开心buff'].includes(r.attribute))r.attribute='buff:emotion_super_happy'
  if(r.attribute==='疼痛'){r.attribute='buff:preview_pain';note('疼痛为预览占位Buff，持续3个模拟分钟；未新增公共库条目。')}
  if(['Buff.提前咬钩','提前咬钩'].includes(r.attribute)){r.attribute='buff:preview_early';r.objectName='';note('提前咬钩为本轮预览标记，完整一轮后清除。')}
  if(r.attribute==='装备飞出')op(r,'flight')
  if(r.attribute==='损坏')op(r,'damage')
  if(r.attribute==='需解卡')op(r,'stuck')
  if(['重量','树龄'].includes(r.attribute)){r.previewFactor=r.attribute==='重量'?'weight':'age';note('重量暂取50、树龄暂取老树，仅用于本场景概率模拟。')}
  if(r.attribute==='body_size'&&['数值高','数值低','小'].includes(r.influenceType))r.previewFactor='size'
  if(r.influenceType==='有'||r.influenceType==='1')r.influenceType='具有（1）'
  if(r.influenceType==='0'){r.influenceType='具体值';r.previewSpecific=0}
  if(r.influenceType==='达到本次期望')r.influenceType='达到目标'
  if(['有该buff','没有该buff'].includes(r.influenceRule)){r.influenceType=r.influenceRule==='有该buff'?'具有（1）':'不具有（0）';r.influenceRule='允许选中'}
  if(['存在时提高','存在时降低'].includes(r.influenceRule)){r.influenceType='具有（1）';r.influenceRule=r.influenceRule==='存在时提高'?'概率越高':'概率越低'}
  if(/^消除【/.test(r.influence))r.influence='消除'
  if(r.influence==='添加')r.influence='增'
  if(['equipped_slot','equipped_slot_tool'].includes(r.attribute)){
   if(r.attribute==='equipped_slot')r.attribute='equipped_slot_tool'
   if(['斧头','有扳手','有抹布','处于指定状态时'].includes(r.influence))op(r,'tool',{tool:id==='fish'?'鱼竿':id==='repair'?'扳手':id==='clean'?'抹布':'斧头'})
   if(r.influence==='装备本次从工具架取下的指定斧头实例')op(r,'tool',{tool:'斧头'})
  }
  if(r.attribute==='数量')op(r,'quantity',{amount:id==='fish'?1:10})
 }
 for(const n of config.graph.nodes){
  const d=n.data;d.attributeChanges=(d.attributeChanges||[]).filter(x=>String(x).trim())
  if(d.playMode==='3~5次'){d.playMode='计次';d.playExpectation='4';note('擦拭3~5次暂取4次。')}
  for(const c of d.loopConditions||[])if(c.kind==='count'&&['默认最大次数','M（本次配置）'].includes(c.maxIterations)){c.maxIterations=10;note('未定循环上限暂取10轮。')}
  for(const b of d.branches||[]){if(['必定','满足条件必选','每次都稍息（必定）'].includes(b.weightExpectation)){b.previewPriority=true;b.weightExpectation='高'}else if(b.weightExpectation==='其余情况'){b.previewFallback=true;b.weightExpectation='中'}else if(b.weightExpectation==='通常发生'){b.weightExpectation='高';note('通常发生暂取高权重。')}}
 }
 if(id==='take')for(const n of config.graph.nodes)for(const r of n.data.effectRules||[])if(r.attribute==='equipped_slot_tool')op(r,'equip',{tool:'斧头'})
 if(id==='put')for(const n of config.graph.nodes)for(const r of n.data.effectRules||[])if(r.attribute==='equipped_slot_tool')op(r,'unequip',{destination:'工具柜'})
 if(['wood','banyan'].includes(id)){
  for(const n of config.graph.nodes){
   for(const r of n.data.effectRules||[]){
    if(r.attribute==='equipped_slot_tool')op(r,'flight')
    if(r.attribute==='reczz28PBhFkUjct')op(r,'yield')
    if(r.attribute==='energy'&&r.influence.startsWith('减少；'))op(r,'weightCost')
    if(r.attribute==='satiety'&&r.influence.startsWith('按本轮'))r.influence='减'
    if(r.influence==='使用消耗，最低为0')r.influence='减'
   }
   if(n.id==='state')for(const b of n.data.branches||[])if(b.id==='broken'){b.previewGate='toolBroken';for(const r of b.weightFactors||[])if(r.attribute==='durability')r.previewSpecific=0}
   if(n.id==='yield')for(const b of n.data.branches||[])b.previewGate=b.id==='last'?'depleted':'hasYield'
   if(n.id==='treasure_check')for(const b of n.data.branches||[])if(b.id==='found')b.previewGate='treasure'
   if(n.id==='treasure'){n.data.outputs=(n.data.outputs||[]).filter(x=>x!=='宝箱*1');n.data.previewAction='treasure'}
  }
  if(id==='banyan'){
   for(const c of node('loop')?.data.loopConditions||[])for(const r of c.rules||[])if(r.id==='wood_count'&&r.influence==='不为0')r.influence='等于0'
   note('原稿冲突：循环名“砍空”但条件写“产量不为0”。预览按产量=0结束；正式稿未修改，需策划确认。')
  }
  note('每轮实际木材=min(10,剩余产量)，库存与产量同步结算；宝箱用标注的预览产物，树中只取一次。')
 }
 if(id==='chair'){
  config.previewProfile='rest';for(const r of config.behavior.preconditions.attributeRules)if(r.id==='usable_chair')op(r,'available')
  const b=node('reaction')?.data.branches.find(b=>b.id==='dirty');if(b)b.previewGate='dirtyChair'
 }
 if(['repair','clean'].includes(id))note('当前公共库中的扳手、抹布已停用：场景使用明确标注的预览占位工具，不重新启用公共库条目；拿取/归还使用预览准备步骤。')
 if(id==='repair'){const b=node('repair_outcome')?.data.branches.find(b=>b.id==='mistake');if(b)b.previewGate='targetBroken'}
 if(id==='unstick'){
  config.behavior.preconditions.attributeRules.push(actorRule('equipped_slot_tool','为空'))
  for(const r of rows(config))if(['reczz28PBpzFKg4B','卡住'].includes(r.attribute)){r.source='object:environmentItem';r.objectName='';r.attribute='reczz28PBpzFKg4B';if(r.influence==='处于指定状态时')r.influence='具有指定 Buff 时';if(r.influence==='改变')r.influence='消除'}
  for(const n of config.graph.nodes)for(const r of n.data.effectRules||[])if(r.attribute==='reczz28PBpzFKg4B'&&r.influence==='减')op(r,'unstick')
  note('解卡读取同一棵树的被卡住Buff；成功解除树与斧头的卡住关系并归还装备槽。')
 }
 if(id==='bait'){
  for(const c of node('craft_loop')?.data.loopConditions||[])if(c.kind==='goal')c.rules=[{...actorRule('',''),previewOp:'craft',amount:12}]
  node('knead').data.playExpectation='1';node('knead').data.previewAction='craft';node('produce_bait').data.previewAction='craft'
  note('鱼饵有效制作时间暂取12模拟分钟，只累加揉搓执行段，等待和受惊不计。')
 }
 if(id==='fall')config.behavior.targetRules=[{...actorRule('',''),previewOp:'finished'}]
 if(id==='laugh'){
  node('laugh_loop').data.loopConditions=[{id:'preview-limit',kind:'count',maxIterations:3}]
  note('原稿大笑循环上限留空：预览取3轮；每次大笑30%移除一层超开心，结束不保证Buff消除。')
 }
 if(id==='fish'){
  config.behavior.preconditions.attributeRules=config.behavior.preconditions.attributeRules.filter(r=>!r.influence.startsWith('【可选】'))
  for(const r of config.behavior.preconditions.attributeRules)if(r.attribute==='interaction_point_count')op(r,'available')
  node('loop').data.loopConditions=[{id:'preview-rounds',kind:'goal',rules:[{...actorRule('',''),previewOp:'rounds',amount:3}]}]
  for(const name of ['fish','empty'])node(name).data.previewAction='fishingRound'
  for(const name of ['cast','lift'])for(const b of node(name).data.branches)if(b.id==='broken')b.previewGate='toolBroken'
  note('钓鱼按原稿完整轮数取3轮；半轮跳出不计，鱼饵可选。肉类遵循在线稿产出，暂不模拟鱼种收藏。')
 }
 if(id==='dizzy')note('晕眩事件层暂定6模拟分钟；按原图恢复节点或到期解除。')
 if(id==='showoff')note('每轮重新选取可见的其他伙伴；无对象时跳出并保留炫耀Buff。')
 return {...file,config,notes:[...new Set(notes)],profile}
}
export function prepareIntegrationWorld(world){
 const cabinet=world.find(e=>e.name==='工具柜')
 // Disabled library items are not re-enabled; separate, labelled preview stand-ins.
 for(const name of ['扳手','抹布'])if(!world.some(e=>e.type==='equippedItem'&&e.name===name))world.push({id:'preview-tool-'+name,name,type:'equippedItem',previewOnly:true,placeholder:true,zone:'工具柜 · 预览占位',x:cabinet?.x||50,z:cabinet?.z||30,attrs:{durability:100},buffs:{},inventory:{},color:'#94a3b8'})
 for(const e of world){
  if(e.type==='equippedItem'){e.attrs.durability??=100;e.location??=cabinet?.id||'storage'}
  if(e.type==='environmentItem'){e.treasure??=true;e.attrs.reczz28PBhFkUjct??=50}
  if(e.type==='partner'){e.attrs.body_size=e.attrs.body_size==='0'?'中型':e.attrs.body_size;e.events||={}}
 }
}
export function toolFor(world,actor,name){return world.find(e=>e.type==='equippedItem'&&e.name===name&&(!e.location||e.location===actor||(!world.some(a=>a.type==='partner'&&a.id===e.location)&&!e.location.startsWith('stuck:'))))}
export function integrationBindings(bindings,config,world,actor){
 const p=config.previewIntegration;if(!p)return bindings
 const a=world.find(e=>e.id===actor),toolName=['wood','banyan','take','put','unstick'].includes(p)?'斧头':p==='fish'?'鱼竿':p==='repair'?'扳手':p==='clean'?'抹布':null
 const tool=world.find(e=>e.id===a.attrs.equipped_slot_tool)||world.find(e=>e.type==='equippedItem'&&e.name===toolName)
 const tree=world.find(e=>e.type==='environmentItem'&&e.name==='乔木'),target=world.find(e=>e.id===a.previewTarget)||world.find(e=>e.type==='interactObject'&&e.name==='桌子')
 for(const r of rows(config)){
  const type=(r.source||r.objectType||'').replace(/^object:/,''),item=world.find(e=>e.itemId===r.objectName)
  if(type==='partner')bindings[key(r)]=/任意|其他伙伴/.test(r.objectName||'')?world.find(e=>e.type==='partner'&&e.id!==actor)?.id:actor
  if(['equippedItem','item'].includes(type)&&tool)bindings[key(r)]=tool.id
  if(type==='environmentItem'&&tree)bindings[key(r)]=tree.id
  if(['repair','clean'].includes(p)&&type==='interactObject'&&target)bindings[key(r)]=target.id
  if(p==='take'&&type==='interactObject')bindings[key(r)]=world.find(e=>e.name==='工具柜')?.id
  if(type==='interactObject'&&r.objectName==='搓饵台')bindings[key(r)]=world.find(e=>e.name==='搓饵台'&&!e.placeholder)?.id
  if(item&&type==='material')bindings[key(r)]=item.id
 }
 return bindings
}
const actor=s=>s.world.find(e=>e.id===s.actor)
const tree=s=>s.world.find(e=>e.type==='environmentItem'&&e.name==='乔木')
const tool=s=>s.world.find(e=>e.id===actor(s).attrs.equipped_slot_tool)||s.world.find(e=>e.id===s.previewTool)
export function previewCondition(s,r){
 const a=actor(s),e=s.world.find(e=>e.id===s.bindings[key(r)])
 switch(r.previewOp){
  case 'tool':return tool(s)?.name===r.tool&&tool(s)?.location===s.actor
  case 'available':return !!e&&(!e.occupied||e.occupied===s.actor)&&e.reachable!==false&&(e.attrs.durability??100)>0
  case 'quantity':{const count=a.inventory[e?.itemId?.slice(5)]||0,initial=s.initial.find(x=>x.id===s.actor).inventory[e?.itemId?.slice(5)]||0;return count-initial>=r.amount}
  case 'rounds':return (s.metrics?.rounds||0)>=r.amount
  case 'craft':return (s.metrics?.craft||0)>=r.amount
  case 'finished':return s.status==='done'
  default:throw Error('未知预览条件：'+r.previewOp)
 }
}
export function previewEffect(s,r){
 const a=actor(s),e=s.world.find(e=>e.id===s.bindings[key(r)]),t=tool(s)
 switch(r.previewOp){
  case 'equip':{const item=toolFor(s.world,s.actor,r.tool);if(!item||item.attrs.durability<=0)throw Error('没有可用的'+r.tool);if(a.attrs.equipped_slot_tool&&a.attrs.equipped_slot_tool!=='0'&&a.attrs.equipped_slot_tool!==item.id)throw Error('工具槽未清空');a.attrs.equipped_slot_tool=item.id;item.location=s.actor;break}
  case 'unequip':{if(!t)throw Error('没有可放回的工具');const place=s.world.find(e=>e.name===r.destination);if(!place)throw Error('找不到存放位置');t.location=place.id;a.attrs.equipped_slot_tool='0';break}
  case 'quantity':{const amount=Math.min(s.rhythm?2:10,tree(s)?.attrs.reczz28PBhFkUjct||0);s.metrics.lastYield=amount;const k=e.itemId.slice(5);a.inventory[k]=(a.inventory[k]||0)+amount;if(!s.node().data.effectRules.some(x=>x.previewOp==='yield'))tree(s).attrs.reczz28PBhFkUjct-=amount;break}
  case 'yield':e.attrs.reczz28PBhFkUjct=Math.max(0,e.attrs.reczz28PBhFkUjct-(s.metrics.lastYield||0));break
  case 'weightCost':if(!s.rhythm)a.attrs.energy=Math.max(0,a.attrs.energy-s.params.delta*1.5);break
  case 'damage':e.attrs.durability=0;break
  case 'stuck':{if(!t)throw Error('卡住缺少斧头实例');const target=tree(s);addBuff(target,'buff_be_stuck',s.params.worldNow||0,s.actor);addBuff(t,'buff_stuck',s.params.worldNow||0,s.actor);t.location='stuck:'+target.id;target.stuckTool=t.id;target.attrs.reczz28PBpzFKg4B='1';break}
  case 'unstick':{const target=tree(s),item=s.world.find(x=>x.id===target.stuckTool);if(!item)throw Error('被卡住的树没有关联斧头实例');if(a.attrs.equipped_slot_tool&&a.attrs.equipped_slot_tool!=='0'&&a.attrs.equipped_slot_tool!==item.id)throw Error('解卡前需要清空工具槽');removeBuff(target,'buff_be_stuck');removeBuff(item,'buff_stuck');if(!target.buffs.buff_be_stuck){item.location=s.actor;a.attrs.equipped_slot_tool=item.id;delete target.stuckTool;target.attrs.reczz28PBpzFKg4B='0'}break}
  case 'flight':if(t){if(!t.location?.startsWith('stuck:')){t.location='ground';t.x=a.x+4;t.z=a.z+3}a.attrs.equipped_slot_tool='0'}break
  default:throw Error('未知预览输出：'+r.previewOp)
 }
 s.log('预览实例结算：'+r.previewOp)
}
export function previewGate(s,gate){
 const t=tool(s),target=s.world.find(e=>e.id===actor(s).previewTarget)||s.world.find(e=>e.name==='桌子')
 if(gate==='toolBroken')return !!t&&t.attrs.durability<=0
 if(gate==='targetBroken')return target?.attrs.durability===0
 if(gate==='depleted')return tree(s)?.attrs.reczz28PBhFkUjct<=0
 if(gate==='hasYield')return tree(s)?.attrs.reczz28PBhFkUjct>0
 if(gate==='treasure')return !!tree(s)?.treasure
 if(gate==='dirtyChair')return !s.visited.includes('dirty')&&(s.world.find(e=>e.name==='椅子')?.attrs.cleanliness??100)<50
 throw Error('未知分支门槛：'+gate)
}
export function previewNodeComplete(s,n){
 if(n.data.previewAction==='craft')s.metrics.craft=(s.metrics.craft||0)+s.duration(n)
 if(n.data.previewAction==='fishingRound'){s.metrics.rounds=(s.metrics.rounds||0)+1;removeBuff(actor(s),'preview_early')}
 if(n.data.previewAction==='treasure'){if(!tree(s).treasure)throw Error('宝藏已被取走');tree(s).treasure=false;actor(s).inventory['preview:treasure']=(actor(s).inventory['preview:treasure']||0)+1;s.log('获得 宝箱（预览占位）×1')}
}
