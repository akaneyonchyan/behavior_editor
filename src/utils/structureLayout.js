import {activeEdges,resolveScopes} from './loopStructure'
import {containerTarget} from './normalizeBehavior'
// Visual-only wrappers and boundary segments; domain graph stays unchanged.
export function scopeNodeId(nodes,id){let prefix='__scope_';while(nodes.some(n=>n.id.startsWith(prefix)))prefix+='_';return prefix+id}
export function structureLayout(nodes,edges,layout={},sizes={},collapsed=[]){
 const {scopes,warnings}=resolveScopes(nodes,edges,layout),byId=new Map(nodes.map(n=>[n.id,n])),collapsedSet=new Set(collapsed)
 const prefix=scopeNodeId(nodes,'')
 const groupId=id=>prefix+id
 const sets=new Map(scopes.map(s=>[s.loopId,new Set([s.loopId,...s.members])]))
 const owners=new Map()
 for(const n of nodes){
  const containing=scopes.filter(s=>sets.get(s.loopId).has(n.id)).sort((a,b)=>a.members.length-b.members.length)
  if(containing.length)owners.set(n.id,containing[0].loopId)
 }
 const parents=new Map()
 for(const s of scopes){
  const enclosing=scopes.filter(p=>p.loopId!==s.loopId&&[...sets.get(s.loopId)].every(id=>sets.get(p.loopId).has(id))).sort((a,b)=>a.members.length-b.members.length)
  if(enclosing.length)parents.set(s.loopId,enclosing[0].loopId)
 }
 const active=activeEdges(nodes,edges).map((e,i)=>({...e,id:e.id||'edge_'+i})),boxes=new Map(),positions=new Map(),output=[]
 const entryId=id=>groupId(id)+'__entry'
 const exitId=(scope,edge)=>groupId(scope)+'__exit_'+edge
 const boundaries=new Map(scopes.map(s=>[s.loopId,[]]))
 const leaving=e=>{
  const result=[]
  let owner=sets.has(e.source)?parents.get(e.source):owners.get(e.source)
  while(owner){
   if(sets.get(owner).has(e.target))break
   result.push(owner);owner=parents.get(owner)
  }
  return result
 }
 const isReturn=e=>scopes.some(s=>s.loopId===e.target&&s.members.includes(e.source))
 for(const e of active.filter(e=>!isReturn(e)))for(const id of leaving(e))boundaries.get(id).push({edgeId:e.id,handle:'exit:'+e.id,label:byId.get(e.source)?.data.name||'分支出口'})
 const rep=(id,scope)=>{
  let owner=owners.get(id)
  if(owner===scope||!owner)return id
  while(parents.has(owner)&&parents.get(owner)!==scope)owner=parents.get(owner)
  return groupId(owner)
 }
 const positionFor=(id,scope)=>{
  const p=layout?.positions?.[id]||positions.get(id)||{x:0,y:0}
  return scope?{x:Math.max(96,p.x),y:Math.max((sizes['header:'+scope]?.height||150)+32,p.y)}:p
 }
 function place(scope){
  const children=scopes.filter(s=>(parents.get(s.loopId)||null)===scope)
  for(const child of children)place(child.loopId)
  const items=[...nodes.filter(n=>n.id!==scope&&(owners.get(n.id)||null)===scope).map(n=>n.id),...children.map(s=>groupId(s.loopId))]
  const set=new Set(items),links=[]
  for(const e of active){
   if(scope&&e.target===scope)continue // Return-to-check must not reverse horizontal ranks
   const from=rep(e.source,scope),to=rep(e.target,scope)
   if(from!==to&&set.has(from)&&set.has(to)&&!links.some(x=>x[0]===from&&x[1]===to))links.push([from,to])
  }
  // Stable topological ranks; cyclic leftovers stay visible without inventing semantics.
  const degree=new Map(items.map(id=>[id,links.filter(x=>x[1]===id).length])),rank=new Map(items.map(id=>[id,0]))
  const pending=items.filter(id=>degree.get(id)===0),visited=new Set()
  while(pending.length){
   const id=pending.shift();visited.add(id)
   for(const [,to] of links.filter(x=>x[0]===id)){rank.set(to,Math.max(rank.get(to),rank.get(id)+1));degree.set(to,degree.get(to)-1);if(degree.get(to)===0)pending.push(to)}
  }
  if(visited.size!==items.length&&items.length)warnings.push({id:scope||null,message:'存在交叉回路，已保留原连线；该区域的横向顺序需核对。'})
  // Honor branch order without cloning merge targets.
  const order=new Map(items.map((id,i)=>[id,i]))
  for(const n of nodes.filter(n=>n.type==='judge'))(n.data.branches||[]).forEach((b,i)=>{
   const edge=active.find(e=>e.source===n.id&&e.sourceHandle===b.id)
   if(edge&&set.has(rep(edge.target,scope)))order.set(rep(edge.target,scope),(order.get(rep(n.id,scope))||0)+i/100)
  })
  let x=scope?120:0,maxHeight=0
  const ranks=[...new Set(rank.values())].sort((a,b)=>a-b)
  for(const r of ranks){
   let y=scope?(sizes['header:'+scope]?.height||150)+32:0,width=0
   const column=items.filter(id=>rank.get(id)===r).sort((a,b)=>order.get(a)-order.get(b))
   for(const id of column){
    const n=byId.get(id),size=boxes.get(id)||sizes[id]||{width:280,height:n?.type==='loop'?720:n?.type==='start'?300:260}
    positions.set(id,{x,y});boxes.set(id,size);y+=size.height+70;width=Math.max(width,size.width)
   }
   maxHeight=Math.max(maxHeight,y);x+=width+100
  }
  if(scope){
   const bounds=items.reduce((b,id)=>{const p=positionFor(id,scope),size=boxes.get(id);return {right:Math.max(b.right,p.x+size.width),bottom:Math.max(b.bottom,p.y+size.height)}},{right:424,bottom:(sizes['header:'+scope]?.height||150)+68})
   boxes.set(groupId(scope),collapsedSet.has(scope)?{width:540,height:Math.max((sizes['header:'+scope]?.height||150)+52,100+boundaries.get(scope).length*28)}:{width:Math.max(540,bounds.right+116),height:Math.max(bounds.bottom+32,(sizes['header:'+scope]?.height||150)+120+boundaries.get(scope).length*48)})
  }

 }
 place(null)
 function emit(scope){
  const children=scopes.filter(s=>(parents.get(s.loopId)||null)===scope)
  for(const child of children){
   const id=groupId(child.loopId),size=boxes.get(id)
   output.push({id,type:'loopScope',position:positionFor(id,scope),...(scope?{parentNode:groupId(scope)}:{}),data:{boundaryExits:boundaries.get(child.loopId),scope:child,collapsed:collapsedSet.has(child.loopId),node:byId.get(child.loopId),count:child.members.length,exits:child.members.reduce((n,id)=>n+(byId.get(id)?.data.externalExits?.length||0),0)+(byId.get(child.loopId)?.data.externalExits?.length||0)},style:{width:size.width,height:size.height},zIndex:-1,selectable:false,deletable:false})
   if(!collapsedSet.has(child.loopId)){
    emit(child.loopId)
    if(child.entry){
     const first=rep(child.entry,child.loopId),pos=positionFor(first,child.loopId),size=boxes.get(first)||{height:260}
     const y=pos.y+(first.startsWith(prefix)?28:size.height/2)-16
     output.push({id:entryId(child.loopId),type:'loopPortal',parentNode:id,position:{x:32,y},data:{kind:'entry'},draggable:false,selectable:false,deletable:false})
    }
    boundaries.get(child.loopId).forEach((exit,i)=>output.push({id:exitId(child.loopId,exit.edgeId),type:'loopPortal',parentNode:id,position:{x:size.width-64,y:(sizes['header:'+child.loopId]?.height||150)+32+i*48},data:{kind:'exit',label:exit.label},draggable:false,selectable:false,deletable:false}))
   }
  }
  for(const n of nodes.filter(n=>n.id!==scope&&(owners.get(n.id)||null)===scope)){
   output.push({...n,position:positionFor(n.id,scope),...(scope?{parentNode:groupId(scope)}:{}),draggable:false,deletable:false})
  }
 }
 emit(null)
 const visible=new Set(output.map(n=>n.id))
 const endpoint=id=>{
  if(visible.has(id))return id
  let owner=owners.get(id)
  while(owner){if(visible.has(groupId(owner)))return groupId(owner);owner=parents.get(owner)}
  return id
 }
 const lines=[]
 const segment=(e,suffix,source,sourceHandle,target,targetHandle)=>{
  if(source!==target)lines.push({...e,id:e.id+suffix,source,sourceHandle,target,targetHandle,type:'default'})
 }
 for(const e of active){
  // Completing an iteration needs no visible return wire.
  if(isReturn(e))continue
  const targetId=containerTarget(scopes,e.source,e.target,e.sourceHandle)
  const target=endpoint(targetId)
  let source=endpoint(e.source),sourceHandle=e.sourceHandle
  const targetHandle=target!==e.target?'in':e.targetHandle
  // Body entry originates at the play glyph, never the container header.
  if(sets.has(e.source)&&e.sourceHandle==='continue'){
   if(!visible.has(entryId(e.source)))continue
   source=entryId(e.source);sourceHandle='out'
  }
  if(source===target)continue
  for(const scope of leaving(e)){
   const group=groupId(scope)
   if(!visible.has(group))continue
   if(visible.has(exitId(scope,e.id)))segment(e,':inside:'+scope,source,sourceHandle,exitId(scope,e.id),'in')
   source=group;sourceHandle='exit:'+e.id
  }
  // A hidden child still exits via its container's matching boundary port.
  segment(e,':outside',source,sourceHandle,target,targetHandle)
 }
 return {nodes:output,edges:lines,warnings,scopes}
}
