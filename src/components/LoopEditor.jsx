import React, { useEffect } from 'react'
import { useBehaviorStore } from '../store/behaviorStore'
import { useContentLibrary, ruleSummary } from '../store/contentLibrary'
import { Handle, Position, useUpdateNodeInternals } from 'reactflow'
import LibraryRules from './LibraryRules'
import {RuleText} from './DesignInputs'
import TextChoice from './TextChoice'
import { EXPECTATIONS } from '../utils/weightFactors'
import { LOOP_OUTPUTS } from '../utils/loopFlow'
import './LoopEditor.css'

export function LoopNodeStages({id,data}) {
  const library=useContentLibrary(s=>s.library)
  const legacy=useBehaviorStore(s=>s.edges.some(e=>e.source===id&&!e.sourceHandle))
  const updateInternals=useUpdateNodeInternals()
  useEffect(()=>{updateInternals(id)},[id,legacy,data,library,updateInternals])
  const enabled=data.restEnabled!==false
  const summary=(text,rules)=>!text&&!rules?.length?'待配置规则':<>{text}{(rules||[]).map((r,i)=><React.Fragment key={r.id}>{(text||i>0)?'；':''}<RuleText rule={r} kind={r.attribute?.startsWith('buff:')?'buff':'attribute'} influences={['较低时','较高时','处于指定状态时','具有指定 Buff 时','不具有指定 Buff 时']}/></React.Fragment>)}</>
  const output=(handle,label,disabled=false)=><div className={'loop-output '+(disabled?'inactive':'')}><span>{label}</span><Handle type="source" position={Position.Right} id={handle} isConnectable={!disabled} className="node-handle"/></div>
  return <div className="loop-stages">
    <section><strong>① 目标达成判定</strong><p>{summary(data.completionCondition,data.completionRules)}</p>
      {data.loopCondition&&<p className="loop-legacy">旧条件待核对：{data.loopCondition}</p>}
      {data.loopRules?.length>0&&<p className="loop-legacy">旧属性规则待核对：{summary('',data.loopRules)}</p>}
      {output('complete','达成 → 成功结算')}<div className="loop-down">未达成 ↓ 进入第二步</div></section>
    <section><strong>② 资源检查</strong><p>{summary(data.resourceCheck,data.resourceRules)}</p>
      {output('insufficient','不足 → 失败结算')}{data.failureReason&&<p>原因：{data.failureReason}</p>}
      {enabled?<div className="loop-down">充足 ↓ 进入第三步</div>:output('continue','充足 → 继续执行')}</section>
    {enabled&&<section><strong>③ 稍息判定</strong>
      {enabled&&<><p>发生倾向：{data.restExpectation||'待定'}</p><p>{summary(data.restCondition,data.restRules)}</p></>}
      {output('rest',enabled?'触发 → 待机节点':'稍息出口已停用（旧连线保留）',!enabled)}
      {output('continue','不触发 → 继续执行')}</section>}
    {legacy&&<div className="loop-output loop-legacy">旧版出口 · 请在侧栏归类<Handle type="source" position={Position.Right} isConnectable={false} className="node-handle"/></div>}
  </div>
}

export default function LoopFields({node}) {
  const {nodes,edges,updateNode,setLoopTarget,assignLoopEdge}=useBehaviorStore()
  const data=node.data,enabled=data.restEnabled!==false
  const update=patch=>updateNode(node.id,patch)
  const legacy=edges.filter(e=>e.source===node.id&&!e.sourceHandle)
  const target=(handle,label)=>{
    const outgoing=edges.find(e=>e.source===node.id&&e.sourceHandle===handle)
    return <div className="form-group"><label>{label}</label><select aria-label={label} value={outgoing?.target||''} disabled={handle==='rest'&&!enabled} onChange={e=>setLoopTarget(node.id,handle,e.target.value)}><option value="">未连接</option>{nodes.filter(n=>n.id!==node.id&&n.type!=='start').map(n=><option value={n.id} key={n.id}>{n.data.name||n.type} · {n.id.slice(0,8)}</option>)}</select></div>
  }
  return <div className="loop-editor">
    <p className="form-hint">按 ① → ② → ③ 依次判断；一旦从出口离开，就不再进行后面的判定。每个出口连接一个后续节点。</p>
    <section><h4>① 目标达成判定</h4><div className="form-group"><label>目标达成规则</label><textarea aria-label="目标达成规则" value={data.completionCondition||''} placeholder="例如：已完成目标要求的进食次数" onChange={e=>update({completionCondition:e.target.value})}/></div>
      <LibraryRules title="目标达成属性条件" value={data.completionRules} onChange={completionRules=>update({completionRules})}/>
      {(data.loopCondition||data.loopRules?.length>0)&&<div className="loop-legacy"><p>旧版条件可能表示“继续循环”，不会自动当作“目标达成”。请核对并填写上方规则。</p><textarea aria-label="旧版循环条件" value={data.loopCondition||''} onChange={e=>update({loopCondition:e.target.value})}/><LibraryRules title="旧版循环属性条件（待核对）" value={data.loopRules} onChange={loopRules=>update({loopRules})}/></div>}
      {target('complete','达成 → 成功结算节点')}<p className="loop-down">未达成 ↓ 第二步</p>
    </section>
    <section><h4>② 资源检查</h4><div className="form-group"><label>资源充足规则</label><textarea aria-label="资源充足规则" value={data.resourceCheck||''} placeholder="例如：还有可食用的食物" onChange={e=>update({resourceCheck:e.target.value})}/></div>
      <LibraryRules title="资源充足属性条件" value={data.resourceRules} onChange={resourceRules=>update({resourceRules})}/>
      <div className="form-group"><label>资源不足的失败原因</label><input aria-label="资源不足的失败原因" value={data.failureReason||''} placeholder="例如：食物用尽" onChange={e=>update({failureReason:e.target.value})}/></div>
      {target('insufficient','不足 → 失败结算节点')}<p className="loop-down">{enabled?'充足 ↓ 第三步':'充足 → 直接继续执行'}</p>
    </section>
    <section><h4>③ 稍息判定</h4><label className="loop-toggle"><input type="checkbox" checked={enabled} onChange={e=>update({restEnabled:e.target.checked})}/>启用稍息判定</label>
      {enabled&&<><div className="form-group"><label>稍息发生倾向</label><TextChoice label="稍息发生倾向" options={EXPECTATIONS} value={data.restExpectation||''} onChange={restExpectation=>update({restExpectation})} placeholder="选择或描述大致倾向"/></div><div className="form-group"><label>稍息判定规则</label><textarea aria-label="稍息判定规则" value={data.restCondition||''} onChange={e=>update({restCondition:e.target.value})} placeholder="例如：疲惫时更倾向于稍息"/></div><LibraryRules title="稍息属性条件" value={data.restRules} onChange={restRules=>update({restRules})}/></>}
      {data.restProbability!==undefined&&<p className="form-hint">旧版概率 {data.restProbability}% 已保留；新设计使用文字倾向，不自动换算。</p>}
      {target('rest','触发 → 待机节点')}{target('continue',enabled?'不触发 → 继续执行节点':'资源充足 → 继续执行节点')}
      <p className="form-hint">待机结束后的去向，请从待机节点再连回执行节点。关闭稍息时跳过第三步，已有稍息连线保留但不生效。</p>
    </section>
    {legacy.length>0&&<section className="loop-legacy"><h4>旧版连线待归类</h4>{legacy.map(edge=><div className="form-group" key={edge.id}><label>连向 {nodes.find(n=>n.id===edge.target)?.data.name||edge.target}</label><select aria-label={'旧连线出口 '+edge.target} value="" onChange={e=>assignLoopEdge(edge.id,e.target.value)}><option value="">请选择这条线对应的结果</option>{LOOP_OUTPUTS.map(o=><option key={o.id} value={o.id} disabled={edges.some(e=>e.source===node.id&&e.sourceHandle===o.id)}>{o.label}</option>)}</select></div>)}</section>}
  </div>
}
