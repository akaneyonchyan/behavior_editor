import {PersonalGitLab} from '../shared/gitlab-personal.mjs'
import {SOURCE_KEY} from '../shared/behavior-source.mjs'
import {failure} from '../shared/gitlab-behavior-reader.mjs'
const enc=new TextEncoder(),hex=bytes=>Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('')
async function key(secret){return crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify'])}
export async function browserGitLabAccess(body,user,env,runtime,validation){
 const owner=hex(await crypto.subtle.digest('SHA-256',enc.encode(SOURCE_KEY+':'+user.id)))
 if(body.input?.action==='authStatus'||body.input?.action==='authForget')return {response:{configured:!!env.COLLAB_SERVICE_URL,direct:true,credentialOwner:owner,authorized:false,canEdit:false}}
 if(!env.COLLAB_SERVICE_TOKEN)throw failure(503,'协作验证服务尚未配置')
 const input=body.input||{},fresh=['authToken','join','saveComplete'].includes(input.action)
 let status,base
 if(fresh){
  const token=body.token||input.token
  const gitlab=new PersonalGitLab({token,...validation,fetchImpl:async(url,init)=>{const r=await runtime.officeNet.fetch(new Request(url,{...init,redirect:'manual'}));if(r.status>=300&&r.status<400)throw failure(502,'GitLab 返回重定向');return r}})
  status=await gitlab.inspect()
  if(input.action==='authToken'){
   if(input.credentialOwner!==owner)throw failure(403,'登录账号已变化，请重新验证')
   const payload=JSON.stringify({owner,...status,expires:Date.now()+15000})
   const signature=hex(await crypto.subtle.sign('HMAC',await key(env.COLLAB_SERVICE_TOKEN),enc.encode(payload)))
   return {response:{...status,direct:true,credentialOwner:owner,ticket:{payload,signature}}}
  }
  if(!status.canEdit)throw failure(403,'当前 GitLab 账号没有 master 写权限')
  base=await gitlab.load(body.name)
  if(input.action==='join'&&(body.browserBase?.sha!==base.sha||body.browserBase?.commit!==base.commit))throw failure(409,'GitLab 文件刚有更新，请刷新后重新加入')
 }else{
  const {payload,signature}=body.ticket||{}
  if(typeof payload!=='string'||payload.length>4000||typeof signature!=='string'||!/^[a-f0-9]{64}$/.test(signature))throw failure(401,'请重新验证 GitLab 权限')
  if(!await crypto.subtle.verify('HMAC',await key(env.COLLAB_SERVICE_TOKEN),Uint8Array.from(signature.match(/../g),h=>parseInt(h,16)),enc.encode(payload)))throw failure(401,'权限凭据无效')
  status=JSON.parse(payload)
  if(status.owner!==owner||status.expires<=Date.now()||!status.canEdit)throw failure(401,'权限凭据已过期或无写权限')
 }
 if(!['join','poll','lock','apply','leave','saveBegin','saveComplete'].includes(input.action))throw failure(400,'未知协作操作')
 return {user:{id:user.id,name:status.name},direct:{authorized:true,base},input}
}
