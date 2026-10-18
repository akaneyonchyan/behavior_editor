import React from 'react'
import { NODE_CONFIG, NODE_TYPES } from '../constants/behaviorTypes'
import './NodePalette.css'
const palette=Object.entries(NODE_CONFIG).filter(([type])=>type!=='start').flatMap(([type,config])=>type==='end'?['完成','中断'].map(reason=>[type,{...config,label:reason+'结束',description:reason==='完成'?'完成表演与结束结算':'中断表演与结束结算',reason}]):[[type,config]])

export default function NodePalette({ onAddNode }) {
  const handleDragStart = (event, nodeType, reason) => {
    event.dataTransfer.setData('application/reactflow', nodeType)
    if(reason)event.dataTransfer.setData('application/behavior-end-reason',reason)
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
            key={type+(config.reason||'')}
            className="palette-node"
            draggable
            onDragStart={(e) => handleDragStart(e, type,config.reason)}
            onClick={() => onAddNode(type,config.reason)}
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
