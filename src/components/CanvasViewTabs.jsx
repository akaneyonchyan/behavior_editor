import React from 'react'
import {useCanvasView} from '../store/canvasView'
import './StructuredCanvas.css'
export default function CanvasViewTabs({children}){
 const {mode,setMode}=useCanvasView()
 return <div className="canvas-view-tools" data-export-ignore="true"><div role="tablist" aria-label="画布视图">
  <button role="tab" aria-selected={mode==='structure'} onClick={()=>setMode('structure')}>结构视图</button>
  <button role="tab" aria-selected={mode==='graph'} onClick={()=>setMode('graph')}>连线视图</button>
 </div>{children}</div>
}
