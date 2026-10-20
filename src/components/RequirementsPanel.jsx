import React,{useMemo,useState,useEffect} from 'react'
import {useBehaviorStore} from '../store/behaviorStore'
import {useContentLibrary} from '../store/contentLibrary'
import {useFileView} from '../store/fileView'
import {collectRequirements,collectOnlineRequirements,requirementsMarkdown,REQUIREMENT_TABS} from '../utils/requirements'
import {loadRequirementFiles} from '../utils/onlineRequirements'
import './ContentLibrary.css'
import './RequirementsPanel.css'

export default function RequirementsPanel({onClose,online=false}){
 const {behaviorInfo,nodes}=useBehaviorStore(),{library,readOnly,publishedReady,syncedAt,error}=useContentLibrary()
 const ready=!readOnly||publishedReady
 const [batch,setBatch]=useState(null),[loading,setLoading]=useState(online),[loadError,setLoadError]=useState(''),[progress,setProgress]=useState({completed:0,total:0}),[refresh,setRefresh]=useState(0)
 const [tab,setTab]=useState('attributes'),[query,setQuery]=useState(''),[message,setMessage]=useState('')
 useEffect(()=>{
  if(!online)return
  const controller=new AbortController();let active=true
  setLoading(true);setBatch(null);setLoadError('');setMessage('');setProgress({completed:0,total:0})
  loadRequirementFiles({signal:controller.signal,onProgress:p=>{if(active)setProgress(p)}}).then(result=>{if(active)setBatch(result)}).catch(e=>{if(active)setLoadError(e.message)}).finally(()=>{if(active)setLoading(false)})
  return()=>{active=false;controller.abort()}
 },[online,refresh])
 const complete=ready&&(!online||(!loading&&!loadError&&batch&&(batch.files.length>0||batch.total===0)))
 const report=useMemo(()=>!complete?null:online?collectOnlineRequirements(batch.files,library):collectRequirements(behaviorInfo,nodes,library),[complete,online,batch,behaviorInfo,nodes,library])
 useEffect(()=>{const close=e=>{if(e.key==='Escape')onClose()};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close)},[onClose])
 const rows=(report?.[tab]||[]).filter(r=>[r.display,r.value,r.field,r.context,r.reason,...r.locations.map(l=>[l.fileName,l.behaviorName,l.label,l.path].join(' '))].join(' ').toLowerCase().includes(query.toLowerCase()))
 const title=online?'全部在线行为':behaviorInfo.name
 const locate=location=>{onClose();window.dispatchEvent(new CustomEvent('pps-focus-node',{detail:location.nodeId}))}
 const openFile=name=>{
  const file=batch?.files.find(f=>f.name===name)
  if(file){useFileView.getState().openOnline(file);onClose()}
 }
 const download=()=>{
  if(!report)return
  try{
   const blob=new Blob([requirementsMarkdown(report,title,syncedAt,online?{...batch,online:true}:{})],{type:'text/markdown;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a')
   a.href=url;a.download=(title||'行为').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,80)+'-需求清单.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage(online&&batch.failures.length?'已导出已读取文件的清单，包含读取失败说明':'已导出四个页签的完整清单')
  }catch(e){setMessage('导出失败：'+e.message)}
 }
 const emptyText=!ready?'等待公共库加载后自动检查。':loading?'正在读取所有在线行为文件…':loadError?'在线文件读取失败，请重新读取。':online&&batch?.failures.length?'已读取文件中暂无匹配项；仍有文件读取失败，清单不完整。':query?'没有符合搜索条件的内容。':online&&batch?.total===0?'在线目录暂无行为文件。':'此页暂无待核对内容。'
 return <div className="dialog-overlay"><div className="dialog library-dialog requirements-dialog" role="dialog" aria-modal="true" aria-label="需求清单">
  <div className="dialog-header"><h3>需求清单 · {title}</h3><button className="dialog-close" aria-label="关闭需求清单" onClick={onClose}>×</button></div>
  <div className="library-intro">{online?'读取全部已发布在线文件，不受文件搜索或当前预览影响。相同内容按字段和对象上下文合并，并列出涉及的行为文件。':'检查当前行为图全部节点及准入设置，汇总未匹配条目和自定义规则。相同内容按上下文合并，保留使用位置；空白配置和已关闭的规则不计入。'}<br/>表演尚未接入资产库，已填写表演列为“待核对资产”，不代表确认缺失。公共库未匹配也不等于游戏未实现。</div>
  <div className="library-tools library-sync">{ready?'依据公共库：'+(syncedAt?new Date(syncedAt).toLocaleString():'本机公共库'):'公共库尚未就绪，暂不判断条目是否合法。'}{error&&<span role="status">{error} 当前清单基于上次成功加载的数据。</span>}</div>
  {online&&<div className="library-tools"><span role="status">{loading?`正在读取在线文件：${progress.completed} / ${progress.total}`:batch?`已读取 ${batch.files.length} / ${batch.total} 个在线文件`:''}{batch?.publishedAt?' · 在线发布：'+new Date(batch.publishedAt).toLocaleString():''}</span><button className="toolbar-btn" disabled={loading} onClick={()=>setRefresh(n=>n+1)}>重新读取在线文件</button><span>仅含已发布版本，合并后可能存在发布延迟。</span></div>}
  {loadError&&<p className="library-intro" role="alert">{loadError}，请点击“重新读取在线文件”。</p>}
  {batch?.failures.length>0&&<div className="library-intro requirement-failures" role="alert"><strong>清单不完整：{batch.failures.length} 个文件读取失败</strong><ul>{batch.failures.map(f=><li key={f.name}>{f.name}：{f.message}</li>)}</ul><span>已成功读取的文件仍可查阅和导出；请重新读取以补齐。</span></div>}
  <div className="library-tools" role="tablist" aria-label="需求分类">{Object.entries(REQUIREMENT_TABS).map(([key,label])=><button role="tab" aria-selected={key===tab} className={'toolbar-btn '+(key===tab?'active':'')} key={key} onClick={()=>setTab(key)}>{label}（{report?.[key].length||0}）</button>)}</div>
  <div className="library-tools"><input aria-label="搜索需求清单" placeholder={online?'搜索内容、原因或行为文件':'搜索内容、原因或节点'} value={query} onChange={e=>setQuery(e.target.value)}/><button className="toolbar-btn" disabled={!complete} onClick={download}>导出完整清单</button><span>当前 {rows.length} 项 · {rows.reduce((sum,r)=>sum+r.locations.length,0)} 处使用</span></div>
  <div className="library-table-wrap" role="tabpanel" aria-label={REQUIREMENT_TABS[tab]}><table className="library-table"><thead><tr><th>待核对内容</th><th>对象 / 属性上下文</th><th>原因</th><th>{online?'涉及行为文件 / 使用位置':'使用位置'}</th></tr></thead><tbody>{rows.map(row=><tr key={row.key}><td><span className="custom-choice">{row.display}</span><small>{row.field}</small>{row.value!==row.display&&<small title={row.value}>{row.value}</small>}</td><td>{row.context||'—'}</td><td>{row.reason}</td><td>{online?<><small>{row.files.length} 个行为文件</small>{row.files.map(f=><div className="requirement-file" key={f.name}><button className="requirement-location" title={'在画布只读查看 '+f.name} onClick={()=>openFile(f.name)}>{f.name}</button>{f.behaviorName&&<small>行为名称：{f.behaviorName}</small>}<details><summary>使用位置（{row.locations.filter(l=>l.fileName===f.name).length}）</summary>{row.locations.filter(l=>l.fileName===f.name).map(l=><small key={l.nodeId+':'+l.path}>{l.label} · {l.path}</small>)}</details></div>)}</>:row.locations.map(l=><button className="requirement-location" key={l.nodeId+':'+l.path} title={l.nodeId||'行为准入数据'} onClick={()=>locate(l)}>{l.label} · {l.path}</button>)}</td></tr>)}</tbody></table>{!rows.length&&<p className="library-intro">{emptyText}</p>}</div>
  <div className="dialog-footer"><span role="status">{message||(online?'公共库更新会重新核对已读取文件；重新打开或点击重新读取，可获取最新在线发布。':'清单随行为图和公共库更新；仅用于需求整理，不修改原图或公共库。')}</span><button className="btn-secondary" onClick={onClose}>关闭</button></div>
 </div></div>
}
