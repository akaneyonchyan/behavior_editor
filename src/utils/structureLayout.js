import {activeEdges,resolveScopes} from './loopStructure'
// Visual-only wrappers. All domain nodes and edges retain their original IDs.
export function structureLayout(nodes,edges,layout={},sizes={},collapsed=[]){
 const {scopes,warnings}=resolveScopes(nodes,edges,layout),byId=new Map(nodes.map(n=>[n.id,n])),collapsedSet=new Set(collapsed)
 const prefix=(()=>{let s='__scope_';while(nodes.some(n=>n.id.startsWith(s)))s+='_';return s})()
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
 const active=activeEdges(nodes,edges),boxes=new Map(),positions=new Map(),output=[]
 const rep=(id,scope)=>{
  let owner=owners.get(id)
  if(owner===scope||!owner)return id
  while(parents.has(owner)&&parents.get(owner)!==scope)owner=parents.get(owner)
  return groupId(owner)
 }
 function place(scope){
  const children=scopes.filter(s=>(parents.get(s.loopId)||null)===scope)
  for(const child of children)place(child.loopId)
  const items=[...nodes.filter(n=>(owners.get(n.id)||null)===scope).map(n=>n.id),...children.map(s=>groupId(s.loopId))]
  const set=new Set(items),links=[]
  for(const e of active){
   if(scope&&e.target===scope)continue // return-to-check remains drawn but doesn't reverse horizontal ranks
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
  let x=scope?32:0,maxHeight=0
  const ranks=[...new Set(rank.values())].sort((a,b)=>a-b)
  for(const r of ranks){
   let y=scope?88:0,width=0
   const column=items.filter(id=>rank.get(id)===r).sort((a,b)=>order.get(a)-order.get(b))
   for(const id of column){
    const n=byId.get(id),size=boxes.get(id)||sizes[id]||{width:280,height:n?.type==='loop'?720:n?.type==='start'?300:260}
    positions.set(id,{x,y});boxes.set(id,size);y+=size.height+70;width=Math.max(width,size.width)
   }
   maxHeight=Math.max(maxHeight,y);x+=width+100
  }
  if(scope)boxes.set(groupId(scope),collapsedSet.has(scope)?{width:360,height:180}:{width:Math.max(420,x-68),height:Math.max(220,maxHeight-38)})
 }
 place(null)
 function emit(scope){
  const children=scopes.filter(s=>(parents.get(s.loopId)||null)===scope)
  for(const child of children){
   const id=groupId(child.loopId),size=boxes.get(id)
   output.push({id,type:'loopScope',position:layout?.positions?.[id]||positions.get(id),...(scope?{parentNode:groupId(scope)}:{}),data:{scope:child,collapsed:collapsedSet.has(child.loopId),node:byId.get(child.loopId),count:child.members.length,exits:child.members.reduce((n,id)=>n+(byId.get(id)?.data.externalExits?.length||0),0)+(byId.get(child.loopId)?.data.externalExits?.length||0)},style:{width:size.width,height:size.height},zIndex:-1,selectable:false,deletable:false})
   if(!collapsedSet.has(child.loopId))emit(child.loopId)
  }
  for(const n of nodes.filter(n=>(owners.get(n.id)||null)===scope)){
   output.push({...n,position:layout?.positions?.[n.id]||positions.get(n.id)||{x:0,y:0},...(scope?{parentNode:groupId(scope)}:{}),draggable:false,deletable:false})
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
 const lines=active.map(e=>{
  const source=endpoint(e.source),target=endpoint(e.target)
  if(source===target&&e.source!==e.target)return null
  return {...e,source,target,sourceHandle:source!==e.source?'out':e.sourceHandle,targetHandle:target!==e.target?'in':e.targetHandle,type:'default',...(scopes.some(s=>s.loopId===e.target&&s.members.includes(e.source))?{label:'返回判定'}:{})}
 }).filter(Boolean)
 return {nodes:output,edges:lines,warnings,scopes}
}
