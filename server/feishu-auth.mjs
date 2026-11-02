import {randomBytes,createHash,timingSafeEqual} from 'node:crypto'
import {readFileSync,mkdirSync} from 'node:fs'
import {dirname} from 'node:path'
import {DatabaseSync} from 'node:sqlite'
const random=()=>randomBytes(32).toString('base64url')
const hash=value=>createHash('sha256').update(value).digest('hex')
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b))
const cookie=(req,name)=>(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1)||''
const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value))}
const fail=(res,status,code,message)=>json(res,status,{code,message,requestId:random()})
const setCookie=(name,value,age)=>`${name}=${value}; Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=${age}`
const page=(res,status,message)=>{res.writeHead(status,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"});res.end(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>行为编辑器 · 飞书登录</title><style>body{font:16px/1.8 system-ui;max-width:520px;margin:15vh auto;padding:24px;color:#243646;background:#f5f7fa}a{display:inline-block;padding:10px 22px;border:1px solid;border-radius:8px;color:inherit}p{margin-bottom:28px}</style><h1>PetPals 行为编辑器</h1><p>${message}</p><a href="/auth/feishu/start">使用飞书登录</a></html>`)}

export function createFeishuAuth({origin,appId,secret,tenant,membersFile,dbPath,fetcher=fetch,now=Date.now}){
 if(new URL(origin).protocol!=='https:'||new URL(origin).origin!==origin||!appId||!secret||!tenant||!membersFile||!dbPath)throw Error('正式登录配置不完整')
 mkdirSync(dirname(dbPath),{recursive:true,mode:0o700})
 const db=new DatabaseSync(dbPath)
 db.exec(`PRAGMA journal_mode=WAL;
 CREATE TABLE IF NOT EXISTS transactions (state TEXT PRIMARY KEY,binding TEXT,verifier TEXT,expires INTEGER);
 CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY,member TEXT,version TEXT,name TEXT,csrf TEXT,expires INTEGER,touched INTEGER);
 CREATE TABLE IF NOT EXISTS pending (member TEXT PRIMARY KEY,created INTEGER);`)
 db.exec('CREATE TABLE IF NOT EXISTS identity_requests (tenant TEXT,member TEXT,created INTEGER,PRIMARY KEY(tenant,member))')
 const members=()=>{
  const data=JSON.parse(readFileSync(membersFile,'utf8'))
  if(Array.isArray(data))return {members:data,companyWide:false}
  if(!data||!Array.isArray(data.members)||data.access!=='company'||data.tenant!==tenant||tenant==='PENDING_ADMIN_CONFIRMATION')throw Error('公司成员配置无效')
  return {members:data.members,companyWide:true}
 }
 members()
 const member=id=>{
  const policy=members(),explicit=policy.members.find(x=>x.open_id===id)
  if(explicit)return explicit.enabled===true&&['viewer','contributor','admin'].includes(explicit.role)&&typeof explicit.version==='string'?explicit:null
  return policy.companyWide?{role:'viewer',version:'company:'+tenant}:null
 }
 const version=m=>JSON.stringify([m.version,m.role])
 const rates=new Map()
 const limited=req=>{const time=now(),key=req.socket.remoteAddress;for(const [k,v] of rates)if(v.until<time)rates.delete(k);const item=rates.get(key)||{count:0,until:time+60000};item.count++;rates.set(key,item);return item.count>30}
 const request=async(url,options)=>{const response=await fetcher(url,{...options,signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('provider');const data=await response.json();if(data.error||(data.code!==undefined&&data.code!==0))throw Error('provider');return data}
 const session=req=>{const id=hash(cookie(req,'__Host-pps_session')),s=db.prepare('SELECT * FROM sessions WHERE id=?').get(id);if(!s)return null;const m=member(s.member);if(!m||s.version!==version(m)||s.expires<=now()||s.touched+7200000<=now()){db.prepare('DELETE FROM sessions WHERE id=?').run(id);return null}db.prepare('UPDATE sessions SET touched=? WHERE id=?').run(now(),id);return {...s,role:m.role}}
 const authorize=async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer')
  const url=new URL(req.url,origin),path=url.pathname
  if(path==='/healthz'&&req.method==='GET'){json(res,200,{ok:true});return true}
  try{
   db.prepare('DELETE FROM transactions WHERE expires<=?').run(now())
   db.prepare('DELETE FROM sessions WHERE expires<=? OR touched<=?').run(now(),now()-7200000)
   db.prepare('DELETE FROM pending WHERE created<=?').run(now()-7*86400000)
   db.prepare('DELETE FROM identity_requests WHERE created<=?').run(now()-7*86400000)
   if(path==='/login'&&req.method==='GET'){page(res,200,members().companyWide?'本公司成员可使用飞书账号登录。':'请使用已开通项目权限的飞书账号登录。');return true}
   if(path==='/auth/feishu/start'&&req.method==='GET'){
    if(limited(req)){fail(res,429,'RATE_LIMITED','登录请求过多，请一分钟后重试');return true}
    const state=random(),binding=random(),verifier=random()
    db.prepare('INSERT INTO transactions VALUES(?,?,?,?)').run(hash(state),hash(binding),verifier,now()+300000)
    const target=new URL('https://accounts.feishu.cn/open-apis/authen/v1/authorize')
    target.search=new URLSearchParams({client_id:appId,response_type:'code',redirect_uri:origin+'/auth/feishu/callback',state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'}).toString()
    res.writeHead(302,{'Location':target.href,'Set-Cookie':setCookie('__Host-pps_oauth',binding,300)});res.end();return true
   }
   if(path==='/auth/feishu/callback'&&req.method==='GET'){
    const state=url.searchParams.get('state')||'',code=url.searchParams.get('code')||''
    // DELETE RETURNING consumes the transaction atomically before any network await.
    const transaction=db.prepare('DELETE FROM transactions WHERE state=? RETURNING *').get(hash(state))
    res.setHeader('Set-Cookie',setCookie('__Host-pps_oauth','',0))
    if(!transaction||transaction.expires<=now()||!equal(transaction.binding,hash(cookie(req,'__Host-pps_oauth')))||!code||url.searchParams.has('error')){page(res,400,'登录请求已过期或校验失败，请重新登录。');return true}
    let identity
    try{
     const token=await request('https://open.feishu.cn/open-apis/authen/v2/oauth/token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({grant_type:'authorization_code',client_id:appId,client_secret:secret,code,redirect_uri:origin+'/auth/feishu/callback',code_verifier:transaction.verifier})})
     if(typeof token.access_token!=='string'||!token.access_token)throw Error('provider')
     const result=await request('https://open.feishu.cn/open-apis/authen/v1/user_info',{headers:{Authorization:'Bearer '+token.access_token}})
     identity=result.data
     if(!identity||typeof identity.open_id!=='string'||!identity.open_id||typeof identity.tenant_key!=='string')throw Error('provider')
    }catch{page(res,503,'飞书登录服务暂不可用，请稍后重试。');return true}
    if(tenant==='PENDING_ADMIN_CONFIRMATION'){db.prepare('INSERT OR REPLACE INTO identity_requests VALUES(?,?,?)').run(identity.tenant_key,identity.open_id,now());page(res,403,'首次接入等待管理员确认公司和成员身份，尚未开放编辑器。');return true}
    if(identity.tenant_key!==tenant){page(res,403,'当前账号不属于允许访问的公司。');return true}
    const m=member(identity.open_id)
    if(!m){db.prepare('INSERT OR REPLACE INTO pending VALUES(?,?)').run(identity.open_id,now());page(res,403,'账号尚未开通项目权限，请联系项目负责人。');return true}
    db.prepare('DELETE FROM sessions WHERE id=?').run(hash(cookie(req,'__Host-pps_session')))
    const id=random()
    db.prepare('INSERT INTO sessions VALUES(?,?,?,?,?,?,?)').run(hash(id),identity.open_id,version(m),String(identity.name||'项目成员').slice(0,100),random(),now()+28800000,now())
    res.writeHead(303,{'Location':'/','Set-Cookie':[setCookie('__Host-pps_oauth','',0),setCookie('__Host-pps_session',id,28800)]});res.end();return true
   }
   const s=session(req)
   if(path==='/api/auth/logout'&&req.method==='POST'){
    if(req.headers.origin!==origin||(s&&!equal(req.headers['x-csrf-token'],s.csrf))){fail(res,403,'CSRF_INVALID','请求校验失败，请刷新后重试');return true}
    db.prepare('DELETE FROM sessions WHERE id=?').run(hash(cookie(req,'__Host-pps_session')))
    res.writeHead(204,{'Set-Cookie':setCookie('__Host-pps_session','',0)});res.end();return true
   }
   if(!s){if(path.startsWith('/api/')||path.startsWith('/data/'))fail(res,401,'AUTH_REQUIRED','请重新登录');else{res.writeHead(303,{Location:'/login'});res.end()}return true}
   if(path==='/api/auth/session'&&req.method==='GET'){json(res,200,{user:{displayName:s.name},role:s.role,expiresAt:new Date(s.expires).toISOString(),csrfToken:s.csrf});return true}
   // This external deployment is strictly read-only, regardless of member role.
   if(!['GET','HEAD'].includes(req.method)){fail(res,403,'READ_ONLY_DEPLOYMENT','请在内网 GitLab 提交行为文件后重新发布');return true}
   return false
  }catch{fail(res,503,'AUTH_UNAVAILABLE','登录配置暂不可用，请联系部署者');return true}
 }
 return {authorize,close:()=>db.close()}
}
