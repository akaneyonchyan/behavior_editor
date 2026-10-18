import React from 'react'
import { NODE_CONFIG, NODE_TYPES } from '../constants/behaviorTypes'
import './NodePalette.css'
const palette=Object.entries(NODE_CONFIG).filter(([type])=>type!=='start')

export default function NodePalette({ onAddNode }) {
  const handleDragStart = (event, nodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div className="node-palette">
      <div className="palette-header">节点工具</div>
      <div style={{ padding: '12px 16px', fontSize: 12, lineHeight: 1.9, color: '#94A3B8' }}>
        拖入画布添加 · Shift 多选<br />
        Del 删除 · Ctrl+Z 撤销<br />
        Ctrl+Shift+Z / Ctrl+Y 重做<br />
        Ctrl+C / V 复制粘贴<br />
        Ctrl+D 快速复制
      </div>
      <div className="palette-content">
        {palette.map(([type, config]) => (
          <div
            key={type}
            className="palette-node"
            draggable
            onDragStart={(e) => handleDragStart(e, type)}
            onClick={() => onAddNode(type)}
          >
            <div
              className="palette-node-icon"
              style={{ background: config.color }}
            >
              {config.icon}
            </div>
            <div className="palette-node-info">
              <div className="palette-node-label">{config.label}</div>
              <div className="palette-node-desc">{config.description}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
