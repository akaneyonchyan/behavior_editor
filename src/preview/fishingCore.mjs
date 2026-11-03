// Explicit, isolated interpretation of the detailed fishing design. Never edits authored files.
import {addBuff,removeBuff} from './state.mjs'

export const FISHING_DEFAULTS={experienceGoal:30,roundGoal:4,fishGoal:3,meatGoal:2,experienceSmall:3,experience:10,experienceLarge:20,levelExperience:100,buffSeconds:600}
export const FISHING_NOTES=[
 '钓鱼细分预览补值：目标经验30、完整提竿4次、鱼3份、肉2份；指定伙伴暂绑定执行伙伴。目标逐项判定，不保证随机结果全部满足。',
 '区间取中值：抛竿4轮，等鱼7.5游戏分钟，瞌睡/晒太阳7次，感受风4次。空次数不新增限制；明确数字保留。等鱼时长每轮前检查，允许最后一个动作完成后超时。',
 '经验小增3、增10、大增20；每累计100经验升1级，最高10级。普通/巨大鱼1尾、多鱼2尾；正常上鱼的肉类按原稿产出2份。鱼种用独立预览条目，不启用停用的公共库鱼条目。',
 '鱼饵按本图必需消耗品处理：开始时消费1层，覆盖本次抛竿循环；单行为自动准备只补1层，自主模式需要真实制作行为。',
 '姿态严格按原图的属于/不属于及允许/排除规则判定，不根据分支名称反转条件；站起/坐下真实更新姿态。蝴蝶与蜻蜓条件保留原图AND关系。',
 '预览情境默认钓鱼3级、经验0、站姿、追求钓获、晴天、有蝴蝶和蜻蜓；可调整伙伴和环境属性。情绪从实际PAD读出，认真钓鱼按实际Buff层数影响概率。',
 '情绪Buff持续600游戏秒：放松PAD +10/-10/-10，新鱼+20/+20/0，指定鱼+10/0/0；平静将当前PAD各维向0拉近10。娱乐每有效分钟+0.4，瞌睡精力每分钟+2，仍扣实际时间消耗。',
]
const ACTOR={source:'object:partner',objectName:''}
export const FISHING_BUFF_IDS={focus:'fishing_focus',multi:'fishing_multi_catch',huge:'fishing_huge_catch',treasure:'fishing_treasure_catch',relax:'fishing_relaxation',new:'fishing_discovery',specified:'fishing_target_satisfaction',calm:'fishing_settling',caught:'preview_fishing_caught'}
const buffId=key=>FISHING_BUFF_IDS[key]
const boolNames={standing:'钓鱼站姿',sitting:'钓鱼坐姿',catch:'获得鱼目标',fun:'获得娱乐目标',growth:'获得成长目标',butterfly:'有蝴蝶',dragonfly:'有蜻蜓'}
const aliases={'属于钓鱼站姿':'standing','属于钓鱼坐姿':'sitting','获得鱼':'catch','获得娱乐':'fun','获得成长':'growth','有蝴蝶':'butterfly','有蜻蜓':'dragonfly'}
export function fishingLibrary(lib){
 for(const [key,name]of Object.entries(boolNames))if(!lib.attributes.some(a=>a.id==='preview_fishing_'+key))lib.attributes.push({id:'preview_fishing_'+key,name:name+'（预览）',kind:'枚举',enabled:true,previewOnly:true,previewDefault:['standing','catch','butterfly','dragonfly'].includes(key)?'1':'0',objectTypes:['butterfly','dragonfly'].includes(key)?['environmen']:['partner']})
 for(const [id,name]of [['focus','认真钓鱼'],['multi','一钩多鱼'],['huge','巨大的鱼'],['caught','获得鱼'],['treasure','钓获宝箱'],['calm','钓鱼平复'],['relax','钓鱼放松'],['new','新鱼发现喜悦'],['specified','目标鱼满足']])if(!lib.buffs.some(b=>b.id===buffId(id)))lib.buffs.push({id:buffId(id),name:name+'（预览）',kind:'枚举',enabled:true,previewOnly:true,objectTypes:['partner']})
 for(const [id,name,type]of [['fishing_posture','钓鱼姿态','partner'],['nearby_butterfly','附近有蝴蝶','environmen'],['nearby_dragonfly','附近有蜻蜓','environmen']])if(!lib.attributes.some(a=>a.id===id))lib.attributes.push({id,name:name+'（预览）',kind:'枚举',enabled:true,previewOnly:true,objectTypes:[type]})
 for(const [id,name]of [['common','普通鱼'],['new','新发现的鱼'],['specified','指定鱼']])if(!lib.items.some(i=>i.id==='preview:fish:'+id))lib.items.push({id:'preview:fish:'+id,name:name+'（预览）',objectType:'collectible',enabled:true,previewOnly:true})
 return lib
}
export function prepareFishingWorld(world){
 for(const e of world){
  if(e.type==='partner'&&(!e.attrs.fishing_posture||e.attrs.fishing_posture==='0'))e.attrs.fishing_posture=e.attrs.preview_fishing_sitting==='1'?'坐姿':'站姿'
  if(e.type==='environmen'){e.attrs.nearby_butterfly??=e.attrs.preview_fishing_butterfly??'1';e.attrs.nearby_dragonfly??=e.attrs.preview_fishing_dragonfly??'1'}
  if(e.type==='partner')for(const [k,v]of Object.entries({standing:'1',sitting:'0',catch:'1',fun:'0',growth:'0'}))e.attrs['preview_fishing_'+k]??=v
  if(e.type==='environmen')for(const k of ['butterfly','dragonfly'])e.attrs['preview_fishing_'+k]??='1'
 }
}
const buffAliases={'认真buff':'focus','认真钓鱼buff':'focus','一钩多鱼':'multi','巨大的鱼':'huge','获得{鱼类名称}':'caught','宝箱buff':'treasure',...Object.fromEntries(Object.entries(FISHING_BUFF_IDS).map(([key,id])=>['buff:'+id,key]))}
const operation=(r,op,extra={})=>Object.assign(r,ACTOR,{previewOp:op,...extra})
const targetAmount=(s,fallback)=>Number(String(s).match(/(?:增加|进行)(\d+(?:\.\d+)?)/)?.[1]??fallback)
export function integrateFishing(file){
 const config=structuredClone(file.config),notes=[...(file.notes||[]),...FISHING_NOTES],p={...FISHING_DEFAULTS}
 config.previewIntegration='fishCore';config.previewFishing=p
 const pre=config.behavior.preconditions
 pre.attributeRules||=[]
 if(!pre.attributeRules.some(r=>r.previewOp==='tool'))pre.attributeRules.push({...ACTOR,attribute:'equipped_slot_tool',influence:'装备鱼竿',previewOp:'tool',tool:'鱼竿'})
 pre.consumableRules=(pre.consumableRules||[]).filter(r=>{
  if(r.objectType!=='buff'||r.objectName!=='item:buff/design_fishing_bait'||r.requirement!=='有可用存量')return true
  pre.attributeRules.push({...ACTOR,attribute:'buff:design_fishing_bait',influence:'具有指定 Buff 时'});config.previewConsumeBait=true;return false
 })
 for(const r of config.behavior.targetRules||[]){
  const source=r.source,attribute=r.attribute
  if(attribute==='fishing_experience'&&/^增加(?:X|\d+(?:\.\d+)?)点$/.test(r.influence))operation(r,'fishingGoal',{metric:'experience',amount:targetAmount(r.influence,p.experienceGoal)})
  if(attribute==='钓鱼行为'&&/^进行(?:X|\d+)次$/.test(r.influence))operation(r,'fishingGoal',{metric:'rounds',amount:targetAmount(r.influence,p.roundGoal)})
  if(attribute==='数量'&&/^增加(?:X|\d+)份$/.test(r.influence)&&['object:collectible','object:material'].includes(source))operation(r,'fishingGoal',{metric:source==='object:collectible'?'fish':'meat',amount:targetAmount(r.influence,source==='object:collectible'?p.fishGoal:p.meatGoal)})
 }
 for(const n of config.graph.nodes){
  const d=n.data||{},name=d.name
  for(const c of d.loopConditions||[]){
   const value=String(c.maxIterations||''),range=value.match(/^(\d+(?:\.\d+)?)\s*[~～-]\s*(\d+(?:\.\d+)?)(min|分钟)?$/)
   if(c.kind==='count'&&range){const mid=(Number(range[1])+Number(range[2]))/2;if(range[3]){c.kind='goal';c.rules=[{...ACTOR,previewOp:'fishingTime',loopId:n.id,amount:mid}];delete c.maxIterations}else c.maxIterations=Math.floor(mid)}
  }
  // Empty optional count entries do not override the authored nonempty limit.
  if(n.type==='loop'&&d.loopConditions?.some(c=>c.rules?.length||c.maxIterations))d.loopConditions=d.loopConditions.filter(c=>c.kind!=='count'||String(c.maxIterations??'').trim())
  for(const b of d.branches||[]){
   if(b.weightExpectation==='条件指定')b.weightExpectation='中'
   for(const f of b.weightFactors||[]){
    if(f.influenceRule==='不影响')continue
    const attr=f.attribute
    if((aliases[attr]||['fishing_posture','nearby_butterfly','nearby_dragonfly'].includes(attr))&&['满足','不满足'].includes(f.influenceType))f.influenceType=f.influenceType==='满足'?'属于':'不属于'
    if(attr==='获得{种类}{鱼}'){f.attribute='preview_fishing_catch';Object.assign(f,ACTOR);if(['',"属于mu'biao",'属于目标'].includes(f.influenceType))f.influenceType='具有（1）'}
    if(aliases[attr]){f.attribute='preview_fishing_'+aliases[attr];if(!['有蝴蝶','有蜻蜓'].includes(attr))Object.assign(f,ACTOR)}
    if(buffAliases[attr]){f.attribute='buff:'+buffId(buffAliases[attr]);Object.assign(f,ACTOR)}
    if(buffAliases[attr]==='focus'&&['','层数多','层数高'].includes(f.influenceType)){f.previewFactor='fishing';f.previewFishingFactor='认真钓鱼buff';continue}
    if(['fishing_posture','nearby_butterfly','nearby_dragonfly'].includes(attr)){f.previewFactor='fishing';f.previewFishingFactor=attr;continue}
    if(['buff:mood_bothered','buff:mood_content'].includes(attr)){f.previewFactor='fishing';f.previewFishingFactor=attr==='buff:mood_bothered'?'情绪-心烦':'情绪-安适';continue}
    const specificFactor=attr==='weather'&&f.influenceType==='雨天'||attr==='fishingLevel'&&f.influenceType==='等级高'||attr==='认真钓鱼buff'&&f.influenceType==='层数多'||['情绪-心烦','情绪-安适'].includes(attr)&&['','属于'].includes(f.influenceType)
    if(specificFactor){f.previewFactor='fishing';f.previewFishingFactor=attr;continue}
    if(['属于','不属于'].includes(f.influenceType))f.influenceType=f.influenceType==='属于'?'具有（1）':'不具有（0）'
    else if(!f.influenceType&&(aliases[attr]||attr.startsWith('personality_')))f.influenceType='具有（1）'
   }
  }
  for(const r of d.effectRules||[]){
   if(buffAliases[r.attribute]&&['+1','添加 Buff'].includes(r.influence)){
    const key=buffAliases[r.attribute];operation(r,'fishingEffect',['relax','new','specified','calm'].includes(key)?{effect:'emotion',emotion:key}:{effect:'buff',buff:buffId(key)})
   }
   else if(r.attribute==='buff:buff_showoff'&&r.influence==='+1')r.influence='添加 Buff'
   else if(r.attribute==='情绪buff'){
    const kind={'P↑A↓D↓':'relax','P↑A↑D→':'new','P↑A→D→':'specified','P→A→D→（变平静）':'calm'}[r.influence]
    if(kind)operation(r,'fishingEffect',{effect:'emotion',emotion:kind})
   }else if(r.attribute==='fishing_experience'&&['增','小增','大增'].includes(r.influence))operation(r,'fishingEffect',{effect:'experience',amount:{增:p.experience,小增:p.experienceSmall,大增:p.experienceLarge}[r.influence]})
   else if(['energy','leisure'].includes(r.attribute)&&r.influence==='增')r.previewFishingRecovery=true
  }
  if(name==='抛竿')d.previewFishingAction='cast'
  if(name==='拿着鱼竿站起来')d.previewFishingAction='stand'
  if(name==='坐到钓鱼椅上'||name==='突然惊醒')d.previewFishingAction='sit'
  if(['普通上鱼','一钩多鱼','巨大的鱼','钓出宝藏','发现新鱼','得到指定鱼','空军'].includes(name)&&n.type==='result')d.previewFishingAction=name
 }
 for(const issue of inspectFishingRoutes(config))notes.push(issue.where+'：'+issue.text)
 config.previewNotes=notes
 return {...file,config,notes,profile:{id:'fishCore',category:'采集',name:file.name}}
}
// Inspect actual outputs, not visual container portals or guessed parent returns.
export function inspectFishingRoutes(config){
 const issues=[],nodes=config.graph.nodes,edges=config.graph.edges
 for(const n of nodes){
  const outputs=n.type==='loop'?[['complete','循环完成']]:['start','result','wait'].includes(n.type)?[['','执行后续']]:n.type==='judge'?(n.data.branches||[]).map(b=>[b.id,b.name]):[]
  for(const [handle,label]of outputs){
   const exit=n.data.externalExits?.some(e=>(e.handle||'')===handle),matches=edges.filter(e=>e.source===n.id&&(e.sourceHandle||'')===handle)
   if(exit&&!matches.length)continue
   let text=''
   if(!matches.length)text='当前文件未保存这条出口连线，也没有跳出行为标记；不推定返回上层循环。'
   else if(exit||matches.length!==1)text='同一出口有多条连线或同时配置了跳出行为，无法确定执行去向。'
   else if(!nodes.some(node=>node.id===matches[0].target))text='出口连接的节点不存在。'
   if(text)issues.push({where:(n.data.name||n.id)+' / '+label,text,kind:'graph',nodeId:n.id,handle})
  }
 }
 return issues
}
export function fishingFactor(s,f){
 const a=s.world.find(e=>e.id===s.actor),kind=f.previewFishingFactor
 if(kind==='weather')return ['雨天','小雨','大雨'].includes(s.value(f))?1:0
 if(kind==='fishingLevel')return Math.max(0,Math.min(1,Number(s.value(f))/10))
 if(kind==='认真钓鱼buff')return Math.min(1,(a.buffs.fishing_focus||0)/5)
 if(kind==='fishing_posture'){const match=a.attrs.fishing_posture===f.fishingPostureValue;return (['不属于','不具有（0）'].includes(f.influenceType)?!match:match)?1:0}
 if(['nearby_butterfly','nearby_dragonfly'].includes(kind))return ['有','1',1,true].includes(s.value(f))?1:0
 if(kind==='情绪-心烦')return (a.pad?.[0]||0)<0?1:0
 if(kind==='情绪-安适')return (a.pad?.[0]||0)>0&&(a.pad?.[1]||0)<=0?1:0
 throw Error('未知钓鱼判断：'+kind)
}
export function fishingCondition(s,r){
 if(r.previewOp==='fishingTime')return s.elapsed-(s.loopStartedAt?.[r.loopId]??s.elapsed)>=r.amount
 if(r.previewOp==='fishingGoal')return (s.metrics[r.metric]||0)>=r.amount
 throw Error('未知钓鱼条件')
}
export function fishingEffect(s,r){
 const a=s.world.find(e=>e.id===s.actor),p=s.config.previewFishing,now=s.params.worldNow||0
 if(r.effect==='experience'){
  a.attrs.fishing_experience=(Number(a.attrs.fishing_experience)||0)+r.amount
  s.metrics.experience=(s.metrics.experience||0)+r.amount
  const base=s.initial.find(e=>e.id===s.actor).attrs
  a.attrs.fishingLevel=Math.min(10,Number(base.fishingLevel||0)+Math.floor(a.attrs.fishing_experience/p.levelExperience)-Math.floor(Number(base.fishing_experience||0)/p.levelExperience))
  s.log('钓鱼经验 +'+r.amount+'；等级 '+a.attrs.fishingLevel)
 }else if(r.effect==='buff')addBuff(a,r.buff,now,s.actor,{seconds:p.buffSeconds,...(r.buff==='fishing_focus'?{group:'fishing-focus',capacity:5}:{})})
 else if(r.effect==='emotion'){
  const pad=r.emotion==='calm'?(a.pad||[0,0,0]).map(v=>-Math.sign(v)*Math.min(10,Math.abs(v))):{relax:[10,-10,-10],new:[20,20,0],specified:[10,0,0]}[r.emotion]
  if(!pad)throw Error('未知钓鱼情绪')
  addBuff(a,buffId(r.emotion),now,s.actor,{seconds:p.buffSeconds,pad,group:'fishing-emotion',capacity:10})
 }else throw Error('未知钓鱼效果')
}
export function fishingNodeComplete(s,n){
 const action=n.data.previewFishingAction;if(!action)return
 const a=s.world.find(e=>e.id===s.actor)
 if(action==='stand'||action==='sit'){a.attrs.preview_fishing_standing=action==='stand'?'1':'0';a.attrs.preview_fishing_sitting=action==='sit'?'1':'0';a.attrs.fishing_posture=action==='stand'?'站姿':'坐姿'}
 if(action==='cast'){s.metrics.pendingCatch=0;return}
 if(['普通上鱼','一钩多鱼','巨大的鱼','钓出宝藏','空军'].includes(action)){
  s.metrics.rounds=(s.metrics.rounds||0)+1
  if(action==='空军'){s.metrics.pendingCatch=0;return}
  if(action==='钓出宝藏'){const key=s.lib.items.some(i=>i.id==='item/treasure_chest'&&i.enabled)?'item/treasure_chest':'preview:treasure';a.inventory[key]=(a.inventory[key]||0)+1;return}
  const count=action==='一钩多鱼'?2:1;s.metrics.pendingCatch=count;s.metrics.fish=(s.metrics.fish||0)+count
  a.inventory['preview:fish:common']=(a.inventory['preview:fish:common']||0)+count
  s.log('获得鱼（预览）×'+count)
  s.metrics.meat=Object.entries(a.inventory).filter(([id])=>s.lib.items.some(i=>i.id===id&&i.name==='肉类')).reduce((sum,[id,v])=>sum+v-(s.initial.find(e=>e.id===s.actor).inventory[id]||0),0)
 }
 if(['发现新鱼','得到指定鱼'].includes(action)){
  const count=Math.min(s.metrics.pendingCatch||0,a.inventory['preview:fish:common']||0),key=action==='发现新鱼'?'new':'specified'
  a.inventory['preview:fish:common']-=count;a.inventory['preview:fish:'+key]=(a.inventory['preview:fish:'+key]||0)+count;s.metrics.pendingCatch=0
 }
}
export function consumeFishingBait(s){
 if(!s.config.previewConsumeBait)return
 const a=s.world.find(e=>e.id===s.actor)
 if(!(a.buffs.design_fishing_bait>0))throw Error('缺少可用鱼饵')
 removeBuff(a,'design_fishing_bait');s.log('本次钓鱼消耗鱼饵1层')
}
export function finishFishing(s){
 if(s.config.previewIntegration!=='fishCore'||!['done','exited'].includes(s.status))return
 const a=s.world.find(e=>e.id===s.actor);while(a.buffs.fishing_focus)removeBuff(a,'fishing_focus');a.attrs.fishing_posture='未钓鱼';a.attrs.preview_fishing_standing='0';a.attrs.preview_fishing_sitting='0'
}
