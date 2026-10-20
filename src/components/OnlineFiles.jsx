import React,{useEffect,useRef,useState} from 'react'
import {listOnlineFiles,readOnlineFile,prepareUpload,submitUpload,REPO_URL} from '../utils/onlineBehaviors'
import {downloadBehavior} from '../utils/downloadBehavior'
import OnlinePreview from './OnlinePreview'
import './OnlineFiles.css'
import useModalFocus from './useModalFocus'
function UploadDialog({children}){const ref=useModalFocus();return <div className="dialog-overlay"><div ref={ref} tabIndex={-1} className="dialog" role="dialog" aria-modal="true" aria-label="确认提交行为文件">{children}</div></div>}
export default function OnlineFiles({onLocal}){
 const [files,setFiles]=useState([]),[loaded,setLoaded]=useState(false),[query,setQuery]=useState(''),[token,setToken]=useState(''),[auth,setAuth]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[preview,setPreview]=useState(null),[plan,setPlan]=useState(null),[link,setLink]=useState(null)
 const input=useRef(null),alive=useRef(true),lock=useRef(false)
 useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[])
 const run=async(task)=>{if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await task()}catch(e){if(alive.current){setError(e.message);if(e.recoveryUrl)setLink({url:e.recoveryUrl,label:'核对上传分支／继续创建 PR'})}}finally{lock.current=false;if(alive.current)setBusy(false)}}
 const refresh=()=>run(async()=>{const result=await listOnlineFiles(token);if(alive.current){setFiles(result.files);setLoaded(true)}})
 useEffect(()=>{void refresh()},[])
 const open=file=>run(async()=>{const result=await readOnlineFile(file,token);if(alive.current)setPreview(result)})
 const download=()=>run(async()=>{const result=await downloadBehavior(preview);if(result&&alive.current){setPreview(null);setNotice(result.opened?'已下载并在本地打开：'+result.name:'已下载到保存目录，可在本地页签打开：'+result.name);onLocal()}})
 const choose=async e=>{const picked=Array.from(e.target.files);e.target.value='';if(!picked.length)return;void run(async()=>{const prepared=await prepareUpload(picked,token);if(alive.current){setPlan(prepared);setLink(null);setNotice('')}})}
 const upload=()=>run(async()=>{const active=plan;setPlan(null);const result=await submitUpload(active,token);if(alive.current){setLink({url:result.url,label:'查看并审核 PR #'+result.number});setNotice('已提交审核，尚未更新在线目录；合并后点击刷新即可查看。')}})
 const shown=files.filter(f=>f.name.toLowerCase().includes(query.toLowerCase()))
 return <section className="behavior-files online-files" aria-label="在线行为文件">
  <div className="behavior-files-header"><span className="behavior-files-directory" title="akaneyonchyan/behavior_editor / behaviors">behaviors / main</span><button className="toolbar-btn" disabled={busy} onClick={refresh}>刷新</button></div>
  <div className="online-actions"><button className="toolbar-btn" disabled={busy} onClick={()=>{if(!token){setAuth(true);setNotice('上传前请填写自己的 GitHub Token。')}else input.current.click()}}>上传文件</button><button className="toolbar-btn" disabled={busy} onClick={()=>setAuth(!auth)}>{token?'授权设置':'上传授权'}</button></div>
  <input aria-label="选择上传行为文件" ref={input} type="file" accept=".json,application/json" multiple hidden onChange={choose}/>
  {auth&&<div className="online-auth"><label>GitHub Token<input aria-label="GitHub Token" type="password" value={token} autoComplete="off" spellCheck={false} onChange={e=>setToken(e.target.value.trim())}/></label><p>仅保留在本页内存，刷新即清除。需此仓库的 Contents、Pull requests 读写权限，账号也需拥有仓库写入权限。</p><a href={REPO_URL+'/blob/main/docs/tool/online-files.md'} target="_blank" rel="noreferrer">查看授权与审核说明</a><button className="toolbar-btn" onClick={()=>{setToken('');setAuth(false)}}>清除授权</button></div>}
  <p>公开文件 · 在线只读 · 上传经 PR 审核合并</p>
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}{link&&<p><a href={link.url} target="_blank" rel="noreferrer">{link.label}</a></p>}
  <div className="behavior-files-filter"><input aria-label="搜索在线行为文件" placeholder="搜索文件" value={query} onChange={e=>setQuery(e.target.value)}/></div>
  <div className="behavior-files-list">{shown.map(f=><button className="behavior-file" title={f.name} key={f.name} disabled={busy} onClick={()=>open(f)}>{f.name}</button>)}</div>
  {busy&&<p role="status">正在处理…</p>}{loaded&&!shown.length&&<p>{query?'没有符合搜索条件的文件。':'暂无已合并的行为文件。可上传本地 JSON 提交审核。'}</p>}
  {preview&&<OnlinePreview file={preview} onClose={()=>setPreview(null)} onDownload={download} busy={busy}/>}
  {preview&&error&&<div className="online-preview-error" role="alert">{error}</div>}
  {plan&&<UploadDialog><h3>提交到公开仓库</h3><p>这些文件及 Git 历史将可被所有人读取。提交后生成 PR，审核合并才更新在线目录。</p><ul>{plan.items.map(f=><li key={f.name}>{f.previousSha?'替换同名文件':'新增文件'}：{f.name}</li>)}</ul><p>上传的是已选本地文件，不包含尚未手动保存的画布改动。</p><div className="online-actions"><button className="toolbar-btn" disabled={busy||!token} onClick={upload}>创建分支并提交审核</button><button className="toolbar-btn" disabled={busy} onClick={()=>setPlan(null)}>取消</button></div></UploadDialog>}
 </section>
}
