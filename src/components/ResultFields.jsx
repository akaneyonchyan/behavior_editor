import React from 'react'
import {useBehaviorStore} from '../store/behaviorStore'
import TextChoice from './TextChoice'
import {PropertyInputs} from './DesignInputs'
import {resultRules,CHANGES,PLAY_MODES} from '../utils/nodeDesign'
export default function ResultFields({node}){
  const updateNode=useBehaviorStore(s=>s.updateNode),data=node.data
  const update=patch=>updateNode(node.id,patch)
  const setRules=(kind,next)=>update({effectRules:[...resultRules(data,kind==='buff'?'attribute':'buff'),...next.map(r=>({...r,kind}))]})
  return <>
    <div className="form-group"><label>表演描述</label><textarea value={data.animation||''} onChange={e=>update({animation:e.target.value})}/></div>
    <div className="form-group"><label>播放方式</label><TextChoice label="播放方式" value={data.playMode||'单次'} options={PLAY_MODES} onChange={playMode=>update({playMode})}/></div>
    {['计次','计时'].includes(data.playMode)&&<div className="form-group"><label>{data.playMode==='计次'?'次数期望':'时长期望'}</label><input value={data.playExpectation||''} placeholder={data.playMode==='计次'?'例如：3次，或多次':'例如：10秒，或短暂播放'} onChange={e=>update({playExpectation:e.target.value})}/></div>}
    {['attribute','buff'].map(kind=>{const rules=resultRules(data,kind),title=kind==='buff'?'Buff':'属性';return <div className="weight-factors" key={kind}><div className="section-header"><label>{title}</label><button className="btn-small" onClick={()=>setRules(kind,[...rules,{id:crypto.randomUUID(),source:'actor',attribute:'',influence:'增'}])}>+ 添加{title}</button></div>
      {rules.map((r,i)=><div className="weight-factor" key={r.id||i}><div className="factor-actions"><strong>{title} {i+1}</strong><button className="btn-small" onClick={()=>setRules(kind,rules.filter((_,j)=>i!==j))}>删除</button></div><PropertyInputs kind={kind} rule={r} onChange={patch=>setRules(kind,rules.map((row,j)=>i===j?{...row,...patch}:row))}/><label>增 / 减<TextChoice label={title+'增减'} options={CHANGES} value={r.influence} onChange={influence=>setRules(kind,rules.map((row,j)=>i===j?{...row,influence}:row))}/></label></div>)}
    </div>})}
    {!!data.attributeChanges?.length&&<div className="form-group"><label>旧版文字变更（待整理，原文保留）</label><textarea className="custom-choice" value={data.attributeChanges.join('\n')} onChange={e=>update({attributeChanges:e.target.value.split('\n')})}/></div>}
    <div className="weight-factors"><div className="section-header"><label>产物</label><button className="btn-small" onClick={()=>update({outputs:[...(data.outputs||[]),'']})}>+ 添加产物</button></div>
      <p className="form-hint">公共库尚无具体产物目录；产物名可自由填写，以下划线标记并保留。</p>
      {(data.outputs||[]).map((o,i)=><div className="weight-factor" key={i}><div className="factor-actions"><strong>产物 {i+1}</strong><button className="btn-small" onClick={()=>update({outputs:data.outputs.filter((_,j)=>i!==j)})}>删除</button></div><TextChoice label="产物名" options={[]} value={typeof o==='string'?o:JSON.stringify(o)} onChange={value=>update({outputs:data.outputs.map((row,j)=>i===j?value:row)})}/></div>)}
    </div>
  </>
}
