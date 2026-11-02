import assert from 'node:assert/strict'
import {mkdtemp,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import http from 'node:http'
import {createFeishuAuth} from '../server/feishu-auth.mjs'
import {createPreviewServer} from '../server/cloud-preview.mjs'
const dir=await mkdtemp(join(tmpdir(),'pps-auth-')),origin='https://behavior-editor.online',membersFile=join(dir,'members.json')
const allowed=[{open_id:'test-user',enabled:true,role:'viewer',version:'1'}]
await writeFile(membersFile,JSON.stringify(allowed))
await writeFile(join(dir,'index.html'),'private editor')
await writeFile(join(dir,'app.js'),'private script')
let time=Date.now(),identity={tenant_key:'test-tenant',open_id:'test-user',name:'测试成员'},calls=0,providerDown=false
const options={origin,appId:'test-app',secret:'test-secret',tenant:'test-tenant',membersFile,dbPath:join(dir,'auth.sqlite'),now:()=>time,fetcher:async(url,options)=>{calls++;if(providerDown)throw Error('offline');if(url.endsWith('/token')){const body=JSON.parse(options.body);assert.equal(body.redirect_uri,origin+'/auth/feishu/callback');assert.ok(body.code_verifier);return new Response(JSON.stringify({code:0,access_token:'private-token'}))}return new Response(JSON.stringify({code:0,data:identity}))}}
let auth,server,base
async function boot(){auth=createFeishuAuth(options);server=createPreviewServer({origin,root:dir,authorize:auth.authorize,service:{list:async()=>({files:['private']})}});await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port}
async function stop(){await new Promise(r=>server.close(r));auth.close()}
const req=(path,headers={},method='GET')=>new Promise((resolve,reject)=>{const request=http.request(base+path,{method,headers:{Host:new URL(origin).host,...headers}},response=>{const chunks=[];response.on('data',x=>chunks.push(x));response.on('end',()=>{const h=new Headers();for(const [key,value] of Object.entries(response.headers))for(const item of Array.isArray(value)?value:[value])h.append(key,item);resolve(new Response(response.statusCode===204?null:Buffer.concat(chunks),{status:response.statusCode,headers:h}))})});request.on('error',reject);request.end()})
async function start(){const r=await req('/auth/feishu/start?returnTo=https://evil.example');assert.equal(r.status,302);const url=new URL(r.headers.get('location'));assert.equal(url.searchParams.get('code_challenge_method'),'S256');return {state:url.searchParams.get('state'),cookie:r.headers.getSetCookie()[0].split(';')[0]}}
const callback=(t,cookie=t.cookie)=>req('/auth/feishu/callback?state='+t.state+'&code=test-code',{'Cookie':cookie,'Sec-Fetch-Site':'cross-site'})
try{
 await boot()
 for(const path of ['/','/app.js','/data/behaviors/index.json','/data/library.json','/api/behaviors']){const r=await req(path);assert.equal(r.status,path.startsWith('/api/')||path.startsWith('/data/')?401:303);assert.ok(!(await r.text()).includes('private'))}
 const wrong=await start();assert.equal((await callback(wrong,'')).status,400);assert.equal(calls,0)
 const expired=await start();time+=300001;assert.equal((await callback(expired)).status,400)
 let t=await start();let response=await callback(t);assert.equal(response.status,303);assert.equal(response.headers.get('location'),'/');assert.equal((await callback(t)).status,400)
 const sessionCookie=response.headers.getSetCookie().find(x=>x.startsWith('__Host-pps_session='));assert.match(sessionCookie,/Secure; HttpOnly; SameSite=Lax/);const headers={Cookie:sessionCookie.split(';')[0]}
 assert.equal((await req('/api/behaviors',headers)).status,200);assert.equal((await req('/app.js',headers)).status,200)
 const returned={...headers,'Sec-Fetch-Site':'cross-site','Sec-Fetch-Mode':'navigate','Sec-Fetch-Dest':'document'}
 assert.equal((await req('/',returned)).status,200,'OAuth redirect chain must allow authenticated top-level home navigation')
 assert.equal((await req('/api/behaviors',returned)).status,403)
 assert.equal((await req('/app.js',returned)).status,403)
 assert.equal((await req('/',{...returned,'Sec-Fetch-Dest':'iframe'})).status,403)
 assert.equal((await req('/',{...returned,'Sec-Fetch-Mode':'cors'})).status,403)
 assert.equal((await req('/',{...returned,Cookie:''})).status,303)
 const session=await (await req('/api/auth/session',headers)).json();assert.equal(session.role,'viewer');assert.ok(!JSON.stringify(session).includes('private-token'))
 assert.equal((await req('/api/behaviors/uploads',{...headers,Origin:origin},'POST')).status,403)
 assert.equal((await req('/api/auth/logout',{...headers,Origin:'https://evil.example','X-CSRF-Token':session.csrfToken},'POST')).status,403)
 assert.equal((await req('/api/auth/logout',{...headers,Origin:origin},'POST')).status,403)
 await stop();await boot();assert.equal((await req('/api/auth/session',headers)).status,200)
 await writeFile(membersFile,'[]');assert.equal((await req('/api/behaviors',headers)).status,401)
 t=await start();assert.equal((await callback(t)).status,403)
 identity.tenant_key='other-company';t=await start();assert.equal((await callback(t)).status,403)
 identity.tenant_key='test-tenant';await writeFile(membersFile,JSON.stringify(allowed));providerDown=true;t=await start();assert.equal((await callback(t)).status,503);providerDown=false
 t=await start();response=await callback(t);headers.Cookie=response.headers.getSetCookie().find(x=>x.startsWith('__Host-pps_session=')).split(';')[0]
 const current=await (await req('/api/auth/session',headers)).json();assert.equal((await req('/api/auth/logout',{...headers,Origin:origin,'X-CSRF-Token':current.csrfToken},'POST')).status,204);assert.equal((await req('/api/behaviors',headers)).status,401)
 t=await start();response=await callback(t);headers.Cookie=response.headers.getSetCookie().find(x=>x.startsWith('__Host-pps_session=')).split(';')[0];time+=7200001;assert.equal((await req('/api/auth/session',headers)).status,401)
 const company={access:'company',tenant:'test-tenant',members:allowed}
 await writeFile(membersFile,JSON.stringify(company))
 identity.open_id='new-colleague';t=await start();response=await callback(t);assert.equal(response.status,303)
 headers.Cookie=response.headers.getSetCookie().find(x=>x.startsWith('__Host-pps_session=')).split(';')[0]
 assert.equal((await (await req('/api/auth/session',headers)).json()).role,'viewer')
 assert.equal((await req('/api/behaviors',headers)).status,200)
 assert.equal((await req('/api/behaviors/uploads',{...headers,Origin:origin},'POST')).status,403)
 identity.tenant_key='other-company';t=await start();assert.equal((await callback(t)).status,403);identity.tenant_key='test-tenant'
 company.members.push({open_id:'new-colleague',enabled:false,role:'viewer',version:'1'})
 await writeFile(membersFile,JSON.stringify(company));assert.equal((await req('/api/auth/session',headers)).status,401)
 t=await start();assert.equal((await callback(t)).status,403)
 company.members=allowed;await writeFile(membersFile,JSON.stringify(company));identity.open_id='another-colleague'
 t=await start();response=await callback(t);assert.equal(response.status,303);headers.Cookie=response.headers.getSetCookie().find(x=>x.startsWith('__Host-pps_session=')).split(';')[0]
 await writeFile(membersFile,'[]');assert.equal((await req('/api/auth/session',headers)).status,401)
 await writeFile(membersFile,JSON.stringify({...company,tenant:'wrong-tenant'}));t=await start();assert.equal((await callback(t)).status,503)
 await writeFile(membersFile,'[]')
 await stop();options.tenant='PENDING_ADMIN_CONFIRMATION';await boot();t=await start();response=await callback(t);assert.equal(response.status,403);assert.ok(!response.headers.getSetCookie().some(x=>x.startsWith('__Host-pps_session=')));assert.equal((await req('/api/behaviors')).status,401)
 console.log('PASS: anonymous resources, state binding/replay/expiry, PKCE, tenant/member denial, persistence, revocation, read-only, CSRF, logout, idle expiry and provider failure')
}finally{await stop();await rm(dir,{recursive:true,force:true})}
