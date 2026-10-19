import React,{useCallback,useEffect,useRef,useState} from 'react'
import {useDocumentSession,getSaveDirectory,getCurrentFileHandle,openDirectoryFile,supportsDirectory} from '../store/documentSession'
import {listBehaviorFiles} from '../utils/behaviorFiles'
import './BehaviorFiles.css'

export default function BehaviorFiles(){
 const session=useDocumentSession(),[view,setView]=useState({files:[],permission:'missing'}),[busy,setBusy]=useState(false),[error,setError]=useState(''),[query,setQuery]=useState('')
 const generation=useRef(0)
 const refresh=useCallback(async()=>{
  const ticket=++generation.current,dir=getSaveDirectory(),handle=getCurrentFileHandle()
  setBusy(true);setError('')
  try{
   const result=await listBehaviorFiles(dir,handle)
   if(ticket===generation.current&&dir===getSaveDirectory())setView({...result,directory:dir})
  }catch(e){if(ticket===generation.current){setView({files:[],permission:'error'});setError('读取保存目录失败：'+e.message+'。请重新选择目录或恢复授权。')}}
  finally{if(ticket===generation.current)setBusy(false)}
 },[])
 useEffect(()=>{
  if(session.ready&&!session.busy)void refresh()
  return()=>{generation.current++}
 },[session.ready,session.busy,session.directoryName,session.fileName,refresh])
 useEffect(()=>{const focus=()=>{if(document.visibilityState==='visible'&&!useDocumentSession.getState().busy)void refresh()};window.addEventListener('focus',focus);return()=>{window.removeEventListener('focus',focus);generation.current++}},[refresh])
 const authorize=async()=>{
  try{const dir=getSaveDirectory();if(!dir)return;if(await dir.requestPermission({mode:'read'})!=='granted'){setError('尚未获得目录读取权限，可以重试授权或重新选择目录。');return}await refresh()}
  catch(e){setError('目录授权失败：'+e.message+'。请重新选择目录。')}
 }
 const files=view.files.filter(f=>(f.name+' '+f.title).toLowerCase().includes(query.toLowerCase()))
 return <section className="behavior-files" aria-label="本地行为文件">
  <div className="behavior-files-header"><span className="behavior-files-directory" title={session.directoryName}>{session.directoryName||'未选择保存目录'}</span><button className="toolbar-btn" aria-label="刷新文件" title="刷新文件" disabled={session.busy||busy||!session.ready} onClick={refresh}>{busy?'…':'刷新'}</button></div>
   {error&&<p role="alert">{error}</p>}
   {view.permission==='missing'&&<p>{supportsDirectory()?'请在顶部“保存目录”选择文件夹。':'当前浏览器不支持目录读取，请使用 Chrome／Edge；也可继续用顶部“打开”选择文件。'}</p>}
   {view.permission==='prompt'&&<p>需要授权才能读取保存目录。<button className="toolbar-btn" disabled={session.busy||busy} onClick={authorize}>授权读取目录</button></p>}
   {view.permission==='granted'&&<><div className="behavior-files-filter"><input aria-label="搜索本地行为文件" placeholder="搜索文件" value={query} onChange={e=>setQuery(e.target.value)}/></div>
    <div className="behavior-files-list">{files.map(f=><button key={f.name} className={'behavior-file '+(f.current?'current':'')} disabled={session.busy||busy||!!f.error} aria-current={f.current?'true':undefined} title={f.error?f.name+'：'+f.error:f.name} onClick={()=>openDirectoryFile(f.handle,view.directory)}>{f.name}</button>)}</div>
    {!files.length&&<p>{query?'没有符合搜索条件的文件。':'当前目录暂无行为 JSON 文件；手动保存到此目录后会显示在这里。'}</p>}
   </>}
 </section>
}
