import {resolveScopes} from './loopStructure'
import {externalExit} from './externalExits'

export const directOwner=(scopes,id)=>scopes.filter(s=>s.members.includes(id)).sort((a,b)=>a.members.length-b.members.length)[0]?.loopId||null
export function absolutePosition(node,nodes){
 let position={...node.position},parent=node.parentNode,seen=new Set([node.id])
 while(parent&&!seen.has(parent)){
  seen.add(parent);const p=nodes.find(n=>n.id===parent);if(!p)break
  position={x:position.x+p.position.x,y:position.y+p.position.y};parent=p.parentNode
 }
 return position
}
// Hit-test only the dragged node. Moving an empty wrapper never adopts stationary nodes.
export function dropContainer(node,visualNodes,scopes){
 if(node.type==='start')return null
 const p=absolutePosition(node,visualNodes),center={x:p.x+(node.width||node.style?.width||280)/2,y:p.y+(node.height||node.style?.height||180)/2}
 const domainId=node.data?.scope?.loopId||node.id,descendants=new Set(scopes.find(s=>s.loopId===domainId)?.members||[])
 const candidates=visualNodes.filter(n=>n.type==='loopScope'&&n.id!==node.id&&!descendants.has(n.data.scope.loopId)&&!n.data.collapsed).filter(n=>{
  const pos=absolutePosition(n,visualNodes)
  return center.x>=pos.x&&center.x<=pos.x+n.style.width&&center.y>=pos.y+(n.data.headerHeight||150)&&center.y<=pos.y+n.style.height
 })
 // Prefer the deepest container, then the smaller area where siblings overlap.
 candidates.sort((a,b)=>directOwner(scopes,a.data.scope.loopId)===b.data.scope.loopId?-1:directOwner(scopes,b.data.scope.loopId)===a.data.scope.loopId?1:a.style.width*a.style.height-b.style.width*b.style.height)
 return candidates[0]||null
}

export function moveStructureNode(graph,id,targetLoopId,positions){
 const node=graph.nodes.find(n=>n.id===id)
 if(!node)throw new Error('要移动的节点不存在')
 targetLoopId=targetLoopId||null
 const saved=graph.layout?.scopes||[]
 const inferred=resolveScopes(graph.nodes,graph.edges,graph.layout).scopes.filter(s=>!saved.some(x=>x.loopId===s.loopId))
 const scopes=structuredClone([...saved,...inferred].map(({loopId,entry,members})=>({loopId,entry,members})))
 const oldOwner=directOwner(scopes,id),ownScope=scopes.find(s=>s.loopId===id),moving=new Set([id,...(ownScope?.members||[])])
 if(node.type==='start')targetLoopId=null
 if(targetLoopId&&(!scopes.some(s=>s.loopId===targetLoopId)||moving.has(targetLoopId)))throw new Error('不能将循环放入自身或自己的内部循环')
 const layout={version:1,scopes,positions:structuredClone(positions)}
 if(oldOwner===targetLoopId)return {nodes:graph.nodes,edges:graph.edges,layout}
 // Keep only subtree-internal edges when changing ownership. No implicit old-scope continuations.
 let edges=graph.edges.filter(e=>moving.has(e.source)===moving.has(e.target))
 const removed=graph.edges.filter(e=>!edges.includes(e))
 let nodes=graph.nodes.map(n=>{
  if(!removed.some(e=>e.source===n.id))return n
  const data={...n.data}
  if(data.nextNode&&removed.some(e=>e.source===n.id&&e.target===data.nextNode))data.nextNode=''
  if(data.branches)data.branches=data.branches.map(b=>removed.some(e=>e.source===n.id&&e.sourceHandle===b.id)?{...b,nextNode:''}:b)
  return {...n,data}
 })
 for(const s of scopes)if(!moving.has(s.loopId))s.members=s.members.filter(member=>!moving.has(member))
 if(targetLoopId){
  const target=scopes.find(s=>s.loopId===targetLoopId)
  const parents=scopes.filter(s=>s.members.includes(targetLoopId))
  for(const s of [target,...parents])s.members=[...new Set([...s.members,...moving])]
 }
 for(const s of scopes){
  if(moving.has(s.loopId))continue // A moved nested container retains its internal graph.
  const direct=s.members.filter(member=>directOwner(scopes,member)===s.loopId)
  if(!s.members.includes(s.entry))s.entry=direct.find(member=>!edges.some(e=>e.target===member&&direct.includes(e.source)))||direct[0]||''
  const existing=edges.find(e=>e.source===s.loopId&&e.sourceHandle==='continue')
  if(existing?.target!==s.entry){
   edges=edges.filter(e=>!(e.source===s.loopId&&e.sourceHandle==='continue'))
   if(s.entry){
    nodes=nodes.map(n=>n.id===s.loopId?{...n,data:{...n.data,externalExits:(n.data.externalExits||[]).filter(x=>x.handle!=='continue')}}:n)
    edges.push({id:crypto.randomUUID(),source:s.loopId,sourceHandle:'continue',target:s.entry})
   }
  }
 }
 // A terminal execution/wait completes an iteration in its new owner. Never reconnect an old branch.
 if(targetLoopId&&['result','wait'].includes(node.type)&&!externalExit(node.data,'')&&!edges.some(e=>e.source===id))edges.push({id:crypto.randomUUID(),source:id,target:targetLoopId})
 return {nodes,edges,layout}
}
