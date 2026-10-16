import React, { useState } from 'react'
import { useBehaviorStore } from '../store/behaviorStore'
import DocumentControls from './DocumentControls'
import ContentLibrary from './ContentLibrary'
import LibraryRules from './LibraryRules'
import './Toolbar.css'
export default function Toolbar() {
  const { behaviorInfo, updateBehaviorInfo, undo, redo, past, future } = useBehaviorStore()
  const [showMetaDialog, setShowMetaDialog] = useState(false)
  const [showLibrary,setShowLibrary]=useState(false)
  return <>
    <div className="toolbar">
      <div className="toolbar-left"><div className="toolbar-brand"><span className="brand-text">PPS 行为编辑器</span></div><button className="toolbar-btn" onClick={() => setShowMetaDialog(true)}>行为配置</button></div>
      <div className="toolbar-right"><button className="toolbar-btn" onClick={()=>setShowLibrary(true)}>公共内容库</button><button className="toolbar-btn" title="Ctrl+Z" disabled={!past.length} onClick={undo}>撤销</button><button className="toolbar-btn" title="Ctrl+Shift+Z / Ctrl+Y" disabled={!future.length} onClick={redo}>重做</button><div className="toolbar-info">{behaviorInfo.name}</div></div>
    </div>
    <DocumentControls />
    {showLibrary&&<ContentLibrary onClose={()=>setShowLibrary(false)}/>}
    {showMetaDialog && <MetaDialog behaviorInfo={behaviorInfo} onUpdate={updateBehaviorInfo} onClose={() => setShowMetaDialog(false)} />}
  </>
}

function MetaDialog({ behaviorInfo, onUpdate, onClose }) {
  const [localInfo, setLocalInfo] = useState(behaviorInfo)

  const handleSave = () => {
    onUpdate(localInfo)
    onClose()
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>行为元信息配置</h3>
          <button className="dialog-close" onClick={onClose}>×</button>
        </div>

        <div className="dialog-content">
          <div className="form-group">
            <label>行为名称</label>
            <input
              type="text"
              value={localInfo.name}
              onChange={(e) => setLocalInfo({ ...localInfo, name: e.target.value })}
              placeholder="例如:吃小吃"
            />
          </div>

          <div className="form-group">
            <label>满足目标</label>
            <textarea
              value={localInfo.matchTargets?.join('\n') || ''}
              onChange={(e) => setLocalInfo({
                ...localInfo,
                matchTargets: e.target.value.split('\n').filter(Boolean)
              })}
              placeholder="每行一个目标,例如:&#10;恢复饱腹&#10;消耗食物"
              rows={4}
            />
            <div className="form-hint">每行一个目标</div>
          </div>

          <div className="form-group">
            <label>交互对象</label>
            <input
              type="text"
              value={localInfo.preconditions?.interactObject || ''}
              onChange={(e) => setLocalInfo({
                ...localInfo,
                preconditions: { ...localInfo.preconditions, interactObject: e.target.value }
              })}
              placeholder="例如:空地"
            />
          </div>

          <div className="form-group">
            <label>消耗品</label>
            <textarea
              value={localInfo.preconditions?.consumables?.join('\n') || ''}
              onChange={(e) => setLocalInfo({
                ...localInfo,
                preconditions: {
                  ...localInfo.preconditions,
                  consumables: e.target.value.split('\n').filter(Boolean)
                }
              })}
              placeholder="每行一个消耗品,格式:&#10;食物 >= 1"
              rows={3}
            />
          </div>

          <LibraryRules title="属性准入条件" value={localInfo.preconditions?.attributeRules} onChange={attributeRules=>setLocalInfo({...localInfo,preconditions:{...localInfo.preconditions,attributeRules}})}/>
          {!!localInfo.preconditions?.attributes?.length&&<div className="form-group">
            <label>原有文字门槛（保留）</label>
            <textarea
              value={localInfo.preconditions?.attributes?.join('\n') || ''}
              onChange={(e) => setLocalInfo({
                ...localInfo,
                preconditions: {
                  ...localInfo.preconditions,
                  attributes: e.target.value.split('\n').filter(Boolean)
                }
              })}
              placeholder="每行一个属性条件,格式:&#10;精力 > 10"
              rows={3}
            />
          </div>}
        </div>

        <div className="dialog-footer">
          <button className="btn-secondary" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={handleSave}>保存</button>
        </div>
      </div>
    </div>
  )
}

