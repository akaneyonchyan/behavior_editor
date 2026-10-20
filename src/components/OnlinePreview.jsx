import React,{useEffect,useMemo,useState} from 'react'
import ReactFlow,{Background,Controls,MiniMap,MarkerType,applyNodeChanges} from 'reactflow'
import {GraphDisplayContext} from '../store/graphDisplay'
import {ensureStart,normalizeMetadata} from '../utils/behaviorMetadata'
import {isLoopOutputEnabled} from '../utils/loopFlow'
import {NODE_CONFIG} from '../constants/behaviorTypes'
import BehaviorNode from './BehaviorNode'
import StartNode from './StartNode'
import FlowingEdge from './FlowingEdge'
import './OnlineFiles.css'
import {useFileView} from '../store/fileView'
import {downloadBehavior} from '../utils/downloadBehavior'
const nodeTypes={...Object.fromEntries(Object.keys(NODE_CONFIG).map(t=>[t,BehaviorNode])),start:StartNode}
const edgeTypes={default:FlowingEdge}
export default function OnlinePreview({file}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('')
 const onDownload=async()=>{if(busy)return;setBusy(true);setError('');try{const result=await downloadBehavior(file);if(result)useFileView.getState().setTab('local')}catch(e){setError(e.message)}finally{setBusy(false)}}
 useEffect(()=>{
  const key=e=>{if((e.ctrlKey||e.metaKey)&&['z','y','d','s'].includes(e.key.toLowerCase())){e.preventDefault();e.stopImmediatePropagation()}}
  window.addEventListener('keydown',key,true);return()=>window.removeEventListener('keydown',key,true)
 },[])
 const initial=useMemo(()=>{
  const c=structuredClone(file.config)
  return {...ensureStart(c.graph.nodes.map((n,i)=>({...n,position:n.position||{x:i*380,y:0},selected:false})),c.graph.edges.map((e,i)=>({...e,id:'preview_'+i,type:'default'}))),behaviorInfo:normalizeMetadata(c.behavior)}
 },[file])
 const [nodes,setNodes]=useState(initial.nodes),[selected,setSelected]=useState(null)
 const edges=initial.edges.filter(e=>!e.sourceHandle||!nodes.some(n=>n.id===e.source&&n.type==='loop'&&!isLoopOutputEnabled(n.data,e.sourceHandle)))
 return <section className="online-preview" aria-label="在线行为只读画布">\n   <header><strong>{file.name} · 在线只读</strong><button className="toolbar-btn" disabled={busy} onClick={onDownload}>下载到本地编辑</button></header>
   {error&&<p role="alert">{error}</p>}\n   <p>在线版本 {file.sha.slice(0,8)} · 可查看和缩放；本地草稿保持原样。选中节点可查看原始配置。</p>
   <div className="online-preview-body"><GraphDisplayContext.Provider value={{...initial,nodes}}>
    <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} nodesDraggable={false} nodesConnectable={false} edgesUpdatable={false} deleteKeyCode={null} onNodesChange={changes=>setNodes(n=>applyNodeChanges(changes.filter(c=>['dimensions','select'].includes(c.type)),n))} onNodeClick={(_,n)=>setSelected(n)} onPaneClick={()=>setSelected(null)} defaultEdgeOptions={{markerEnd:{type:MarkerType.ArrowClosed,color:'#94A3B8'}}} minZoom={.1} maxZoom={2} fitView>
     <Background/><Controls showInteractive={false}/><MiniMap/>
    </ReactFlow>
   </GraphDisplayContext.Provider>{selected&&<aside><strong>{selected.data.name||NODE_CONFIG[selected.type].label}</strong><pre>{JSON.stringify(selected.type==='start'?file.config.behavior:selected.data,null,2)}</pre></aside>}</div>
 </section>
}
