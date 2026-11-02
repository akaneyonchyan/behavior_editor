// Private migration preview only. This is not the production authentication server.
import http from 'node:http'
import {readFile} from 'node:fs/promises'
import {resolve,extname,sep} from 'node:path'
import {fileURLToPath} from 'node:url'
import {createRequire} from 'node:module'
import {GitLabBehaviors,failure} from './gitlab-behaviors.mjs'
import {SnapshotBehaviors} from './snapshot-behaviors.mjs'
import {validateLibrary} from '../shared/library-model.mjs'
export function createPreviewServer({service,root=resolve('dist'),origin='http://localhost:5110',uploads=false,libraryPath,authorize}){
 const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))}
 const expected=new URL(origin),inflight=new Map()
 return http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff')
  res.setHeader('Referrer-Policy','no-referrer')
  res.setHeader('Cache-Control','no-store')
  try{
   // No public gateway is supported before authentication is implemented.
   if(req.headers.host!==expected.host)throw failure(403,'请求主机不匹配')
   if(authorize && await authorize(req,res))return
   const url=new URL(req.url,origin),path=url.pathname
   // OAuth redirects retain cross-site metadata through the final home navigation.
   // authorize has already validated the session; allow only top-level GET home.
   const authenticatedNavigation=authorize&&req.method==='GET'&&path==='/'&&req.headers['sec-fetch-mode']==='navigate'&&req.headers['sec-fetch-dest']==='document'
   if(req.headers['sec-fetch-site']==='cross-site'&&!authenticatedNavigation)throw failure(403,'不允许跨站请求')
   if(req.method==='POST'){
    if(req.headers.origin!==expected.origin)throw failure(403,'请求来源不匹配')
    if(!req.headers['content-type']?.startsWith('application/json'))throw failure(415,'请使用 JSON 请求')
   }
   if(path==='/healthz'&&req.method==='GET'){send(res,200,{ok:true,mode:'private-preview'});return}
   if(path==='/api/behaviors'&&req.method==='GET'){send(res,200,await service.list());return}
   if(path==='/api/behaviors/file'&&req.method==='GET'){send(res,200,await service.read(Object.fromEntries(url.searchParams)));return}
   if(path==='/api/behaviors/uploads'&&req.method==='POST'){
    if(!uploads)throw failure(403,'测试服务尚未开启上传，请联系部署者配置')
    let size=0;const chunks=[]
    for await(const chunk of req){size+=chunk.length;if(size>16*1024*1024)throw failure(413,'请求内容过大');chunks.push(chunk)}
    let input;try{input=JSON.parse(Buffer.concat(chunks).toString('utf8'));service.validateUpload(input)}catch(e){throw failure(e.status||400,e.message)}
    // Serialize duplicate requests; different payloads cannot share a request id.
    const key=JSON.stringify(input),old=inflight.get(input.requestId)
    if(old&&old.key!==key)throw failure(409,'重复请求标识的内容不同')
    if(!old&&inflight.size>=4)throw failure(429,'正在处理其他上传，请稍后重试')
    const promise=old?.promise||service.submit(input)
    if(!old){inflight.set(input.requestId,{key,promise});promise.finally(()=>inflight.delete(input.requestId)).catch(()=>{})}
    send(res,200,await promise);return
   }
   if(path.startsWith('/api/'))throw failure(404,'接口不存在')
   if(req.method!=='GET'&&req.method!=='HEAD')throw failure(405,'请求方式不支持')
   if(path==='/data/library.json'){
    if(!libraryPath)throw failure(503,'尚未配置公共库快照')
    const snapshot=JSON.parse(await readFile(libraryPath,'utf8'))
    if(!Number.isFinite(Date.parse(snapshot.syncedAt)))throw failure(503,'公共库快照时间无效')
    validateLibrary(snapshot.library);send(res,200,snapshot);return
   }
   const target=resolve(root,'.'+decodeURIComponent(path))
   if(target!==root&&!target.startsWith(root+sep))throw failure(403,'路径无效')
   if(path.startsWith('/data/'))throw failure(404,'数据不存在')
   const file=path==='/'?resolve(root,'index.html'):target
   let data;try{data=await readFile(file)}catch{throw failure(404,'文件不存在')}
   const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'}
   res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'});res.end(req.method==='HEAD'?undefined:data)
  }catch(e){if(!res.headersSent)send(res,e.status||502,{message:e.status?e.message:'服务处理失败，请检查服务端配置或文件格式',...(e.recoveryUrl?{recoveryUrl:e.recoveryUrl}:{})});else res.end()}
 })
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const env=process.env
 if(env.PREVIEW_ONLY!=='true')throw new Error('该服务仅支持 PREVIEW_ONLY=true 的受限测试部署，尚未接入飞书登录')
 const require=createRequire(import.meta.url),validator=require('./generated/behavior-validation.cjs')
 const snapshot=env.BEHAVIOR_SOURCE==='snapshot'
 const token=snapshot?undefined:env.GITLAB_TOKEN_FILE?(await readFile(env.GITLAB_TOKEN_FILE,'utf8')).trim():env.GITLAB_TOKEN
 const service=snapshot?new SnapshotBehaviors({directory:env.BEHAVIOR_SNAPSHOT_PATH||'dist/data/behaviors',...validator}):new GitLabBehaviors({token,branch:env.GITLAB_BRANCH||'master',...validator})
 const origin=env.PREVIEW_ORIGIN||'http://localhost:5110'
 const server=createPreviewServer({service,origin,uploads:!snapshot&&env.ENABLE_UPLOADS==='true',libraryPath:env.LIBRARY_SNAPSHOT_PATH})
 server.listen(Number(env.PORT)||5110,env.CONTAINER_PREVIEW==='true'?'0.0.0.0':'127.0.0.1',()=>console.log('受限测试服务已启动；尚未接入飞书登录，请勿公开端口'))
}
