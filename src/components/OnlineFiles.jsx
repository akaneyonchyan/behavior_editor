import React,{useEffect,useRef,useState} from 'react'
import {prepareUpload,submitUpload,REPO_URL,REPO,BRANCH,FOLDER} from '../utils/onlineBehaviors'
import {gitlabMode,snapshotMode,liveGitlabMode} from '../utils/onlineProvider'
import {listPublishedBehaviors,readPublishedBehavior} from '../utils/publishedBehaviors'
import {useFileView} from '../store/fileView'
import './OnlineFiles.css'
import useModalFocus from './useModalFocus'
function UploadDialog({children}){const ref=useModalFocus();return <div className="dialog-overlay"><div ref={ref} tabIndex={-1} className="dialog" role="dialog" aria-modal="true" aria-label="确认提交行为文件">{children}</div></div>}
export default function OnlineFiles({onLocal,canCollaborate=false,providerVersion='anonymous'}){
 const setCollaborating=useFileView(s=>s.setCollaborating)
 const [files,setFiles]=useState([]),[loaded,setLoaded]=useState(false),[query,setQuery]=useState(''),[token,setToken]=useState(''),[auth,setAuth]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[plan,setPlan]=useState(null),[link,setLink]=useState(null)
 const {file:preview,openOnline,editRequest,collaborating}=useFileView()
 useEffect(()=>{if(editRequest&&canCollaborate&&preview&&useFileView.getState().tab==='online')setCollaborating(true)},[editRequest])
 const [branch,setBranch]=useState(BRANCH),[head,setHead]=useState('')
 const input=useRef(null),alive=useRef(true),lock=useRef(false)
 useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[])
 const reviewName=gitlabMode?'MR':'PR'
 const run=async(task)=>{if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await task()}catch(e){if(alive.current){setError(e.message);if(e.recoveryUrl)setLink({url:e.recoveryUrl,label:'核对上传分支／继续创建 '+reviewName})}}finally{lock.current=false;if(alive.current)setBusy(false)}}
 const refresh=()=>run(async()=>{const result=await listPublishedBehaviors();if(alive.current){setFiles(result.files);setBranch(result.branch||BRANCH);setHead(result.head||'');setLoaded(true)}})
 useEffect(()=>{void refresh()},[providerVersion])
 const open=file=>run(async()=>{const result=await readPublishedBehavior(file);if(alive.current&&useFileView.getState().tab==='online'&&openOnline(result)){if(liveGitlabMode&&useFileView.getState().onlineAccess.canEdit)setCollaborating(true)}})
 const choose=async e=>{const picked=Array.from(e.target.files);e.target.value='';if(!picked.length)return;void run(async()=>{const prepared=await prepareUpload(picked,token);if(alive.current){setPlan(prepared);setLink(null);setNotice('')}})}
 const upload=()=>run(async()=>{const active=plan;if(!gitlabMode)setPlan(null);const result=await submitUpload(active,token);if(alive.current){setPlan(null);setLink({url:result.url,label:'查看并审核 '+reviewName+' #'+result.number});setNotice(gitlabMode?'已提交 Draft MR；审核合并后，刷新在线目录即可查看。':'已提交审核，尚未更新在线目录；合并且网页发布完成后，点击刷新即可查看。')}})
 const shown=files.filter(f=>f.name.toLowerCase().includes(query.toLowerCase()))
 return <section className="behavior-files online-files" aria-label="在线行为文件">
  {liveGitlabMode&&preview&&!collaborating&&<button className="toolbar-btn" disabled={!canCollaborate} onClick={()=>setCollaborating(true)}>共同编辑</button>}
  <div className="behavior-files-header"><span className="behavior-files-directory" title={REPO+' / '+FOLDER}>{FOLDER} / {branch}</span><button className="toolbar-btn" disabled={busy} onClick={refresh}>刷新</button></div>
  {!snapshotMode&&!liveGitlabMode&&<div className="online-actions"><button className="toolbar-btn" disabled={busy} onClick={()=>{if(!gitlabMode&&!token){setAuth(true);setNotice('上传前请填写自己的 GitHub Token。')}else input.current.click()}}>上传文件</button>{!gitlabMode&&<button className="toolbar-btn" disabled={busy} onClick={()=>setAuth(!auth)}>上传授权</button>}</div>}
  <input aria-label="选择上传行为文件" ref={input} type="file" accept=".json,application/json" multiple hidden onChange={choose}/>
  {auth&&<div className="online-auth"><label>GitHub Token<input aria-label="GitHub Token" type="password" value={token} autoComplete="off" spellCheck={false} onChange={e=>setToken(e.target.value.trim())}/></label><p>仅保留在本页内存，刷新即清除。需此仓库的 Contents、Pull requests 读写权限，账号也需拥有仓库写入权限。</p><a href={REPO_URL+'/blob/main/docs/tool/online-files.md'} target="_blank" rel="noreferrer">查看授权与审核说明</a><button className="toolbar-btn" onClick={()=>{setToken('');setAuth(false)}}>清除授权</button></div>}
  <p>{liveGitlabMode?(canCollaborate?'GitLab 实时目录 · 点击文件进入协作编辑':'GitLab 实时目录 · 验证个人权限后可编辑'):snapshotMode?'已发布快照 · 在线只读 · GitLab 更新需重新发布':gitlabMode?'项目文件 · 在线只读 · 上传经 MR 审核合并':'公开文件 · 在线只读 · 上传经 PR 审核合并'}</p>
  {liveGitlabMode&&head&&<p>目录版本：{head.slice(0,8)}</p>}
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}{link&&<p><a href={link.url} target="_blank" rel="noreferrer">{link.label}</a></p>}
  <div className="behavior-files-filter"><input aria-label="搜索在线行为文件" placeholder="搜索文件" value={query} onChange={e=>setQuery(e.target.value)}/></div>
  <div className="behavior-files-list">{shown.map(f=><button className={'behavior-file '+(preview?.name===f.name?'current':'')} aria-current={preview?.name===f.name?'true':undefined} title={f.name} key={f.name} disabled={busy} onClick={()=>open(f)}>{f.name}</button>)}</div>
  {busy&&<p role="status">正在处理…</p>}{loaded&&!shown.length&&<p>{query?'没有符合搜索条件的文件。':liveGitlabMode?'仓库 '+FOLDER+' 目录暂无行为图，请先在 GitLab 合并行为文件后刷新。':'暂无已合并的行为文件。可上传本地 JSON 提交审核。'}</p>}
  {plan&&<UploadDialog><h3>{gitlabMode?'提交到项目仓库':'提交到公开仓库'}</h3><p>{gitlabMode?'提交后生成 Draft MR，审核合并才更新在线目录。':'这些文件及 Git 历史将可被所有人读取。提交后生成 PR，审核合并才更新在线目录。'}</p><ul>{plan.items.map(f=><li key={f.name}>{f.previousSha?'替换同名文件':'新增文件'}：{f.name}</li>)}</ul><p>上传的是已选本地文件，不包含尚未手动保存的画布改动。</p>{error&&<p role="alert">{error}</p>}{link&&<p><a href={link.url} target="_blank" rel="noreferrer">{link.label}</a></p>}<div className="online-actions"><button className="toolbar-btn" disabled={busy||(!gitlabMode&&!token)} onClick={upload}>创建分支并提交审核</button><button className="toolbar-btn" disabled={busy} onClick={()=>setPlan(null)}>取消</button></div></UploadDialog>}
 </section>
}
