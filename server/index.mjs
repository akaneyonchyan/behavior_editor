import http from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto'
import { FeishuRepository } from './feishu.mjs'
import { LibraryService } from './library-service.mjs'
const equal=(a,b)=>{const x=Buffer.from(a||''),y=Buffer.from(b||'');return x.length===y.length&&timingSafeEqual(x,y)}
export function createEditorServer(env=process.env,repository=new FeishuRepository(env)) {
  const service=new LibraryService(repository),root=resolve(fileURLToPath(new URL('../dist',import.meta.url))), attempts=new Map()
  const configured=!!(env.FEISHU_APP_ID&&env.FEISHU_APP_SECRET&&env.EDITOR_ACCESS_KEY?.length>=8)
  const sign=text=>createHmac('sha256',env.EDITOR_ACCESS_KEY||'not-configured').update(text).digest('base64url')
  const authorized=req=>{const value=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('pps_session='))?.slice(12)||'';const [payload,signature]=value.split('.');if(!payload||!equal(signature,sign(payload)))return false;try {return JSON.parse(Buffer.from(payload,'base64url')).expires>Date.now()}catch{return false}}
  const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))}
  const body=async req=>{let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>2_000_000){const e=new Error('请求内容过大');e.status=413;throw e}chunks.push(chunk)}try{return JSON.parse(Buffer.concat(chunks).toString())}catch{const e=new Error('请求必须是 JSON');e.status=400;throw e}}
  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin')
    try {
      const path=new URL(req.url,'http://localhost').pathname
      if(path.startsWith('/api/')) {
        if(req.method!=='GET'){
          const origin=req.headers.origin,allowed=new Set([env.EDITOR_PUBLIC_ORIGIN,'http://'+req.headers.host,'https://'+req.headers.host].filter(Boolean))
          if(!origin||!allowed.has(origin)){json(res,403,{message:'请求来源不匹配'});return}
          if(!(req.headers['content-type']||'').startsWith('application/json')){json(res,415,{message:'请使用 JSON 请求'});return}
        }
        if(path==='/api/library/status'&&req.method==='GET'){json(res,200,{configured,authenticated:authorized(req),message:configured?'团队服务已配置':'尚未配置飞书应用和团队访问口令，请按接入指引配置服务端',tableUrl:'https://xd.feishu.cn/base/EXAMPLE_BASE_TOKEN'});return}
        if(!configured){json(res,503,{message:'团队服务尚未完成飞书应用配置'});return}
        if(path==='/api/library/login'&&req.method==='POST'){
          const key=req.socket.remoteAddress,now=Date.now();for(const [k,v] of attempts)if(v.until<now)attempts.delete(k)
          const attempt=attempts.get(key)||{count:0,until:now+60000};if(attempt.count>=10){json(res,429,{message:'尝试次数过多，请一分钟后重试'});return}
          const input=await body(req)
          if(typeof input.password!=='string'||!equal(input.password,env.EDITOR_ACCESS_KEY)){attempt.count++;attempts.set(key,attempt);json(res,401,{message:'团队访问口令不正确'});return}
          attempts.delete(key);const payload=Buffer.from(JSON.stringify({expires:now+8*3600000,nonce:randomBytes(16).toString('hex')})).toString('base64url')
          res.setHeader('Set-Cookie','pps_session='+payload+'.'+sign(payload)+'; HttpOnly; SameSite=Strict; Path=/api/library; Max-Age=28800'+(env.EDITOR_PUBLIC_ORIGIN?.startsWith('https://')?'; Secure':''));json(res,200,{ok:true});return
        }
        if(!authorized(req)){json(res,401,{message:'请先输入团队访问口令'});return}
        if(path==='/api/library/logout'&&req.method==='POST'){res.setHeader('Set-Cookie','pps_session=; HttpOnly; SameSite=Strict; Path=/api/library; Max-Age=0');json(res,200,{ok:true});return}
        if(path==='/api/library/events'&&req.method==='GET'){
          res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});res.write(': connected\n\n')
          const listener=(event,data)=>res.write('event: '+event+'\ndata: '+JSON.stringify(data)+'\n\n');service.listeners.add(listener)
          if(service.view())listener('library',service.view())
          service.read().catch(()=>{});const heartbeat=setInterval(()=>{if(!authorized(req)){listener('auth-expired',{});res.end()}else res.write(': heartbeat\n\n')},20000)
          req.on('close',()=>{clearInterval(heartbeat);service.listeners.delete(listener)});return
        }
        if(path==='/api/library'&&req.method==='GET'){json(res,200,await service.read());return}
        if(path==='/api/library'&&req.method==='POST'){
          const data=await body(req);json(res,200,await service.save(data.base,data.library));return
        }
        json(res,404,{message:'接口不存在'});return
      }
      if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return}
      const requested=decodeURIComponent(path),target=resolve(root,'.'+requested)
      if(target!==root&&!target.startsWith(root+sep)){res.writeHead(403);res.end();return}
      let file=target;try{if((await stat(file)).isDirectory())file=resolve(file,'index.html')}catch{if(extname(file)){res.writeHead(404);res.end();return}file=resolve(root,'index.html')}
      const data=await readFile(file),types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml'}
      res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':extname(file)==='.html'?'no-cache':'public, max-age=3600'});res.end(req.method==='HEAD'?undefined:data)
    }catch(e){if(!res.headersSent)json(res,e.status||502,{message:e.message,conflicts:authorized(req)?e.conflicts||[]:[]});else res.end()}
  })
  service.start();server.on('close',()=>service.stop());return {server,service}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const {server}=createEditorServer();server.listen(Number(process.env.PORT)||5110,process.env.HOST||'127.0.0.1',()=>console.log('PPS 团队服务已启动，端口 '+(process.env.PORT||5110)+'；请访问 /api/library/status 检查配置状态。'))
}
