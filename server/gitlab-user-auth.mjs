import {createHash} from 'node:crypto'
import {PROJECT,failure} from '../shared/gitlab-behavior-reader.mjs'
const ORIGIN='https://git.xindong.com'
const owner=user=>createHash('sha256').update(user.id).digest('hex')
// Tokens are bound to trusted SSO and retained only in process memory.
export class GitLabUserAuth{
 constructor({fetchImpl=fetch,clock=Date.now,repositoryFor}={}){Object.assign(this,{fetchImpl,clock,repositoryFor});this.grants=new Map()}
 async request(path,token){
  let response
  try{response=await this.fetchImpl(ORIGIN+path,{method:'GET',redirect:'error',signal:AbortSignal.timeout(15000),headers:{'PRIVATE-TOKEN':token}})}catch{throw failure(502,'GitLab 权限服务暂时无法连接，请稍后重试')}
  if(!response.ok)throw failure(response.status===401?401:response.status===404||response.status===403?403:502,response.status===401?'GitLab Token 无效或已过期，请更新凭据':response.status===403||response.status===404?'当前 Token 无法访问所需 GitLab 接口，请检查 api 权限和行为图库仓库权限':'GitLab 权限验证失败，请检查网络')
  try{return await response.json()}catch{throw failure(502,'GitLab 返回了无效权限响应')}
 }
 async inspect(token){
  const project='/api/v4/projects/'+encodeURIComponent(PROJECT)
  const identity=await this.request('/api/v4/user',token),details=await this.request('/api/v4/personal_access_tokens/self',token)
  if(details.revoked||details.active===false)throw failure(401,'GitLab Token 已失效，请更新凭据')
  await this.request(project,token)
  const branch=await this.request(project+'/repository/branches/master',token)
  return {configured:true,authorized:true,canRead:true,canEdit:branch.can_push===true&&details.scopes?.includes('api')===true,name:identity.name||identity.username,gitlabId:identity.id,project:PROJECT,branch:'master',hasApiScope:details.scopes?.includes('api')===true,expiresAt:details.expires_at||null}
 }
 async status(user,{fresh=true}={}){
  const credentialOwner=owner(user),grant=this.grants.get(user.id)
  if(!grant||grant.expires<=this.clock()){this.grants.delete(user.id);return {configured:true,authorized:false,canEdit:false,credentialOwner}}
  if(!fresh&&grant.checkedAt+5000>this.clock())return {...grant.status,credentialOwner}
  try{grant.status=await this.inspect(grant.token);grant.checkedAt=this.clock();return {...grant.status,credentialOwner}}
  catch(error){if(error.status===401||error.status===403)this.grants.delete(user.id);throw error}
 }
 async handle(user,input){
  if(!user?.id)throw failure(401,'请先登录编辑器')
  if(input.action==='authStatus'){try{return await this.status(user)}catch(error){if(error.status===401||error.status===403)return {configured:true,authorized:false,canEdit:false,credentialOwner:owner(user),message:error.message};throw error}}
  if(input.credentialOwner!==owner(user))throw failure(403,'当前登录账号已变化，请重新进入在线页签')
  if(input.action==='authForget'){this.grants.delete(user.id);return this.status(user)}
  if(input.action==='authToken'){
   if(typeof input.token!=='string'||!input.token||input.token.length>4096||/\s/.test(input.token))throw failure(400,'Token 为空或格式无效')
   const status=await this.inspect(input.token)
   const grant={token:input.token,status,expires:this.clock()+28800000,checkedAt:this.clock()}
   this.grants.set(user.id,grant)
   // Remove idle credentials too, without waiting for the next request.
   const expiry=grant.expires,id=user.id
   setTimeout(()=>{if(this.grants.get(id)?.expires===expiry)this.grants.delete(id)},28800000).unref()
   return {...status,credentialOwner:owner(user)}
  }
  throw failure(400,'未知权限操作')
 }
 async authorize(user,input){
  const status=await this.status(user,{fresh:input.action==='join'||input.action==='save'})
  if(!status.authorized)throw failure(401,'请先在在线页签验证个人 GitLab Token')
  if(!status.canEdit)throw failure(403,'当前账号或 Token 没有行为图库 master 写权限，只能只读查看')
  return {user:{id:user.id,name:status.name},repository:this.repositoryFor(this.grants.get(user.id).token)}
 }
}
