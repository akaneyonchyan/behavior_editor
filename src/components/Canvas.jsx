import React, { useEffect, useRef } from 'react'
import ReactFlow, { Background, Controls, MiniMap, MarkerType, ConnectionLineType, useNodesInitialized, useReactFlow } from 'reactflow'
import 'reactflow/dist/style.css'
import { useBehaviorStore } from '../store/behaviorStore'
import { NODE_CONFIG } from '../constants/behaviorTypes'
import BehaviorNode from './BehaviorNode'
import StartNode from './StartNode'
import FlowingEdge from './FlowingEdge'
import { isLoopOutput } from '../utils/loopFlow'
import './Canvas.css'
const nodeTypes = {...Object.fromEntries(Object.keys(NODE_CONFIG).map(type => [type, BehaviorNode])),start:StartNode}
const edgeTypes = { default: FlowingEdge, smoothstep: FlowingEdge, routed: FlowingEdge }
const edgeOptions = { type: 'default', markerEnd: { type: MarkerType.ArrowClosed, color: '#94A3B8' }, style: { stroke: '#94A3B8', strokeWidth: 2 } }
function DocumentViewport(){
  const initialized=useNodesInitialized(),{fitView,getNodes}=useReactFlow(),revision=useBehaviorStore(s=>s.documentRevision),last=useRef(-1)
  useEffect(()=>{
    if(!initialized||last.current===revision)return
    let timer,attempts=0
    const fit=()=>{
      const expected=useBehaviorStore.getState().nodes,actual=getNodes()
      if(actual.length!==expected.length||actual.some(n=>!n.width||!n.height||!expected.some(e=>e.id===n.id&&e.position.x===n.position.x&&e.position.y===n.position.y))){if(++attempts<20)timer=setTimeout(fit,50);return}
      last.current=revision;fitView({padding:.18,duration:200})
    }
    timer=setTimeout(fit,50);return()=>clearTimeout(timer)
  },[initialized,revision,fitView,getNodes])
  return null
}
export default function Canvas() {
  const flow = useRef(null)
  const s = useBehaviorStore()
  useEffect(() => {
    const onKey = e => {
      if (e.isComposing || e.target.closest('input, textarea, select, [contenteditable="true"]') || document.querySelector('.dialog-overlay')) return
      const state = useBehaviorStore.getState(), mod = e.ctrlKey || e.metaKey, key = e.key.toLowerCase()
      let action
      if (key === 'delete' || key === 'backspace') action = state.deleteSelection
      if (mod && key === 'z') action = e.shiftKey ? state.redo : state.undo
      if (mod && key === 'y') action = state.redo
      if (mod && key === 'c' && !window.getSelection()?.toString()) action = state.copy
      if (mod && key === 'v') action = state.paste
      if (mod && key === 'd') action = () => { state.copy(); state.paste() }
      if (action) { e.preventDefault(); action() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return <div className="canvas">
    <ReactFlow nodes={s.nodes} edges={s.edges.filter(e=>!(e.sourceHandle==='rest'&&s.nodes.some(n=>n.id===e.source&&n.type==='loop'&&n.data.restEnabled===false)))} nodeTypes={nodeTypes} edgeTypes={edgeTypes} elevateEdgesOnSelect={false} onInit={instance => { flow.current = instance }}
      onNodesChange={s.changeNodes} onEdgesChange={s.changeEdges} onConnect={s.connect}
      isValidConnection={connection=>{const source=s.nodes.find(n=>n.id===connection.source);return !s.nodes.some(n=>n.id===connection.target&&n.type==='start')&&(source?.type!=='loop'||(isLoopOutput(connection.sourceHandle)&&connection.target!==connection.source&&(connection.sourceHandle!=='rest'||source.data.restEnabled!==false)))}}
      onNodeDragStart={s.checkpoint} onNodeClick={(_, node) => s.selectNode(node)} onPaneClick={() => s.selectNode(null)}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
      onDrop={e => {
        e.preventDefault()
        const type = e.dataTransfer.getData('application/reactflow')
        if (!NODE_CONFIG[type] || type==='start' || !flow.current) return
        s.addNode({ id: crypto.randomUUID(), type, position: flow.current.screenToFlowPosition({ x: e.clientX, y: e.clientY }), data: { ...structuredClone(NODE_CONFIG[type].defaultData), name: NODE_CONFIG[type].label + '节点' } })
      }}
      defaultEdgeOptions={edgeOptions} connectionLineType={ConnectionLineType.Bezier}
      deleteKeyCode={null} multiSelectionKeyCode="Shift" minZoom={0.15} maxZoom={2} fitView>
      <Background color="#29313d" gap={20} />
      <DocumentViewport/>
      <Controls /><MiniMap nodeColor={node => NODE_CONFIG[node.type]?.color || '#94A3B8'} maskColor="rgba(5,7,12,.7)" />
    </ReactFlow>
  </div>
}
