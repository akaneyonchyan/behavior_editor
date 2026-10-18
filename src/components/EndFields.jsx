import React from 'react'
import {useBehaviorStore} from '../store/behaviorStore'
import {useState} from 'react'
import {END_REASONS,isLegacyEnd,inferredEndReason} from '../utils/endings'
import {ReleaseSummary} from './OccupiedResources'
import TextChoice from './TextChoice'
import {PLAY_MODES} from '../utils/nodeDesign'
export default function EndFields({node}) {
 const [assignments,setAssignments]=useState({}),[error,setError]=useState('')
 const graph=useBehaviorStore(),legacy=isLegacyEnd(node.data)
 const update=patch=>useBehaviorStore.getState().updateNode(node.id,patch),d=node.data
 if(legacy)return <div className="weight-factors">
   <h4>旧结束节点需要拆分</h4><p className="form-hint">原始表演与结算配置已保留。确认每条入线对应的旧表演后，拆成两个独立节点；可撤销。</p>
   <p>完成表演：{d.successAnimation||'未配置'}</p><p>中断表演：{d.failAnimation||'未配置'}</p>
   {graph.edges.filter(e=>e.target===node.id).map(e=><label key={e.id}>{graph.nodes.find(n=>n.id===e.source)?.data.name||e.source} · {e.sourceHandle||'默认出口'}<select aria-label={'结束入线 '+e.id} value={assignments[e.id]||inferredEndReason(e,graph.nodes)} onChange={event=>setAssignments({...assignments,[e.id]:event.target.value})}><option value="">请选择归属</option>{END_REASONS.map(r=><option key={r} value={r}>{r==='完成'?'表演1（旧成功表演）':'表演2（旧失败表演）'}</option>)}</select></label>)}
   {error&&<p role="alert">{error}</p>}<button className="btn-primary" onClick={()=>{try{graph.splitEnd(node.id,assignments);setError('')}catch(e){setError(e.message)}}}>拆分为两个结束节点</button>
 </div>
 return <>
  <ReleaseSummary id={node.id} panel/>
  {!!d.releaseResources?.length&&<details><summary>旧版释放说明（仅供核对）</summary><p className="form-hint">原文保留，但不参与自动引用；请在前序节点声明对应占用。</p><ul>{d.releaseResources.map((text,i)=><li key={i}>{text}</li>)}</ul></details>}
  <div className="form-group"><label>结束表演</label><textarea aria-label="结束表演" value={d.animation||''} onChange={e=>update({animation:e.target.value})}/></div>
  <div className="form-group"><label>播放方式</label><TextChoice label="结束播放方式" options={PLAY_MODES} value={d.playMode??'单次'} onChange={playMode=>update({playMode})}/></div>
  {['计次','计时'].includes(d.playMode)&&<div className="form-group"><label>{d.playMode==='计次'?'次数期望':'时长期望'}</label><input aria-label="结束播放期望" value={d.playExpectation||''} onChange={e=>update({playExpectation:e.target.value})}/></div>}
 </>
}
