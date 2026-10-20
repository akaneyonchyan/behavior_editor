import {inferLoopScope,convertToPrecheck} from './loopStructure'
import {externalExit} from './externalExits'

// Explicit transaction: keep a complete archive and preserve port destinations.
export function separateLoopLogic(nodes,edges,layout,id){
 const node=nodes.find(n=>n.id===id)
 if(node?.type!=='loop'||node.data.loopVersion===3)throw new Error('请选择尚未迁移的循环')
 const scope=layout?.scopes?.find(s=>s.loopId===id)||inferLoopScope(nodes,edges,id)
 const converted=convertToPrecheck(nodes,edges,scope),d=node.data
 const added=[],addedEdges=[],memberIds=[],used=new Set(nodes.map(n=>n.id))
 const unique=base=>{let name=base,i=1;while(used.has(name))name=base+'_'+i++;used.add(name);return name}
 const link=(source,sourceHandle,target)=>addedEdges.push({id:crypto.randomUUID(),source,sourceHandle,target})
 const gate=(kind,name,rules,text,labels)=>{
  const gateId=unique(id+'_'+kind),attributes=(rules||[]).map((r,i)=>({...r,id:kind+'_'+i}))
  const gateNode={id:gateId,type:'judge',position:{x:node.position.x+360,y:node.position.y},data:{
   name,description:text||'',judgeAttributes:attributes.map(({influence,...r})=>r),
   branches:labels.map((name,i)=>({id:kind+'_'+i,name,weightExpectation:kind==='rest'?(i===0?d.restExpectation||'待定':'其余情况'):'按条件判定',
    weightFactors:attributes.map(a=>({...a,attributeId:a.id,influence:(i===0?'满足条件：':'不满足条件：')+a.influence}))})),
   legacyGate:{kind,condition:text||'',rules:structuredClone(rules||[]),...(kind==='rest'?{probability:d.restProbability,expectation:d.restExpectation}:{failureReason:d.failureReason})}
  }}
  added.push(gateNode);memberIds.push(gateId);return gateNode
 }
 const destination=(gateNode,branch,handle)=>{
  const exit=externalExit(d,handle),edge=converted.edges.find(e=>e.source===id&&e.sourceHandle===handle)
  if(exit)gateNode.data.externalExits=[...(gateNode.data.externalExits||[]),{...exit,handle:branch}]
  else if(edge)link(gateNode.id,branch,edge.target)
 }
 let entry=scope.entry
 if(d.restEnabled!==false){
  const rest=gate('rest','稍息判断',d.restRules,d.restCondition,['稍息','继续执行'])
  destination(rest,'rest_0','rest');link(rest.id,'rest_1',entry);entry=rest.id
  if(!externalExit(d,'rest')&&!converted.edges.some(e=>e.source===id&&e.sourceHandle==='rest')){
   const waitId=unique(id+'_wait');added.push({id:waitId,type:'wait',position:{x:node.position.x+720,y:node.position.y+200},data:{name:'个性待机'}});memberIds.push(waitId);link(rest.id,'rest_0',waitId);link(waitId,undefined,id)
  }
 }
 if(d.admissionEnabled!==false){
  const admission=gate('admission','准入判断',d.resourceRules,[d.resourceCheck,d.failureReason&&'不满足原因：'+d.failureReason].filter(Boolean).join('\n'),['满足','不满足'])
  link(admission.id,'admission_0',entry);destination(admission,'admission_1','insufficient');entry=admission.id
 }
 const archive={data:structuredClone(d),edges:structuredClone(edges.filter(e=>e.source===id||e.target===id)),scope:structuredClone(scope)}
 const {resourceCheck,resourceRules,failureReason,admissionEnabled,restEnabled,restExpectation,restCondition,restRules,restProbability,...remaining}=converted.nodes.find(n=>n.id===id).data
 const data={...remaining,loopVersion:3,loopMode:'goal',maxIterations:'',legacyLoopLogic:archive,externalExits:(d.externalExits||[]).filter(e=>['complete','continue'].includes(e.handle))}
 const nextScope={...scope,entry,members:[...scope.members,...memberIds]}
 return {nodes:[...converted.nodes.map(n=>n.id===id?{...n,data}:n),...added],edges:[...converted.edges.filter(e=>e.source!==id||!['rest','insufficient'].includes(e.sourceHandle)).map(e=>e.source===id&&e.sourceHandle==='continue'?{...e,target:entry}:e),...addedEdges],
  layout:{version:1,scopes:[...(layout?.scopes||[]).filter(s=>s.loopId!==id).map(s=>s.members.includes(id)?{...s,members:[...s.members,...memberIds]}:s),nextScope],positions:{}}}
}
