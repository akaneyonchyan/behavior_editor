import React, { useState } from 'react'
import { useBehaviorStore } from '../store/behaviorStore'
import DocumentControls from './DocumentControls'
import ContentLibrary from './ContentLibrary'

import './Toolbar.css'
export default function Toolbar() {
  const { behaviorInfo, selectNode, undo, redo, past, future } = useBehaviorStore()

  const [showLibrary,setShowLibrary]=useState(false)
  return <>
    <div className="toolbar">
      <div className="toolbar-left"><div className="toolbar-brand"><span className="brand-text">PPS 行为编辑器</span></div><button className="toolbar-btn" onClick={() => selectNode(null)}>行为配置</button></div>
      <div className="toolbar-right"><button className="toolbar-btn" onClick={()=>setShowLibrary(true)}>公共内容库</button><button className="toolbar-btn" title="Ctrl+Z" disabled={!past.length} onClick={undo}>撤销</button><button className="toolbar-btn" title="Ctrl+Shift+Z / Ctrl+Y" disabled={!future.length} onClick={redo}>重做</button><div className="toolbar-info">{behaviorInfo.name}</div></div>
    </div>
    <DocumentControls />
    {showLibrary&&<ContentLibrary onClose={()=>setShowLibrary(false)}/>}

  </>
}

