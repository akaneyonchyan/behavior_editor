import {browserGitLabAccess} from './browser-gitlab-access.mjs'
import {SOURCE_KEY} from '../shared/behavior-source.mjs'
export async function collaborationRoomName(name){
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([SOURCE_KEY,name])))
 return Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('')+'.json'
}
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}})
export async function collaborationProxy(request,env,user,runtime,validation,serviceFetch=(...args)=>fetch(...args)){
 if(!env.COLLAB_SERVICE_URL||!env.COLLAB_SERVICE_TOKEN)return json({message:'多人协作服务尚未配置，请联系管理员启用'},503)
 if(request.method!=='POST')return json({message:'协作接口仅支持 POST'},405)
 if(request.headers.get('origin')!==new URL(request.url).origin||request.headers.get('sec-fetch-site')==='cross-site')return json({message:'不允许跨站修改行为图'},403)
 let stage='请求解析'
 try{
  const endpoint=new URL(env.COLLAB_SERVICE_URL)
  if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password)return json({message:'协作服务必须配置 HTTPS 地址'},503)
  // Read bounded bytes, not an unbounded request.text().
  const reader=request.body?.getReader();let size=0,parts=[]
  if(!reader)return json({message:'缺少协作请求'},400)
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>5*1024*1024){await reader.cancel();return json({message:'协作请求过大'},413)}parts.push(value)}
  const bytes=new Uint8Array(size);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length}
  let body;try{body=JSON.parse(new TextDecoder().decode(bytes))}catch{return json({message:'请求格式无效'},400)}
  stage='身份验证'
  const access=await browserGitLabAccess(body,user,env,runtime,validation)
  if(access.response){
   if(body.input?.action==='authStatus'){
    stage='服务健康连接'
    const health=await serviceFetch(new Request(endpoint,{method:'POST',redirect:'manual',headers:{'Content-Type':'application/json','Authorization':'Bearer '+env.COLLAB_SERVICE_TOKEN},body:JSON.stringify({input:{action:'health'},user:{id:user.id}})}))
    if(!health.ok)return json({message:`协作服务连接失败（上游 HTTP ${health.status}），请联系管理员检查服务配置`},503)
    stage='健康响应解析'
    const result=await health.json()
    if(result.ready!==true||result.mode!=='browser-direct')return json({message:'协作服务版本不匹配，请联系管理员更新'},503)
   }
   return json(access.response)
  }
  stage='协作服务连接'
  // The paired collaboration host is public HTTPS. officeNet is exclusively
  // for GitLab verification; this is not a fallback for denied intranet calls.
  // The direct service receives a verified base; its filename is only the room key.
  // Isolate drafts and leases from files with the same name in the old repository.
  const response=await serviceFetch(new Request(endpoint,{method:'POST',redirect:'manual',headers:{'Content-Type':'application/json','Authorization':'Bearer '+env.COLLAB_SERVICE_TOKEN},body:JSON.stringify({name:await collaborationRoomName(body.name),input:access.input,user:access.user,direct:access.direct})}))
  if(response.status>=300&&response.status<400)return json({message:'协作服务地址发生重定向，请联系管理员检查'},502)
  stage='协作响应解析'
  const result=await response.json()
  return json(result,response.status)
 }catch(error){
  const type=['TypeError','ReferenceError','SyntaxError','AbortError','TimeoutError','NotSupportedError'].includes(error.name)?error.name:'Error'
  const detail=String(error.message||'')
  const reason=/redirect/i.test(detail)?'重定向参数或响应':/crypto|subtle/i.test(detail)?'加密接口':/serializ|clone/i.test(detail)?'跨服务参数':/network|connect|fetch failed|reset|TLS/i.test(detail)?'网络连接':/getReader|stream/i.test(detail)?'请求流':'运行时调用'
  return json({message:error.status?error.message:'协作请求失败（'+stage+'；'+type+'；'+reason+'），请保留本机副本后重试'},error.status||502)
 }
}
