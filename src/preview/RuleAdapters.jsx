import React from 'react'
import {allRules} from './runtime.mjs'
export function adaptPreview(config,adapters){
 const copy=structuredClone(config)
 for(const [i,{r}] of allRules(copy).entries())if(adapters[i])Object.assign(r,adapters[i])
 return copy
}
export default function RuleAdapters({config,library,adapters,onChange,disabled}){
 const rows=allRules(config)
 const choice=(value,options,change,label)=><select aria-label={label} disabled={disabled} value={value||''} onChange={e=>change(e.target.value)}>{!options.some(o=>o.value===value)&&<option value={value||''}>{value||'未填写'}</option>}{options.map(o=><option key={o.value} value={o.value}>{o.label||o.value}</option>)}</select>
 const options=values=>values.map(value=>({value}))
 return <details><summary>预览规则适配（不会修改原稿）</summary><p className="preview-help">自定义规则可在此明确映射为可运行规则。改变后需重新绑定对象。这里只适配本次预览；切换文件即清除。</p>{rows.map(({r:original,where,mode},i)=>{
  if(['object','occupy','unsupported'].includes(mode))return null
  const r={...original,...adapters[i]},type=(r.source||'').replace(/^object:/,''),patch=p=>onChange({...adapters,[i]:{...adapters[i],...p}})
  const attrs=[...library.attributes.map(a=>({...a,value:a.id})),...library.buffs.map(a=>({...a,value:'buff:'+a.id}))].filter(a=>a.enabled&&a.objectTypes?.includes(type)).map(a=>({value:a.value,label:a.name}))
  return <details key={i} className="rule-adapter"><summary>{where} · {original.attribute||'未填写'}</summary><small>原文：{original.influence||[original.influenceType,original.influenceRule].join(' / ')}</small>
   {choice(r.source,library.objects.filter(o=>o.enabled).map(o=>({value:'object:'+o.id,label:o.name})),source=>patch({source,objectName:''}),'适配对象类型')}
   {choice(r.attribute,attrs,attribute=>patch({attribute}),'适配判断项')}
   {mode==='factor'?<>{choice(r.influenceType,options(['数值高','数值低','具体值','具有（1）','不具有（0）']),influenceType=>patch({influenceType}),'适配影响类型')}{choice(r.influenceRule,options(['概率越高','概率越低','允许选中','排除选中','不影响']),influenceRule=>patch({influenceRule}),'适配影响规则')}</>:choice(r.influence,options(mode==='effect'?['增','减','恢复']:['较高时','较低时','增加','减少','改变','具有指定 Buff 时','不具有指定 Buff 时','为空','不为空']),influence=>patch({influence}),'适配规则')}
  </details>
 })}</details>
}
