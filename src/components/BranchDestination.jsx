import {containerTarget} from '../utils/normalizeBehavior'
import {NODE_CONFIG} from '../constants/behaviorTypes'
import React from 'react'
import {Handle, Position} from 'reactflow'
import {useBehaviorStore} from '../store/behaviorStore'
import {externalExit, exitEnabled} from '../utils/externalExits'

export function BranchPort({data, handle, className='node-handle', disabled=false}) {
  const exit = externalExit(data, handle)
  if (exit) return <span className="external-exit" title={exit.note || '交给行为外通用流程处理'}>↗ 跳出行为{exit.note && <small>{exit.note}</small>}</span>
  return <Handle type="source" position={Position.Right} id={handle || undefined} className={className} isConnectable={!disabled}/>
}

export default function BranchDestination({node, handle='', label='后续去向'}) {
  const {nodes, edges, layout, setBranchDestination} = useBehaviorStore()
  const exit = externalExit(node.data, handle)
  const outgoing = edges.filter(e => e.source === node.id && (e.sourceHandle || '') === handle)
  const enabled = exitEnabled(node, handle)
  return <div className="form-group branch-destination">
    <label>{label}</label>
    <select aria-label={label+'类型'} disabled={!enabled} value={exit?'external':'node'} onChange={e => setBranchDestination(node.id,handle,e.target.value)}>
      <option value="node">连接节点</option><option value="external">跳出行为</option>
    </select>
    {exit ? <>
      <input aria-label={label+'跳出说明'} value={exit.note || ''} placeholder="跳出说明（可选）" disabled={!enabled} onChange={e => setBranchDestination(node.id,handle,'external',undefined,e.target.value)}/>
      <p className="form-hint">交给行为外通用流程，不播放结束表演。原后续节点仍保留，切换可撤销。</p>
    </> : <>
      <select aria-label={label} disabled={!enabled} value={outgoing.length===1?outgoing[0].target:''} onChange={e => setBranchDestination(node.id,handle,'node',e.target.value)}>
        <option value="">{outgoing.length>1?'旧版多条连线，待核对':'未连接'}</option>
        {nodes.filter(n=>n.type!=='start' && (node.type!=='loop'||n.id!==node.id) && containerTarget(layout?.scopes,node.id,n.id,handle)===n.id).map(n=><option key={n.id} value={n.id}>{n.data.name || NODE_CONFIG[n.type]?.label || n.type} · {n.id.slice(0,8)}</option>)}
      </select>
      {outgoing.some(e=>nodes.find(n=>n.id===e.target)?.type==='end')&&<p className="form-hint">如需改为通用跳出，可选择“跳出行为”；原结束节点和表演不会自动删除。</p>}
    </>}
  </div>
}
