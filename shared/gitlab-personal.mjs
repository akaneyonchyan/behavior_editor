import {FOLDER} from './behavior-source.mjs'
import {PROJECT,failure} from './gitlab-behavior-reader.mjs'
import {equal} from './collaboration.mjs'
export class PersonalGitLab {
 constructor({token,fetchImpl=(...args)=>fetch(...args),parseBehavior,validateFileName}){Object.assign(this,{token,fetchImpl,parseBehavior,validateFileName})}
 async api(path,{method='GET',body}={}){
  let response
  try{response=await this.fetchImpl('https://git.xindong.com/api/v4'+path,{method,credentials:'omit',redirect:'error',signal:AbortSignal.timeout(20000),headers:{'PRIVATE-TOKEN':this.token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})})}
  catch{throw failure(502,'无法直连 GitLab，请检查公司网络和浏览器的本地网络访问权限；保存超时后请重新加入核对结果')}
  if(!response.ok)throw failure(response.status,response.status===401?'个人 GitLab Token 无效或已过期':response.status===403?'当前 Token 无访问或写入权限':response.status===400||response.status===409?'GitLab 拒绝保存，请核对文件版本与分支权限':'GitLab 请求失败（'+response.status+'）')
  return response.json()
 }
 project(path=''){return '/projects/'+encodeURIComponent(PROJECT)+path}
 async inspect(){
  if(typeof this.token!=='string'||!this.token||this.token.length>4096||/\s/.test(this.token))throw failure(400,'Token 为空或格式无效')
  const user=await this.api('/user'),details=await this.api('/personal_access_tokens/self')
  if(details.revoked||details.active===false)throw failure(401,'GitLab Token 已失效')
  await this.api(this.project())
  const branch=await this.api(this.project('/repository/branches/master'))
  return {authorized:true,canEdit:branch.can_push===true&&details.scopes?.includes('api')===true,name:user.name||user.username,gitlabId:user.id}
 }
 async load(name){
  this.validateFileName(name)
  const file=await this.api(this.project('/repository/files/'+encodeURIComponent(FOLDER+'/'+name)+'?ref=master'))
  if(file.encoding!=='base64'||file.size>2*1024*1024)throw failure(422,'行为文件过大或编码无效')
  const bytes=Uint8Array.from(atob(file.content),c=>c.charCodeAt(0))
  if(bytes.length>2*1024*1024)throw failure(422,'行为文件超过 2 MB')
  const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes)
  return {config:this.parseBehavior(text),text,sha:file.blob_id,commit:file.last_commit_id}
 }
 async save(name,intent){
  const current=await this.load(name)
  if(equal(current.config,intent.config))return current
  if(current.sha!==intent.base.sha||current.commit!==intent.base.commit)throw failure(409,'GitLab 文件已被外部修改，共享草稿已保留，不能覆盖保存')
  try{await this.api(this.project('/repository/files/'+encodeURIComponent(FOLDER+'/'+name)),{method:'PUT',body:{branch:'master',last_commit_id:intent.base.commit,content:JSON.stringify(intent.config,null,2)+'\n',commit_message:'协作保存行为：'+name+'\n\n操作：'+intent.id+'\n参与人：'+intent.contributors.join('、')}})}
  catch(error){const after=await this.load(name).catch(()=>null);if(after&&equal(after.config,intent.config))return after;throw error}
  const saved=await this.load(name)
  if(!equal(saved.config,intent.config))throw failure(409,'保存后文件已有其他更新，请保留副本并核对 GitLab')
  return saved
 }
}
