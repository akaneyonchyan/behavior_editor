import React, { useEffect } from 'react'
import { Handle, Position, useUpdateNodeInternals } from 'reactflow'
import { NODE_CONFIG } from '../constants/behaviorTypes'
import './BehaviorNode.css'
import { designFactor } from '../utils/weightFactors'
import { useContentLibrary, ruleSummary } from '../store/contentLibrary'
import { LoopNodeStages } from './LoopEditor'
const format = value => Array.isArray(value) ? value.filter(Boolean).map(format).join('；') : value && typeof value === 'object' ? Object.entries(value).map(([k,v]) => k + ': ' + format(v)).join('，') : String(value ?? '')
function Row({ label, value, fallback = '未配置' }) {
  return <div className="summary-row"><span>{label}</span><div>{format(value) || fallback}</div></div>
}
export default function BehaviorNode({ id, data, type, selected }) {
  const config = NODE_CONFIG[type], updateInternals = useUpdateNodeInternals()
  const library=useContentLibrary(s=>s.library)
  const summaries=rules=>rules?.map(r=>ruleSummary(library,r))||[]
  useEffect(() => { updateInternals(id) }, [id, data, library, updateInternals])
  return <div className={'behavior-node ' + (selected ? 'selected' : '')} style={{ '--node-color': config.color }}>
    <Handle type="target" position={Position.Left} className="node-handle" />
    <div className="node-header"><span className="node-icon">{config.icon}</span><span>{config.label}</span><span className="node-id" title={id}>{id.slice(0, 12)}</span></div>
    <div className="node-body">
      <div className="node-name">{data.name || config.label + '节点'}</div>
      {data.description && <div className="node-desc">{data.description}</div>}
      <div className="node-summary">
        {type === 'move' && <><Row label="目标类型" value={data.destinationType === 'coordinate' ? '固定坐标' : library.objects.find(o=>o.id===data.objectType)?.name||data.objectType||'交互对象'} /><Row label="目的地" value={data.destination} /></>}
        {type === 'wait' && <Row label="执行" value="原地稍息，随后进入后续节点" />}
        {type === 'judge' && <Row label="分支" value={(data.branches?.length || 0) + ' 条 · 根据规则选择'} />}
        {type === 'result' && <><Row label="表演" value={data.animation} /><Row label="属性 / Buff" value={[...(data.attributeChanges||[]),...summaries(data.effectRules)]} fallback="无" /><Row label="产出" value={data.outputs} fallback="无" /></>}
        {type === 'loop' && <Row label="判定顺序" value="目标达成 → 资源 → 稍息" />}
        {type === 'end' && <><Row label="成功表演" value={data.successAnimation} /><Row label="失败表演" value={data.failAnimation} /><Row label="释放资源" value={data.releaseResources} fallback="无" /></>}
      </div>
    </div>
    {type === 'judge' && <div className="node-branches">{data.branches?.map(branch => <div className="node-branch" key={branch.id}>
      <div>{branch.name}<small>发生倾向：{branch.weightExpectation || '待定'}{branch.condition ? ' · ' + branch.condition : ''}</small></div>
      {branch.weightFactors?.map((factor,i) => <small key={factor.id||i} className="factor-summary">{i+1}. {ruleSummary(library,designFactor(factor))}</small>)}
      <Handle type="source" position={Position.Right} id={branch.id} className="node-handle branch-handle" />
    </div>)}</div>}
    {type === 'loop' && <LoopNodeStages id={id} data={data}/>}
    {type !== 'judge' && type !== 'end' && type !== 'loop' && <Handle type="source" position={Position.Right} className="node-handle" />}
  </div>
}
