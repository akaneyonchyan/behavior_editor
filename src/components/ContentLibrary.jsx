import React, { useEffect, useRef, useState } from 'react'
import { useContentLibrary, validateLibrary, connectTeamLibrary, loginTeamLibrary, saveTeamLibrary } from '../store/contentLibrary'
import { sameLibrary } from '../../shared/library-model.mjs'
import './ContentLibrary.css'
import PublishedLibrary from './PublishedLibrary'
import { publishedMode } from '../store/publishedLibrary'
const tables={objects:'对象类型',attributes:'属性类型',buffs:'Buff 类型'}
export default function ContentLibrary({onClose}) {
  return publishedMode ? <PublishedLibrary onClose={onClose}/> : <EditableLibrary onClose={onClose}/>
}
function EditableLibrary({onClose}) {
  const {library,save,error,teamMode,teamReady,teamStatus,teamConfigured,teamAuthenticated,checkedAt}=useContentLibrary()
  const [recovery]=useState(()=>{try {const r=JSON.parse(sessionStorage.getItem('pps-team-library-draft'));if(r){validateLibrary(r.base);const check=structuredClone(r.draft);for(const table of ['objects','attributes','buffs'])check[table].forEach((row,i)=>{if(typeof row.name!=='string')throw new Error('草稿名称格式错误');row.name='draft-'+i});validateLibrary(check)}return r}catch{return null}})
  const [draft,setDraft]=useState(()=>structuredClone(recovery?.draft||library)), [tab,setTab]=useState('objects'),[query,setQuery]=useState(''),[message,setMessage]=useState(recovery?'已恢复未同步编辑，请核对后保存':''),[pending,setPending]=useState(null)
  const [busy,setBusy]=useState(false),[blocked,setBlocked]=useState(!!recovery),[password,setPassword]=useState(''),[conflicts,setConflicts]=useState([])
  const file=useRef(null),base=useRef(recovery?.base||library)
  const dirty=!sameLibrary(draft,base.current)
  useEffect(()=>{
    if(!busy&&sameLibrary(draft,base.current)){base.current=library;setDraft(library)}
  },[library,busy])
  useEffect(()=>{
    if(!teamMode)return
    try{if(dirty)sessionStorage.setItem('pps-team-library-draft',JSON.stringify({base:base.current,draft}));else sessionStorage.removeItem('pps-team-library-draft')}catch{setMessage('浏览器无法备份编辑内容，请先导出草稿')}
  },[draft,teamMode,dirty])
  const sync=async()=>{
    if(busy||!teamReady)return
    try{validateLibrary(draft)}catch(e){setMessage(e.message);return}
    setBusy(true);setBlocked(false);setMessage('正在保存到飞书…')
    try{const next=await saveTeamLibrary(base.current,draft);base.current=next;setDraft(next);setConflicts([]);setMessage('已保存到飞书，其他在线用户将收到更新');sessionStorage.removeItem('pps-team-library-draft')}
    catch(e){setBlocked(true);setConflicts(e.data?.conflicts||[]);setMessage(e.message+'；本地草稿已保留。请先导出草稿，再核对云端版本。')}
    finally{setBusy(false)}
  }
  useEffect(()=>{
    if(!teamMode||!teamReady||!dirty||busy||blocked)return
    const timer=setTimeout(sync,900);return()=>clearTimeout(timer)
  },[draft,teamMode,teamReady,dirty,busy,blocked])
  useEffect(()=>{const guard=e=>{if(dirty){e.preventDefault();e.returnValue=''}};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard)},[dirty])
  const close=()=>{if(busy)return;if(!dirty||confirm(teamMode?'还有未同步修改，草稿已保留在当前浏览器标签页。是否暂时关闭？':'公共库还有未保存内容，关闭会放弃这些修改。是否关闭？'))onClose()}
  const persist=next=>{
    setDraft(next)
    if(teamMode){setMessage('待同步');return}
    if(!sameLibrary(base.current,useContentLibrary.getState().library)){setMessage('公共库已在其他页面更新。请关闭后重新打开，再继续编辑。');return}
    if(save(next)){base.current=useContentLibrary.getState().library;setMessage('已自动保存到本机')}
  }
  const update=(id,patch)=>persist({...draft,[tab]:draft[tab].map(row=>row.id===id?{...row,...patch}:row)})
  const add=()=>{let n=draft[tab].length+1;while(draft[tab].some(r=>r.name==='新'+tables[tab]+n))n++
    persist({...draft,[tab]:[...draft[tab],{id:crypto.randomUUID(),name:'新'+tables[tab]+n,description:'',enabled:true,...(tab==='objects'?{}:{objectTypes:[]}),...(tab==='attributes'?{kind:'数值'}:{})}]});setQuery('')}
  const exportFile=()=>{try {validateLibrary(draft);const blob=new Blob([JSON.stringify(draft,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='PPS公共内容库.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage('已导出公共库，可发给团队成员导入')}catch(e){setMessage('无法导出：'+e.message)}}
  const importFile=async e=>{const selected=e.target.files[0];e.target.value='';if(!selected)return;try {const data=validateLibrary(JSON.parse((await selected.text()).replace(/^﻿/,'')));setPending(data);setMessage('已读取文件，应用前请核对条目数量；应用将替换当前公共库。')}catch(error){setMessage('导入失败：'+error.message)}}
  return <div className="dialog-overlay"><div className="dialog library-dialog" role="dialog" aria-modal="true" aria-label="公共内容库">
    <div className="dialog-header"><h3>公共内容库</h3><button className="dialog-close" disabled={busy} aria-label="关闭公共内容库" onClick={close}>×</button></div>
    <div className="library-intro">{teamMode?'当前为团队库。有效编辑自动保存到飞书；飞书侧修改约每 5 秒检查一次。检测到冲突时暂停保存，保留本地草稿。':'当前为本机公共库。配置团队服务并连接后，可与飞书双向同步。'} 停用条目不清除已有引用。</div>
    <div className="library-tools library-sync"><span>{teamStatus}{checkedAt?' · 最近检查 '+new Date(checkedAt).toLocaleTimeString():''}</span><button className="toolbar-btn" disabled={busy} onClick={()=>connectTeamLibrary()}>连接 / 重连团队库</button></div>
    {teamConfigured&&!teamAuthenticated&&<form className="library-tools" onSubmit={async e=>{e.preventDefault();try{await loginTeamLibrary(password);setPassword('');setMessage('')}catch(e){setMessage(e.message)}}}><input type="password" autoComplete="current-password" aria-label="团队访问口令" placeholder="输入团队访问口令（不是飞书密钥）" value={password} onChange={e=>setPassword(e.target.value)}/><button className="btn-primary">连接团队库</button></form>}
    {blocked&&<div className="library-import"><span>{conflicts.length?'冲突条目：'+conflicts.map(c=>c.name).join('、'):'编辑尚未同步，请核对。'}</span><button className="btn-secondary" onClick={exportFile}>导出本地草稿</button><button className="btn-secondary" disabled={!teamReady||busy} onClick={()=>{if(confirm('放弃当前未同步编辑，改用已读取的云端版本？建议先导出草稿。')){base.current=library;setDraft(library);setBlocked(false);setConflicts([]);setMessage('已采用云端版本')}}}>采用云端版本</button></div>}
    <fieldset className="library-edit" disabled={busy||(teamMode&&!teamAuthenticated)}>
    <div className="library-tools">{Object.entries(tables).map(([key,label])=><button className={'toolbar-btn '+(key===tab?'active':'')} key={key} onClick={()=>{setTab(key);setQuery('')}}>{label}（{draft[key].length}）</button>)}<button className="toolbar-btn" onClick={exportFile}>导出公共库</button>{!teamMode&&<button className="toolbar-btn" onClick={()=>file.current.click()}>导入公共库</button>}<input ref={file} type="file" accept=".json" hidden onChange={importFile}/></div>
    {pending&&<div className="library-import">待导入：{pending.objects.length} 类对象、{pending.attributes.length} 项属性、{pending.buffs.length} 项 Buff。<button className="btn-primary" onClick={()=>{persist(pending);setPending(null)}}>应用导入库</button><button className="btn-secondary" onClick={()=>setPending(null)}>取消导入</button></div>}
    <div className="library-tools"><input aria-label="搜索公共库" placeholder="搜索名称或说明" value={query} onChange={e=>setQuery(e.target.value)}/><button className="toolbar-btn" onClick={add}>+ 添加{tables[tab]}</button></div>
    <div className="library-table-wrap"><table className="library-table"><thead><tr><th>名称</th>{tab==='attributes'&&<th>数据类型</th>}{tab!=='objects'&&<th>适用对象（可多选）</th>}<th>说明</th><th>启用</th></tr></thead><tbody>
      {draft[tab].filter(r=>(r.name+' '+r.description).includes(query)).map(row=><tr key={row.id}><td><input aria-label="条目名称" value={row.name} onChange={e=>update(row.id,{name:e.target.value})}/><small title={row.id}>标识：{row.id}</small></td>{tab==='attributes'&&<td><select aria-label="属性数据类型" value={row.kind} onChange={e=>update(row.id,{kind:e.target.value})}><option>数值</option><option>枚举</option></select></td>}{tab!=='objects'&&<td><div className="library-object-checks">{draft.objects.map(object=><label key={object.id}><input type="checkbox" checked={row.objectTypes.includes(object.id)} onChange={e=>update(row.id,{objectTypes:e.target.checked?[...row.objectTypes,object.id]:row.objectTypes.filter(id=>id!==object.id)})}/>{object.name}{!object.enabled?'（停用）':''}</label>)}</div></td>}<td><textarea aria-label="条目说明" rows={2} value={row.description} onChange={e=>update(row.id,{description:e.target.value})}/></td><td><input type="checkbox" aria-label={'启用'+row.name} checked={row.enabled} onChange={e=>update(row.id,{enabled:e.target.checked})}/></td></tr>)}
    </tbody></table>{!draft[tab].length&&<p className="library-intro">暂无条目，点击上方添加。Buff 独立维护，不会作为普通属性或对象类型混用。</p>}</div>
    </fieldset>
    <div className="dialog-footer"><span role="status" className={dirty?'unsaved':''}>{error||message||(dirty?'有未保存修改':'公共库已就绪')}{dirty?' · 当前编辑尚未保存':''}</span>{dirty&&<button className="btn-primary" disabled={busy||(teamMode&&!teamReady)} onClick={()=>teamMode?sync():persist(draft)}>重试保存</button>}<button className="btn-secondary" disabled={busy} onClick={close}>完成</button></div>
  </div></div>
}
