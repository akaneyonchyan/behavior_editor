import LoopScopeSettings from './LoopScopeSettings'
import BranchDestination,{BranchPort} from './BranchDestination'
import React,{useEffect} from 'react'
import {useBehaviorStore} from '../store/behaviorStore'
import {useContentLibrary} from '../store/contentLibrary'
import {useUpdateNodeInternals} from 'reactflow'
import LibraryRules from './LibraryRules'
import {RuleText} from './DesignInputs'
import './LoopEditor.css'

export function LoopGoalSummary({data}){
 if(data.loopMode==='count'||(!data.completionCondition&&!data.completionRules?.length))return null
 return <div className="loop-goal-summary">{data.completionCondition}{data.completionRules?.map(r=><div key={r.id}><RuleText rule={r} kind={r.attribute?.startsWith('buff:')?'buff':'attribute'} influences={['较低时','较高时','处于指定状态时','具有指定 Buff 时','不具有指定 Buff 时']}/></div>)}</div>
}
export function LoopConditionSummary({data}){
 return <><div className="loop-condition-summary"><strong>执行条件</strong><span>{data.loopMode==='count'?'按最大次数 · '+(data.maxIterations||'待设置')+' 次':'按目标满足情况 · 未满足时继续'}</span></div><LoopGoalSummary data={data}/></>
}
export function LoopNodeStages({id,data}) {
 const library=useContentLibrary(s=>s.library),updateInternals=useUpdateNodeInternals()
 useEffect(()=>{updateInternals(id)},[id,data,library,updateInternals])
 return <div className="loop-stages"><LoopConditionSummary data={data}/><p>每轮执行前判定；本轮结束后自动进入下一次判定</p>{[['continue','循环体起点'],['complete','循环结束']].map(([handle,label])=><div key={handle} className="loop-output"><span>{label}</span><BranchPort data={data} handle={handle}/></div>)}</div>
}
export default function LoopFields({node}){
 const {updateNode}=useBehaviorStore()
 const d=node.data,update=patch=>updateNode(node.id,patch)
 return <div className="loop-editor">
  <div className="form-group"><label>循环执行条件</label><select aria-label="循环执行条件" value={d.loopMode||'goal'} onChange={e=>update({loopMode:e.target.value})}><option value="count">按配置的最大次数</option><option value="goal">按目标满足情况</option></select></div>
  {d.loopMode==='count'?<div className="form-group"><label>最大次数</label><input aria-label="最大次数" value={d.maxIterations||''} placeholder="填写次数或设计期望" onChange={e=>update({maxIterations:e.target.value})}/><p className="form-hint">执行前检查已完成轮数；达到最大次数则离开循环。</p></div>:<>
   <p className="form-hint">每轮执行前检查目标是否满足；满足则离开，未满足才执行内部节点。未单独配置时，引用行为准入数据中的满足目标。</p>
   {(d.completionCondition||d.completionRules?.length>0)&&<details><summary>目标满足条件</summary><textarea aria-label="目标满足条件" value={d.completionCondition||''} onChange={e=>update({completionCondition:e.target.value})}/><LibraryRules title="目标满足属性条件" value={d.completionRules} onChange={completionRules=>update({completionRules})}/></details>}
  </>}
  <BranchDestination node={node} handle="continue" label="进入循环体"/>
  <BranchDestination node={node} handle="complete" label="循环结束后去向"/>
  <p className="form-hint">准入用内部判断节点，个性待机用内部待机节点。末尾不用画回线，确认范围时自动补齐返回关系。</p>
  <LoopScopeSettings key={node.id} node={node}/>
 </div>
}
