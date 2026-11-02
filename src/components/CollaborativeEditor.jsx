import React,{createContext,useContext,useEffect,useRef,useState} from 'react'
import {useFileView} from '../store/fileView'
import ReactFlow,{Background,Controls,MarkerType} from 'reactflow'
import 'reactflow/dist/style.css'
import {CollaborationClient} from '../store/collaborationClient'
import {EditorStoreContext} from '../store/editorStore'
import {GraphDisplayContext} from '../store/graphDisplay'
import {NODE_CONFIG} from '../constants/behaviorTypes'
import BehaviorNode from './BehaviorNode'
import StartNode from './StartNode'
import FlowingEdge from './FlowingEdge'
import PropertyPanel from './PropertyPanel'
import './CollaborativeEditor.css'
const PresenceContext=createContext(null)
const colors=['#2563eb','#a21caf','#0f766e','#b45309','#be123c','#6d28d9']
const color=id=>colors[[...id].reduce((sum,c)=>sum+c.charCodeAt(0),0)%colors.length]
function SharedNode(props){
 const state=useContext(PresenceContext),owner=state.room?.locks[props.id],person=state.room?.participants.find(p=>p.session===owner)
 return <div className="collab-node" style={owner?{outline:'2px solid '+color(owner)}:undefined}>
  {person&&<span className="collab-node-owner" style={{background:color(owner)}}>{person.name}{owner===state.room.session?' · 我正在编辑':' · 正在编辑'}</span>}
  {props.type==='start'?<StartNode {...props}/>:<BehaviorNode {...props}/>}</div>
}
const nodeTypes=Object.fromEntries(Object.keys(NODE_CONFIG).map(t=>[t,SharedNode]))
const edgeTypes={default:FlowingEdge}
const tabId=crypto.randomUUID()
const recoveryPrefix=name=>'pps-collaboration-recovery:'+name+':'
const recoveryKey=name=>recoveryPrefix(name)+tabId
function recoveries(name){try{return Object.keys(localStorage).filter(k=>k.startsWith(recoveryPrefix(name))).map(key=>({key,config:JSON.parse(localStorage.getItem(key))}))}catch{return []}}
function download(name,config){
 const url=URL.createObjectURL(new Blob([JSON.stringify(config,null,2)],{type:'application/json'})),a=document.createElement('a')
 a.href=url;a.download=name.replace(/\.json$/i,'')+'-协作副本.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
}
export default function CollaborativeEditor({file,onClose}){
 const [state,setState]=useState({room:null,error:'',connected:false}),[notice,setNotice]=useState(''),[generation,setGeneration]=useState(0)
 const [recovery,setRecovery]=useState(()=>recoveries(file.name))
 const [client,setClient]=useState(null),status=useRef(state)
 useEffect(()=>{
  useFileView.getState().setOnlineControls({
   canEdit:state.connected&&!state.room?.saveIntent,canSave:state.connected&&!state.pending&&!state.room?.saveIntent,
   save:()=>client?.save(),download:()=>state.room&&download(file.name,client.store.getState().exportConfig()),
   addNode:type=>client?.addAtCenter?.(type),
   canLeave:()=>!status.current.pending||window.confirm('还有未同步修改，已尽力保留浏览器恢复副本。建议先下载副本，仍要切换吗？')
  })
 },[client,state,file.name])
 useEffect(()=>()=>useFileView.getState().setOnlineControls(null),[])
 useEffect(()=>{
  const c=new CollaborationClient(file.name,{onStatus:next=>{status.current=next;setState(next);if(next.pending){try{localStorage.setItem(recoveryKey(file.name),JSON.stringify(c.store.getState().exportConfig()))}catch{}}else if(next.connected){try{localStorage.removeItem(recoveryKey(file.name))}catch{}}}})
  c.onNotice=setNotice;setClient(c);setState({room:null,error:'',connected:false})
  c.join().catch(e=>setState({room:null,error:e.message,connected:false}))
  const unload=e=>{if(status.current.pending){e.preventDefault();e.returnValue=''}}
  window.addEventListener('beforeunload',unload)
  return()=>{window.removeEventListener('beforeunload',unload);void c.close()}
 },[file.name,generation])
 const close=()=>onClose()
 return <section className="collab-workspace" aria-label={'共同编辑 '+file.name}>
  <header className="collab-header"><strong>{file.name}</strong><span role="status">{state.error?'同步已暂停':state.room?state.room.saveIntent?'正在核对 GitLab 保存结果 · 暂停编辑；中断后可再次保存核对':state.pending?'正在同步…':state.room.revision===state.room.savedRevision?'已保存到 GitLab':'已同步共享草稿 · 尚未保存 GitLab':'正在加入协作…'}</span>
   <button disabled={!state.room} onClick={()=>download(file.name,client.store.getState().exportConfig())}>下载当前副本</button><button onClick={close}>退出协作</button></header>
  {!!recovery.length&&<div className="collab-notice">发现未同步的恢复副本。{recovery.map((r,i)=><button key={r.key} onClick={()=>download(file.name,r.config)}>下载恢复副本 {i+1}</button>)}<button onClick={()=>setRecovery([])}>收起提示</button></div>}
  {state.error&&<div className="collab-notice" role="alert">{state.error}。请先下载当前副本。<button onClick={()=>{if(!status.current.pending||window.confirm('重新加入会读取服务端共享草稿。请确认已下载未同步修改的副本。'))setGeneration(n=>n+1)}}>重新加入</button></div>}
  {notice&&<div className="collab-notice" role="alert">{notice}<button onClick={()=>setNotice('')}>知道了</button></div>}
  {client&&state.room&&<EditorStoreContext.Provider value={client.store}><PresenceContext.Provider value={state}><RoomCanvas client={client} state={state}/></PresenceContext.Provider></EditorStoreContext.Provider>}
 </section>
}
function RoomCanvas({client,state}){
 const graph=client.store(),flow=useRef(null),[viewport,setViewport]=useState({x:0,y:0,zoom:1})
 const selected=graph.selectedNode?.id,room=state.room,canEdit=state.connected&&!room.saveIntent,mine=id=>canEdit&&room.locks[id]===room.session
 const acquiring=!!selected&&state.locking===selected
 const editable=!!selected&&!acquiring&&mine(selected),others=room.participants.filter(p=>p.session!==room.session)
 const addNode=(type,position)=>{const config=NODE_CONFIG[type];if(!canEdit||!config||['start','move'].includes(type))return;graph.addNode({id:crypto.randomUUID(),type,data:structuredClone(config.defaultData),position})}
 client.addAtCenter=type=>{const bounds=document.querySelector('.collab-canvas')?.getBoundingClientRect();if(bounds)addNode(type,flow.current?.screenToFlowPosition({x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2})||{x:0,y:0})}
 useEffect(()=>{const key=e=>{if((e.ctrlKey||e.metaKey)&&['s','z','y'].includes(e.key.toLowerCase())){e.preventDefault();e.stopImmediatePropagation();if(e.key.toLowerCase()==='s')void client.save()}};window.addEventListener('keydown',key,true);return()=>window.removeEventListener('keydown',key,true)},[client])
 return <>
  <div className="collab-people" aria-label="正在协作的人"><span>{room.participants.length} 人在线</span>{room.participants.map(p=><button key={p.session} style={{borderColor:color(p.session)}} onClick={()=>{const node=graph.nodes.find(n=>n.id===p.selected);if(node)flow.current?.fitView({nodes:[node],maxZoom:1,duration:200});else if(p.cursor)flow.current?.setCenter(p.cursor.x,p.cursor.y,{zoom:1,duration:200})}}>{p.name}{p.session===room.session?'（我）':''}{p.selected?' · 编辑中':''}</button>)}<span>点击节点获取编辑权；空白处释放。共享草稿实时同步，GitLab 手动保存。</span></div>
  <div className="collab-body">
   <div className="collab-canvas canvas" onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect='move'}} onDrop={e=>{e.preventDefault();if(flow.current)addNode(e.dataTransfer.getData('application/reactflow'),flow.current.screenToFlowPosition({x:e.clientX,y:e.clientY}))}} onPointerMove={e=>{if(flow.current)client.cursor=flow.current.screenToFlowPosition({x:e.clientX,y:e.clientY})}} onPointerLeave={()=>{client.cursor=null}}>
    <GraphDisplayContext.Provider value={graph}><ReactFlow nodes={graph.nodes.map(n=>({...n,draggable:mine(n.id),connectable:canEdit&&(!room.locks[n.id]||mine(n.id))}))} edges={graph.edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onInit={f=>{flow.current=f;setViewport(f.getViewport())}} onMove={(_,v)=>setViewport(v)}
     onNodesChange={changes=>{graph.changeNodes(changes.filter(c=>c.type==='dimensions'||c.type==='select'||(c.type==='position'&&mine(c.id))));const selection=changes.find(c=>c.type==='select'&&c.selected);if(selection)void client.lock(selection.id)}}
     onNodeClick={(_,n)=>void client.lock(n.id)} onPaneClick={()=>void client.lock(null)}
     onConnect={params=>{if(mine(params.source))graph.connect(params)}}
     onEdgesChange={changes=>graph.changeEdges(changes.filter(c=>c.type==='select'))}
     deleteKeyCode={null} selectionOnDrag={false} defaultEdgeOptions={{markerEnd:{type:MarkerType.ArrowClosed,color:'#94a3b8'}}} fitView minZoom={.1} maxZoom={2}><Background/><Controls showInteractive={false}/></ReactFlow></GraphDisplayContext.Provider>
    <div className="collab-cursors" aria-hidden="true">{others.filter(p=>p.cursor).map(p=><div key={p.session} data-testid="remote-cursor" style={{transform:'translate('+(p.cursor.x*viewport.zoom+viewport.x)+'px,'+(p.cursor.y*viewport.zoom+viewport.y)+'px)',color:color(p.session)}}>➤ <span style={{background:color(p.session)}}>{p.name}</span></div>)}</div>
   </div>
   <aside className="collab-properties"><div className="collab-notice" role="status">{acquiring?'正在获取此节点编辑权…':editable?'你已获得此节点编辑权':selected?'此节点暂不可编辑':'请选择节点；编辑行为准入数据请先点击开始节点。'}</div><div inert={!editable?'':undefined} aria-disabled={!editable}><PropertyPanel/></div></aside>
  </div>
 </>
}
