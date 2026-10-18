import React from 'react'
import {useBehaviorStore} from '../store/behaviorStore'
import {useState} from 'react'
import {END_REASONS,isLegacyEnd,inferredEndReason} from '../utils/endings'
import TextChoice from './TextChoice'
import {PLAY_MODES} from '../utils/nodeDesign'
export default function EndFields({node}) {
 const [assignments,setAssignments]=useState({}),[error,setError]=useState('')
 const graph=useBehaviorStore(),legacy=isLegacyEnd(node.data)
 const update=patch=>useBehaviorStore.getState().updateNode(node.id,patch),d=node.data
 if(legacy)return <div className="weight-factors">
   <h4>旧结束节点需要拆分</h4><p className="form-hint">原始表演与结算配置已保留。确认每条入线的结束类型后，拆成两个独立节点；可撤销。</p>
   <p>完成表演：{d.successAnimation||'未配置'}</p><p>中断表演：{d.failAnimation||'未配置'}</p>
   {graph.edges.filter(e=>e.target===node.id).map(e=><label key={e.id}>{graph.nodes.find(n=>n.id===e.source)?.data.name||e.source} · {e.sourceHandle||'默认出口'}<select aria-label={'结束入线 '+e.id} value={assignments[e.id]||inferredEndReason(e,graph.nodes)} onChange={event=>setAssignments({...assignments,[e.id]:event.target.value})}><option value="">请选择归属</option>{END_REASONS.map(r=><option key={r}>{r}</option>)}</select></label>)}
   {error&&<p role="alert">{error}</p>}<button className="btn-primary" onClick={()=>{try{graph.splitEnd(node.id,assignments);setError('')}catch(e){setError(e.message)}}}>拆分为完成／中断结束</button>
 </div>
 return <>
  <div className="form-group"><label>结束类型</label><TextChoice label="结束类型" options={['完成','中断']} value={d.endReason||''} onChange={endReason=>update({endReason})}/></div>
  <div className="form-group"><label>结束表演</label><textarea aria-label="结束表演" value={d.animation||''} onChange={e=>update({animation:e.target.value})}/></div>
  <div className="form-group"><label>播放方式</label><TextChoice label="结束播放方式" options={PLAY_MODES} value={d.playMode??'单次'} onChange={playMode=>update({playMode})}/></div>
  {['计次','计时'].includes(d.playMode)&&<div className="form-group"><label>{d.playMode==='计次'?'次数期望':'时长期望'}</label><input aria-label="结束播放期望" value={d.playExpectation||''} onChange={e=>update({playExpectation:e.target.value})}/></div>}
  <div className="form-group"><label>资源释放（按顺序，每行一项）</label><textarea aria-label="结束资源释放" value={(d.releaseResources||[]).join('\n')} onChange={e=>update({releaseResources:e.target.value.split('\n')})}/><p className="form-hint">留空沿用通用顺序：交互物点位 → 空地 → 伙伴占用状态。</p></div>
  <div className="form-group"><label>目标判定规则</label><textarea aria-label="结束目标判定" value={d.targetCondition||''} onChange={e=>update({targetCondition:e.target.value})}/><p className="form-hint">达成后匹配下一目标；未达成则重新匹配行为。结束类型不代替目标判定。</p></div>
 </>
}
