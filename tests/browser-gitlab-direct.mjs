import assert from 'node:assert/strict'
import {readFileSync,readdirSync} from 'node:fs'
import {createRequire} from 'node:module'
import {PersonalGitLab} from '../shared/gitlab-personal.mjs'
import {collaborationProxy,collaborationRoomName} from '../server/collaboration-proxy.mjs'
import {CollaborationRooms} from '../server/collaboration-rooms.mjs'
import {collaborationServer} from '../server/collaboration-service.mjs'
import {diff} from '../shared/collaboration.mjs'
const require=createRequire(import.meta.url),validation=require('../server/generated/behavior-validation.cjs')
const name=readdirSync('behaviors').find(n=>n.endsWith('.json'))
let config=validation.parseBehavior(readFileSync('behaviors/'+name,'utf8')),sha='a'.repeat(40),commit='b'.repeat(40),writes=0,deny=false,loseResponse=false
const original=structuredClone(config),token='test-direct-token',secret='test-service-secret-at-least-32-characters',user={id:'sso-user',name:'SSO'}
async function upstream(url,init={}){
 assert.equal(new Headers(init.headers).get('PRIVATE-TOKEN'),token)
 if(deny)return new Response('',{status:403})
 if(url.endsWith('/user'))return Response.json({id:7,name:'GitLab colleague'})
 if(url.endsWith('/personal_access_tokens/self'))return Response.json({active:true,scopes:['api','write_repository']})
 assert.ok(url.includes(encodeURIComponent('petpals/shared/design_workspace')))
 if(url.endsWith('/branches/master'))return Response.json({can_push:true})
 if(!url.includes('/repository/files/'))return Response.json({id:1})
 assert.equal(decodeURIComponent(new URL(url).pathname.split('/repository/files/')[1]),'β行为图/'+name)
 if(init.method==='PUT'){
  const body=JSON.parse(init.body);assert.equal(body.last_commit_id,commit);assert.equal(body.branch,'master')
  config=JSON.parse(body.content);sha='c'.repeat(40);commit='d'.repeat(40);writes++
  if(loseResponse)throw Error('lost response')
  return Response.json({})
 }
 const text=JSON.stringify(config)
 return Response.json({encoding:'base64',content:Buffer.from(text).toString('base64'),size:Buffer.byteLength(text),blob_id:sha,last_commit_id:commit})
}
const disk=new Map(),rooms=new CollaborationRooms({storage:{load:async n=>disk.get(n),save:async(n,s)=>disk.set(n,structuredClone(s))},validate:c=>validation.parseBehavior(JSON.stringify(c))})
const server=collaborationServer({rooms,direct:true,secret,validateFileName:validation.validateFileName})
await new Promise(r=>server.listen(0,'127.0.0.1',r))
const address='http://127.0.0.1:'+server.address().port+'/rpc',env={COLLAB_SERVICE_URL:'https://collaboration.test/rpc',COLLAB_SERVICE_TOKEN:secret}
let forwarded=0
const runtime={officeNet:{fetch:async request=>{
 assert.equal(new URL(request.url).host,'git.xindong.com','Office network must only receive GitLab requests')
 assert.equal(request.method,'GET','Worker must never write GitLab');return upstream(request.url,{method:request.method,headers:request.headers})
}}}
const serviceFetch=async request=>{
 assert.equal(new URL(request.url).host,'collaboration.test')
 const body=await request.json();assert.ok(!JSON.stringify(body).includes(token),'PAT must not reach collaboration host');assert.equal(body.user.id,user.id);forwarded++
 return fetch(address,{method:'POST',headers:request.headers,body:JSON.stringify(body)})
}
const call=async(body,who=user)=>{const r=await collaborationProxy(new Request('https://editor.test/api/collaboration',{method:'POST',headers:{origin:'https://editor.test'},body:JSON.stringify(body)}),env,who,runtime,validation,serviceFetch);const data=await r.json();if(!r.ok)throw Object.assign(Error(data.message),{status:r.status});return data}
try{
 const status=await call({input:{action:'authStatus'}})
 const auth=await call({input:{action:'authToken',credentialOwner:status.credentialOwner,token}})
 assert.equal(auth.canEdit,true);assert.equal(auth.direct,true)
 await assert.rejects(()=>call({name,input:{action:'poll'},ticket:auth.ticket},{id:'forged'}),{status:401})
 await assert.rejects(()=>call({name,input:{action:'poll'},ticket:{...auth.ticket,payload:auth.ticket.payload.replace('GitLab colleague','forged name')}}),{status:401})
 const direct=new PersonalGitLab({token,...validation,fetchImpl:async(url,init)=>{assert.equal(init.credentials,'omit');return upstream(url,init)}})
 const base=await direct.load(name)
 let room=await call({name,input:{action:'join'},token,browserBase:base,user:{id:'forged'}})
 const next=structuredClone(original);next.graph.nodes.find(n=>n.type!=='start').data.name='Direct browser edit'
 room=await call({name,ticket:auth.ticket,input:{action:'apply',session:room.session,operation:'edit',changes:diff(original,next)}})
 room=await call({name,ticket:auth.ticket,input:{action:'saveBegin',session:room.session,revision:room.revision}})
 const intent=room.saveIntent;assert.ok(intent)
 const recoveredRooms=new CollaborationRooms({storage:{load:async n=>structuredClone(disk.get(n)),save:async()=>{}},validate:c=>validation.parseBehavior(JSON.stringify(c))})
 const roomName=await collaborationRoomName(name)
 assert.notEqual(roomName,name,'new repository must not reuse old filename-based drafts')
 assert.ok(disk.has(roomName));assert.ok(!disk.has(name))
 const recovered=await recoveredRooms.run(roomName,user,{action:'join'},{load:async()=>base})
 assert.equal(recovered.saveIntent.id,intent.id,'pending save survives process restart')
 await assert.rejects(()=>call({name,ticket:auth.ticket,input:{action:'apply',session:room.session,operation:'during-save',changes:[]}}),{status:425})
 // A browser claiming success without a GitLab commit cannot clear the save.
 await assert.rejects(()=>call({name,token,input:{action:'saveComplete',session:room.session,intent:intent.id}}),{status:409})
 loseResponse=true;await direct.save(name,intent);assert.equal(writes,1)
 await direct.save(name,intent);assert.equal(writes,1,'retry reconciles the lost response')
 room=await call({name,token,input:{action:'saveComplete',session:room.session,intent:intent.id}})
 assert.equal(room.savedRevision,room.revision);assert.equal(room.saveIntent,null)
 const changed=structuredClone(next);changed.graph.nodes.find(n=>n.type!=='start').data.name='Another edit'
 await assert.rejects(()=>direct.save(name,{...intent,config:changed}),{status:409})
 deny=true
 await assert.rejects(()=>call({name,token,input:{action:'join'},browserBase:base}),{status:403})
 assert.ok(forwarded>0)
 console.log('Browser direct GitLab: credential isolation, SSO-bound tickets, read-only Worker, save reservation, false receipts, lost-response reconciliation, CAS and revocation passed')
}finally{await new Promise(r=>server.close(r))}
