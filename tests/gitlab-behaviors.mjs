import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {execFileSync} from 'node:child_process'
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import http from 'node:http'
import {GitLabBehaviors} from '../server/gitlab-behaviors.mjs'
import {createPreviewServer} from '../server/cloud-preview.mjs'
execFileSync(process.execPath,['scripts/build-server-validator.mjs'])
const require=createRequire(import.meta.url),validator=require('../server/generated/behavior-validation.cjs')
const head='a'.repeat(40),sha='b'.repeat(40),newsha='c'.repeat(40),requestId='11111111-1111-4111-8111-111111111111'
const {readdir}=await import('node:fs/promises')
const name=(await readdir('behaviors')).find(n=>n.endsWith('.json')),text=await readFile('behaviors/'+name,'utf8')
let currentSha=sha,existing=null,mrs=[],writes=[],failMR=false,folder=true,secondPage=false,pages=[]
const mock=async(url,options)=>{
 const u=new URL(url),route=u.pathname.split('/projects/')[1].split('/').slice(1).join('/')
 assert.ok(u.pathname.includes(encodeURIComponent('petpals/shared/design_workspace')))
 assert.equal(options.headers['PRIVATE-TOKEN'],'fake-only')
 assert.equal(options.redirect,'error')
 let data
 const body=options.body&&JSON.parse(options.body)
 if(options.method==='POST')writes.push({route,body})
 if(route==='repository/branches/master')data={commit:{id:head}}
 else if(route.startsWith('repository/branches/')){
  if(!existing)return {ok:false,status:404};data=existing
 }else if(route==='repository/tree'){
  assert.equal(u.searchParams.get('ref'),head)
  if(!u.searchParams.get('path'))data=folder?[{name:'β行为图',type:'tree'}]:[]
  else{
   assert.equal(u.searchParams.get('path'),'β行为图')
   pages.push(u.searchParams.get('page'))
   data=u.searchParams.get('page')==='2'?[]:[{name,id:currentSha,type:'blob',mode:'100644'},{name:'link.json',id:sha,type:'blob',mode:'120000'}]
   if(secondPage&&u.searchParams.get('page')==='1')while(data.length<100)data.push({name:'dir'+data.length,type:'tree'})
  }
 }else if(route.startsWith('repository/files/'))data={blob_id:sha,size:Buffer.byteLength(text),encoding:'base64',content:Buffer.from(text).toString('base64')}
 else if(route==='repository/commits'){existing={commit:{id:newsha,message:body.commit_message}};data={id:newsha}}
 else if(route==='merge_requests'&&options.method==='GET')data=mrs
 else if(route==='merge_requests'){if(failMR)return {ok:false,status:503};data={iid:7,state:'opened'};mrs=[data]}
 else throw Error(route)
 return {ok:true,json:async()=>data}
}
const service=new GitLabBehaviors({token:'fake-only',...validator,fetchImpl:mock})
const plan={requestId,items:[{name,text,previousSha:sha}]}
assert.equal((await service.list()).files.length,1)
secondPage=true;pages=[];await service.list();assert.deepEqual(pages,['1','2']);secondPage=false
assert.equal((await service.read({name,ref:head,sha})).text,text)
await assert.rejects(service.read({name:'../a.json',ref:head,sha}))
await assert.rejects(service.read({name,ref:'master',sha}))
await assert.rejects(service.read({name,ref:head,sha:newsha}),/版本不匹配/)
folder=false;assert.equal((await service.list()).files.length,0);folder=true
assert.throws(()=>service.validateUpload({...plan,items:[...plan.items,...plan.items]}),/重复/)
assert.throws(()=>service.validateUpload({...plan,items:[{...plan.items[0],text:'{}'}]}))
assert.throws(()=>service.validateUpload({...plan,items:[{...plan.items[0],previousSha:undefined}]}))
assert.throws(()=>service.validateUpload({...plan,requestId:'../../master'}))
currentSha=newsha;await assert.rejects(service.submit(plan),/线上版本已变化/);assert.equal(writes.length,0)
currentSha=sha;failMR=true
await assert.rejects(service.submit(plan),e=>!!e.recoveryUrl)
assert.equal(writes.filter(x=>x.route==='repository/commits').length,1)
assert.equal(writes[0].body.start_sha,head)
assert.ok(writes[0].body.branch.startsWith('feature/proto_'))
assert.equal(writes[0].body.actions[0].action,'update')
assert.equal(writes[0].body.actions[0].file_path,'β行为图/'+name)
failMR=false
const result=await service.submit(plan);assert.equal(result.number,7)
await service.submit(plan)
assert.equal(writes.filter(x=>x.route==='repository/commits').length,1)
assert.ok(writes.findLast(x=>x.route==='merge_requests').body.title.startsWith('Draft:'))
assert.equal(writes.findLast(x=>x.route==='merge_requests').body.target_branch,'master')
await assert.rejects(service.submit({...plan,items:[{...plan.items[0],text:text+' '}]}),/不一致/)
const denied=new GitLabBehaviors({token:'fake-only',...validator,fetchImpl:async()=>({ok:false,status:403})})
await assert.rejects(denied.list(),/403/)

const root=await mkdtemp(join(tmpdir(),'editor-preview-'))
await writeFile(join(root,'index.html'),'<html>preview</html>')
const server=createPreviewServer({service,root,origin:'http://localhost:5110',uploads:false})
await new Promise(r=>server.listen(0,'127.0.0.1',r))
const base='http://127.0.0.1:'+server.address().port
const request=(url,{method='GET',headers={},body}={})=>new Promise((resolve,reject)=>{
 const req=http.request(url,{method,headers},res=>{let text='';res.on('data',chunk=>text+=chunk);res.on('end',()=>resolve({status:res.statusCode,json:async()=>JSON.parse(text)}))})
 req.on('error',reject);req.end(body)
})
try{
 const get=(path,headers={})=>request(base+path,{headers:{host:'localhost:5110',...headers}})
 assert.equal((await get('/')).status,200)
 assert.equal((await get('/api/behaviors')).status,200)
 assert.equal((await get('/api/behaviors',{host:'attacker.invalid'})).status,403)
 assert.equal((await get('/api/behaviors',{'sec-fetch-site':'cross-site'})).status,403)
 assert.equal((await get('/data/library.json')).status,503)
 assert.equal((await get('/server/cloud-preview.mjs')).status,404)
 assert.equal((await request(base+'/api/behaviors/uploads',{method:'POST',headers:{host:'localhost:5110',origin:'http://attacker.invalid','content-type':'application/json'},body:JSON.stringify(plan)})).status,403)
 const disabled=await request(base+'/api/behaviors/uploads',{method:'POST',headers:{host:'localhost:5110',origin:'http://localhost:5110','content-type':'application/json'},body:JSON.stringify(plan)})
 assert.equal(disabled.status,403);assert.match((await disabled.json()).message,/尚未开启/)
}finally{await new Promise(r=>server.close(r));await rm(root,{recursive:true,force:true})}
console.log('PASS: GitLab pagination, pinned reads, file validation, SHA conflicts, atomic branch, Draft MR recovery/idempotency, preview host/origin boundaries and uploads disabled')
