import {createBehaviorStore} from './behaviorStore'
import {diff,apply,equal} from '../../shared/collaboration.mjs'
import {browserGitLabRequest} from '../utils/browserGitLab'

export async function collaborationRequest(name,input){
 return browserGitLabRequest(name,input,sendCollaboration)
}
async function sendCollaboration(body){
 let response,result
 try{response=await fetch('/api/collaboration',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(45000)})}
 catch{throw new Error('协作连接中断或超时，请保留当前副本后重新加入')}
 try{result=await response.json()}catch{throw new Error('协作服务返回无效响应，请保留当前副本并检查登录状态')}
 if(!response.ok)throw Object.assign(new Error(result.message||'协作请求失败'),{status:response.status})
 return result
}
export class CollaborationClient{
 constructor(name,{request=collaborationRequest,onStatus=()=>{}}={}){
  Object.assign(this,{name,request,onStatus});this.store=createBehaviorStore();this.remote=null;this.applying=false;this.stopped=false;this.pending=null;this.error='';this.cursor=null;this.chain=Promise.resolve();this.lastContact=0
 }
 state(){return {room:this.remote,error:this.error,locking:this.locking,pending:!!this.pending||!!(this.remote&&diff(this.remote.config,this.store.getState().exportConfig()).length),connected:!!this.remote&&!this.error&&Date.now()-this.lastContact<5000}}
 notify(){this.onStatus(this.state())}
 async join(){
  const room=await this.request(this.name,{action:'join'})
  if(this.stopped){void this.request(this.name,{action:'leave',session:room.session}).catch(()=>{});return}
  this.remote=room;this.lastContact=Date.now();this.install(room.config)
  // Store.importConfig intentionally regenerates IDs for local imports; room
  // snapshots must preserve the authoritative edge IDs.
  this.unsubscribe=this.store.subscribe(()=>{if(!this.applying){this.notify();if(!this.flushTimer)this.flushTimer=setTimeout(()=>{this.flushTimer=null;void this.enqueue(()=>this.flush())},120)}})
  this.notify();this.timer=setInterval(()=>{this.notify();if(this.tickQueued)return;this.tickQueued=true;void this.enqueue(()=>this.poll()).finally(()=>{this.tickQueued=false})},350)
 }
 install(config){
  this.applying=true
  const s=this.store.getState(),id=s.selectedNode?.id
  const nodes=config.graph.nodes.map(n=>{const old=s.nodes.find(x=>x.id===n.id);return {...n,width:old?.width,height:old?.height,selected:n.id===id}})
  this.store.setState({nodes,edges:config.graph.edges.map(e=>({...e,type:'default'})),behaviorInfo:config.behavior,layout:config.graph.layout||null,selectedNode:nodes.find(n=>n.id===id)||null,past:[],future:[]})
  this.applying=false
 }
 enqueue(task){
  this.chain=this.chain.then(async()=>{if(this.stopped)return;try{await task()}catch(e){this.error=e.message||'协作连接中断，请保留副本后重新加入';this.notify()}})
  return this.chain
 }
 async rpc(input){return this.request(this.name,{...input,knownRevision:this.remote.revision,session:this.remote.session})}
 accept(room,base){
  room={...room,config:room.config||this.remote.config}
  // Preserve edits made while a request was in flight, applying only the
  // unacknowledged delta over the new authoritative graph. Conflicts freeze.
  const local=this.store.getState().exportConfig(),extra=diff(base,local)
  const merged=apply(room.config,extra)
  this.remote=room;this.lastContact=Date.now();if(!equal(local,merged))this.install(merged);this.notify()
 }
 async flush(){
  if(!this.remote||this.error)return
  if(!this.pending){
   const config=this.store.getState().exportConfig(),changes=diff(this.remote.config,config)
   if(!changes.length)return
   this.pending={action:'apply',operation:crypto.randomUUID(),changes,config}
  }
  const pending=this.pending
  let room
  try{room=await this.rpc({action:pending.action,operation:pending.operation,changes:pending.changes})}catch(e){if(e.status===425)return;throw e}
  this.accept(room,pending.config);this.pending=null;this.notify()
 }
 async poll(){
  if(!this.remote||this.error)return
  await this.flush()
  const base=this.remote.config,room=await this.rpc({action:'poll',cursor:this.cursor})
  this.accept(room,base)
 }
 lock(id){
  if(!this.remote||this.error)return Promise.resolve()
  // Selection is local UI state; editing remains gated by the server lease.
  // Both ReactFlow selection changes (keyboard/pointer) and clicks reach here.
  this.store.getState().selectNode(this.store.getState().nodes.find(n=>n.id===id)||null)
  if(this.locking===id)return this.chain
  if(this.locking===undefined&&id&&this.remote.locks[id]===this.remote.session)return Promise.resolve()
  const request=this.selectionRequest=(this.selectionRequest||0)+1
  this.locking=id;this.notify()
  return this.enqueue(async()=>{
   try{
    if(this.error||request!==this.selectionRequest)return
    await this.flush()
    if(request!==this.selectionRequest)return
    const base=this.remote.config,room=await this.rpc({action:'lock',node:id});this.accept(room,base)
   }catch(e){if(e.status===423){this.onNotice?.(e.message);return}throw e}
   finally{if(request===this.selectionRequest){this.locking=undefined;this.notify()}}
  })
 }
 save(){return this.enqueue(async()=>{
  if(this.error)return
  await this.flush()
  if(this.pending)return
  const base=this.remote.config,room=await this.rpc({action:'save',revision:this.remote.revision});this.accept(room,base)
 })}
 async close(){
  this.stopped=true;clearInterval(this.timer);clearTimeout(this.flushTimer);this.unsubscribe?.()
  // Do not release a lock while an in-flight command might still be writing.
  await this.chain
  if(this.remote)void this.rpc({action:'leave'}).catch(()=>{})
 }
}
