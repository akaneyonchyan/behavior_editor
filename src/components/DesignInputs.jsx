import React from 'react'
import TextChoice from './TextChoice'
import ObjectNameInput, {ObjectNameText} from './ObjectNameInput'
import {sourceType} from '../store/contentLibrary'
import { useContentLibrary,sourceChoices,sourceName,propertyChoices,propertyName } from '../store/contentLibrary'
export function choicesFor(lib,source,kind='attribute'){return propertyChoices(lib,source).filter(p=>kind==='buff'?p.id.startsWith('buff:'):!p.id.startsWith('buff:'))}
export function ChoiceText({value,options}){return <span className={value&&!options.includes(value)?'custom-choice':''}>{value||'未配置'}</span>}
export function PropertyInputs({rule,onChange,kind='attribute'}){
  const lib=useContentLibrary(s=>s.library),sources=sourceChoices(lib),properties=choicesFor(lib,rule.source,kind)
  return <>
    <label>对象来源<TextChoice label="对象来源" options={sources.map(s=>s.name)} value={sourceName(lib,rule.source)} onChange={name=>onChange({source:sources.find(s=>s.name===name)?.id||name})}/></label>
    <ObjectNameInput type={sourceType(rule.source)} value={rule.objectName} onChange={objectName=>onChange({objectName})}/>
    <label>{kind==='buff'?'Buff名':'属性名'}<TextChoice label={kind==='buff'?'Buff名':'属性名'} options={properties.map(p=>p.name)} value={propertyName(lib,rule.attribute)} onChange={name=>onChange({attribute:properties.find(p=>p.name===name)?.id||name})}/></label>
  </>
}
export function RuleText({rule,kind='attribute',influences}){
  const lib=useContentLibrary(s=>s.library)
  return <><ChoiceText value={sourceName(lib,rule.source)} options={sourceChoices(lib).map(s=>s.name)}/>{rule.objectName&&<> · <ObjectNameText type={sourceType(rule.source)} value={rule.objectName}/></>} · <ChoiceText value={propertyName(lib,rule.attribute)} options={choicesFor(lib,rule.source,kind).map(p=>p.name)}/> · <ChoiceText value={rule.influence} options={influences}/></>
}
