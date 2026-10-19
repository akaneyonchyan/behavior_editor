import {isLoopOutputEnabled} from './loopFlow'
// Design-time references, not a simulation of runtime ownership.
export function upstreamOccupancies(nodes,edges,endId){
  const byId=new Map(nodes.map(n=>[n.id,n])),forward=new Map(),reverse=new Map()
  for(const e of edges){
    const source=byId.get(e.source)
    if(!source||!byId.has(e.target)||source.type==='end'||(source.type==='loop'&&e.sourceHandle&&!isLoopOutputEnabled(source.data,e.sourceHandle)))continue
    if(!forward.has(e.source))forward.set(e.source,[])
    if(!reverse.has(e.target))reverse.set(e.target,[])
    forward.get(e.source).push(e.target);reverse.get(e.target).push(e.source)
  }
  const walk=(initial,adj)=>{const seen=new Set(),queue=[...initial];while(queue.length){const id=queue.pop();if(seen.has(id))continue;seen.add(id);queue.push(...(adj.get(id)||[]))}return seen}
  const reachable=walk(nodes.filter(n=>n.type==='start').map(n=>n.id),forward),upstream=walk([endId],reverse)
  if(!reachable.has(endId))return []
  return nodes.filter(n=>['move','result'].includes(n.type)&&reachable.has(n.id)&&upstream.has(n.id)).flatMap(n=>(n.data.occupiedResources||[]).map(r=>({...r,nodeId:n.id,nodeName:n.data.name||n.id})))
}
