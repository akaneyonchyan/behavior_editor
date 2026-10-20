import React from 'react'
import { BaseEdge, getBezierPath } from 'reactflow'
export default function FlowingEdge({id,sourceX,sourceY,targetX,targetY,sourcePosition,targetPosition,markerEnd,style,selected,label}) {
  const [path,labelX,labelY]=getBezierPath({sourceX,sourceY,targetX,targetY,sourcePosition,targetPosition})
  return <>
    <BaseEdge labelX={labelX} labelY={labelY} label={label} labelStyle={{fill:'#cbd5e1',fontSize:11}} labelBgStyle={{fill:'#111827'}} id={id} path={path} markerEnd={markerEnd} style={{...style,stroke:selected?'#b6dfff':'#83909f'}} interactionWidth={18}/>
    <path className="edge-flow-trail" d={path} pathLength="100" fill="none" stroke="#4cbcff" strokeWidth="3" strokeLinecap="round" strokeDasharray="8 92" pointerEvents="none"/>
    <path className="edge-flow-head" d={path} pathLength="100" fill="none" stroke="#e3f5ff" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="2 98" pointerEvents="none"/>
  </>
}
