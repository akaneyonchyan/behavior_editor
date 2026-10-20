import React,{useMemo,useState,useEffect,useRef} from 'react'
import ReactFlow,{Background,Controls,MiniMap,Handle,Position,MarkerType,useReactFlow,useUpdateNodeInternals} from 'reactflow'
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
import {LoopConditionSummary,LoopGoalSummary} from './LoopEditor'
import {externalExit} from '../utils/externalExits'
import {isLoopOutputEnabled} from '../utils/loopFlow'

function ScopeNode({id,data}){
 const {node,scope,collapsed}=data
 const header=useRef(null),updateInternals=useUpdateNodeInternals()
 useEffect(()=>{const observer=new ResizeObserver(()=>{data.measure(node.id,header.current.offsetHeight);updateInternals(id)});observer.observe(header.current);updateInternals(id);return()=>observer.disconnect()},[id,node.data,collapsed,data.measure,updateInternals])
 return <div className={'loop-scope '+(collapsed?'collapsed':'')} style={{'--node-color':NODE_CONFIG.loop.color}}>
  <header ref={header}><button className="nodrag scope-title" onClick={()=>data.select(node)}>{node.data.name||'循环'} · {node.data.checkTiming==='before'?'先判定，再执行':'旧图时序待核对'}</button>
   <button className="nodrag scope-toggle" data-export-ignore="true" aria-label={(collapsed?'展开':'折叠')+'循环 '+scope.loopId} onClick={()=>data.toggle(scope.loopId)}>{collapsed?'展开':'折叠'}</button>
   {node.data.loopVersion===3&&!data.readOnly?<div className="scope-condition-controls nodrag"><label>执行条件<select aria-label="容器循环执行条件" value={node.data.loopMode||'goal'} onChange={e=>data.update?.(node.id,{loopMode:e.target.value})}><option value="count">按配置的最大次数</option><option value="goal">按目标满足情况</option></select></label>{node.data.loopMode==='count'&&<label>最大次数<input aria-label="容器最大次数" placeholder="待设置" value={node.data.maxIterations||''} onChange={e=>data.update?.(node.id,{maxIterations:e.target.value})}/></label>}</div>:<LoopConditionSummary data={node.data}/>}
   <small>{scope.confirmed?'已确认范围':'候选范围，待确认'} · {data.count} 个内部节点{data.exits?' · 含 '+data.exits+' 处跳出行为':''}</small>
   {node.data.loopVersion===3&&!data.readOnly&&<LoopGoalSummary data={node.data}/>}
   <div className="scope-flow-note">{collapsed?'内部节点已折叠':'内部流程完成一轮后自动重新判定，无需回线'}</div>
   <Handle type="target" position={Position.Left} id="in" style={{top:28}}/>
   {['complete','continue','insufficient','rest'].filter(h=>isLoopOutputEnabled(node.data,h)).map((h,i)=><div key={h} className="scope-output" style={h==='continue'?{bottom:-12,left:24,right:'auto'}:{top:24+i*24}}>{externalExit(node.data,h)?<span title={externalExit(node.data,h).note}>{h==='complete'?'循环结束':'出口'} ↗ 跳出行为</span>:<><span>{({complete:'循环结束',continue:'进入循环体',insufficient:'旧准入不满足',rest:'旧稍息'})[h]}</span><Handle type="source" position={h==='continue'?Position.Bottom:Position.Right} id={h} style={h==='continue'?{left:80,top:'100%',bottom:'auto'}:{right:-5,top:'50%'}}/></>}</div>)}
  </header>
  {collapsed&&<Handle type="source" position={Position.Right} id="out"/>}
 </div>
}
const nodeTypes={...Object.fromEntries(Object.keys(NODE_CONFIG).map(t=>[t,BehaviorNode])),start:StartNode,loopScope:ScopeNode}
const edgeTypes={default:FlowingEdge}
function FitStructure({geometry,revision}){
 const {fitView}=useReactFlow()
 useEffect(()=>{const timer=setTimeout(()=>fitView({padding:.12,maxZoom:1}),80);return()=>clearTimeout(timer)},[geometry,revision,fitView])
 return null
}
export default function StructuredCanvas({graph,readOnly=false,onSelect,onPositions,onAdd,onUpdate,revision=0}){
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
 const measure=React.useCallback((id,height)=>setSizes(old=>old['header:'+id]?.height===height?old:{...old,['header:'+id]:{height}}),[])
 const nodes=computed.nodes.map(n=>({...n,position:dragged[n.id]||n.position,draggable:n.type==='loopScope'&&!readOnly,...(n.type==='loopScope'?{data:{...n.data,toggle,select:onSelect,readOnly,update:onUpdate,measure}}:{})}))
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
