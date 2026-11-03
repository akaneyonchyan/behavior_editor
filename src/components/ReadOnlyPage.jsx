import React,{useEffect,useRef,useState} from 'react'
import OnlinePreview from './OnlinePreview'
import CopyReadOnlyLink from './CopyReadOnlyLink'
import {listPublishedBehaviors,readPublishedBehavior} from '../utils/publishedBehaviors'
import {validateFileName} from '../utils/onlineBehaviors'
import {startPublishedLibrary} from '../store/publishedLibrary'
import {NODE_CONFIG} from '../constants/behaviorTypes'
import './ReadOnlyPage.css'

export default function ReadOnlyPage(){
 const [file,setFile]=useState(null),[selected,setSelected]=useState(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0)
 const [detailsOpen,setDetailsOpen]=useState(false),detailsButton=useRef(null)
 const closeDetails=()=>{setDetailsOpen(false);detailsButton.current?.focus()}
 useEffect(()=>{
  if(!detailsOpen)return
  const key=e=>{if(e.key==='Escape'){e.preventDefault();setDetailsOpen(false);detailsButton.current?.focus()}}
  window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)
 },[detailsOpen])
 const name=new URLSearchParams(location.search).get('file')
 useEffect(()=>startPublishedLibrary(),[])
 useEffect(()=>{
  const controller=new AbortController();let active=true
  setFile(null);setSelected(null);setError('')
  async function load(){
   try{
    if(!name)throw Error('链接缺少行为文件名，请让分享者重新复制只读链接。')
    validateFileName(name)
    const options={signal:controller.signal},catalog=await listPublishedBehaviors(options)
    const entry=catalog.files.find(f=>f.name===name)
    if(!entry)throw Error('此行为图不存在或已改名，请让分享者重新复制只读链接。')
    const result=await readPublishedBehavior(entry,options)
    if(active)setFile(result)
   }catch(e){if(active)setError(e.message||'读取失败，请检查网络或登录状态后重试。')}
  }
  void load();return()=>{active=false;controller.abort()}
 },[name,attempt])
 return <main className="readonly-page">
  <header className="readonly-header"><div><h1>{file?.config.behavior.name||name||'行为图查阅'}</h1><p>只读 · 最新已保存版本{file?' · '+file.name:''}</p></div>{file&&<div className="readonly-header-actions"><button ref={detailsButton} aria-expanded={detailsOpen} aria-controls="readonly-json-details" onClick={()=>setDetailsOpen(open=>!open)}>JSON 详情</button><CopyReadOnlyLink key={file.name} file={file}/></div>}</header>
  {error?<div className="readonly-message"><p role="alert">{error}</p><button onClick={()=>setAttempt(n=>n+1)}>重试</button></div>:!file?<p className="readonly-message" role="status">正在读取行为图…</p>:<div className="readonly-content">
   <OnlinePreview key={file.sha+file.name} file={file} onSelect={setSelected}/>
   {detailsOpen&&<aside id="readonly-json-details" className="readonly-properties" aria-label="只读节点配置"><div className="readonly-details-heading"><h2>JSON 详情 · {selected?(selected.data.name||NODE_CONFIG[selected.type]?.label):'行为准入数据'}</h2><button onClick={closeDetails} aria-label="收起 JSON 详情">收起</button></div><p>点击画板节点查看对应配置；按 Esc 收起。</p><pre>{JSON.stringify(selected&&selected.type!=='start'?selected.data:file.config.behavior,null,2)}</pre></aside>}
  </div>}
 </main>
}
