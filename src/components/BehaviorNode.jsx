import React, { useEffect } from 'react'
import { Handle, Position, useUpdateNodeInternals } from 'reactflow'
import { NODE_CONFIG } from '../constants/behaviorTypes'
import './BehaviorNode.css'
import { useContentLibrary } from '../store/contentLibrary'
import {OccupiedSummary,ReleaseSummary} from './OccupiedResources'
import {endLabel,isLegacyEnd} from '../utils/endings'
import { LoopNodeStages } from './LoopEditor'
import {RuleText,ChoiceText} from './DesignInputs'
import {ObjectNameText} from './ObjectNameInput'
import {resultRules,judgeAttributes,branchFactors,PROBABILITIES,EFFECTS,CHANGES,PLAY_MODES} from '../utils/nodeDesign'
function OutputSection({title,children}){
  if(!children.length&&title!=='属性')return null
  return <div className="result-output-section"><strong>{title}</strong>{children.length?<ol>{children.map((child,i)=><li key={i}>{child}</li>)}</ol>:<div>无</div>}</div>
}
const format = value => Array.isArray(value) ? value.filter(Boolean).map(format).join('；') : value && typeof value === 'object' ? Object.entries(value).map(([k,v]) => k + ': ' + format(v)).join('，') : String(value ?? '')
function Row({ label, value, fallback = '未配置' }) {
  return <div className="summary-row"><span>{label}</span><div>{format(value) || fallback}</div></div>
}
export default function BehaviorNode({ id, data, type, selected }) {
  const config = NODE_CONFIG[type], updateInternals = useUpdateNodeInternals()
  const library=useContentLibrary(s=>s.library)
  useEffect(() => { updateInternals(id) }, [id, data, library, updateInternals])
  return <div className={'behavior-node ' + (selected ? 'selected' : '')} style={{ '--node-color': config.color }}>
    <Handle type="target" position={Position.Left} className="node-handle" />
    <div className="node-header"><span className="node-icon">{config.icon}</span><span>{type==='end'?endLabel(data):config.label}</span><span className="node-id" title={id}>{id.slice(0, 12)}</span></div>
    <div className="node-body">
      <div className="node-name">{data.name || config.label + '节点'}</div>
      {data.description && <div className="node-desc">{data.description}</div>}
      <div className="node-summary">
        {['move','result'].includes(type)&&<OccupiedSummary data={data}/>}
        {type === 'move' && <><Row label="目标类型" value={data.destinationType === 'coordinate' ? '固定坐标' : library.objects.find(o=>o.id===data.objectType)?.name||data.objectType||'交互对象'} />{data.destinationType==='coordinate'?<Row label="目的地" value={data.destination}/>:<div className="summary-row"><span>对象名</span><div><ObjectNameText type={data.objectType} value={data.objectName??data.destination}/></div></div>}</>}
        {type === 'wait' && <Row label="执行" value="原地稍息，随后进入后续节点" />}
        {type === 'judge' && <Row label="分支" value={(data.branches?.length || 0) + ' 条 · 根据规则选择'} />}
        {type === 'result' && <><Row label="表演" value={data.animation} /><div className="summary-row"><span>播放方式</span><div><ChoiceText value={data.playMode??'单次'} options={PLAY_MODES}/>{data.playMode!=='单次'&&data.playExpectation?' · '+data.playExpectation:''}</div></div><OutputSection title="属性">{[...resultRules(data,'attribute').map(r=><RuleText rule={r} influences={CHANGES}/>),...(data.attributeChanges||[]).map(text=><span className="custom-choice">{text}</span>)]}</OutputSection><OutputSection title="Buff">{resultRules(data,'buff').filter(r=>r.attribute?.trim()).map(r=><RuleText rule={r} kind="buff" influences={CHANGES}/>)}</OutputSection><OutputSection title="产物">{(data.outputs||[]).filter(o=>format(o).trim()).map(o=><ChoiceText value={format(o)} options={[]}/>)}</OutputSection></>}
        {type === 'loop' && <Row label="判定顺序" value={data.restEnabled===false?'目标达成 → 资源':'目标达成 → 资源 → 稍息'} />}
        {type === 'end' && (isLegacyEnd(data)?<><Row label="旧完成表演" value={data.successAnimation}/><Row label="旧中断表演" value={data.failAnimation}/><Row label="待处理" value="选中后拆分为两个结束节点并确认入线"/></>:<><Row label="表演" value={data.animation} /><div className="summary-row"><span>播放方式</span><div><ChoiceText value={data.playMode??'单次'} options={PLAY_MODES}/>{data.playMode!=='单次'&&data.playExpectation?' · '+data.playExpectation:''}</div></div><ReleaseSummary id={id}/></>)}
      </div>
    </div>
    {type === 'judge' && <div className="node-branches">{data.branches?.map(branch => <div className="node-branch" key={branch.id}>
      <div>{branch.name}<small>默认概率：<ChoiceText value={branch.weightExpectation||'待定'} options={PROBABILITIES}/>{branch.condition ? ' · ' + branch.condition : ''}</small></div>
      {branchFactors(branch,judgeAttributes(data)).map((factor,i) => <small key={factor.id||i} className="factor-summary">{i+1}. <RuleText rule={factor} influences={EFFECTS}/></small>)}
      <Handle type="source" position={Position.Right} id={branch.id} className="node-handle branch-handle" />
    </div>)}</div>}
    {type === 'loop' && <LoopNodeStages id={id} data={data}/>}
    {type !== 'judge' && type !== 'end' && type !== 'loop' && <Handle type="source" position={Position.Right} className="node-handle" />}
  </div>
}
