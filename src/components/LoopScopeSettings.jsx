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
 const apply=()=>{try{confirmLoopScope(checkScope(nodes,edges,{loopId:node.id,entry,members}),true);setError('');setNotice('已确认：首次进入和每轮返回先判定；原连线记录保留，支持撤销。')}catch(e){setError(e.message)}}
 return <details className="scope-settings" open={node.data.checkTiming!=='before'||undefined}>
  <summary>循环范围与先判定</summary>
  <p className="form-hint">{node.data.checkTiming==='before'?'先判定目标、准入和稍息，再进入内部节点。':'旧图尚未确认判定时机。转换会调整首次入口及稍息返回连线，不改节点内规则。'}</p>
  <label>循环体起点<select aria-label="循环体起点" value={entry} onChange={e=>{setEntry(e.target.value);setMembers([]);setNotice('')}}><option value="">选择起点</option>{nodes.filter(n=>n.id!==node.id&&!['start','end'].includes(n.type)).map(n=><option key={n.id} value={n.id}>{label(n)} · {n.id.slice(0,12)}</option>)}</select></label>
  <button onClick={infer}>识别候选范围</button>
  <div className="scope-members">{nodes.filter(n=>n.id!==node.id&&n.type!=='start'&&n.type!=='end').map(n=><label key={n.id}><input type="checkbox" checked={members.includes(n.id)} onChange={e=>setMembers(ids=>e.target.checked?[...ids,n.id]:ids.filter(id=>id!==n.id))}/>{label(n)} · {n.id.slice(0,12)}</label>)}</div>
  <button onClick={apply}>确认范围并采用先判定</button>
  <p className="form-hint">起点须与“继续执行”出口一致。框内可包含稍息节点；离开后的收尾留在框外。不能确定的交叉入口会提示核对。</p>
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
 </details>
}
