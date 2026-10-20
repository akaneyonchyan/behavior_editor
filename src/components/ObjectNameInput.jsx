import React from 'react'
import TextChoice from './TextChoice'
import {useContentLibrary,objectChoices,objectName} from '../store/contentLibrary'

export default function ObjectNameInput({type,value,onChange}){
  const lib=useContentLibrary(s=>s.library),options=objectChoices(lib,type)
  const name=objectName(lib,value),valid=!value||options.some(o=>o.id===value||(!value.startsWith('item:')&&o.name===value))
  return <label className={valid?'':'object-name-custom'}>对象子类<TextChoice label="对象子类" invalid={!valid} options={options.map(o=>o.name)} value={name} placeholder="选择对象子类或自由填写（可留空）" onChange={text=>onChange(options.find(o=>o.name===text)?.id||text)}/></label>
}
export function ObjectNameText({type,value}){
  const lib=useContentLibrary(s=>s.library),options=objectChoices(lib,type)
  if(!value)return null
  const valid=options.some(o=>o.id===value||(!value.startsWith('item:')&&o.name===value))
  return <span className={valid?'':'custom-choice'}>{objectName(lib,value)}</span>
}

