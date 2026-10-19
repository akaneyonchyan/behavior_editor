import React, { useState } from 'react'
import { useBehaviorStore } from '../store/behaviorStore'
import DocumentControls from './DocumentControls'
import ContentLibrary from './ContentLibrary'
import RequirementsPanel from './RequirementsPanel'

import './Toolbar.css'
export default function Toolbar() {
  const { behaviorInfo, undo, redo, past, future } = useBehaviorStore()

  const [showLibrary,setShowLibrary]=useState(false)
  const [showRequirements,setShowRequirements]=useState(false)
  return <>
    <div className="toolbar">
      <div className="toolbar-left"><div className="toolbar-brand"><span className="brand-text">PPS 行为编辑器</span></div></div>
      <div className="toolbar-right"><button className="toolbar-btn" onClick={()=>setShowRequirements(true)}>需求清单</button><button className="toolbar-btn" onClick={()=>setShowLibrary(true)}>公共内容库</button><button className="toolbar-btn" title="Ctrl+Z" disabled={!past.length} onClick={undo}>撤销</button><button className="toolbar-btn" title="Ctrl+Shift+Z / Ctrl+Y" disabled={!future.length} onClick={redo}>重做</button><div className="toolbar-info">{behaviorInfo.name}</div></div>
    </div>
    <DocumentControls />
    {showRequirements&&<RequirementsPanel onClose={()=>setShowRequirements(false)}/>}
    {showLibrary&&<ContentLibrary onClose={()=>setShowLibrary(false)}/>}

  </>
}

