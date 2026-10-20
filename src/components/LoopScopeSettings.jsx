import React,{useState,useEffect} from 'react'
import {useBehaviorStore} from '../store/behaviorStore'
import {inferLoopScope,checkScope} from '../utils/loopStructure'
import {NODE_CONFIG} from '../constants/behaviorTypes'
import './StructuredCanvas.css'
export default function LoopScopeSettings({node}){
 const {nodes,edges,layout,confirmLoopScope}=useBehaviorStore()
 const saved=layout?.scopes?.find(s=>s.loopId===node.id)
 const [entry,setEntry]=useState(saved?.entry||edges.find(e=>e.source===node.id&&e.sourceHandle==='continue')?.target||'')
 const [members,setMembers]=useState(saved?.members||[]),[error,setError]=useState(''),[notice,setNotice]=useState('')
 useEffect(()=>{setEntry(saved?.entry||edges.find(e=>e.source===node.id&&e.sourceHandle==='continue')?.target||'');setMembers(saved?.members||[])},[saved,node.id])
 const label=n=>n.data.name||NODE_CONFIG[n.type]?.label||n.id
 const infer=()=>{try{const scope=inferLoopScope(nodes,edges,node.id,entry);setEntry(scope.entry);setMembers(scope.members);setError('');setNotice('已生成候选范围，请核对后确认。')}catch(e){setError(e.message)}}
 const apply=()=>{try{confirmLoopScope(checkScope(nodes,edges,{loopId:node.id,entry,members}),true);setError('');setNotice('已确认：首次进入和每轮返回先判定；继续循环的连接显示到右侧 ↻ 标记，支持撤销。')}catch(e){setError(e.message)}}
 return <details className="scope-settings" >
  <summary>循环范围</summary>
  <p className="form-hint">先判定循环执行条件，再进入内部节点。</p>
  <label>循环体起点<select aria-label="循环体起点" value={entry} onChange={e=>{setEntry(e.target.value);setMembers([]);setNotice('')}}><option value="">选择起点</option>{nodes.filter(n=>n.id!==node.id&&!['start','end'].includes(n.type)).map(n=><option key={n.id} value={n.id}>{label(n)} · {n.id.slice(0,12)}</option>)}</select></label>
  <button onClick={infer}>识别候选范围</button>
  <div className="scope-members">{nodes.filter(n=>n.id!==node.id&&n.type!=='start'&&n.type!=='end').map(n=><label key={n.id}><input type="checkbox" checked={members.includes(n.id)} onChange={e=>setMembers(ids=>e.target.checked?[...ids,n.id]:ids.filter(id=>id!==n.id))}/>{label(n)} · {n.id.slice(0,12)}</label>)}</div>
  <button onClick={apply}>确认范围</button>
  <p className="form-hint">起点须与“循环体起点”出口一致。需要继续循环的出口请连接到右侧 ↻ 标记；未连接出口保持未连接；离开后的收尾留在框外。</p>
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
 </details>
}

