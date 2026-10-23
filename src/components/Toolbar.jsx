import React, { useState } from 'react'
import { useBehaviorStore } from '../store/behaviorStore'
import DocumentControls from './DocumentControls'
import ContentLibrary from './ContentLibrary'
import RequirementsPanel from './RequirementsPanel'

import './Toolbar.css'
import {useFileView} from '../store/fileView'
export default function Toolbar({navigation}) {
  const { behaviorInfo, undo, redo, past, future } = useBehaviorStore()

  const {tab,file}=useFileView(),readOnly=tab==='online'
  const [showLibrary,setShowLibrary]=useState(false)
  const [showRequirements,setShowRequirements]=useState(false)
  return <>
    <div className="toolbar">
      <div className="toolbar-left">{navigation||<div className="toolbar-brand"><span className="brand-text">PPS 行为编辑器</span></div>}</div>
      <div className="toolbar-right"><button className="toolbar-btn" onClick={()=>setShowRequirements(true)}>需求清单</button><button className="toolbar-btn" onClick={()=>setShowLibrary(true)}>公共内容库</button><button className="toolbar-btn" title="Ctrl+Z" disabled={readOnly||!past.length} onClick={undo}>撤销</button><button className="toolbar-btn" title="Ctrl+Shift+Z / Ctrl+Y" disabled={readOnly||!future.length} onClick={redo}>重做</button><div className="toolbar-info">{readOnly?(file?.name||'在线文件'):behaviorInfo.name}</div></div>
    </div>
    <DocumentControls />
    {showRequirements&&<RequirementsPanel online={readOnly} onClose={()=>setShowRequirements(false)}/>}
    {showLibrary&&<ContentLibrary onClose={()=>setShowLibrary(false)}/>}

  </>
}

