import React,{useMemo,useState,useEffect} from 'react'
import {useBehaviorStore} from '../store/behaviorStore'
import {useContentLibrary} from '../store/contentLibrary'
import {collectRequirements,requirementsMarkdown,REQUIREMENT_TABS} from '../utils/requirements'
import './ContentLibrary.css'
import './RequirementsPanel.css'

export default function RequirementsPanel({onClose}){
 const {behaviorInfo,nodes}=useBehaviorStore(),{library,readOnly,publishedReady,syncedAt,error}=useContentLibrary()
 const ready=!readOnly||publishedReady
 const report=useMemo(()=>ready?collectRequirements(behaviorInfo,nodes,library):null,[ready,behaviorInfo,nodes,library])
 const [tab,setTab]=useState('attributes'),[query,setQuery]=useState(''),[message,setMessage]=useState('')
 useEffect(()=>{const close=e=>{if(e.key==='Escape')onClose()};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close)},[onClose])
 const rows=(report?.[tab]||[]).filter(r=>[r.display,r.value,r.field,r.context,r.reason,...r.locations.map(l=>l.label+' '+l.path)].join(' ').toLowerCase().includes(query.toLowerCase()))
 const locate=location=>{onClose();window.dispatchEvent(new CustomEvent('pps-focus-node',{detail:location.nodeId}))}
 const download=()=>{
  try{
   const blob=new Blob([requirementsMarkdown(report,behaviorInfo.name,syncedAt)],{type:'text/markdown;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a')
   a.href=url;a.download=(behaviorInfo.name||'行为').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,80)+'-需求清单.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage('已导出四个页签的完整清单')
  }catch(e){setMessage('导出失败：'+e.message)}
 }
 return <div className="dialog-overlay"><div className="dialog library-dialog requirements-dialog" role="dialog" aria-modal="true" aria-label="需求清单">
  <div className="dialog-header"><h3>需求清单 · {behaviorInfo.name}</h3><button className="dialog-close" aria-label="关闭需求清单" onClick={onClose}>×</button></div>
  <div className="library-intro">检查当前行为图全部节点及准入设置，汇总未匹配条目和自定义规则。相同内容按上下文合并，保留使用位置；空白配置和已关闭的稍息规则不计入。<br/>表演尚未接入资产库，已填写表演列为“待核对资产”，不代表确认缺失。公共库未匹配也不等于游戏未实现。</div>
  <div className="library-tools library-sync">{ready?'依据公共库：'+(syncedAt?new Date(syncedAt).toLocaleString():'本机公共库'):'公共库尚未就绪，暂不判断条目是否合法。'}{error&&<span role="status">{error} 当前清单基于上次成功加载的数据。</span>}</div>
  <div className="library-tools" role="tablist" aria-label="需求分类">{Object.entries(REQUIREMENT_TABS).map(([key,title])=><button role="tab" aria-selected={key===tab} className={'toolbar-btn '+(key===tab?'active':'')} key={key} onClick={()=>setTab(key)}>{title}（{report?.[key].length||0}）</button>)}</div>
  <div className="library-tools"><input aria-label="搜索需求清单" placeholder="搜索内容、原因或节点" value={query} onChange={e=>setQuery(e.target.value)}/><button className="toolbar-btn" disabled={!ready} onClick={download}>导出完整清单</button><span>当前 {rows.length} 项 · {rows.reduce((sum,r)=>sum+r.locations.length,0)} 处使用</span></div>
  <div className="library-table-wrap" role="tabpanel" aria-label={REQUIREMENT_TABS[tab]}><table className="library-table"><thead><tr><th>待核对内容</th><th>对象 / 属性上下文</th><th>原因</th><th>使用位置</th></tr></thead><tbody>{rows.map(row=><tr key={row.key}><td><span className="custom-choice">{row.display}</span><small>{row.field}</small>{row.value!==row.display&&<small title={row.value}>{row.value}</small>}</td><td>{row.context||'—'}</td><td>{row.reason}</td><td>{row.locations.map(l=><button className="requirement-location" key={l.nodeId+':'+l.path} title={l.nodeId||'行为准入数据'} onClick={()=>locate(l)}>{l.label} · {l.path}</button>)}</td></tr>)}</tbody></table>{!rows.length&&<p className="library-intro">{!ready?'等待公共库加载后自动检查。':query?'没有符合搜索条件的内容。':'此页暂无待核对内容。'}</p>}</div>
  <div className="dialog-footer"><span role="status">{message||'清单随行为图和公共库更新；仅用于需求整理，不修改原图或公共库。'}</span><button className="btn-secondary" onClick={onClose}>关闭</button></div>
 </div></div>
}
