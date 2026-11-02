import {randomUUID,createHash} from 'node:crypto'
import {apply,affected,equal} from '../shared/collaboration.mjs'
import {failure} from '../shared/gitlab-behavior-reader.mjs'

// Exactly one authoritative process owns the durable database (enforced by the
// service's directory lease). Never instantiate this inside a stateless Worker.
export class CollaborationRooms{
 constructor({repository,storage,validate,clock=Date.now,leaseMs=15000}){
  Object.assign(this,{repository,storage,validate,clock,leaseMs});this.rooms=new Map();this.queues=new Map()
 }
 async run(name,user,input,repository=this.repository){
  const previous=this.queues.get(name)||Promise.resolve()
  const next=previous.catch(()=>{}).then(()=>this.execute(name,user,input,repository))
  this.queues.set(name,next)
  try{return await next}finally{if(this.queues.get(name)===next)this.queues.delete(name)}
 }
 async execute(name,user,input,repository=this.repository){
  if(!user?.id)throw failure(401,'请先登录')
  let room=this.rooms.get(name)
  if(!room){
   let state=await this.storage.load(name)
   if(!state){const base=await repository.load(name);state={config:base.config,base,revision:0,savedRevision:0,receipts:[],contributors:[]};await this.storage.save(name,state)}
   room={state,sessions:new Map(),locks:new Map()};this.rooms.set(name,room)
  }
  const now=this.clock()
  for(const [id,s] of room.sessions)if(s.until<=now){room.sessions.delete(id);for(const [node,owner] of room.locks)if(owner===id)room.locks.delete(node)}
  if(input.action==='join'){
   if(!room.sessions.size&&room.state.revision===room.state.savedRevision){
    const base=await repository.load(name)
    const next={...room.state,base,config:base.config};await this.storage.save(name,next);room.state=next
   }
   if(room.sessions.size>=40)throw failure(429,'当前文档协作人数已达上限')
   const id=randomUUID();room.sessions.set(id,{user:{id:user.id,name:user.name||user.email||'同事'},until:now+this.leaseMs,cursor:null,selected:null})
   return this.view(room,id)
  }
  const session=room.sessions.get(input.session)
  if(!session||session.user.id!==user.id)throw failure(410,'协作连接已过期，请保留本机副本后重新加入')
  session.until=now+this.leaseMs
  const blocked=ids=>ids.find(id=>room.locks.has(id)&&room.locks.get(id)!==input.session)
  if(input.action==='leave'){room.sessions.delete(input.session);for(const [id,s] of room.locks)if(s===input.session)room.locks.delete(id);return {left:true}}
  if(input.action==='poll'){
   if(input.cursor===null)session.cursor=null
   else if(input.cursor&&Number.isFinite(input.cursor.x)&&Number.isFinite(input.cursor.y))session.cursor={x:input.cursor.x,y:input.cursor.y}
  }else if(input.action==='lock'){
   const id=input.node
   if(id!==null&&!room.state.config.graph.nodes.some(n=>n.id===id))throw failure(404,'节点已不存在')
   const conflict=id&&blocked([id])
   if(conflict)throw failure(423,(room.sessions.get(room.locks.get(conflict))?.user.name||'其他同事')+' 正在编辑此节点')
   for(const [key,owner] of room.locks)if(owner===input.session)room.locks.delete(key)
   if(id)room.locks.set(id,input.session)
   session.selected=id
  }else if(input.action==='apply'){
   if(room.state.saveIntent)throw failure(425,'正在确认 GitLab 保存结果，请稍后同步或重新加入后继续保存')
   if(typeof input.operation!=='string'||!input.operation||input.operation.length>80||!Array.isArray(input.changes)||input.changes.length>10000)throw failure(400,'协作修改格式无效')
   const fingerprint=createHash('sha256').update(JSON.stringify(input.changes)).digest('hex')
   const receipt=room.state.receipts.find(r=>r.id===input.operation)
   if(receipt){if(receipt.user!==user.id||receipt.fingerprint!==fingerprint)throw failure(409,'操作编号已被使用');return this.view(room,input.session)}
   if(!input.changes.length)return this.view(room,input.session)
   const config=apply(room.state.config,input.changes);this.validate(config)
   const conflict=blocked(affected(room.state.config,input.changes))
   if(conflict)throw failure(423,'关联节点正被其他同事编辑，请稍后重试')
   // The selected node is a persistent lease; additional entities are acquired
   // atomically for this command under this document queue.
   const next={...room.state,config,revision:room.state.revision+1,contributors:[...new Set([...room.state.contributors,session.user.name])],receipts:[...room.state.receipts.slice(-199),{id:input.operation,user:user.id,fingerprint}]}
   await this.storage.save(name,next);room.state=next
  }else if(input.action==='saveBegin'){
   session.until=now+90000
   if(!room.state.saveIntent){
    if(input.revision!==room.state.revision)throw failure(409,'其他同事刚刚更新了内容，请同步后再保存')
    if(room.state.revision!==room.state.savedRevision){
     const saveIntent={id:randomUUID(),revision:room.state.revision,base:{sha:room.state.base.sha,commit:room.state.base.commit},config:room.state.config,contributors:room.state.contributors}
     const next={...room.state,saveIntent};await this.storage.save(name,next);room.state=next
    }
   }
  }else if(input.action==='saveComplete'){
   const intent=room.state.saveIntent
   if(!intent||intent.id!==input.intent)throw failure(409,'保存操作已变化，请重新同步')
   const base=await repository.load(name)
   if(!equal(base.config,intent.config))throw failure(409,'GitLab 保存结果与共享草稿不一致，已保留待核对状态')
   const next={...room.state,base,savedRevision:intent.revision,contributors:[],saveIntent:null}
   await this.storage.save(name,next);room.state=next
  }else if(input.action==='save'){
   if(input.revision!==room.state.revision)throw failure(409,'其他同事刚刚更新了内容，请同步后再保存')
   if(room.state.savedRevision!==room.state.revision){
    const base=await repository.save(name,room.state.base,room.state.config,room.state.contributors,session.user)
    const next={...room.state,base,savedRevision:room.state.revision,contributors:[]}
    await this.storage.save(name,next);room.state=next
   }
  }else throw failure(400,'未知协作操作')
  return this.view(room,input.session,input.knownRevision)
 }
 view(room,id,knownRevision){
  return {...room.state,config:knownRevision===room.state.revision?undefined:room.state.config,receipts:undefined,base:{sha:room.state.base.sha,commit:room.state.base.commit},session:id,leaseMs:this.leaseMs,participants:[...room.sessions].map(([session,s])=>({session,name:s.user.name,cursor:s.cursor,selected:s.selected})),locks:Object.fromEntries(room.locks)}
 }
}
