import assert from 'node:assert/strict'
import { once } from 'node:events'
import { LibraryService } from '../server/library-service.mjs'
import { FeishuRepository } from '../server/feishu.mjs'
import { createEditorServer } from '../server/index.mjs'
import { planChanges } from '../shared/library-model.mjs'
const original={version:1,objects:[{id:'partner',name:'伙伴',description:'',enabled:true},{id:'food',name:'食物',description:'',enabled:true}],attributes:[{id:'energy',name:'精力',description:'',enabled:true,kind:'数值',objectTypes:['partner']}],buffs:[]}
const copy=value=>structuredClone(value)
class MemoryRepository {
  library=copy(original);writes=0;failAt=0
  async read(){return {library:copy(this.library),handles:{}}}
  async write({table,after}){if(++this.writes===this.failAt)throw new Error('模拟写入失败');const at=this.library[table].findIndex(r=>r.id===after.id);if(at<0)this.library[table].push(copy(after));else this.library[table][at]=copy(after)}
}
const repository=new MemoryRepository(),service=new LibraryService(repository)
const a=copy(original),b=copy(original);a.objects[0].description='A 编辑';b.objects[1].description='B 编辑'
await Promise.all([service.save(original,a),service.save(original,b)])
assert.equal(repository.library.objects[0].description,'A 编辑');assert.equal(repository.library.objects[1].description,'B 编辑')
const conflict=copy(original);conflict.objects[0].description='旧页面改动'
await assert.rejects(()=>service.save(original,conflict),e=>e.status===409&&e.conflicts[0].id==='partner')
const beforeRetry=repository.writes;await service.save(original,a);assert.equal(repository.writes,beforeRetry,'Retry must not duplicate a successful operation')
const deletion=copy(original);deletion.objects.pop();assert.throws(()=>planChanges(original,deletion,original),/删除/)
const partialRepo=new MemoryRepository(),partial=new LibraryService(partialRepo),desired=copy(original)
desired.objects.forEach(r=>r.description='批量修改');partialRepo.failAt=2
await assert.rejects(()=>partial.save(original,desired),/已有 1 条写入/)
assert.equal(partialRepo.library.objects[0].description,'批量修改');assert.equal(partialRepo.library.objects[1].description,'')
await partial.save(original,desired);assert.equal(partialRepo.library.objects[1].description,'批量修改')
const directRepo=new MemoryRepository(),direct=new LibraryService(directRepo);let reads=0
const baseRead=directRepo.read.bind(directRepo);directRepo.read=async()=>{if(++reads===2)directRepo.library.objects[0].description='飞书同时修改';return baseRead()}
await assert.rejects(()=>direct.save(original,a),e=>e.status===409);assert.equal(directRepo.writes,0)
const requests=[],fakeFetch=async(url,init)=>{
  requests.push({url,init})
  if(url.includes('tenant_access_token'))return Response.json({code:0,tenant_access_token:'test-only',expire:7200})
  if(init.method!=='GET')return Response.json({code:0,data:{}})
  const object=url.includes('example_objects'),attribute=url.includes('example_attributes')
  return Response.json({code:0,data:{has_more:false,items:object?[{record_id:'rec_partner',fields:{名称:[{text:'伙伴'}],标识:'partner',说明:'',启用:true}}]:attribute?[{record_id:'rec_energy',fields:{名称:'精力',标识:'energy',启用:true,数据类型:'数值',适用对象:[{record_ids:['rec_partner'],text:'伙伴',type:'text'}]}}]:[]}})
}
const feishu=new FeishuRepository({FEISHU_APP_ID:'test',FEISHU_APP_SECRET:'test'},fakeFetch),snapshot=await feishu.read()
assert.deepEqual(snapshot.library.attributes[0].objectTypes,['partner'])
const emptyLinkFetch=async(url,init)=>{const response=await fakeFetch(url,init);const data=await response.json();if(url.includes('example_attributes'))data.data.items[0].fields.适用对象=[{record_ids:null,text:null,text_arr:[],type:'text'},{text_arr:[],type:'text'}];return Response.json(data)}
assert.deepEqual((await new FeishuRepository({FEISHU_APP_ID:'test',FEISHU_APP_SECRET:'test'},emptyLinkFetch).read()).library.attributes[0].objectTypes,[])
const brokenLinkFetch=async(url,init)=>{const response=await fakeFetch(url,init);const data=await response.json();if(url.includes('example_attributes'))data.data.items[0].fields.适用对象=[{record_ids:['missing_record']}];return Response.json(data)}
await assert.rejects(()=>new FeishuRepository({FEISHU_APP_ID:'test',FEISHU_APP_SECRET:'test'},brokenLinkFetch).read(),/关联已失效/)
await feishu.write({table:'attributes',before:snapshot.library.attributes[0],after:{...snapshot.library.attributes[0],description:'更新说明'}},snapshot)
assert.deepEqual(JSON.parse(requests.at(-1).init.body).fields,{说明:'更新说明'})
assert.equal(requests.filter(r=>r.url.includes('tenant_access_token')).length,3)
const env={FEISHU_APP_ID:'test',FEISHU_APP_SECRET:'test',EDITOR_ACCESS_KEY:'test1234'}
const {server,service:httpService}=createEditorServer(env,new MemoryRepository())
server.listen(0,'127.0.0.1');await once(server,'listening');const origin='http://127.0.0.1:'+server.address().port
const post=(path,data,cookie='',originHeader=origin)=>fetch(origin+path,{method:'POST',headers:{Origin:originHeader,'Content-Type':'application/json',Cookie:cookie},body:typeof data==='string'?data:JSON.stringify(data)})
let reader
try {
  assert.equal((await fetch(origin+'/api/library')).status,401)
  assert.equal((await post('/api/library/login',{password:env.EDITOR_ACCESS_KEY},'','https://untrusted.example')).status,403)
  assert.equal((await post('/api/library/login',{password:'wrong'})).status,401)
  const login=await post('/api/library/login',{password:env.EDITOR_ACCESS_KEY});assert.equal(login.status,200)
  const cookie=login.headers.get('set-cookie').split(';')[0];assert.match(login.headers.get('set-cookie'),/HttpOnly/)
  const initial=await (await fetch(origin+'/api/library',{headers:{Cookie:cookie}})).json();assert.deepEqual(initial.library,original)
  const invalidLogin=await post('/api/library/login','{');assert.equal(invalidLogin.status,400);assert.ok(!Object.hasOwn(await invalidLogin.json(),'current'))
  const stream=await fetch(origin+'/api/library/events',{headers:{Cookie:cookie}});reader=stream.body.getReader()
  let chunk='';while(!chunk.includes('event: library')){const data=await reader.read();chunk+=new TextDecoder().decode(data.value)}
  assert.ok(chunk.includes('event: library'+String.fromCharCode(10)+'data:'))
  assert.equal((await post('/api/library',{base:original,library:a},cookie)).status,200)
  assert.equal((await post('/api/library',{base:original,library:conflict},cookie)).status,409)
  assert.equal((await post('/api/library/logout',{},cookie)).status,200)
  assert.equal(httpService.view().library.objects[0].description,'A 编辑')
}finally{await reader?.cancel();server.closeAllConnections();server.close();httpService.stop()}
console.log('PASS: two-client merge, same-row conflicts, partial failure/retry, direct Feishu race detection, Feishu link parsing and partial writes, auth, origin checks, SSE, no unauthenticated data leak')
