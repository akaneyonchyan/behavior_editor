import BranchDestination from './BranchDestination'
import React from 'react'
import { useBehaviorStore } from '../store/behaviorStore'
import { NODE_CONFIG, NODE_TYPES } from '../constants/behaviorTypes'
import './PropertyPanel.css'
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
        {selectedNode.type===NODE_TYPES.RESULT&&<OccupiedResources node={selectedNode}/> }
        {selectedNode.type === NODE_TYPES.MOVE && <MoveFields node={selectedNode} />}
        {selectedNode.type === NODE_TYPES.JUDGE && <JudgeFields node={selectedNode} />}
        {selectedNode.type === NODE_TYPES.RESULT && <><ResultFields node={selectedNode} /><BranchDestination node={selectedNode}/></>}
        {selectedNode.type === NODE_TYPES.LOOP && <LoopFields node={selectedNode} />}
        {selectedNode.type === NODE_TYPES.END && <EndFields key={selectedNode.id} node={selectedNode} />}
      </div>
    </div>
  )
}

// Legacy documents remain readable; removal is explicit and undoable.
function MoveFields({node}) {
 const remove=useBehaviorStore(s=>s.removeLegacyMove)
 return <div className="form-group"><p className="form-hint">旧版位移节点：位移和寻路失败已由行为外通用规则处理。移除时仅接续正常出口，不删除原结束节点；原配置保存在文件的兼容记录中。</p>
 <pre style={{whiteSpace:'pre-wrap',fontSize:12}}>{JSON.stringify(node.data,null,2)}</pre>
 <button onClick={()=>{try{remove(node.id)}catch(e){window.alert(e.message)}}}>移除旧位移并接续</button></div>
}
