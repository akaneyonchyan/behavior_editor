import assert from 'node:assert/strict'
import {mkdtemp,rm,readFile,readdir} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {build} from 'esbuild'
import {createRequire} from 'node:module'
import {CollaborationRooms} from '../server/collaboration-rooms.mjs'
import {CollaborationRepository,diskStorage,collaborationServer} from '../server/collaboration-service.mjs'
import {diff,apply} from '../shared/collaboration.mjs'
import {collaborationProxy} from '../server/collaboration-proxy.mjs'
import validation from '../server/generated/behavior-validation.cjs'
const filename=(await readdir('behaviors')).find(n=>n.endsWith('.json'))
const original=validation.parseBehavior(await readFile('behaviors/'+filename,'utf8'))
const clone=structuredClone,user={id:'alice',name:'小甲'},other={id:'bob',name:'小乙'}
const root=await mkdtemp(join(tmpdir(),'pps-collaboration-')),storage=await diskStorage(root)
await assert.rejects(()=>diskStorage(root),{code:'EEXIST'})
let now=0,current=clone(original),sha='base',commit='commit-1',writes=0
const repository={load:async()=>({config:clone(current),sha,commit}),save:async(name,base,config)=>{if(base.sha!==sha)throw Object.assign(new Error('外部修改'),{status:409});current=clone(config);sha='saved-'+(++writes);return {config:clone(config),sha,commit}}}
const create=()=>new CollaborationRooms({storage,repository,validate:c=>validation.parseBehavior(JSON.stringify(c)),clock:()=>now})
let rooms=create()
const call=(who,input)=>rooms.run(filename,who,input)
const a=await call(user,{action:'join'}),b=await call(other,{action:'join'})
const ids=original.graph.nodes.map(n=>n.id),id=ids[0],second=ids[1]
const results=await Promise.allSettled([call(user,{action:'lock',session:a.session,node:id}),call(other,{action:'lock',session:b.session,node:id})])
assert.equal(results.filter(r=>r.status==='fulfilled').length,1)
assert.equal(results.find(r=>r.status==='rejected').reason.status,423)
await call(other,{action:'lock',session:b.session,node:second})
const edit=(config,id,name)=>{const next=clone(config);next.graph.nodes.find(n=>n.id===id).data.name=name;return next}
const ca=edit(original,id,'甲修改'),cb=edit(original,second,'乙修改')
const pa={action:'apply',session:a.session,operation:'op-a',changes:diff(original,ca)}
await call(user,pa)
const merged=await call(other,{action:'apply',session:b.session,operation:'op-b',changes:diff(original,cb)})
assert.equal(merged.config.graph.nodes.find(n=>n.id===id).data.name,'甲修改')
assert.equal(merged.config.graph.nodes.find(n=>n.id===second).data.name,'乙修改')
assert.equal((await call(user,pa)).revision,2,'replayed operation must not apply twice')
await assert.rejects(()=>call(user,{...pa,changes:diff(original,edit(original,id,'伪造重复'))}),{status:409})
await assert.rejects(()=>call(other,{...pa,session:b.session,operation:'bad-owner'}),{status:409})
const denied=edit(merged.config,id,'乙抢写')
await assert.rejects(()=>call(other,{action:'apply',session:b.session,operation:'denied',changes:diff(merged.config,denied)}),{status:423})
await assert.rejects(()=>call(user,{action:'poll',session:b.session}),{status:410})
await call(user,{action:'poll',session:a.session,cursor:{x:100,y:200}})
assert.deepEqual((await call(other,{action:'poll',session:b.session})).participants.find(p=>p.name==='小甲').cursor,{x:100,y:200})
await assert.rejects(()=>call(user,{action:'save',session:a.session,revision:1}),{status:409})
const saved=await call(user,{action:'save',session:a.session,revision:2});assert.equal(saved.savedRevision,2);assert.equal(writes,1)
await call(user,{action:'save',session:a.session,revision:2});assert.equal(writes,1)
// Crash/restart retains acknowledged drafts but invalidates every old lease.
const more=edit(saved.config,id,'未存仓库的草稿')
await call(user,{action:'apply',session:a.session,operation:'draft',changes:diff(saved.config,more)})
rooms=create()
await assert.rejects(()=>call(user,{action:'poll',session:a.session}),{status:410})
const restarted=await call(user,{action:'join'})
assert.equal(restarted.config.graph.nodes.find(n=>n.id===id).data.name,'未存仓库的草稿')
sha='external'
await assert.rejects(()=>call(user,{action:'save',session:restarted.session,revision:3}),{status:409})
await call(user,{action:'lock',session:restarted.session,node:id})
now=16000
const fresh=await call(other,{action:'join'})
assert.equal(Object.keys(fresh.locks).length,0)
await call(other,{action:'lock',session:fresh.session,node:id})
await assert.rejects(()=>call(user,{action:'lock',session:restarted.session,node:id}),{status:410})
assert.throws(()=>apply(original,[{key:'nodes:'+id,before:original.graph.nodes[0],after:{...original.graph.nodes[0],id:'different'}}]))
// Durability failures do not acknowledge or mutate the authoritative graph.
const failing=new CollaborationRooms({storage:{load:async()=>null,save:async()=>{throw new Error('disk full')}},repository,validate:()=>{}})
await assert.rejects(()=>failing.run(filename,user,{action:'join'}),/disk full/)
// GitLab writes use file-level CAS; matching content reconciles lost responses.
const git=new CollaborationRepository({token:'test',...validation}),calls=[]
git.load=async()=>({config:clone(original),sha:'x',commit:'last-file-commit'})
git.api=async(path,options)=>{calls.push(options);git.load=async()=>({config:ca,sha:'new',commit:'new-commit'});return {}}
await git.save(filename,{sha:'x'},ca,['小甲'],user)
assert.equal(calls[0].body.last_commit_id,'last-file-commit');assert.equal(calls[0].body.branch,'master')
await git.save(filename,{sha:'x'},ca,['小甲'],user);assert.equal(calls.length,1)
await assert.rejects(()=>git.save(filename,{sha:'x'},cb,['小甲'],user),{status:409})
// HTTP backend and Worker trust only server identity, not browser-supplied user.
const secret='test-only-service-secret-with-32-characters',server=collaborationServer({rooms,secret,validateFileName:validation.validateFileName})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const address='http://127.0.0.1:'+server.address().port+'/rpc'
assert.equal((await fetch(address,{method:'POST',body:'{}'})).status,401)
const env={COLLAB_SERVICE_URL:'https://backend.test/rpc',COLLAB_SERVICE_TOKEN:secret}
const request=body=>new Request('https://editor.test/api/collaboration',{method:'POST',headers:{origin:'https://editor.test','Content-Type':'application/json'},body:JSON.stringify(body)})
const proxy=await collaborationProxy(request({name:filename,input:{action:'join'},user:other}),env,user,{officeNet:{fetch:async request=>{const body=await request.json();assert.equal(body.user.id,user.id);return fetch(address,{method:'POST',headers:request.headers,body:JSON.stringify(body)})}}})
assert.equal(proxy.status,400) // No personal credential: cannot forge identity through the proxy.
assert.equal((await collaborationProxy(new Request('https://editor.test/api/collaboration',{method:'POST',headers:{origin:'https://evil.test'}}),env,user,{})).status,403)
assert.equal((await collaborationProxy(request({}),{},user,{})).status,503)
await new Promise(resolve=>server.close(resolve))
// The browser client must preserve typing that happens while an earlier edit
// is being acknowledged, as well as another user's independent node changes.
const clientBundle=await build({entryPoints:['src/store/collaborationClient.js'],bundle:true,platform:'node',format:'cjs',write:false,logLevel:'silent'})
const clientModule={exports:{}},require=createRequire(import.meta.url)
new Function('require','module','exports',clientBundle.outputFiles[0].text)(require,clientModule,clientModule.exports)
const {CollaborationClient}=clientModule.exports
const volatile=new Map(),clientRooms=new CollaborationRooms({storage:{load:async n=>volatile.get(n),save:async(n,v)=>volatile.set(n,clone(v))},repository:{load:async()=>({config:clone(original),sha:'base'})},validate:c=>validation.parseBehavior(JSON.stringify(c))})
let releaseRequest,waiting=false
const client=new CollaborationClient(filename,{request:async(name,input)=>{
 if(input.action==='apply'&&!waiting){waiting=true;await new Promise(resolve=>{releaseRequest=resolve})}
 return clientRooms.run(name,user,input)
}})
await client.join();await client.lock(id)
client.store.getState().updateNode(id,{name:'第一段'})
const firstFlush=client.flush()
client.store.getState().updateNode(id,{name:'第一段加后续输入'})
const peer=await clientRooms.run(filename,other,{action:'join'})
await clientRooms.run(filename,other,{action:'apply',session:peer.session,operation:'peer-change',changes:diff(original,edit(original,second,'另一人输入'))})
releaseRequest();await firstFlush
assert.equal(client.store.getState().nodes.find(n=>n.id===id).data.name,'第一段加后续输入')
assert.equal(client.store.getState().nodes.find(n=>n.id===second).data.name,'另一人输入')
await client.flush();assert.equal(client.state().pending,false)
await client.close()
const withEdges=(await clientRooms.run(filename,other,{action:'poll',session:peer.session})).config
const removed=clone(withEdges),edge=removed.graph.edges.shift()
assert.ok(edge,'fixture must contain an edge')
const withoutEdge=await clientRooms.run(filename,other,{action:'apply',session:peer.session,operation:'remove-edge',changes:diff(withEdges,removed)})
assert.equal(withoutEdge.config.graph.edges.length,withEdges.graph.edges.length-1)
const restored=await clientRooms.run(filename,other,{action:'apply',session:peer.session,operation:'restore-edge',changes:diff(removed,withEdges)})
assert.equal(restored.config.graph.edges.length,withEdges.graph.edges.length)
await storage.close();await rm(root,{recursive:true,force:true})
console.log('协作服务回归通过：抢锁、独立编辑合并、重放、冒用、光标、CAS保存、外部冲突、重启恢复、租约过期、鉴权')
