import {absolutePosition,dropContainer} from '../utils/structureEditing'
import React,{useMemo,useState,useEffect,useRef} from 'react'
import ReactFlow,{Background,Controls,MiniMap,Handle,Position,MarkerType,useReactFlow,useUpdateNodeInternals} from 'reactflow'
import 'reactflow/dist/style.css'
import {structureLayout,scopeNodeId} from '../utils/structureLayout'
import {NODE_CONFIG} from '../constants/behaviorTypes'
import BehaviorNode from './BehaviorNode'
import StartNode from './StartNode'
import FlowingEdge from './FlowingEdge'
import CanvasViewTabs from './CanvasViewTabs'
import {GraphDisplayContext} from '../store/graphDisplay'
import {openDroppedFiles} from '../store/documentSession'
import './StructuredCanvas.css'
import {LoopConditionSummary,LoopConditionsEditor} from './LoopEditor'
import {externalExit} from '../utils/externalExits'


function ScopeNode({id,data}){
 const {node,scope,collapsed}=data
 const header=useRef(null),updateInternals=useUpdateNodeInternals()
 useEffect(()=>{const observer=new ResizeObserver(()=>{data.measure(node.id,header.current.offsetHeight);updateInternals(id)});observer.observe(header.current);updateInternals(id);return()=>observer.disconnect()},[id,node.data,collapsed,data.headerHeight,JSON.stringify(data.boundaryExits),data.measure,updateInternals])
 return <div className={'loop-scope '+(collapsed?'collapsed':'')} style={{'--node-color':NODE_CONFIG.loop.color}}>
  <header ref={header}><button className="nodrag scope-title" onClick={()=>data.select(node)}>{node.data.name||'循环'} · 先判定，再执行</button>
   <button className="nodrag scope-toggle" data-export-ignore="true" aria-label={(collapsed?'展开':'折叠')+'循环 '+scope.loopId} onClick={()=>data.toggle(scope.loopId)}>{collapsed?'展开':'折叠'}</button>
   {data.readOnly?<LoopConditionSummary data={node.data}/>:<LoopConditionsEditor node={node} compact onUpdate={data.update}/>}
   <small>{data.count} 个内部节点{data.exits?' · 含 '+data.exits+' 处跳出行为':''}</small>
   <div className="scope-flow-note">{collapsed?'内部节点已折叠':'内部流程完成一轮后自动重新判定，无需回线'}</div>
  </header>
  <Handle type="target" position={Position.Left} id="in" style={{top:28}} title="循环入口"/>
  <div className="scope-output" style={{top:24}}>{externalExit(node.data,'complete')?<span title={externalExit(node.data,'complete').note}>循环结束 ↗ 跳出行为</span>:<><span>循环出口</span><Handle type="source" position={Position.Right} id="complete"/></>}</div>
  {data.boundaryExits.map((exit,i)=><div key={exit.handle} className="scope-output scope-boundary" style={{top:collapsed?64+i*28:(data.headerHeight||150)+40+i*48}}><span title={exit.label}>分支出口 {i+1}</span><Handle type="source" position={Position.Right} id={exit.handle}/></div>)}

 </div>
}
function LoopPortal({data}){
 return <div className={'loop-portal '+data.kind} title={data.kind==='entry'?'本轮开始':data.label} aria-label={data.kind==='entry'?'循环内部起点':'循环内部出口'}>
  {data.kind==='entry'?<><span>▶</span><Handle type="source" position={Position.Right} id="out"/></>:<><Handle type="target" position={Position.Left} id="in"/><span>↗</span></>}
 </div>
}
const nodeTypes={loopPortal:LoopPortal,...Object.fromEntries(Object.keys(NODE_CONFIG).map(t=>[t,BehaviorNode])),start:StartNode,loopScope:ScopeNode}
const edgeTypes={default:FlowingEdge}
function FitStructure({geometry,revision}){
 const {fitView}=useReactFlow()
 useEffect(()=>{const timer=setTimeout(()=>fitView({padding:.12,maxZoom:1}),80);return()=>clearTimeout(timer)},[geometry,revision,fitView])
 return null
}
export default function StructuredCanvas({graph,readOnly=false,onSelect,onPositions,onAdd,onUpdate,onMove,onAddStructure,revision=0}){
 const [sizes,setSizes]=useState({}),[collapsed,setCollapsed]=useState([]),[dragged,setDragged]=useState({}),[previewPositions,setPreviewPositions]=useState(null)
 const dragStart=useRef(null),flow=useRef(null),selectRef=useRef(onSelect);selectRef.current=onSelect
 useEffect(()=>{setDragged({})},[graph.layout])
 useEffect(()=>{
  const focus=e=>{const n=graph.nodes.find(n=>n.id===e.detail);if(!n)return;setCollapsed([]);onSelect(n);setTimeout(()=>flow.current?.fitView({nodes:[{id:n.id}],padding:.5,maxZoom:1}),150)}
  if(!readOnly)window.addEventListener('pps-focus-node',focus)
  return()=>window.removeEventListener('pps-focus-node',focus)
 },[graph.nodes,onSelect,readOnly])
 const layout=useMemo(()=>({...graph.layout,...(readOnly&&previewPositions?{positions:previewPositions}:{})}),[graph.layout,readOnly,previewPositions])
 const computed=useMemo(()=>structureLayout(graph.nodes,graph.edges,layout,sizes,collapsed),[graph.nodes,graph.edges,layout,sizes,collapsed])
 const toggle=id=>setCollapsed(list=>list.includes(id)?list.filter(x=>x!==id):[...list,id])
 const measure=React.useCallback((id,height)=>setSizes(old=>old['header:'+id]?.height===height?old:{...old,['header:'+id]:{height}}),[])
 const nodes=computed.nodes.map(n=>({...n,position:dragged[n.id]||n.position,draggable:n.type!=='loopPortal'&&!readOnly,...(n.type==='loopScope'?{data:{...n.data,headerHeight:sizes['header:'+n.data.node.id]?.height,toggle,select:onSelect,readOnly,update:onUpdate,measure}}:{})}))
 const geometry=JSON.stringify([collapsed,graph.nodes.map(n=>n.id)])
 const placement=(node,visualNodes)=>{
  const target=dropContainer(node,visualNodes,computed.scopes),absolute=absolutePosition(node,visualNodes)
  const targetPosition=target?absolutePosition(target,visualNodes):{x:0,y:0}
  const positions={...layout.positions,...Object.fromEntries(visualNodes.filter(n=>n.type!=='loopPortal').map(n=>[n.id,n.position]))}
  positions[node.id]={x:target?Math.max(96,absolute.x-targetPosition.x):absolute.x,y:target?Math.max((target.data.headerHeight||150)+32,absolute.y-targetPosition.y):absolute.y}
  return {targetLoopId:target?.data.scope.loopId||null,positions}
 }
 const finishMove=(_,node)=>{
  if(readOnly||node.type==='loopPortal')return
  const start=dragStart.current;dragStart.current=null
  if(start&&Math.abs(start.x-node.position.x)<.5&&Math.abs(start.y-node.position.y)<.5){setDragged({});return}
  const visualNodes=nodes.map(n=>n.id===node.id?{...n,...node}:n)
  const {targetLoopId,positions}=placement(node,visualNodes)
  onMove?.(node.data?.scope?.loopId||node.id,targetLoopId,positions)
  setDragged({})
 }
 const change=changes=>{
  const measured=changes.filter(c=>c.type==='dimensions'&&c.dimensions&&graph.nodes.some(n=>n.id===c.id))
  if(measured.length)setSizes(old=>{const next={...old};let changed=false;for(const c of measured)if(old[c.id]?.width!==c.dimensions.width||old[c.id]?.height!==c.dimensions.height){next[c.id]=c.dimensions;changed=true}return changed?next:old})
  const moving=changes.filter(c=>c.type==='position'&&c.position)
  if(moving.length)setDragged(old=>({...old,...Object.fromEntries(moving.map(c=>[c.id,c.position]))}))
 }
 return <div className={readOnly?'structured-canvas online-structure':'canvas structured-canvas'} aria-label="父子结构画布"
  onDragOver={e=>{if(!readOnly)e.preventDefault()}}
  onDrop={e=>{if(readOnly)return;e.preventDefault();if(e.dataTransfer.files.length){void openDroppedFiles(e.dataTransfer);return}const type=e.dataTransfer.getData('application/reactflow');if(type&&NODE_CONFIG[type]&&!['start','move'].includes(type)){
   const position=flow.current.screenToFlowPosition({x:e.clientX,y:e.clientY}),id=crypto.randomUUID(),node={id,type,position,data:structuredClone(NODE_CONFIG[type].defaultData)}
   const visual=type==='loop'?{...node,id:scopeNodeId([...graph.nodes,node],id),type:'loopScope',style:{width:540,height:350},data:{scope:{loopId:id,members:[]}}}:node
   const {targetLoopId,positions}=placement(visual,[...nodes,visual]);onAddStructure?.(node,targetLoopId,positions)
  }}}>

  <CanvasViewTabs><button onClick={()=>readOnly?setPreviewPositions({}):onPositions?.({})}>重新排布</button><button onClick={()=>setCollapsed([])}>全部展开</button><span>顺序从左向右；连线编辑可切换连线视图</span></CanvasViewTabs>
  {computed.warnings.length>0&&<details className="structure-warnings" data-export-ignore="true"><summary>结构核对（{computed.warnings.length}）</summary>{computed.warnings.map((w,i)=><button key={i} onClick={()=>{const n=graph.nodes.find(n=>n.id===w.id);if(n)onSelect(n)}}>{graph.nodes.find(n=>n.id===w.id)?.data.name||w.id||'流程'}：{w.message}</button>)}</details>}
  <GraphDisplayContext.Provider value={graph}>
  <ReactFlow nodes={nodes} edges={computed.edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
   onInit={f=>{flow.current=f}} onNodesChange={change}
   onNodeClick={(_,n)=>{if(n.type!=='loopPortal')onSelect(graph.nodes.find(x=>x.id===(n.data?.scope?.loopId||n.id)))}}
   onPaneClick={()=>onSelect(null)}
   nodeDragThreshold={3} onNodeDragStart={(_,n)=>{dragStart.current={...n.position}}} onNodeDragStop={finishMove}
   nodesConnectable={false} edgesUpdatable={false} deleteKeyCode={null} minZoom={.05} maxZoom={2}
   defaultEdgeOptions={{markerEnd:{type:MarkerType.ArrowClosed,color:'#94A3B8'}}}>
   <Background color="#29313d" gap={20}/><Controls showInteractive={false}/><MiniMap nodeColor={n=>n.type==='loopScope'?'#372536':n.type==='loopPortal'?NODE_CONFIG.loop.color:NODE_CONFIG[n.type]?.color||'#94A3B8'}/>
   <FitStructure geometry={geometry} revision={revision}/>
  </ReactFlow>
  </GraphDisplayContext.Provider>
 </div>
}
