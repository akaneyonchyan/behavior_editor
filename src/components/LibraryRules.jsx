import React from 'react'
import TextChoice from './TextChoice'
import ObjectNameInput, {ObjectNameText} from './ObjectNameInput'
import {sourceType} from '../store/contentLibrary'
import { useContentLibrary, sourceChoices, sourceName, propertyChoices, propertyName } from '../store/contentLibrary'
export function RuleInputs({rule,onChange,influences,influenceLabel='规则描述'}) {
  const lib=useContentLibrary(s=>s.library), sources=sourceChoices(lib), properties=propertyChoices(lib,rule.source)
  const missing=rule.attribute&&!properties.some(p=>p.id===rule.attribute||p.name===rule.attribute)
  return <>
    <label>属性来源<TextChoice label="属性来源" options={sources.map(s=>s.name)} value={sourceName(lib,rule.source)} placeholder="选择对象类型或填写具体对象" onChange={name=>onChange({source:sources.find(s=>s.name===name)?.id||name})}/></label>
    <ObjectNameInput type={sourceType(rule.source)} value={rule.objectName} onChange={objectName=>onChange({objectName})}/>
    <label>属性名<TextChoice label="属性名" options={properties.map(p=>p.name)} value={rule.attribute?propertyName(lib,rule.attribute):''} placeholder="选择属性或 Buff" onChange={name=>onChange({attribute:properties.find(p=>p.name===name)?.id||name})}/></label>
    {missing&&<p className="form-hint">当前条目未在该对象的可选库中，已保留原值。可改选或在公共库中补充适用对象。</p>}
    {!properties.length&&<p className="form-hint">该来源暂无候选项，可先填写文字，再到公共库补充。</p>}
    <label>{influenceLabel}<TextChoice label={influenceLabel} options={influences} value={rule.influence||''} placeholder="描述规则和大致期望" onChange={influence=>onChange({influence})}/></label>
  </>
}
export default function LibraryRules({title,value=[],onChange,mode='condition',showEmptyRow=false}) {
  const influences=mode==='goal'?['提升至期望状态','降低至期望状态','恢复至正常状态','达到指定状态','获得指定 Buff','移除指定 Buff']:mode==='change'?['增加','减少','恢复','设置为指定状态','添加 Buff','移除 Buff']:['较低时','较高时','处于指定状态时','具有指定 Buff 时','不具有指定 Buff 时']
  return <div className="weight-factors"><div className="section-header"><label>{title}</label><button className="btn-small" onClick={()=>onChange([...value,{id:crypto.randomUUID(),source:'',attribute:'',influence:''}])}>+ 添加规则</button></div>
    {showEmptyRow&&!value.length&&<div className="weight-factor"><RuleInputs rule={{source:'',attribute:'',influence:''}} influences={influences} onChange={patch=>onChange([{id:crypto.randomUUID(),source:'',attribute:'',influence:'',...patch}])}/><p className="form-hint">直接选择上面的选项即可添加规则；留空不计入配置。</p></div>}
    {mode==='condition'&&value.length>1&&<p className="form-hint">以下规则需要同时满足。</p>}
    {value.map((r,i)=><div className="weight-factor" key={r.id}><div className="factor-actions"><strong>规则 {i+1}</strong><button className="btn-small" onClick={()=>onChange(value.filter((_,j)=>j!==i))}>删除</button></div><RuleInputs rule={r} influences={influences} onChange={patch=>onChange(value.map((row,j)=>j===i?{...row,...patch}:row))}/></div>)}
  </div>
}
