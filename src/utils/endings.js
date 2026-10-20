export const END_REASONS=['完成','中断']
export const isLegacyEnd=data=>Object.hasOwn(data,'successAnimation')||Object.hasOwn(data,'failAnimation')
export function endLabel(data){return '结束'}
export function inferredEndReason(edge,nodes){
  const source=nodes.find(n=>n.id===edge.source)
  if(source?.data.legacyGate?.kind==='admission'&&edge.sourceHandle==='admission_1')return '中断'
  if(source?.type!=='loop')return ''
  return edge.sourceHandle==='complete'?'完成':edge.sourceHandle==='insufficient'?'中断':''
}
export function splitLegacyEnd(nodes,edges,id,assignments={},newId=crypto.randomUUID()){
  const node=nodes.find(n=>n.id===id)
  if(node?.type!=='end'||!isLegacyEnd(node.data))throw Error('该节点不是旧版合并结束节点')
  if(nodes.some(n=>n.id===newId))throw Error('新节点标识重复')
  if(edges.some(e=>e.source===id))throw Error('结束节点存在出线，请先检查并移除出线再拆分')
  const incoming=edges.filter(e=>e.target===id)
  const reasons=new Map(incoming.map(e=>[e.id,assignments[e.id]||inferredEndReason(e,nodes)]))
  if(incoming.some(e=>!END_REASONS.includes(reasons.get(e.id))))throw Error('请为每条入线选择要播放的旧表演，无法自动判断的连线不会猜测归属')
  const original=structuredClone(node.data),{successAnimation,failAnimation,endReason,...shared}=original
  const make=(reason,targetId,animation,y)=>({...node,id:targetId,selected:false,position:{...node.position,y},data:{...structuredClone(shared),name:(original.name||'结束')+' · 表演'+(reason==='完成'?'1':'2'),animation:animation??original.animation??'',playMode:original.playMode??'单次',playExpectation:original.playExpectation||'',legacyEndConfig:structuredClone(original)}})
  const done=make('完成',id,successAnimation,node.position?.y||0)
  const interrupted=make('中断',newId,failAnimation,(node.position?.y||0)+(node.height||300)+80)
  return {nodes:nodes.flatMap(n=>n.id===id?[done,interrupted]:[n]),edges:edges.map(e=>e.target===id?{...e,target:reasons.get(e.id)==='中断'?newId:id}:e)}
}
