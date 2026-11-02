import {FOLDER} from '../shared/behavior-source.mjs'
import http from 'node:http'
import {createHash,timingSafeEqual,randomUUID} from 'node:crypto'
import {mkdir,readFile,open,rename,rm} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {CollaborationRooms} from './collaboration-rooms.mjs'
import {GitLabBehaviorReader,failure} from '../shared/gitlab-behavior-reader.mjs'
import {equal} from '../shared/collaboration.mjs'

export class CollaborationRepository extends GitLabBehaviorReader{
 async load(name){
  this.validateFileName(name)
  const file=await this.api('/repository/files/'+encodeURIComponent(FOLDER+'/'+name)+'?ref='+encodeURIComponent(this.branch))
  if(file.encoding!=='base64'||file.size>2*1024*1024)throw failure(422,'行为文件过大或编码无效')
  const config=this.parseBehavior(Buffer.from(file.content,'base64').toString('utf8'))
  return {config,sha:file.blob_id,commit:file.last_commit_id}
 }
 async save(name,base,config,contributors,user){
  const current=await this.load(name)
  // Reconcile an earlier successful write whose response was lost.
  if(equal(current.config,config))return current
  if(current.sha!==base.sha)throw failure(409,'GitLab 文件已被外部修改。共享草稿已保留，请下载副本并在仓库整合，不能覆盖保存')
  try{await this.api('/repository/files/'+encodeURIComponent(FOLDER+'/'+name),{method:'PUT',body:{branch:this.branch,last_commit_id:current.commit,content:JSON.stringify(config,null,2)+'\n',commit_message:'协作保存行为：'+name+'\n\n保存人：'+user.name+'\n参与人：'+contributors.join('、')}})}
  catch(error){
   const after=await this.load(name).catch(()=>null)
   if(after&&equal(after.config,config))return after
   if(after&&after.sha!==base.sha)throw failure(409,'保存期间 GitLab 文件已被修改，共享草稿已保留，请下载副本并整合')
   throw error
  }
  const saved=await this.load(name)
  if(!equal(saved.config,config))throw failure(409,'保存后仓库又有更新，共享草稿已保留，请核对 GitLab')
  return saved
 }
}

export async function diskStorage(directory){
 const root=resolve(directory);await mkdir(root,{recursive:true})
 // Refuse a second authority, including on the same shared volume. A crash
 // leaves this lock intentionally: an operator must confirm the old process
 // stopped before removing it. No unsafe age-based lock stealing.
 const lock=join(root,'.authority');await mkdir(lock)
 const path=name=>join(root,createHash('sha256').update(name).digest('hex')+'.json')
 return {
  async load(name){try{return JSON.parse(await readFile(path(name),'utf8'))}catch(e){if(e.code==='ENOENT')return null;throw e}},
  async save(name,state){
   const target=path(name),temp=target+'.'+randomUUID()+'.tmp',handle=await open(temp,'wx',0o600)
   try{await handle.writeFile(JSON.stringify(state));await handle.sync()}finally{await handle.close()}
   await rename(temp,target)
   if(process.platform!=='win32'){const dir=await open(root,'r');try{await dir.sync()}finally{await dir.close()}}
  },
  async close(){await rm(lock,{recursive:true})}
 }
}
const digest=s=>createHash('sha256').update(s).digest()
export function collaborationServer({rooms,secret,validateFileName,auth,direct=false}){
 if(!secret||secret.length<32)throw new Error('COLLAB_SERVICE_TOKEN 至少需要 32 个字符')
 return http.createServer(async(req,res)=>{
  const reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))}
  try{
   if(req.method!=='POST'||req.url!=='/rpc')return reply(404,{message:'接口不存在'})
   if(!timingSafeEqual(digest(req.headers.authorization||''),digest('Bearer '+secret)))return reply(401,{message:'协作服务鉴权失败'})
   let size=0,chunks=[]
   for await(const chunk of req){size+=chunk.length;if(size>5*1024*1024)return reply(413,{message:'协作请求过大'});chunks.push(chunk)}
   let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{throw failure(400,'请求不是有效 JSON')}
   if(!body.user?.id||typeof body.user.id!=='string')throw failure(401,'缺少可信登录身份')
   const input=body.input||{}
   if(input.action==='health')return reply(200,{ready:true,mode:direct?'browser-direct':'server'})
   if(direct){
    if(body.direct?.authorized!==true||!['join','poll','lock','apply','leave','saveBegin','saveComplete'].includes(input.action))throw failure(403,'缺少可信 Worker 权限验证')
    try{validateFileName(body.name)}catch{throw failure(400,'行为文件名无效')}
    const repository={load:async()=>{if(!body.direct.base)throw failure(400,'缺少可信 GitLab 文件快照');return body.direct.base}}
    return reply(200,await rooms.run(body.name,body.user,input,repository))
   }
   if(['authStatus','authToken','authForget'].includes(input.action)){
    if(!auth)throw failure(503,'尚未启用 GitLab 个人凭据验证')
    return reply(200,await auth.handle(body.user,input))
   }
   try{validateFileName(body.name)}catch{throw failure(400,'行为文件名无效')}
   const access=auth?await auth.authorize(body.user,input):{user:body.user,repository:undefined}
   reply(200,await rooms.run(body.name,access.user,input,access.repository))
  }catch(error){reply(error.status||500,{message:error.status?error.message:'协作服务未完成请求，草稿已保留，请重试'})}
 })
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const secret=async name=>process.env[name+'_FILE']?(await readFile(process.env[name+'_FILE'],'utf8')).trim():process.env[name]
 const serviceToken=await secret('COLLAB_SERVICE_TOKEN')
 if(!serviceToken||serviceToken.length<32)throw new Error('请先配置至少 32 字符的 COLLAB_SERVICE_TOKEN，或对应的 _FILE 路径')
 const {default:validation}=await import('./generated/behavior-validation.cjs')
 const storage=await diskStorage(process.env.COLLAB_DATA_DIR||'./collaboration-data')
 const rooms=new CollaborationRooms({storage,validate:config=>validation.parseBehavior(JSON.stringify(config))})
 const server=collaborationServer({rooms,direct:true,secret:serviceToken,validateFileName:validation.validateFileName})
 server.listen(Number(process.env.COLLAB_PORT||5112),process.env.COLLAB_HOST||'127.0.0.1',()=>console.log('协作服务已启动'))
 let closing=false
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{if(closing)return;closing=true;server.close(async()=>{await storage.close();process.exit(0)})})
}
