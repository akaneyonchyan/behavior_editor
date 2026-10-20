import React,{useMemo,useState,useEffect,useRef} from 'react'
import ReactFlow,{Background,Controls,MiniMap,Handle,Position,MarkerType,useReactFlow} from 'reactflow'
import 'reactflow/dist/style.css'
import {structureLayout} from '../utils/structureLayout'
import {NODE_CONFIG} from '../constants/behaviorTypes'
import BehaviorNode from './BehaviorNode'
import StartNode from './StartNode'
import FlowingEdge from './FlowingEdge'
import CanvasViewTabs from './CanvasViewTabs'
import {GraphDisplayContext} from '../store/graphDisplay'
import {openDroppedFiles} from '../store/documentSession'
import './StructuredCanvas.css'

function ScopeNode({data}){
 const {node,scope,collapsed}=data
 return <div className={'loop-scope '+(collapsed?'collapsed':'')} style={{'--node-color':NODE_CONFIG.loop.color}}>
  <header><button className="nodrag scope-title" onClick={()=>data.select(node)}>{node.data.name||'循环'} · {node.data.checkTiming==='before'?'先判定，再执行':'旧图时序待核对'}</button>
   <button className="nodrag scope-toggle" data-export-ignore="true" aria-label={(collapsed?'展开':'折叠')+'循环 '+scope.loopId} onClick={()=>data.toggle(scope.loopId)}>{collapsed?'展开':'折叠'}</button>
   <small>{scope.confirmed?'已确认范围':'候选范围，待确认'} · {data.count} 个内部节点{data.exits?' · 含 '+data.exits+' 处跳出行为':''}</small>
  </header>
  {collapsed&&<><p>内部流程已折叠；连接保留原去向。</p><Handle type="target" position={Position.Left} id="in"/><Handle type="source" position={Position.Right} id="out"/></>}
 </div>
}
const nodeTypes={...Object.fromEntries(Object.keys(NODE_CONFIG).map(t=>[t,BehaviorNode])),start:StartNode,loopScope:ScopeNode}
const edgeTypes={default:FlowingEdge}
function FitStructure({geometry,revision}){
 const {fitView}=useReactFlow()
 useEffect(()=>{const timer=setTimeout(()=>fitView({padding:.12,maxZoom:1}),80);return()=>clearTimeout(timer)},[geometry,revision,fitView])
 return null
}
export default function StructuredCanvas({graph,readOnly=false,onSelect,onPositions,onAdd,revision=0}){
 const [sizes,setSizes]=useState({}),[collapsed,setCollapsed]=useState([]),[dragged,setDragged]=useState({}),[previewPositions,setPreviewPositions]=useState(null)
 const flow=useRef(null),selectRef=useRef(onSelect);selectRef.current=onSelect
 useEffect(()=>{setDragged({})},[graph.layout])
 useEffect(()=>{
  const focus=e=>{const n=graph.nodes.find(n=>n.id===e.detail);if(!n)return;setCollapsed([]);onSelect(n);setTimeout(()=>flow.current?.fitView({nodes:[{id:n.id}],padding:.5,maxZoom:1}),150)}
  if(!readOnly)window.addEventListener('pps-focus-node',focus)
  return()=>window.removeEventListener('pps-focus-node',focus)
 },[graph.nodes,onSelect,readOnly])
 const layout=useMemo(()=>({...graph.layout,...(readOnly&&previewPositions?{positions:previewPositions}:{})}),[graph.layout,readOnly,previewPositions])
 const computed=useMemo(()=>structureLayout(graph.nodes,graph.edges,layout,sizes,collapsed),[graph.nodes,graph.edges,layout,sizes,collapsed])
 const toggle=id=>setCollapsed(list=>list.includes(id)?list.filter(x=>x!==id):[...list,id])
 const nodes=computed.nodes.map(n=>({...n,position:dragged[n.id]||n.position,draggable:n.type==='loopScope'&&!readOnly,...(n.type==='loopScope'?{data:{...n.data,toggle,select:onSelect}}:{})}))
 const geometry=JSON.stringify([sizes,collapsed,computed.scopes.map(s=>[s.loopId,s.members])])
 const change=changes=>{
  const measured=changes.filter(c=>c.type==='dimensions'&&c.dimensions&&graph.nodes.some(n=>n.id===c.id))
  if(measured.length)setSizes(old=>{const next={...old};let changed=false;for(const c of measured)if(old[c.id]?.width!==c.dimensions.width||old[c.id]?.height!==c.dimensions.height){next[c.id]=c.dimensions;changed=true}return changed?next:old})
  const moving=changes.filter(c=>c.type==='position'&&c.position)
  if(moving.length)setDragged(old=>({...old,...Object.fromEntries(moving.map(c=>[c.id,c.position]))}))
 }
 return <div className={readOnly?'structured-canvas online-structure':'canvas structured-canvas'} aria-label="父子结构画布"
  onDragOver={e=>{if(!readOnly)e.preventDefault()}}
  onDrop={e=>{if(readOnly)return;e.preventDefault();if(e.dataTransfer.files.length){void openDroppedFiles(e.dataTransfer);return}const type=e.dataTransfer.getData('application/reactflow');if(type&&NODE_CONFIG[type]&&!['start','move'].includes(type))onAdd?.({id:crypto.randomUUID(),type,position:{x:0,y:0},data:structuredClone(NODE_CONFIG[type].defaultData)})}}>
  <CanvasViewTabs><button onClick={()=>readOnly?setPreviewPositions({}):onPositions?.({})}>重新排布</button><button onClick={()=>setCollapsed([])}>全部展开</button><span>顺序从左向右；连线编辑可切换连线视图</span></CanvasViewTabs>
  {computed.warnings.length>0&&<details className="structure-warnings" data-export-ignore="true"><summary>结构核对（{computed.warnings.length}）</summary>{computed.warnings.map((w,i)=><button key={i} onClick={()=>{const n=graph.nodes.find(n=>n.id===w.id);if(n)onSelect(n)}}>{graph.nodes.find(n=>n.id===w.id)?.data.name||w.id||'流程'}：{w.message}</button>)}</details>}
  <GraphDisplayContext.Provider value={graph}>
  <ReactFlow nodes={nodes} edges={computed.edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
   onInit={f=>{flow.current=f}} onNodesChange={change}
   onNodeClick={(_,n)=>{if(n.type!=='loopScope')onSelect(graph.nodes.find(x=>x.id===n.id))}}
   onPaneClick={()=>onSelect(null)}
   onNodeDragStop={(_,n)=>{if(!readOnly&&n.type==='loopScope'){onPositions?.({...layout.positions,[n.id]:n.position});setDragged({})}}}
   nodesConnectable={false} edgesUpdatable={false} deleteKeyCode={null} minZoom={.05} maxZoom={2}
   defaultEdgeOptions={{markerEnd:{type:MarkerType.ArrowClosed,color:'#94A3B8'}}}>
   <Background color="#29313d" gap={20}/><Controls showInteractive={false}/><MiniMap nodeColor={n=>n.type==='loopScope'?'#372536':NODE_CONFIG[n.type]?.color||'#94A3B8'}/>
   <FitStructure geometry={geometry} revision={revision}/>
  </ReactFlow>
  </GraphDisplayContext.Provider>
 </div>
}
