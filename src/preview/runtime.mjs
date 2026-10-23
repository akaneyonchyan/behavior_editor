// Isolated, deterministic design simulator. Never writes editor state or source JSON.
import {OP_NAMES,previewCondition,previewEffect,previewGate,previewNodeComplete} from './integration.mjs'
import {effectiveValue,addBuff,removeBuff,completeBuffNode,expireBuffs} from './state.mjs'
import {layoutIsland} from './mapLayout.mjs'
import {attachRhythm,rhythmDuration,applyRhythm,rhythmEffect,inferredDelta,NEEDS} from './rhythm.mjs'
export const CHARACTERS=[['pip','皮普','兔子','种植 · 自然观察','#f4a6ad'],['banban','斑斑','鹿','雕塑 · 自然采集','#cf9a72'],['nana','娜娜','马','唱歌 · 吉他','#a99bd0'],['pietro','裴洛','猫','摄影 · 家居布置','#e7cb8b'],['finn','芬恩','垂耳兔','绘本插画 · 画云','#9bbfc4'],['granny','古奶奶','仓鼠','读书 · 收集贝壳','#c0b598']].map(([id,name,species,hobby,color])=>({id,name,species,hobby,color}))
export const DEFAULTS={initial:50,delta:10,seconds:3,count:3,threshold:70,specific:70,seed:42,maxSteps:500}
export const WEIGHTS={'极高':9,'高':6,'中':3,'低':2,'极低':1}
export const refKey=r=>JSON.stringify([r.source||r.objectType||'',r.objectName||''])
export function definition(lib,key){if(key?.startsWith('buff:'))return lib.buffs.find(a=>a.id===key.slice(5)&&a.enabled);const matches=[...lib.attributes,...lib.buffs.map(b=>({...b,isBuff:true}))].filter(a=>a.enabled&&(a.id===key||a.name===key));return matches.length===1?matches[0]:undefined}
export const conditionAlias={'达到睡眠恢复期望':'较高时','达到期望':'较高时','达到本次目标期望':'较高时','恢复到本次目标期望':'较高时'}
const comparison=s=>String(s).match(/^(小于|大于|等于|不小于|不大于)(\d+(?:\.\d+)?)(?:（[^）]*）)?$/)
export function allRules(config){
 const rows=[], add=(rs,where,mode)=>{for(const r of rs||[])rows.push({r,where,mode})}
 add(config.behavior?.preconditions?.attributeRules,'准入','condition');add(config.behavior?.targetRules,'行为目标','goal')
 add(config.behavior?.preconditions?.interactObjectRules,'交互对象','object');add(config.behavior?.preconditions?.consumableRules,'消耗品','unsupported')
 for(const n of config.graph.nodes){const d=n.data||{},w=d.name||n.id
  add(d.effectRules,w,'effect');add(d.occupiedResources,w,'occupy')
  for(const b of d.branches||[])add(b.weightFactors,w+' / '+b.name,'factor')
  for(const c of d.loopConditions||[])add(c.rules,w+' / 循环条件','condition')
 }
 return rows
}
export function makeWorld(lib,p=DEFAULTS,config=null){
 const attrs=type=>Object.fromEntries(lib.attributes.filter(a=>a.enabled&&a.objectTypes?.includes(type)).map(a=>[a.id,a.kind==='数值'?p.initial:'0']))
 const actors=CHARACTERS.map((c,i)=>({...c,type:'partner',x:35+i*5,z:56+(i%2)*7,attrs:attrs('partner'),buffs:{},inventory:{}}))
 const objects=(lib.items||[]).filter(i=>i.enabled&&!['partner','buff'].includes(i.objectType)).map((item,i)=>{
  const water=/钓|鱼|水/.test(item.name),forest=/树|木|斧|石/.test(item.name)
  const zone=water?'水边':forest?'资源区':['food','container','furniture'].includes(item.objectType)?'生活区':'创作区'
  const group=(lib.items||[]).filter(a=>a.enabled&&a.objectType===item.objectType).indexOf(item)
  return {id:'obj-'+i,itemId:'item:'+item.id,name:item.name,type:item.objectType,zone,x:water?80:forest?17:zone==='生活区'?48:70,z:18+((i*13+group*7)%60),attrs:attrs(item.objectType),buffs:{},inventory:{},color:water?'#79c4cc':forest?'#7eaa70':'#d7bc96'}
 })
 const world=[...actors,...objects]
 // Custom object names remain visibly marked placeholders, linked to an existing library type.
 for(const {r} of config?allRules(config):[]){const type=(r.source||r.objectType||'').replace(/^object:/,''),name=r.objectName
  if(type==='partner'||!lib.objects.some(o=>o.enabled&&o.id===type)||!name||name.startsWith('item:')||world.some(o=>o.type===type&&o.name===name))continue
  const id='placeholder-'+world.length;world.push({id,name,type,placeholder:true,x:22+(world.length*7)%55,z:22+(world.length*11)%50,zone:'行为测试区',attrs:attrs(type),buffs:{},inventory:{},color:'#cbbba7'})
 }
 return layoutIsland(world)
}
export function bindingsFor(config,lib,world,actor){
 const bindings={}
 for(const {r} of allRules(config)){
  const type=(r.source||r.objectType||'').replace(/^object:/,''),item=lib.items?.find(i=>'item:'+i.id===r.objectName)
  if(type==='partner'&&(!r.objectName||r.objectName==='本行为伙伴'||item?.name==='行为伙伴'))bindings[refKey(r)]=actor
  else if(type==='partner'&&item?.name==='任意伙伴')bindings[refKey(r)]=world.find(o=>o.type==='partner'&&o.id!==actor)?.id||''
  else {const candidates=world.filter(o=>o.type===type&&(!r.objectName||o.itemId===r.objectName||o.name===r.objectName));if(candidates.length)bindings[refKey(r)]=candidates[0].id}
 }
 return bindings
}
const conditions=['较低时','较高时','具有指定 Buff 时','不具有指定 Buff 时','增加','减少','改变','增','减','消除','移除指定 Buff','获得指定 Buff','提升至期望状态','降低至期望状态','恢复至正常状态','为空','不为空','具有（1）','不具有（0）','处于指定状态时：小雨或大雨']
const effects=['归零','概率消除','增','减','增加','减少','添加 Buff','移除 Buff','消除','恢复','有概率提升']
export function inspect(config,lib,world,bindings){
 const issues=[]
 const check=(text,where)=>issues.push({where,text})
 for(const {r,where,mode} of allRules(config)){
  if(mode==='factor'&&r.influenceRule==='不影响')continue
  const entity=world.find(o=>o.id===bindings[refKey(r)])
  if(!entity)check('请绑定具体场景对象',where)
  if(mode==='unsupported'){check('消耗品规则暂未实现，请勿把预览当作已验证',where);continue}
  if(['object','occupy'].includes(mode))continue
  if(r.previewOp){if(!OP_NAMES.includes(r.previewOp))check('未知预览操作：'+r.previewOp,where);continue}
  if(r.previewFactor&&['size','weight','age'].includes(r.previewFactor))continue
  const def=definition(lib,r.attribute)
  if(!def)check('公共库未支持判断项：'+(r.attribute||'空'),where)
  else if(entity&&!def.objectTypes?.includes(entity.type))check('判断项不适用于绑定对象：'+def.name,where)
  if(mode==='effect'&&!effects.includes(r.influence))check('未支持的输出规则：'+r.influence,where)
  if(['condition','goal'].includes(mode)&&!conditions.includes(r.influence)&&!conditionAlias[r.influence]&&!comparison(r.influence))check('未支持的条件：'+r.influence,where)
  if(mode==='factor'){
   if(!['概率越高','概率越低','允许选中','排除选中','不影响','大于指定值才允许被触发'].includes(r.influenceRule))check('未支持影响规则：'+r.influenceRule,where)
   if(r.influenceRule!=='不影响'&&r.influenceRule!=='大于指定值才允许被触发'&&!['数值高','数值低','具体值','具有（1）','不具有（0）','未达目标','达到目标'].includes(r.influenceType))check('具体值需明确结构化取值，当前未支持：'+r.influenceType,where)
   if(def?.kind==='枚举'&&['数值高','数值低'].includes(r.influenceType))check('枚举不能按数值高低计算',where)
  }
 }
 for(const n of config.graph.nodes){
  const d=n.data||{},where=d.name||n.id
  if(!['start','judge','result','wait','loop','end'].includes(n.type))check('不支持节点类型：'+n.type,where)
  if(d.attributeChanges?.length)check('旧文字属性输出尚未结构化',where)
  if(d.playMode&&!['单次','计次','计时'].includes(d.playMode))check('播放方式不支持：'+d.playMode,where)
  for(const b of d.branches||[])if(!(b.weightExpectation in WEIGHTS))check('默认概率不支持：'+b.weightExpectation,where)
  for(const c of d.loopConditions||[]){if(!['goal','count'].includes(c.kind))check('未知循环条件',where);if(c.kind==='goal'&&c.condition&&!c.rules?.length)check('循环文字条件需改为属性规则：'+c.condition,where);if(c.kind==='count'&&c.maxIterations&&c.maxIterations!=='默认次数'&&!/^\d+$/.test(String(c.maxIterations)))check('循环最大次数必须为整数',where)}
  if(n.type==='loop'&&!config.graph.layout?.scopes?.some(s=>s.loopId===n.id&&s.entry))check('循环缺少内部入口',where)
  for(const output of d.outputs||[]){if(typeof output!=='string'||!lib.items?.some(i=>i.enabled&&(i.name===output||'item:'+i.id===output)))check('产物尚未映射公共库：'+String(output),where)}
 }
 return issues.filter((x,i,a)=>a.findIndex(y=>y.where===x.where&&y.text===x.text)===i)
}
export class Simulation{
 constructor(config,lib,world,bindings,actor,params={}){
  this.config=structuredClone(config);this.lib=structuredClone(lib);this.world=structuredClone(world);this.bindings={...bindings};this.actor=actor;this.params={...DEFAULTS,...params};this.random=this.params.seed>>>0;this.current=config.graph.nodes.find(n=>n.type==='start')?.id;this.status='ready';this.elapsed=0;this.progress=0;this.steps=0;this.logs=[];this.loops={};this.held=new Set();this.visited=[];this.edges=[];this.initial=structuredClone(this.world);this.metrics={};this.previewTool=this.world.find(e=>e.id===this.bindings[JSON.stringify(['object:equippedItem',''])])?.id||this.world.find(e=>e.id===actor)?.attrs.equipped_slot_tool
  const issues=inspect(config,lib,world,bindings);if(issues.length){this.status='blocked';this.error=issues.map(i=>i.where+'：'+i.text).join('\n')}
  if(this.params.rhythm&&this.config.previewIntegration)attachRhythm(this)
 }
 node(){return this.config.graph.nodes.find(n=>n.id===this.current)}
 log(text){this.logs.unshift({time:this.elapsed,node:this.current,text});this.logs=this.logs.slice(0,200)}
 entity(r){const e=this.world.find(o=>o.id===this.bindings[refKey(r)]);if(!e)throw Error('对象未绑定');return e}
 value(r,initial=false){const entity=this.entity(r),e=initial?this.initial.find(o=>o.id===entity.id):entity,def=definition(this.lib,r.attribute);if(!def)throw Error('属性定义缺失');if(r.attribute.startsWith('buff:')||def.isBuff)return e.buffs[def.id]||0;if(!(def.id in e.attrs))throw Error('属性值缺失：'+r.attribute);return this.params.stateRules?effectiveValue(e,def.id):e.attrs[def.id]}
 condition(r){if(r.previewOp)return previewCondition(this,r);const v=this.value(r),old=this.value(r,true),s=conditionAlias[r.influence]||r.influence,compare=comparison(s)
  const i=NEEDS.indexOf(r.attribute)
  if(this.rhythm&&i>=0&&this.rhythm.recovery[i]>0&&this.entity(r).id===this.actor&&['较高时','提升至期望状态'].includes(s))return this.rhythmRecovery[i]>0&&Number(v)>=this.rhythmTargets[r.attribute]-1e-6
  if(s==='处于指定状态时：小雨或大雨')return ['小雨','大雨'].includes(v)
  if(compare){const n=Number(compare[2]);return {'小于':Number(v)<n,'大于':Number(v)>n,'等于':Number(v)===n,'不小于':Number(v)>=n,'不大于':Number(v)<=n}[compare[1]]}
  if(['具有指定 Buff 时','获得指定 Buff','具有（1）','不为空'].includes(s))return v!==''&&v!=='0'&&v!==0
  if(['不具有指定 Buff 时','移除指定 Buff','消除','为空','不具有（0）'].includes(s))return v===''||v==='0'||v===0
  if(['增加','增'].includes(s))return Number(v)>Number(old)
  if(['减少','减'].includes(s))return Number(v)<Number(old)
  if(s==='改变')return v!==old
  if(['较高时','提升至期望状态'].includes(s))return Number(v)>=this.params.threshold
  if(['较低时','降低至期望状态'].includes(s))return Number(v)<=100-this.params.threshold
  if(s==='恢复至正常状态')return Number(v)>=this.params.initial
  throw Error('未支持条件：'+s)
 }
 duration(n){if(this.rhythm)return rhythmDuration(this,n);if(!['result','wait','end'].includes(n.type))return 0.4;const d=n.data,number=String(d.playExpectation||'').match(/^\s*(\d+(?:\.\d+)?)\s*(秒|次|s)?\s*$/)?.[1];return d.playMode==='计时'?Math.max(.2,Number(number)||this.params.seconds):d.playMode==='计次'?Math.max(1,Number(number)||this.params.count)*this.params.seconds:this.params.seconds}
 tick(dt){if(['blocked','done','exited'].includes(this.status))return;this.status='running';this.elapsed+=dt;if(this.params.selfClock){this.params.worldNow=this.elapsed*60;for(const o of this.world)expireBuffs(o,this.params.worldNow)}const moving=this.approach(dt);if(this.rhythm)applyRhythm(this,dt,moving);if(moving)return;this.progress+=dt;if(this.progress>=this.duration(this.node())){this.progress=0;this.step(false)}}
 approach(dt){const actor=this.world.find(o=>o.id===this.actor),n=this.node();if(n?.type!=='start')return false;if(!(this.config.behavior.preconditions?.attributeRules||[]).every(r=>this.condition(r)))return false;const rule=this.config.behavior.preconditions?.interactObjectRules?.[0];if(!rule)return false;const target=this.entity(rule);if(target.id===actor.id)return false;const dx=target.x-3-actor.x,dz=target.z-actor.z,d=Math.hypot(dx,dz);if(d<.2)return false;const ratio=Math.min(1,dt*12/d);actor.x+=dx*ratio;actor.z+=dz*ratio;return true}
 next(handle=''){
  const n=this.node();if(n.data.externalExits?.some(e=>(e.handle||'')===handle)){this.status='exited';this.log('跳出行为，交由外部策略处理；不自动执行结束节点');return}
  const es=this.config.graph.edges.filter(e=>e.source===n.id&&(e.sourceHandle||'')===handle)
  if(es.length!==1)throw Error('出口需要一条连线，当前 '+es.length+' 条')
  const e=es[0],target=this.config.graph.nodes.find(n=>n.id===e.target)
  if(!target)throw Error('连线目标不存在')
  if(target.type==='loop'){
   const scope=this.config.graph.layout?.scopes?.find(s=>s.loopId===target.id)
   if(scope?.members.includes(n.id))this.loops[target.id]=(this.loops[target.id]||0)+1
   else this.loops[target.id]=0
  }
  this.edges.push(e.id);this.current=e.target
 }
 branchWeight(b){
  if(b.previewGate&&!previewGate(this,b.previewGate))return 0
  let w=WEIGHTS[b.weightExpectation]
  for(const f of b.weightFactors||[]){
   if(f.influenceRule==='不影响')continue
   const v=f.previewFactor==='weight'?50:f.previewFactor==='age'?1:f.previewFactor==='size'?({'小型':20,'中型':50,'大型':80}[this.value(f)]??50):this.value(f)
   const max=f.attribute==='freshness'?(this.entity(f).freshnessMax||100):100
   const strength=f.previewFactor==='age'?1:f.influenceType==='小'?(Number(v)<40?1:0):f.influenceType==='未达目标'?(Number(v)<(this.rhythmTargets?.[f.attribute]??this.params.threshold)?1:0):f.influenceType==='达到目标'?(Number(v)>=(this.rhythmTargets?.[f.attribute]??this.params.threshold)?1:0):f.influenceType==='数值高'?Number(v)/max:f.influenceType==='数值低'?1-Number(v)/max:f.influenceType==='具体值'?(definition(this.lib,f.attribute)?.kind==='数值'?(Number(v)===(f.previewSpecific??this.params.specific)?1:0):(Number(v)>0?1:0)):f.influenceType==='具有（1）'?(Number(v)>0?1:0):(Number(v)===0?1:0)
   if(!Number.isFinite(strength))throw Error('无法比较属性值')
   if(f.influenceRule==='大于指定值才允许被触发'&&Number(v)<=this.params.threshold)w=0
   if(f.influenceRule==='允许选中'&&strength<.5)w=0
   if(f.influenceRule==='排除选中'&&strength>=.5)w=0
   if(f.influenceRule==='概率越高')w*=1+strength
   if(f.influenceRule==='概率越低')w*=1-strength*.8
  }
  return w
 }
 step(manual=true){
  if(['blocked','done','exited'].includes(this.status))return
  try{
   if(++this.steps>this.params.maxSteps)throw Error('达到预览步数上限，请检查循环或调整场景条件')
   this.status='running';const n=this.node();if(!n)throw Error('没有有效节点');if(manual){const time=Math.max(0,this.duration(n)-this.progress);this.elapsed+=time;if(this.params.selfClock){this.params.worldNow=this.elapsed*60;for(const o of this.world)expireBuffs(o,this.params.worldNow)}this.approach(100);if(this.rhythm)applyRhythm(this,time)}this.progress=0;const d=n.data||{};this.visited.push(n.id);this.log('执行 '+(d.name||n.type))
   if(this.config.previewIntegration==='showoff'&&n.type==='loop'){const others=this.world.filter(e=>e.type==='partner'&&e.id!==this.actor&&e.visible!==false);if(!others.length){this.status='exited';this.log('没有可见互动伙伴，保留炫耀Buff并交回目标策略');return}const target=others[(this.loops[n.id]||0)%others.length];for(const {r}of allRules(this.config))if(/任意|其他伙伴/.test(r.objectName||''))this.bindings[refKey(r)]=target.id}
   if(n.type==='start'){
    const rs=this.config.behavior.preconditions?.attributeRules||[];if(!rs.every(r=>this.condition(r)))throw Error('准入条件不满足：请调整场景初始属性或 Buff 后重置')
    const targets=(this.config.behavior.preconditions?.interactObjectRules||[]).map(r=>this.entity(r));if(targets.some(o=>o.occupied&&o.occupied!==this.actor))throw Error('交互对象被其他伙伴占用')
    for(const o of targets){o.occupied=this.actor;this.held.add(o.id);this.log('预约 '+o.name)}
    this.next()
   }else if(n.type==='judge'){
    const weighted=(d.branches||[]).map(b=>({b,w:this.branchWeight(b)}))
    const forced=weighted.find(x=>x.b.previewPriority&&x.w>0);if(forced)for(const x of weighted)if(x!==forced)x.w=0
    const total=weighted.reduce((a,x)=>a+x.w,0);if(!total)throw Error('没有可选择的分支');this.random=(Math.imul(1664525,this.random)+1013904223)>>>0;let x=this.random/4294967296*total;const selected=weighted.find(a=>(x-=a.w)<0)||weighted.at(-1);this.log(weighted.map(a=>a.b.name+' '+Math.round(a.w/total*100)+'%').join(' / ')+' → '+selected.b.name);this.next(selected.b.id)
   }else if(n.type==='loop'){
    const count=this.loops[n.id]||0;const conditions=d.loopConditions||[]
    const hit=conditions.find(c=>c.kind==='count'?(this.config.previewProfile==='eat'&&this.world.find(o=>o.id===this.world.find(a=>a.id===this.actor)?.foodRef)?.bites===0)||count>=(c.maxIterations==null||c.maxIterations===''||c.maxIterations==='默认次数'?this.params.count:Number(c.maxIterations)):(c.rules?.length?c.rules:this.config.behavior.targetRules||[]).length>0&&(c.rules?.length?c.rules:this.config.behavior.targetRules||[]).every(r=>this.condition(r)))
    this.log('已完成 '+count+' 轮；'+(hit?'结束：'+hit.kind:'进入下一轮'))
    if(hit)this.next('complete');else {const scope=this.config.graph.layout.scopes.find(s=>s.loopId===n.id);this.current=scope.entry;if(this.node()?.type==='loop')this.loops[this.current]=0}
   }else{
    // Stage all effects on a clone; a malformed rule cannot partially settle a node.
    const before=structuredClone(this.world),metricsBefore=structuredClone(this.metrics),randomBefore=this.random,heldBefore=new Set(this.held),logsBefore=[...this.logs];try{
     for(const r of d.occupiedResources||[]){const o=this.entity(r);if(o.occupied&&o.occupied!==this.actor)throw Error('对象被占用：'+o.name);o.occupied=this.actor;this.held.add(o.id)}
     for(const r of d.effectRules||[]){
     if(rhythmEffect(this,r))continue
     if(r.previewOp){previewEffect(this,r);continue}
     if(r.influence==='概率消除'){this.random=(Math.imul(1664525,this.random)+1013904223)>>>0;if(this.random/4294967296>=.3){this.log('模拟消除概率30%：未触发');continue}}
     if(this.config.previewProfile==='eat'&&r.attribute==='satiety'&&r.influence==='增'){
      const actor=this.world.find(o=>o.id===this.actor),food=this.world.find(o=>o.id===actor.foodRef);
      if(!food||food.bites<=0||food.attrs.freshness<=0)throw Error('食物已耗尽或变质，停止本口结算');
      food.bites--;if(food.attrs.freshness<(food.freshnessMax||100)*.1){actor.attrs.satiety=Math.max(0,actor.attrs.satiety-this.params.delta/2);this.log('低新鲜度：本口饱腹恢复减半')}
      this.log('消耗 '+food.name+' 一口，剩余 '+food.bites+' 口');
     }
     const o=this.entity(r),v=this.value(r),def=definition(this.lib,r.attribute),minus=['减','减少','移除 Buff','消除','概率消除'].includes(r.influence);if(r.influence==='有概率提升'){this.random=(Math.imul(1664525,this.random)+1013904223)>>>0;if(this.random/4294967296>=.1){this.log('模拟生病概率10%：未触发');continue}}if(r.attribute.startsWith('buff:')||def.isBuff){if(this.params.stateRules){if(minus)removeBuff(o,def.id);else addBuff(o,def.id,this.params.worldNow||0,this.actor)}else o.buffs[def.id]=minus?Math.max(0,Number(v)-1):Number(v)+1;}else if(def.kind==='数值')o.attrs[def.id]=Math.max(0,Math.min(100,r.influence==='归零'?0:r.influence==='恢复'?this.params.initial:Number(o.attrs[def.id])+(minus?-1:1)*inferredDelta(this,r)));else o.attrs[def.id]=minus||r.influence==='归零'?'0':'1';this.log(o.name+' · '+def.name+'：'+v+' → '+this.value(r))}
     for(const output of d.outputs||[]){const item=this.lib.items.find(i=>i.name===output||'item:'+i.id===output),actor=this.world.find(o=>o.id===this.actor);actor.inventory[item.id]=(actor.inventory[item.id]||0)+(this.rhythm?.id==='fish'?2:1);this.log('获得 '+item.name+' ×'+(this.rhythm?.id==='fish'?2:1))}
     previewNodeComplete(this,n)
    }catch(e){this.world=before;this.metrics=metricsBefore;this.random=randomBefore;this.held=heldBefore;this.logs=logsBefore;throw e}
    if(this.params.stateRules)for(const e of this.world)completeBuffNode(e,n.id,this.params.executionId+':'+this.steps);if(n.type==='end'){for(const id of this.held){const o=this.world.find(o=>o.id===id);if(o?.occupied===this.actor)delete o.occupied}this.held.clear();this.status='done';const goals=this.config.behavior.targetRules||[];this.log('行为结束；目标策略：'+(goals.length?(goals.every(r=>this.condition(r))?'目标已满足':'目标未满足'):'未配置目标'))}else this.next()
   }
  }catch(e){this.status='blocked';this.error=e.message;this.log('暂停：'+e.message)}
 }
}
