import StructuredCanvas from './StructuredCanvas'
import CanvasViewTabs from './CanvasViewTabs'
import {useCanvasView} from '../store/canvasView'
import {externalExit} from '../utils/externalExits'
import React, { useEffect, useRef } from 'react'
import ReactFlow, { Background, Controls, MiniMap, MarkerType, ConnectionLineType, useNodesInitialized, useReactFlow } from 'reactflow'
import 'reactflow/dist/style.css'
import { useState } from 'react'
import { openDroppedFiles } from '../store/documentSession'
import { useBehaviorStore } from '../store/behaviorStore'
import { NODE_CONFIG } from '../constants/behaviorTypes'
import BehaviorNode from './BehaviorNode'
import StartNode from './StartNode'
import FlowingEdge from './FlowingEdge'
import { isLoopOutput, isLoopOutputEnabled } from '../utils/loopFlow'
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
  const dragDepth=useRef(0),[fileHover,setFileHover]=useState(false)
  const s = useBehaviorStore()
  const mode=useCanvasView(v=>v.mode)
  useEffect(()=>{
    if(mode==='structure')return
    const focus=e=>{
      const state=useBehaviorStore.getState(),node=state.nodes.find(n=>n.id===e.detail)
      state.selectNode(node||null)
      if(node){state.changeNodes(state.nodes.map(n=>({id:n.id,type:'select',selected:n.id===node.id})));flow.current?.fitView({nodes:[{id:node.id}],padding:.5,maxZoom:1,duration:250})}
    }
    window.addEventListener('pps-focus-node',focus);return()=>window.removeEventListener('pps-focus-node',focus)
  },[mode])
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
  if(mode==='structure')return <StructuredCanvas graph={{nodes:s.nodes,edges:s.edges,behaviorInfo:s.behaviorInfo,layout:s.layout}} revision={s.documentRevision} onSelect={n=>{s.selectNode(n);s.changeNodes(s.nodes.map(x=>({id:x.id,type:'select',selected:x.id===n?.id})))}} onPositions={s.setStructurePositions} onAdd={s.addNode}/>
  return <div className="canvas"
    onDragEnter={e=>{if(Array.from(e.dataTransfer.types).includes('Files')){e.preventDefault();dragDepth.current++;setFileHover(true)}}}
    onDragLeave={()=>{dragDepth.current=Math.max(0,dragDepth.current-1);if(!dragDepth.current)setFileHover(false)}}>
    <CanvasViewTabs/>
    {fileHover&&<div className="canvas-file-drop-hint" role="status">松开以打开行为图 JSON（替换当前画布，未保存时会先提示）</div>}
    <ReactFlow nodes={s.nodes} edges={s.edges.filter(e=>!(e.sourceHandle&&s.nodes.some(n=>n.id===e.source&&n.type==='loop'&&!isLoopOutputEnabled(n.data,e.sourceHandle))))} nodeTypes={nodeTypes} edgeTypes={edgeTypes} elevateEdgesOnSelect={false} onInit={instance => { flow.current = instance }}
      onNodesChange={s.changeNodes} onEdgesChange={s.changeEdges} onConnect={s.connect}
      isValidConnection={connection=>{const source=s.nodes.find(n=>n.id===connection.source);return !externalExit(source?.data||{},connection.sourceHandle)&&!(source?.type==='move'&&connection.sourceHandle==='unreachable'&&s.nodes.find(n=>n.id===connection.target)?.type!=='end')&&!s.nodes.some(n=>n.id===connection.target&&n.type==='start')&&(source?.type!=='loop'||(isLoopOutputEnabled(source.data,connection.sourceHandle)&&connection.target!==connection.source))}}
      onNodeDragStart={s.checkpoint} onNodeClick={(_, node) => s.selectNode(node)} onPaneClick={() => s.selectNode(null)}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = Array.from(e.dataTransfer.types).includes('Files')?'copy':'move' }}
      onDrop={e => {
        e.preventDefault()
        dragDepth.current=0;setFileHover(false)
        if(document.querySelector('.dialog-overlay'))return
        if(Array.from(e.dataTransfer.types).includes('Files')||e.dataTransfer.files.length){void openDroppedFiles(e.dataTransfer);return}
        const type = e.dataTransfer.getData('application/reactflow')
        if (!NODE_CONFIG[type] || type==='start' || type==='move' || !flow.current) return
        s.addNode({ id: crypto.randomUUID(), type, position: flow.current.screenToFlowPosition({ x: e.clientX, y: e.clientY }), data: { ...structuredClone(NODE_CONFIG[type].defaultData), name:NODE_CONFIG[type].label+'节点' } })
      }}
      defaultEdgeOptions={edgeOptions} connectionLineType={ConnectionLineType.Bezier}
      deleteKeyCode={null} multiSelectionKeyCode="Shift" minZoom={0.15} maxZoom={2} fitView>
      <Background color="#29313d" gap={20} />
      <DocumentViewport/>
      <Controls /><MiniMap nodeColor={node => NODE_CONFIG[node.type]?.color || '#94A3B8'} maskColor="rgba(5,7,12,.7)" />
    </ReactFlow>
  </div>
}
