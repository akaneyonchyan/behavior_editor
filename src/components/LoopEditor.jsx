import LoopScopeSettings from './LoopScopeSettings'
import BranchDestination,{BranchPort} from './BranchDestination'
import {useDisplayGraph} from '../store/graphDisplay'
import React, { useEffect, useState } from 'react'
import { useBehaviorStore } from '../store/behaviorStore'
import { useContentLibrary, ruleSummary } from '../store/contentLibrary'
import { Handle, Position, useUpdateNodeInternals } from 'reactflow'
import LibraryRules from './LibraryRules'
import {RuleText} from './DesignInputs'
import TextChoice from './TextChoice'
import { EXPECTATIONS } from '../utils/weightFactors'
import { LOOP_OUTPUTS, isLoopOutputEnabled } from '../utils/loopFlow'
import './LoopEditor.css'

export function LoopGoalSummary({data}){
 if(data.loopMode==='count'||(!data.completionCondition&&!data.completionRules?.length))return null
 return <div className="loop-goal-summary">{data.completionCondition}{data.completionRules?.map(r=><div key={r.id}><RuleText rule={r} kind={r.attribute?.startsWith('buff:')?'buff':'attribute'} influences={['较低时','较高时','处于指定状态时','具有指定 Buff 时','不具有指定 Buff 时']}/></div>)}</div>
}
export function LoopConditionSummary({data}){
 return <><div className="loop-condition-summary"><strong>执行条件</strong><span>{data.loopVersion===3?(data.loopMode==='count'?'按最大次数 · '+(data.maxIterations||'待设置')+' 次':'按目标满足情况 · 未满足时继续'):'旧版循环 · 目标判定'}{data.loopVersion!==3&&<small>准入／稍息请拆分为内部节点</small>}</span></div><LoopGoalSummary data={data}/></>
}
export function LoopNodeStages({id,data}) {
  const library=useContentLibrary(s=>s.library)
  const legacy=useDisplayGraph(s=>s.edges.some(e=>e.source===id&&!e.sourceHandle))
  const updateInternals=useUpdateNodeInternals()
  useEffect(()=>{updateInternals(id)},[id,legacy,data,library,updateInternals])
  const enabled=data.restEnabled!==false,admission=data.admissionEnabled!==false
  const summary=(text,rules)=>!text&&!rules?.length?'待配置规则':<>{text}{(rules||[]).map((r,i)=><React.Fragment key={r.id}>{(text||i>0)?'；':''}<RuleText rule={r} kind={r.attribute?.startsWith('buff:')?'buff':'attribute'} influences={['较低时','较高时','处于指定状态时','具有指定 Buff 时','不具有指定 Buff 时']}/></React.Fragment>)}</>
  const output=(handle,label,disabled=false)=><div className={'loop-output '+(disabled?'inactive':'')}><span>{label}</span><BranchPort data={data} handle={handle} disabled={disabled}/></div>
  if(data.loopVersion===3)return <div className="loop-stages"><LoopConditionSummary data={data}/><p>每轮执行前判定；本轮结束后自动进入下一次判定</p>{output('continue','进入循环体')}{output('complete','循环结束')}</div>
  return <div className="loop-stages"><p className="form-hint">{data.checkTiming==='before'?'先判定能否进入本轮，再执行内部节点':'旧图时序待核对'}</p>
    <section><strong>① 目标达成判定</strong><p>{summary(data.completionCondition,data.completionRules)}</p>
      {data.loopCondition&&<p className="loop-legacy">旧条件待核对：{data.loopCondition}</p>}
      {data.loopRules?.length>0&&<p className="loop-legacy">旧属性规则待核对：{summary('',data.loopRules)}</p>}
      {output('complete','达成')}{admission||enabled?<div className="loop-down">未达成 ↓ {admission?'准入检查':'稍息判定'}</div>:output('continue','未达成 → 继续执行')}</section>
    {admission&&<section><strong>② 准入检查</strong><p>{summary(data.resourceCheck,data.resourceRules)}</p>
      {output('insufficient','不满足')}{data.failureReason&&<p>原因：{data.failureReason}</p>}
      {enabled?<div className="loop-down">满足 ↓ 稍息判定</div>:output('continue','满足 → 继续执行')}</section>}
    {enabled&&<section><strong>③ 稍息判定</strong>
      {enabled&&<><p>发生倾向：{data.restExpectation||'待定'}</p><p>{summary(data.restCondition,data.restRules)}</p></>}
      {output('rest',enabled?'触发 → 待机节点':'稍息出口已停用（旧连线保留）',!enabled)}
      {output('continue','不触发 → 继续执行')}</section>}
    {legacy&&<div className="loop-output loop-legacy">旧版出口 · 请在侧栏归类<Handle type="source" position={Position.Right} isConnectable={false} className="node-handle"/></div>}
  </div>
}

function LegacyLoopFields({node}) {
  const {nodes,edges,updateNode,setLoopTarget,assignLoopEdge}=useBehaviorStore()
  const data=node.data,enabled=data.restEnabled!==false,admission=data.admissionEnabled!==false
  const update=patch=>updateNode(node.id,patch)
  const legacy=edges.filter(e=>e.source===node.id&&!e.sourceHandle)
  const target=(handle,label)=><BranchDestination node={node} handle={handle} label={label}/>
  return <div className="loop-editor"><LoopScopeSettings key={node.id} node={node}/>
    <p className="form-hint">按 ① → ② → ③ 依次判断；一旦从出口离开，就不再进行后面的判定。每个出口选择连接节点或跳出行为。</p>
    <section><h4>① 目标达成判定</h4><div className="form-group"><label>目标达成规则</label><textarea aria-label="目标达成规则" value={data.completionCondition||''} placeholder="例如：已完成目标要求的进食次数" onChange={e=>update({completionCondition:e.target.value})}/></div>
      <LibraryRules title="目标达成属性条件" value={data.completionRules} onChange={completionRules=>update({completionRules})}/>
      {(data.loopCondition||data.loopRules?.length>0)&&<div className="loop-legacy"><p>旧版条件可能表示“继续循环”，不会自动当作“目标达成”。请核对并填写上方规则。</p><textarea aria-label="旧版循环条件" value={data.loopCondition||''} onChange={e=>update({loopCondition:e.target.value})}/><LibraryRules title="旧版循环属性条件（待核对）" value={data.loopRules} onChange={loopRules=>update({loopRules})}/></div>}
      {target('complete','达成后去向')}<p className="loop-down">{admission?'未达成 ↓ 准入检查':enabled?'未达成 ↓ 稍息判定':'未达成 → 继续执行'}</p>
    </section>
    <section><h4>② 准入检查</h4><label className="loop-toggle"><input type="checkbox" checked={admission} onChange={e=>update({admissionEnabled:e.target.checked})}/>启用准入检查</label>{admission&&<><div className="form-group"><label>准入条件检查</label><textarea aria-label="准入条件检查" value={data.resourceCheck||''} placeholder="例如：还有可食用的食物" onChange={e=>update({resourceCheck:e.target.value})}/></div>
      <LibraryRules title="准入条件规则" value={data.resourceRules} onChange={resourceRules=>update({resourceRules})}/>
      <div className="form-group"><label>准入不满足的原因</label><input aria-label="准入不满足的原因" value={data.failureReason||''} placeholder="例如：食物用尽" onChange={e=>update({failureReason:e.target.value})}/></div>
      {target('insufficient','不满足后去向')}<p className="loop-down">{enabled?'满足 ↓ 稍息判定':'满足 → 直接继续执行'}</p></>}
      {!admission&&<p className="form-hint">已跳过准入检查；原有配置和不满足分支连线保留，重新开启后恢复。</p>}
    </section>
    <section><h4>③ 稍息判定</h4><label className="loop-toggle"><input type="checkbox" checked={enabled} onChange={e=>update({restEnabled:e.target.checked})}/>启用稍息判定</label>
      {enabled&&<><div className="form-group"><label>稍息发生倾向</label><TextChoice label="稍息发生倾向" options={EXPECTATIONS} value={data.restExpectation||''} onChange={restExpectation=>update({restExpectation})} placeholder="选择或描述大致倾向"/></div><div className="form-group"><label>稍息判定规则</label><textarea aria-label="稍息判定规则" value={data.restCondition||''} onChange={e=>update({restCondition:e.target.value})} placeholder="例如：疲惫时更倾向于稍息"/></div><LibraryRules title="稍息属性条件" value={data.restRules} onChange={restRules=>update({restRules})}/></>}
      {data.restProbability!==undefined&&<p className="form-hint">旧版概率 {data.restProbability}% 已保留；新设计使用文字倾向，不自动换算。</p>}
      {target('rest','触发 → 待机节点')}{target('continue',enabled?'不触发 → 继续执行节点':admission?'满足 → 继续执行节点':'未达成 → 继续执行节点')}
      <p className="form-hint">待机结束后返回循环判定，重新检查能否进入本轮。关闭稍息时跳过第三步，已有稍息连线保留但不生效。</p>
    </section>
    {legacy.length>0&&<section className="loop-legacy"><h4>旧版连线待归类</h4>{legacy.map(edge=><div className="form-group" key={edge.id}><label>连向 {nodes.find(n=>n.id===edge.target)?.data.name||edge.target}</label><select aria-label={'旧连线出口 '+edge.target} value="" onChange={e=>assignLoopEdge(edge.id,e.target.value)}><option value="">请选择这条线对应的结果</option>{LOOP_OUTPUTS.map(o=><option key={o.id} value={o.id} disabled={!isLoopOutputEnabled(data,o.id)||edges.some(e=>e.source===node.id&&e.sourceHandle===o.id)}>{o.label}</option>)}</select></div>)}</section>}
  </div>
}

export default function LoopFields({node}){
 const {updateNode,separateLoopLogic}=useBehaviorStore(),[error,setError]=useState('')
 const d=node.data,update=patch=>updateNode(node.id,patch)
 if(d.loopVersion!==3)return <div className="loop-editor"><p className="form-hint">旧版循环含准入或稍息逻辑。拆分后，它们成为容器内的判断／待机节点，原规则和去向保留；可撤销。</p>
  <button onClick={()=>{try{separateLoopLogic(node.id);setError('')}catch(e){setError(e.message)}}}>拆分为循环容器与内部节点</button>
  {error&&<p role="alert">{error}</p>}
  <details><summary>旧版兼容配置（迁移前核对）</summary><LegacyLoopFields node={node}/></details>
 </div>
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
