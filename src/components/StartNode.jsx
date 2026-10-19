import React,{useEffect} from 'react'
import {Handle,Position,useUpdateNodeInternals} from 'reactflow'
import {useBehaviorStore} from '../store/behaviorStore'
import {useContentLibrary} from '../store/contentLibrary'
import {RuleText,ChoiceText} from './DesignInputs'
import {GOAL_TYPES,CONSUMPTION_TYPES} from '../utils/behaviorMetadata'
import {NODE_CONFIG} from '../constants/behaviorTypes'
const CONDITIONS=['较低时','较高时','处于指定状态时','具有指定 Buff 时','不具有指定 Buff 时']
function Section({title,children}){return children.length>0&&<div className="start-section"><strong>{title}</strong><ol>{children.map((child,i)=><li key={i}>{child}</li>)}</ol></div>}
export default function StartNode({id,selected}){
  const info=useBehaviorStore(s=>s.behaviorInfo),connected=useBehaviorStore(s=>s.edges.some(e=>e.source===id)),lib=useContentLibrary(s=>s.library),internals=useUpdateNodeInternals()
  useEffect(()=>{internals(id)},[id,info,lib,internals])
  const p=info.preconditions||{},object=value=><ChoiceText value={lib.objects.find(o=>o.id===value)?.name||value} options={lib.objects.filter(o=>o.enabled).map(o=>o.name)}/>
  return <div className={'behavior-node '+(selected?'selected':'')} style={{'--node-color':NODE_CONFIG.start.color}}>
    <div className="node-header"><span>▶</span><span>开始 · 唯一入口</span></div>
    <div className="node-body"><div className="node-name">{info.name||'未命名行为'}</div><div className="start-summary">
      <Section title="满足目标">{info.targetRules.map(r=><RuleText rule={r} influences={GOAL_TYPES}/>)}</Section>
      <Section title="交互对象">{(p.interactObjectRules||[]).map(r=>object(r.objectType))}</Section>
      <Section title="消耗品">{(p.consumableRules||[]).map(r=><>{object(r.objectType)} · <ChoiceText value={r.requirement} options={CONSUMPTION_TYPES}/></>)}</Section>
      <Section title="准入条件">{(p.attributeRules||[]).map(r=><RuleText rule={r} kind={r.attribute?.startsWith('buff:')?'buff':'attribute'} influences={CONDITIONS}/>)}</Section>
      <p className="form-hint">{connected?'点击此节点编辑行为准入数据':'请从右侧出口连接第一个行为节点'}</p>
    </div></div>
    <Handle type="source" position={Position.Right} className="node-handle"/>
  </div>
}
