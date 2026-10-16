import React, { createContext, useContext, useMemo } from 'react'
import { BaseEdge } from 'reactflow'
import { routeEdge } from '../utils/edgeRouting'
export const RoutingContext = createContext({ rects: [], dragging: false })
export default function RoutedEdge(props) {
  const { rects, dragging, pending } = useContext(RoutingContext)
  const { sourceX, sourceY, targetX, targetY, source, target, id, markerEnd, style } = props
  const route = useMemo(() => dragging || pending ? null : routeEdge({ source:{x:sourceX,y:sourceY},target:{x:targetX,y:targetY},sourceId:source,targetId:target,rects }), [rects,dragging,pending,sourceX,sourceY,targetX,targetY,source,target])
  if (dragging || pending || !route) return null
  if (route.error) return <g className="route-error" data-edge-id={id}>
    <title>{route.error}</title><circle cx={sourceX+8} cy={sourceY} r={6} fill="#f59e0b" />
    <text x={sourceX+20} y={sourceY-8} fill="#fcd34d" fontSize={11}>⚠ {route.error}</text>
  </g>
  return <BaseEdge id={id} path={route.path} markerEnd={markerEnd} style={style} interactionWidth={16} />
}
