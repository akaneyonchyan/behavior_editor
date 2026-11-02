import {PROJECT,FOLDER} from './behavior-source.mjs'
export {PROJECT,FOLDER}
export const REPOSITORY='https://git.xindong.com/'+PROJECT
export function failure(status,message){return Object.assign(new Error(message),{status})}
export class GitLabBehaviorReader{
 constructor({token,branch='master',parseBehavior,validateFileName,fetchImpl=fetch}){
  Object.assign(this,{token,branch,parseBehavior,validateFileName,fetchImpl})
 }
 async api(route,{method='GET',body}={}){
  if(!this.token)throw failure(503,'尚未配置服务端 GitLab 凭据')
  let response
  try{response=await this.fetchImpl('https://git.xindong.com/api/v4/projects/'+encodeURIComponent(PROJECT)+route,{
   method,redirect:'error',signal:AbortSignal.timeout(30000),
   headers:{'PRIVATE-TOKEN':this.token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})
  })}catch(error){
   if(error.status)throw error
   const name=['TypeError','AbortError','TimeoutError','DataCloneError'].includes(error.name)?error.name:'NetworkError'
   const detail=String(error.message||'')
   let reason=/serializ|clone/i.test(detail)?'请求参数无法跨服务传递':/AbortSignal|signal/i.test(detail)?'请求超时信号不受支持':/redirect/i.test(detail)?'上游请求发生重定向':/DNS|resolve|ENOTFOUND/i.test(detail)?'无法解析 GitLab 地址':/certificate|TLS|SSL/i.test(detail)?'GitLab 连接证书校验失败':'办公网请求未完成'
   // Only option-related TypeErrors are diagnostic; never expose upstream bodies.
   if(name==='TypeError'&&/redirect/i.test(detail)){
    let safe=detail
    for(const secret of [this.token,encodeURIComponent(this.token),JSON.stringify(this.token).slice(1,-1)])if(secret)safe=safe.split(secret).join('[redacted]')
    reason+='；'+safe.slice(0,300)
   }
   throw failure(502,'GitLab 网络请求失败（'+name+'：'+reason+'），请稍后重试')
  }
  if(!response.ok)throw failure(response.status===404?404:response.status===401||response.status===403?503:502,'GitLab 请求失败（'+response.status+'），请检查服务端权限及仓库配置')
  return response.json()
 }
 async list(){
  const branch=await this.api('/repository/branches/'+encodeURIComponent(this.branch)),head=branch.commit.id,files=[]
  // Query the root first: a missing behaviors directory is a valid empty repository,
  // whereas inaccessible refs or API errors must not be mistaken for an empty list.
  let folder=false
  for(let page=1;;page++){
   const entries=await this.api('/repository/tree?'+new URLSearchParams({ref:head,per_page:'100',page:String(page)}))
   const item=entries.find(x=>x.name===FOLDER)
   if(item){if(item.type!=='tree')throw failure(422,FOLDER+' 路径必须是目录');folder=true}
   if(entries.length<100)break
   if(page>=100)throw failure(422,'仓库目录过大，请整理目录')
  }
  if(folder)for(let page=1;;page++){
   const entries=await this.api('/repository/tree?'+new URLSearchParams({ref:head,path:FOLDER,per_page:'100',page:String(page)}))
   for(const entry of entries)if(entry.type==='blob'&&entry.mode==='100644'&&/\.json$/i.test(entry.name)){
    this.validateFileName(entry.name);files.push({name:entry.name,sha:entry.id,ref:head})
   }
   if(entries.length<100)break
   if(page>=100)throw failure(422,'行为目录过大，请拆分目录')
  }
  return {version:1,head,branch:this.branch,source:'gitlab-live',folder:FOLDER,files:files.sort((a,b)=>a.name.localeCompare(b.name,'zh-CN',{numeric:true}))}
 }
 async read({name,ref,sha}){
  try{this.validateFileName(name)}catch{throw failure(400,'行为文件名无效')}
  if(!/^[a-f0-9]{40}$/.test(ref||'')||!/^[a-f0-9]{40}$/.test(sha||''))throw failure(400,'行为文件版本无效')
  const file=await this.api('/repository/files/'+encodeURIComponent(FOLDER+'/'+name)+'?ref='+ref)
  if(file.blob_id!==sha)throw failure(409,'文件版本不匹配，请刷新目录')
  if(file.size>2*1024*1024||file.encoding!=='base64')throw failure(422,'文件过大或编码不支持')
  let bytes
  try{bytes=Uint8Array.from(atob(file.content),c=>c.charCodeAt(0))}catch{throw failure(422,'行为文件编码无效')}
  if(bytes.length>2*1024*1024)throw failure(422,'文件超过 2 MB')
  let text
  try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);this.parseBehavior(text)}catch{throw failure(422,'行为文件内容无效，请检查仓库中的 JSON')}
  return {text}
 }
}
