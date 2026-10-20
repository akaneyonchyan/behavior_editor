import {INFLUENCE_TYPES,INFLUENCE_RULES} from './influenceRules'
import {sourceChoices,sourceType,sourceName,propertyChoices,propertyName,objectChoices,objectName} from '../store/contentLibrary'
import {judgeAttributes,branchFactors,PROBABILITIES,EFFECTS,CHANGES,PLAY_MODES} from './nodeDesign'
import {GOAL_TYPES,CONSUMPTION_TYPES,normalizeMetadata} from './behaviorMetadata'
import {EXPECTATIONS} from './weightFactors'
import {NODE_CONFIG} from '../constants/behaviorTypes'

export const REQUIREMENT_TABS={attributes:'属性',objects:'对象',buffs:'Buff',performances:'表演'}
const CONDITIONS=['较低时','较高时','处于指定状态时','具有指定 Buff 时','不具有指定 Buff 时']
const asText=value=>typeof value==='string'?value:value==null?'':JSON.stringify(value)
// Read-only inventory of explicit design choices, not a runtime capability verdict.
export function collectRequirements(info,nodes,lib){
 const groups=new Map(),result=Object.fromEntries(Object.keys(REQUIREMENT_TABS).map(k=>[k,[]]))
 const add=(tab,field,value,reason,loc,context='',display=value)=>{
  value=asText(value);if(!value.trim())return
  const key=JSON.stringify([tab,field,value,reason,context])
  let item=groups.get(key)
  if(!item){item={key,tab,field,value,display:asText(display),reason,context,locations:[]};groups.set(key,item);result[tab].push(item)}
  if(!item.locations.some(l=>l.nodeId===loc.nodeId&&l.path===loc.path))item.locations.push(loc)
 }
 const choice=(tab,field,value,options,loc,context='')=>{if(value&&!options.includes(value))add(tab,field,value,'自定义规则，当前编辑器未提供标准选项',loc,context)}
 const object=(type,value,loc)=>{
  if(!value)return
  const candidates=objectChoices(lib,type)
  if(candidates.some(o=>o.id===value||(!value.startsWith('item:')&&o.name===value)))return
  const found=(lib.items||[]).find(o=>'item:'+o.id===value||(!value.startsWith('item:')&&o.objectType===type&&o.name===value))
  const reason=found?(!found.enabled?'对象已停用':found.objectType!==type?'对象不属于所选类型':'对象类型已停用'):!type?'未选择有效对象类型，无法匹配对象':'对象未收录或引用已失效'
  add('objects','对象名',value,reason,loc,lib.objects.find(o=>o.id===type)?.name||type||'类型未配置',objectName(lib,value))
 }
 const source=(value,loc)=>{
  if(value&&!sourceChoices(lib).some(o=>o.id===value||o.name===value)){
   const found=lib.objects.find(o=>'object:'+o.id===value)
   add('objects','对象来源',value,found&&!found.enabled?'对象类型已停用':'对象来源未收录或为旧版身份',loc,'',sourceName(lib,value))
  }
 }
 const type=(value,loc)=>{
  if(value&&!lib.objects.some(o=>o.enabled&&(o.id===value||o.name===value)))add('objects','对象类型',value,lib.objects.some(o=>o.id===value)?'对象类型已停用':'对象类型未收录',loc,'',lib.objects.find(o=>o.id===value)?.name||value)
 }
 const rule=(r,loc,influences,kind,includeIdentity=true)=>{
  const buff=kind?kind==='buff':r.attribute?.startsWith('buff:'),tab=buff?'buffs':'attributes'
  const context=[sourceName(lib,r.source),r.objectName?objectName(lib,r.objectName):''].filter(Boolean).join(' · ')
  if(includeIdentity){
   source(r.source,loc);object(sourceType(r.source),r.objectName,loc)
   const options=propertyChoices(lib,r.source).filter(p=>kind?buff===p.id.startsWith('buff:'):true)
   if(r.attribute&&!options.some(p=>p.id===r.attribute||p.name===r.attribute)){
    const rows=buff?lib.buffs:lib.attributes,found=rows.find(p=>(buff?'buff:'+p.id:p.id)===r.attribute||(buff?'Buff · '+p.name:p.name)===r.attribute)
    const reason=!found?'未收录或引用已失效':!found.enabled?'条目已停用':!sourceType(r.source)?'对象来源未配置或无法识别':'不适用于所选对象或对象类型已停用'
    add(tab,buff?'Buff名':'属性名',r.attribute,reason,loc,context,propertyName(lib,r.attribute))
   }
  }
  if(r.influenceType!==undefined&&r.influenceRule!==undefined){choice(tab,'影响类型',r.influenceType,INFLUENCE_TYPES,loc,context);choice(tab,'影响规则',r.influenceRule,INFLUENCE_RULES,loc,[context,propertyName(lib,r.attribute)].join(' · '))}
  else if(influences)choice(tab,'规则 / 影响方式',r.influence,influences,loc,[context,propertyName(lib,r.attribute)].filter(Boolean).join(' · '))
 }
 const start=nodes.find(n=>n.type==='start'),loc=(node,path)=>({nodeId:node?.id||null,label:node?.type==='start'?'开始 · 行为准入数据':node?.data?.name||NODE_CONFIG[node?.type]?.label||'行为准入数据',path})
 const metadata=normalizeMetadata(info),p=metadata.preconditions
 metadata.targetRules.forEach((r,i)=>rule(r,loc(start,'满足目标 '+(i+1)),GOAL_TYPES,'attribute'))
 p.interactObjectRules.forEach((r,i)=>{const l=loc(start,'交互对象 '+(i+1));type(r.objectType,l);object(r.objectType,r.objectName,l)})
 p.consumableRules.forEach((r,i)=>{const l=loc(start,'消耗品 '+(i+1));type(r.objectType,l);object(r.objectType,r.objectName,l);choice('objects','消耗品要求',r.requirement,CONSUMPTION_TYPES,l)})
 p.attributeRules.forEach((r,i)=>rule(r,loc(start,'准入条件 '+(i+1)),CONDITIONS))
 for(const node of nodes){
  const d=node.data||{},at=path=>loc(node,path)
  if(['move','result'].includes(node.type))(d.occupiedResources||[]).forEach((r,i)=>rule(r,at('占用资源 '+(i+1)),null,'attribute'))
  if(node.type==='move'&&d.destinationType!=='coordinate'){type(d.objectType,at('交互对象类型'));object(d.objectType,d.objectName??d.destination,at('位移对象'))}
  if(node.type==='judge'){
   const attrs=judgeAttributes(d)
   attrs.forEach((r,i)=>rule(r,at('参与判断属性 '+(i+1)),null,'attribute'))
   ;(d.branches||[]).forEach((b,i)=>{const label='分支 '+(i+1)+(b.name?' · '+b.name:'');choice('attributes','默认概率',b.weightExpectation,PROBABILITIES,at(label));branchFactors(b,attrs).forEach((r,j)=>rule(r,at(label+' / 属性影响 '+(j+1)),EFFECTS,'attribute',false))})
  }
  if(node.type==='result'){
   (d.effectRules||[]).forEach((r,i)=>rule(r,at('执行输出 '+(i+1)),CHANGES,r.kind||(r.attribute?.startsWith('buff:')?'buff':'attribute')))
   ;(d.attributeChanges||[]).forEach((v,i)=>add('attributes','旧版属性变化',v,'旧版自由文字，待整理为结构化规则',at('旧版属性变化 '+(i+1))))
   ;(d.outputs||[]).forEach((v,i)=>add('objects','产物',v,'产物尚未绑定对象类型及名录，待核对',at('产物 '+(i+1))))
  }
   if(node.type==='loop'&&Array.isArray(d.loopConditions)){
    d.loopConditions.forEach((c,i)=>{if(c.kind==='goal')(c.rules||[]).forEach((r,j)=>rule(r,at('循环结束条件 '+(i+1)+' · 属性 '+(j+1)),CONDITIONS))})
   }else if(node.type==='loop'&&!(d.loopVersion===3&&d.loopMode==='count')){
   for(const [key,label] of [['completionRules','目标达成条件'],...(d.admissionEnabled!==false?[['resourceRules','准入条件']]:[]),['loopRules','旧循环条件'],...(d.restEnabled!==false?[['restRules','稍息条件']]:[])])(d[key]||[]).forEach((r,i)=>rule(r,at(label+' '+(i+1)),CONDITIONS))
   if(d.restEnabled!==false)choice('attributes','稍息发生倾向',d.restExpectation,EXPECTATIONS,at('稍息发生倾向'))
  }
  if(['result','end'].includes(node.type)){
   for(const [key,label] of [['animation','表演描述'],...(node.type==='end'?[['successAnimation','旧完成表演'],['failAnimation','旧中断表演']]:[])])add('performances','表演资产',d[key],'待核对资产（尚未接入表演资产库）',at(label))
   choice('performances','播放方式',d.playMode,PLAY_MODES,at('播放方式'))
  }
 }
 return result
}
export function collectOnlineRequirements(files,lib){
 const report=Object.fromEntries(Object.keys(REQUIREMENT_TABS).map(k=>[k,[]])),groups=new Map()
 for(const file of files){
  const result=collectRequirements(file.config.behavior,file.config.graph.nodes,lib)
  for(const tab of Object.keys(REQUIREMENT_TABS))for(const row of result[tab]){
   let merged=groups.get(row.key)
   if(!merged){merged={...row,locations:[],files:[]};groups.set(row.key,merged);report[tab].push(merged)}
   if(!merged.files.some(f=>f.name===file.name))merged.files.push({name:file.name,behaviorName:file.config.behavior.name,sha:file.sha})
   for(const location of row.locations){
    if(!merged.locations.some(l=>l.fileName===file.name&&l.nodeId===location.nodeId&&l.path===location.path))
     merged.locations.push({...location,fileName:file.name,fileSha:file.sha,behaviorName:file.config.behavior.name})
   }
  }
 }
 return report
}
export function requirementsMarkdown(report,name,syncedAt,scope={}){
 const escape=v=>String(v??'').replace(/\|/g,'\\|').replace(/\r?\n/g,'<br>')
 const lines=['# '+String(name||'未命名行为').replace(/[\r\n]/g,' ')+' · 需求清单','','依据公共库快照：'+(syncedAt||'本机公共库'),(scope.online?'核对已发布在线文件；':'仅核对当前行为图；')+'未匹配不等于游戏不支持。表演资产均待人工核对。','']
 if(scope.online){
  lines.push('读取成功 '+scope.files.length+' / '+scope.total+' 个文件；在线快照：'+(scope.publishedAt||'时间未提供'),'')
  if(scope.failures?.length)lines.push('注意：清单不完整，以下文件读取失败：',...scope.failures.map(f=>'- '+escape(f.name)+'：'+escape(f.message)),'')
 }
 for(const [tab,title] of Object.entries(REQUIREMENT_TABS)){
  lines.push('## '+title+'（'+report[tab].length+'）','','| 内容 | 字段 | 对象 / 属性上下文 | 原因 | 使用位置 |','|---|---|---|---|---|')
  for(const row of report[tab])lines.push('| '+[row.display,row.field,row.context,row.reason,row.locations.map(l=>(l.fileName?l.fileName+'（'+l.behaviorName+'） / ':'')+l.label+' ['+(l.nodeId||'准入')+'] / '+l.path).join('\n')].map(escape).join(' | ')+' |')
  if(!report[tab].length)lines.push('| 暂无待核对内容 | | | | |')
  lines.push('')
 }
 return lines.join('\n')
}

