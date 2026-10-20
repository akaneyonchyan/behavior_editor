import React,{useMemo,useState} from 'react'
import ReactFlow,{Background,Controls,MiniMap,MarkerType,applyNodeChanges} from 'reactflow'
import {GraphDisplayContext} from '../store/graphDisplay'
import {ensureStart,normalizeMetadata} from '../utils/behaviorMetadata'
import {isLoopOutputEnabled} from '../utils/loopFlow'
import {NODE_CONFIG} from '../constants/behaviorTypes'
import BehaviorNode from './BehaviorNode'
import StartNode from './StartNode'
import FlowingEdge from './FlowingEdge'
import './OnlineFiles.css'
import useModalFocus from './useModalFocus'
const nodeTypes={...Object.fromEntries(Object.keys(NODE_CONFIG).map(t=>[t,BehaviorNode])),start:StartNode}
const edgeTypes={default:FlowingEdge}
export default function OnlinePreview({file,onClose,onDownload,busy}){
 const modal=useModalFocus()
 const initial=useMemo(()=>{
  const c=structuredClone(file.config)
  return {...ensureStart(c.graph.nodes.map((n,i)=>({...n,position:n.position||{x:i*380,y:0},selected:false})),c.graph.edges.map((e,i)=>({...e,id:'preview_'+i,type:'default'}))),behaviorInfo:normalizeMetadata(c.behavior)}
 },[file])
 const [nodes,setNodes]=useState(initial.nodes),[selected,setSelected]=useState(null)
 const edges=initial.edges.filter(e=>!e.sourceHandle||!nodes.some(n=>n.id===e.source&&n.type==='loop'&&!isLoopOutputEnabled(n.data,e.sourceHandle)))
 return <div ref={modal} tabIndex={-1} className="dialog-overlay online-preview-overlay" role="dialog" aria-modal="true" aria-label="在线行为只读预览" onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape'&&!busy)onClose()}}>
  <div className="online-preview">
   <header><strong>{file.name} · 在线只读</strong><button className="toolbar-btn" disabled={busy} onClick={onDownload}>下载到本地编辑</button><button className="toolbar-btn" disabled={busy} onClick={onClose}>关闭预览</button></header>
   <p>在线版本 {file.sha.slice(0,8)} · 可查看和缩放；本地草稿保持原样。选中节点可查看原始配置。</p>
   <div className="online-preview-body"><GraphDisplayContext.Provider value={{...initial,nodes}}>
    <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} nodesDraggable={false} nodesConnectable={false} edgesUpdatable={false} deleteKeyCode={null} onNodesChange={changes=>setNodes(n=>applyNodeChanges(changes.filter(c=>['dimensions','select'].includes(c.type)),n))} onNodeClick={(_,n)=>setSelected(n)} onPaneClick={()=>setSelected(null)} defaultEdgeOptions={{markerEnd:{type:MarkerType.ArrowClosed,color:'#94A3B8'}}} minZoom={.1} maxZoom={2} fitView>
     <Background/><Controls showInteractive={false}/><MiniMap/>
    </ReactFlow>
   </GraphDisplayContext.Provider>{selected&&<aside><strong>{selected.data.name||NODE_CONFIG[selected.type].label}</strong><pre>{JSON.stringify(selected.type==='start'?file.config.behavior:selected.data,null,2)}</pre></aside>}</div>
  </div>
 </div>
}
