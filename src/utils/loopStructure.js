import {isLoopOutputEnabled} from './loopFlow'
import {externalExit} from './externalExits'

export function activeEdges(nodes,edges){
 const byId=new Map(nodes.map(n=>[n.id,n]))
 return edges.filter(e=>{
  const n=byId.get(e.source)
  return n&&byId.has(e.target)&&n.type!=='end'&&!externalExit(n.data,e.sourceHandle)&&(n.type!=='loop'||!e.sourceHandle||isLoopOutputEnabled(n.data,e.sourceHandle))
 })
}
function reachable(start,edges,stop,reverse=false){
 const seen=new Set(),pending=[start]
 while(pending.length){
  const id=pending.pop();if(id===stop||seen.has(id))continue;seen.add(id)
  for(const e of edges)if((reverse?e.target:e.source)===id)pending.push(reverse?e.source:e.target)
 }
 return seen
}
export function inferLoopScope(nodes,edges,loopId,entryOverride){
 const node=nodes.find(n=>n.id===loopId)
 if(node?.type!=='loop')throw new Error('循环节点不存在')
 const outgoing=edges.filter(e=>e.source===loopId&&e.sourceHandle==='continue')
 const entry=entryOverride|| (outgoing.length===1?outgoing[0].target:null)
 if(!entry&&node.data.loopVersion===3&&!outgoing.length)return {loopId,entry:'',members:[]}
 if(!entry||entry===loopId||!nodes.some(n=>n.id===entry&&n.type!=='start'&&n.type!=='end'))throw new Error('请先指定唯一的循环体起点（继续执行出口）。')
 const usable=activeEdges(nodes,edges)
 // Exclude the controller's outgoing edges: the body must lead back to this controller.
 const bodyEdges=usable.filter(e=>e.source!==loopId)
 const forward=reachable(entry,bodyEdges,loopId),backward=reachable(loopId,bodyEdges,null,true)
 const body=nodes.filter(n=>forward.has(n.id)&&backward.has(n.id)&&n.id!==loopId).map(n=>n.id)
 if(!body.includes(entry)&&node.data.loopVersion!==3)throw new Error('循环体没有返回该循环判定的路径，请先核对连线。')
 const members=new Set(body)
 // Include authored terminating branches inside the body, but not terminal end nodes.
 // They remain explicit exits rather than duplicated shared continuations.
 const outsideTargets=new Set(edges.filter(e=>e.source===loopId&&['complete','insufficient'].includes(e.sourceHandle)).map(e=>e.target))
 for(const id of forward){
  const n=nodes.find(n=>n.id===id)
  if(n&&n.type!=='end'&&n.type!=='start'&&!outsideTargets.has(id)&&!edges.some(e=>e.target===id&&!forward.has(e.source)&&e.source!==loopId))members.add(id)
 }
 const rest=edges.find(e=>e.source===loopId&&e.sourceHandle==='rest')?.target
 if(rest&&rest!==loopId){
  const restReach=reachable(rest,bodyEdges,loopId)
  for(const id of restReach){
   if(id===entry||members.has(id))continue
   const n=nodes.find(n=>n.id===id)
   const backToEntry=reachable(entry,bodyEdges,null,true)
   if(n&&n.type!=='end'&&(backward.has(id)||backToEntry.has(id)))members.add(id)
  }
 }
 return {loopId,entry,members:nodes.filter(n=>members.has(n.id)).map(n=>n.id)}
}
export function checkScope(nodes,edges,scope){
 const ids=new Set(nodes.map(n=>n.id)),members=new Set(scope.members)
 if(nodes.find(n=>n.id===scope.loopId)?.data.loopVersion===3&&scope.entry===''&&scope.members.length===0)return scope
 if(nodes.find(n=>n.id===scope.loopId)?.type!=='loop'||!members.has(scope.entry)||members.has(scope.loopId)||scope.members.some(id=>!ids.has(id)||nodes.find(n=>n.id===id)?.type==='start'))throw new Error('循环范围包含失效节点或起点不在范围内。')
 const entries=edges.filter(e=>members.has(e.target)&&!members.has(e.source)&&e.source!==scope.loopId)
 if(entries.some(e=>e.target!==scope.entry))throw new Error('有连线从循环外进入中途节点，请先核对这些入口。')
 for(const e of edges.filter(e=>e.source===scope.loopId)){
  if(['complete','insufficient'].includes(e.sourceHandle)&&members.has(e.target))throw new Error('正常离开／准入不满足的目标不能同时放进本轮循环体。')
 }
 return scope
}
export function convertToPrecheck(nodes,edges,scope){
 checkScope(nodes,edges,scope)
 const node=nodes.find(n=>n.id===scope.loopId),members=new Set(scope.members)
 if(node.data.loopVersion===3&&!scope.entry&&!members.size)return {nodes,edges}
 const continuing=edges.filter(e=>e.source===scope.loopId&&e.sourceHandle==='continue')
 if(continuing.length!==1||continuing[0].target!==scope.entry||externalExit(node.data,'continue'))throw new Error('继续执行出口必须连接指定的循环体起点。')
 const bodyEdges=activeEdges(nodes,edges).filter(e=>e.source!==scope.loopId&&members.has(e.source)&&(members.has(e.target)||e.target===scope.loopId))
 if(node.data.loopVersion!==3&&!reachable(scope.entry,bodyEdges,null).has(scope.loopId))throw new Error('所选循环范围没有返回循环判定的路径。')
 // A second path to the body entry is ambiguous unless it is an authored rest path.
 const restTarget=edges.find(e=>e.source===scope.loopId&&e.sourceHandle==='rest')?.target
 const restNodes=restTarget&&restTarget!==scope.entry?reachable(restTarget,edges.filter(e=>e.source!==scope.loopId),scope.entry):new Set()
 if(edges.some(e=>e.target===scope.entry&&members.has(e.source)&&!restNodes.has(e.source)))throw new Error('循环体内部存在直接返回起点的路径，请先改为返回循环判定。')
 const changes=edges.filter(e=>e.target===scope.entry&&e.source!==scope.loopId)
 const nextEdges=edges.map(e=>changes.includes(e)?{...e,target:scope.loopId,targetHandle:undefined}:e)
 if(node.data.loopVersion===3){
  // Scope confirmation supplies bookkeeping returns; the structure view never draws them.
  for(const n of nodes.filter(n=>members.has(n.id)&&['result','wait'].includes(n.type)))
   if(!edges.some(e=>e.source===n.id)&&!externalExit(n.data,''))nextEdges.push({id:crypto.randomUUID(),source:n.id,target:scope.loopId})
 }
 return {nodes:nodes.map(n=>n.id===scope.loopId?{...n,data:{...n.data,checkTiming:'before',legacyLoopRouting:node.data.legacyLoopRouting||{checkTiming:node.data.checkTiming||'unspecified',edges:changes.map(e=>({...e}))}}}:n),edges:nextEdges}
}
export function resolveScopes(nodes,edges,layout){
 const scopes=[],warnings=[]
 for(const node of nodes.filter(n=>n.type==='loop')){
  try{
   const saved=layout?.scopes?.find(s=>s.loopId===node.id)
   const scope=checkScope(nodes,edges,saved||inferLoopScope(nodes,edges,node.id))
   if(scope.entry&&(!edges.some(e=>e.source===node.id&&e.sourceHandle==='continue'&&e.target===scope.entry)||externalExit(node.data,'continue')))throw new Error('循环体起点与继续执行出口不一致，请重新确认范围。')
   if(node.data.checkTiming!=='before')warnings.push({id:node.id,message:'旧循环：尚未确认先判定，请在右侧设置循环范围并转换。'})
   else if(edges.some(e=>scope.members.includes(e.target)&&!scope.members.includes(e.source)&&e.source!==scope.loopId))warnings.push({id:node.id,message:'仍有入口绕过循环判定，请重新确认先判定。'})
   scopes.push({...scope,confirmed:!!saved})
  }catch(e){warnings.push({id:node.id,message:e.message})}
 }
 const invalid=new Set()
 for(let i=0;i<scopes.length;i++)for(let j=i+1;j<scopes.length;j++){
  const a=new Set([scopes[i].loopId,...scopes[i].members]),b=new Set([scopes[j].loopId,...scopes[j].members])
  if([...a].some(id=>b.has(id))&&((![...a].every(id=>b.has(id))&&![...b].every(id=>a.has(id)))||(a.size===b.size&&[...a].every(id=>b.has(id))))){invalid.add(scopes[i].loopId);invalid.add(scopes[j].loopId)}
 }
 for(const id of invalid)warnings.push({id,message:'循环范围交叉，保留普通连线；请调整范围后再分组。'})
 return {scopes:scopes.filter(s=>!invalid.has(s.loopId)),warnings}
}
