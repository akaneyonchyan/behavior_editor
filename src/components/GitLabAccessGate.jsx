import React,{useEffect,useRef,useState} from 'react'
import {useFileView} from '../store/fileView'
import {collaborationRequest} from '../store/collaborationClient'
import {saveGitLabCredential,readGitLabCredential,forgetGitLabCredential} from '../utils/gitlabCredential'
import OnlineFiles from './OnlineFiles'
import './GitLabAccessGate.css'
export default function GitLabAccessGate({onLocal}){
 const [expanded,setExpanded]=useState(true)
 const tab=useFileView(s=>s.tab),[access,setAccess]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[token,setToken]=useState(''),[remember,setRemember]=useState(true),[stored,setStored]=useState(false),[credentialOwner,setOwner]=useState(''),generation=useRef(0)
 const check=async()=>{
  const ticket=++generation.current;setBusy(true);setError('')
  try{
   let result=await collaborationRequest(null,{action:'authStatus'})
   if(ticket!==generation.current)return
   setOwner(result.credentialOwner)
   const local=await readGitLabCredential(result.credentialOwner)
   if(ticket!==generation.current)return
   setStored(!!local)
   if(local&&(!result.direct||!result.authorized))result=await collaborationRequest(null,{action:'authToken',credentialOwner:result.credentialOwner,token:local})
   if(ticket===generation.current){setAccess(result);setExpanded(!result.authorized);if(result.message)setError(result.message)}
  }catch(e){if(ticket===generation.current){setAccess(null);setError(e.message)}}finally{if(ticket===generation.current)setBusy(false)}
 }
 useEffect(()=>{if(tab==='online')void check();return()=>{generation.current++}},[tab])
 useEffect(()=>{useFileView.getState().setOnlineAccess({canEdit:!busy&&!!access?.canEdit,message:busy?'正在验证 GitLab 权限…':error|| (access?.canEdit?'可进入协作编辑，点击节点后修改右侧表单。':access?.authorized?'账号或 Token 无 master 写权限，当前仅可预览。':'请在左侧展开在线编辑权限，验证个人 GitLab Token。')})},[access,busy,error])
 const verify=async e=>{
  e.preventDefault();setBusy(true);setAccess(null);setError('')
  try{
   const value=token.trim(),result=await collaborationRequest(null,{action:'authToken',credentialOwner,token:value})
   setAccess(result);setToken('');setExpanded(!result.authorized)
   if(remember){await saveGitLabCredential(credentialOwner,value);setStored(true)}else{await forgetGitLabCredential(credentialOwner);setStored(false)}
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 const forget=async()=>{setBusy(true);setError('');setToken('');setExpanded(true);try{await forgetGitLabCredential(credentialOwner);setStored(false);setAccess(null);await collaborationRequest(null,{action:'authForget',credentialOwner})}catch(e){setError(e.message)}finally{setBusy(false)}}
 return <><form className={'gitlab-access'+(expanded?'':' is-collapsed')} aria-label="GitLab 个人权限" onSubmit={verify}>
  <div className="gitlab-access-heading"><strong>在线编辑权限</strong><button className="gitlab-access-toggle" type="button" aria-expanded={expanded} aria-controls="gitlab-access-fields" onClick={()=>setExpanded(value=>!value)}>{expanded?'收起':'展开'}</button></div>
  <div id="gitlab-access-fields" className="gitlab-access-fields" hidden={!expanded}>
  <p className="gitlab-access-status" role="status">{busy?'正在验证 GitLab 权限…':access?.canEdit?'已验证 '+access.name+' · 可共同编辑并保存':access?.authorized?'已验证 '+access.name+' · 账号或 Token 无 master 写权限，仅可只读查看':'验证个人 Token 后，即可共同编辑。'}</p>
  {error&&<p role="alert">{error}</p>}
  <label className="gitlab-access-token">个人 API Token<input type="password" aria-label="个人 GitLab API Token" autoComplete="off" spellCheck={false} value={token} onChange={e=>setToken(e.target.value)}/></label>
  <label className="gitlab-access-remember"><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/><span>记住此浏览器<span className="gitlab-access-hint">加密保存在本地</span></span></label>
  <p className="gitlab-access-help"><a href="https://xd.feishu.cn/wiki/OIECwWxUviBhIZkqvH8cX2eqn0g" target="_blank" rel="noreferrer">Token 创建指引 ↗</a><span>勾选 api、write_repository；账号还需拥有行为图库仓库权限。</span></p>
  <div className="gitlab-access-actions">
  {!access?.authorized?<button disabled={busy||!token.trim()||!credentialOwner} type="submit">验证</button>:<>
  <button disabled={busy} type="button" aria-label="重新验证权限" onClick={check}>重新验证</button>
  <button disabled={busy||!credentialOwner} type="button" aria-label="清除本机凭据" onClick={forget}>清除凭据</button>
  </>}
  </div>
  {stored&&<p className="gitlab-access-hint">本浏览器已记住凭据；换设备需重新输入。</p>}
  </div>
 </form><OnlineFiles onLocal={onLocal} providerVersion={access?.gitlabId||'anonymous'} canCollaborate={!busy&&!!access?.canEdit}/></>
}
