import {createRuntime, getCurrentUser} from '@xd-cell/worker-sdk'
import {GitLabBehaviorReader, failure} from '../shared/gitlab-behavior-reader.mjs'
import {parseBehavior, validateFileName} from '../src/utils/onlineBehaviors.js'
import {collaborationProxy} from './collaboration-proxy.mjs'

const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})

// The platform router enforces SSO and office-network access before this Worker.
// Dependencies are injectable for tests; production uses only the SDK public API.
export function createSitesWorker({currentUser=getCurrentUser,runtimeFor=createRuntime}={}){
 return {async fetch(request,env){
  if(!currentUser(request))return json({message:'请先通过心动 SSO 登录'},401)
  const url=new URL(request.url),path=url.pathname
  if(path==='/api/collaboration')return collaborationProxy(request,env,currentUser(request),runtimeFor({request,env}),{parseBehavior,validateFileName})
  if(request.method!=='GET'&&request.method!=='HEAD')return json({message:'行为图库仅支持只读访问'},405)
  if(path.startsWith('/api/')){
   if(request.method!=='GET')return json({message:'接口仅支持 GET'},405)
   if(path!=='/api/behaviors'&&path!=='/api/behaviors/file')return json({message:'接口不存在'},404)
   if(request.headers.get('sec-fetch-site')==='cross-site')return json({message:'不允许跨站读取行为图库'},403)
   try{
    const runtime=runtimeFor({request,env})
    const service=new GitLabBehaviorReader({token:env.GITLAB_TOKEN,parseBehavior,validateFileName,fetchImpl:async(input,init)=>{
     // Pass an HTTP Request across the service boundary, rather than a JS
     // RequestInit containing an AbortSignal (not all RPC transports clone it).
     // Worker fetch accepts manual redirects; reject 3xx rather than forwarding
     // the private token to an unexpected redirect target.
     const response=await runtime.officeNet.fetch(new Request(input,{...init,redirect:'manual'}))
     if(response.status>=300&&response.status<400)throw failure(502,'GitLab API 返回重定向，请检查办公网路由；未向重定向地址发送凭据')
     if(response.status===501){
      const body=await response.clone().json().catch(()=>null)
      if(body?.error?.code==='OFFICE_NET_UNAVAILABLE')throw failure(503,'当前站点尚未开通办公网访问，请配置站点办公网能力')
     }
     return response
    }})
    const result=path==='/api/behaviors'?await service.list():await service.read(Object.fromEntries(url.searchParams))
    return json(result)
   }catch(error){
    // Do not return upstream bodies, credentials, headers or arbitrary exceptions.
    return json({message:error.status?error.message:'读取 GitLab 行为图失败，请刷新后重试'},error.status||502)
   }
  }
  // A live build must never silently serve the old, packaged behavior library.
  if(path.startsWith('/data/behaviors/'))return json({message:'行为图库已改为 GitLab 实时读取'},404)
  return env.ASSETS.fetch(request)
 }}
}
export default createSitesWorker()
