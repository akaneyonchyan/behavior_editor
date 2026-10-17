import React from 'react'
import { useBehaviorStore } from '../store/behaviorStore'
import { NODE_CONFIG, NODE_TYPES } from '../constants/behaviorTypes'
import './PropertyPanel.css'
import TextChoice from './TextChoice'
import { useContentLibrary } from '../store/contentLibrary'
import LoopFields from './LoopEditor'
import BehaviorMetadata from './BehaviorMetadata'
import JudgeFields from './JudgeFields'
import ResultFields from './ResultFields'

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
          {config.label}节点
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
        {selectedNode.type === NODE_TYPES.MOVE && <MoveFields node={selectedNode} />}
        {selectedNode.type === NODE_TYPES.JUDGE && <JudgeFields node={selectedNode} />}
        {selectedNode.type === NODE_TYPES.RESULT && <ResultFields node={selectedNode} />}
        {selectedNode.type === NODE_TYPES.LOOP && <LoopFields node={selectedNode} />}
        {selectedNode.type === NODE_TYPES.END && <EndFields node={selectedNode} />}
      </div>
    </div>
  )
}

// 位移节点字段
function MoveFields({ node }) {
  const { updateNode } = useBehaviorStore()
  const objects=useContentLibrary(s=>s.library.objects)

  return (
    <>
      <div className="form-group">
        <label>目的地类型</label>
        <select
          value={node.data.destinationType || 'interactObject'}
          onChange={(e) => updateNode(node.id, { destinationType: e.target.value })}
        >
          <option value="interactObject">交互对象</option>
          <option value="coordinate">固定坐标</option>
        </select>
      </div>

      <div className="form-group">
        <label>交互对象类型</label>
        <TextChoice label="交互对象类型" options={objects.filter(o=>o.enabled).map(o=>o.name)} value={objects.find(o=>o.id===node.data.objectType)?.name||node.data.objectType||''} onChange={name=>updateNode(node.id,{objectType:objects.find(o=>o.name===name)?.id||name})} placeholder="从公共库选择对象类型"/>
      </div>
      <div className="form-group">
        <label>目的地</label>
        <input
          type="text"
          value={node.data.destination || ''}
          onChange={(e) => updateNode(node.id, { destination: e.target.value })}
          placeholder={node.data.destinationType === 'coordinate' ? 'x, y, z' : '对象名称'}
        />
      </div>
    </>
  )
}

// 结束节点字段
function EndFields({ node }) {
  const { updateNode } = useBehaviorStore()

  return (
    <>
      <div className="form-group">
        <label>成功表演</label>
        <input
          type="text"
          value={node.data.successAnimation || ''}
          onChange={(e) => updateNode(node.id, { successAnimation: e.target.value })}
          placeholder="成功动画"
        />
      </div>

      <div className="form-group">
        <label>失败表演</label>
        <input
          type="text"
          value={node.data.failAnimation || ''}
          onChange={(e) => updateNode(node.id, { failAnimation: e.target.value })}
          placeholder="失败动画"
        />
      </div>
    </>
  )
}
