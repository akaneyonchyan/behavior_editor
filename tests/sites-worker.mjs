import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {readFile,readdir} from 'node:fs/promises'
const bundled=await build({entryPoints:['server/sites-worker.mjs'],bundle:true,platform:'browser',format:'esm',write:false,define:{'import.meta.env':'{}'}})
const {createSitesWorker}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'))
const head='a'.repeat(40),sha='b'.repeat(40),newHead='c'.repeat(40)
const name=(await readdir('behaviors')).find(n=>n.endsWith('.json')),text=await readFile('behaviors/'+name,'utf8')
let currentHead=head,empty=false,denied=false,officeUnavailable=false,redirected=false,calls=[]
const upstream=async(request)=>{
 assert.ok(request instanceof Request)
 const url=request.url
 calls.push(url);assert.equal(request.method,'GET');assert.equal(request.headers.get('PRIVATE-TOKEN'),'test-only');assert.equal(request.redirect,'manual')
 if(redirected)return new Response(null,{status:302,headers:{location:'https://other.invalid/'}})
 if(officeUnavailable)return Response.json({error:{code:'OFFICE_NET_UNAVAILABLE'}},{status:501})
 if(denied)return new Response('private upstream body',{status:403})
 const u=new URL(url)
 if(u.pathname.endsWith('/branches/master'))return Response.json({commit:{id:currentHead}})
 if(u.pathname.endsWith('/tree')){
  assert.equal(u.searchParams.get('ref'),currentHead)
  return Response.json(!u.searchParams.has('path')?[{name:'β行为图',type:'tree'}]:empty?[]:[{name,id:sha,type:'blob',mode:'100644'}])
 }
 assert.equal(u.searchParams.get('ref'),head) // old committed file remains readable after master changes
 return Response.json({blob_id:sha,size:Buffer.byteLength(text),encoding:'base64',content:Buffer.from(text).toString('base64')})
}
const worker=createSitesWorker({currentUser:()=>({id:'test-user'}),runtimeFor:()=>({officeNet:{fetch:upstream}})})
const env={GITLAB_TOKEN:'test-only',ASSETS:{fetch:async()=>new Response('asset')}}
const get=(path,options)=>worker.fetch(new Request('https://site.test'+path,options),env)
const anonymous=createSitesWorker({currentUser:()=>null})
assert.equal((await anonymous.fetch(new Request('https://site.test/api/behaviors'),env)).status,401)
assert.equal(calls.length,0)
const index=await (await get('/api/behaviors')).json()
assert.equal(index.files[0].ref,head);assert.equal(index.source,'gitlab-live')
currentHead=newHead
assert.equal((await (await get('/api/behaviors/file?'+new URLSearchParams(index.files[0]))).json()).text,text)
assert.equal((await (await get('/api/behaviors')).json()).head,newHead)
empty=true;assert.deepEqual((await (await get('/api/behaviors')).json()).files,[])
assert.equal((await get('/api/behaviors/file?name=..%2Fa.json&ref='+head+'&sha='+sha)).status,400)
assert.equal((await get('/api/behaviors/file?name='+encodeURIComponent(name)+'&ref=master&sha='+sha)).status,400)
assert.equal((await get('/api/behaviors',{method:'POST'})).status,405)
assert.equal((await get('/api/behaviors',{headers:{'sec-fetch-site':'cross-site'}})).status,403)
assert.equal((await get('/api/other')).status,404)
assert.equal((await get('/data/behaviors/index.json')).status,404)
assert.equal(await (await get('/')).text(),'asset')
denied=true
const failure=await get('/api/behaviors');assert.equal(failure.status,503)
const error=await failure.text();assert.ok(!error.includes('test-only'));assert.ok(!error.includes('private upstream body'))
denied=false;officeUnavailable=true
assert.match(await (await get('/api/behaviors')).text(),/办公网/)
officeUnavailable=false;redirected=true
const before=calls.length
assert.match(await (await get('/api/behaviors')).text(),/未向重定向地址发送凭据/)
assert.equal(calls.length,before+1)
console.log('Sites Worker: SSO, read-only routes, pinned versions, empty directory, GitLab denial and office-network failure passed')
