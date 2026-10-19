import React from 'react'
import { useBehaviorStore } from '../store/behaviorStore'
import { NODE_CONFIG, NODE_TYPES } from '../constants/behaviorTypes'
import './PropertyPanel.css'
import TextChoice from './TextChoice'
import ObjectNameInput from './ObjectNameInput'
import { useContentLibrary } from '../store/contentLibrary'
import LoopFields from './LoopEditor'
import BehaviorMetadata from './BehaviorMetadata'
import JudgeFields from './JudgeFields'
import ResultFields from './ResultFields'
import {OccupiedResources} from './OccupiedResources'
import EndFields from './EndFields'
import {endLabel} from '../utils/endings'

export default function PropertyPanel() {
  const { selectedNode, updateNode, deleteNode } = useBehaviorStore()

  if (!selectedNode || selectedNode.type==='start') {
    return <BehaviorMetadata />
  }

  const config = NODE_CONFIG[selectedNode.type]

  return (
    <div className="property-panel">
      <div className="panel-header">
        <div className="panel-title">
          <span className="panel-icon" style={{ background: config.color }}>
            {config.icon}
          </span>
          {selectedNode.type==='end'?endLabel(selectedNode.data):config.label+'节点'}
        </div>
        <button
          className="btn-delete"
          onClick={() => deleteNode(selectedNode.id)}
        >
          删除
        </button>
      </div>

      <div className="panel-content">
        {/* 通用字段 */}
        <div className="form-group">
          <label>节点名称</label>
          <input
            type="text"
            value={selectedNode.data.name || ''}
            onChange={(e) => updateNode(selectedNode.id, { name: e.target.value })}
            placeholder={`${config.label}节点`}
          />
        </div>

        <div className="form-group">
          <label>节点说明</label>
          <textarea
            value={selectedNode.data.description || ''}
            onChange={(e) => updateNode(selectedNode.id, { description: e.target.value })}
            placeholder="可选的节点说明"
            rows={2}
          />
        </div>

        {/* 类型特定字段 */}
        {[NODE_TYPES.MOVE,NODE_TYPES.RESULT].includes(selectedNode.type)&&<OccupiedResources node={selectedNode}/> }
        {selectedNode.type === NODE_TYPES.MOVE && <MoveFields node={selectedNode} />}
        {selectedNode.type === NODE_TYPES.JUDGE && <JudgeFields node={selectedNode} />}
        {selectedNode.type === NODE_TYPES.RESULT && <ResultFields node={selectedNode} />}
        {selectedNode.type === NODE_TYPES.LOOP && <LoopFields node={selectedNode} />}
        {selectedNode.type === NODE_TYPES.END && <EndFields key={selectedNode.id} node={selectedNode} />}
      </div>
    </div>
  )
}

// 位移节点字段
function MoveFields({ node }) {
  const { updateNode,nodes,edges,setMoveEndTarget } = useBehaviorStore()
  const objects=useContentLibrary(s=>s.library.objects)

  return (
    <>
      <div className="form-group">
        <label>目的地类型</label>
        <select
          value={node.data.destinationType ?? 'interactObject'}
          onChange={(e) => updateNode(node.id, { destinationType: e.target.value })}
        >
          <option value="">未配置</option>
          <option value="interactObject">交互对象</option>
          <option value="coordinate">固定坐标</option>
        </select>
      </div>

      {node.data.destinationType!=='coordinate'&&<><div className="form-group">
        <label>交互对象类型</label>
        <TextChoice label="交互对象类型" options={objects.filter(o=>o.enabled).map(o=>o.name)} value={objects.find(o=>o.id===node.data.objectType)?.name||node.data.objectType||''} onChange={name=>updateNode(node.id,{objectType:objects.find(o=>o.enabled&&o.name===name)?.id||name})} placeholder="从公共库选择对象类型"/>
      </div><div className="form-group"><ObjectNameInput type={node.data.objectType} value={node.data.objectName??node.data.destination??''} onChange={objectName=>updateNode(node.id,{objectName})}/></div></>}
      {node.data.destinationType==='coordinate'&&<div className="form-group"><label>目的地</label><input aria-label="目的地坐标" value={node.data.destination||''} onChange={e=>updateNode(node.id,{destination:e.target.value})} placeholder="x, y, z"/></div>}
      <div className="form-group"><label>目的地不可达时</label><select aria-label="位移不可达结束节点" value={edges.find(e=>e.source===node.id&&e.sourceHandle==='unreachable')?.target||''} onChange={e=>setMoveEndTarget(node.id,e.target.value)}><option value="">选择中断收尾的结束节点</option>{nodes.filter(n=>n.type==='end').map(n=><option key={n.id} value={n.id}>{n.data.name||'结束节点'} · {n.id.slice(0,8)}</option>)}</select><p className="form-hint">可达出口保留原后续连线；不可达出口只连接普通结束节点，由名称和表演表达中断。也可以在画布直接连线。</p></div>
    </>
  )
}

