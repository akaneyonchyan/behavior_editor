import {externalExit} from './externalExits'

export function migrateLoopReturns(nodes,edges,scopes){
 const byId=new Map(nodes.map(n=>[n.id,n]))
 return edges.map(e=>{
  if(byId.get(e.source)?.type==='end'||externalExit(byId.get(e.source)?.data||{},e.sourceHandle))return e
  const scope=scopes.filter(s=>s.entry===e.target&&s.members.includes(e.source)&&e.source!==s.loopId).sort((a,b)=>a.members.length-b.members.length)[0]
  return scope?{...e,target:scope.loopId,targetHandle:undefined}:e
 })
}
// Only a member's real output may connect to its immediate owner's repeat glyph.
export function loopReturnConnection(connection,nodes,scopes,visualNodes){
 const target=visualNodes.find(n=>n.id===connection.target)
 if(target?.type!=='loopPortal'||target.data.kind!=='repeat')return null
 const visualSource=visualNodes.find(n=>n.id===connection.source)
 if(!visualSource||visualSource.type==='loopPortal')return null
 const source=nodes.find(n=>n.id===(visualSource.data?.scope?.loopId||visualSource.id))
 if(!source||!['judge','result','wait','loop'].includes(source.type))return null
 const owner=scopes.filter(s=>s.members.includes(source.id)).sort((a,b)=>a.members.length-b.members.length)[0]
 if(owner?.loopId!==target.data.loopId||externalExit(source.data,connection.sourceHandle))return null
 const handle=connection.sourceHandle||''
 if(source.type==='judge'&&!source.data.branches?.some(b=>b.id===handle))return null
 if(source.type==='loop'&&handle!=='complete')return null
 if(['result','wait'].includes(source.type)&&handle)return null
 return {source:source.id,sourceHandle:handle||undefined,target:owner.loopId}
}

