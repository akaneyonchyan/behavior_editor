import {normalizeInfluences} from './influenceRules'
import {loopConditions} from './loopConditions'
import {separateLoopLogic} from './loopMigration'
import {inferLoopScope} from './loopStructure'

// All file entry points share this pure adapter. Source files are never written here.
export function normalizeBehavior(input){
 const config=structuredClone(input)
 let g=config.graph
 for(const n of [...g.nodes]){
  if(n.type==='loop'&&n.data.loopVersion!==3){
   try{g={...g,...separateLoopLogic(g.nodes,g.edges,g.layout,n.id,true)}}
   catch(e){throw new Error('循环「'+(n.data.name||n.id)+'」的连接不完整：'+e.message)}
  }
 }
 const scopes=[...(g.layout?.scopes||[])]
 for(const n of g.nodes.filter(n=>n.type==='loop')){
  n.data.checkTiming='before'
  n.data.loopMode=n.data.loopMode||'goal'
  n.data.loopConditions=loopConditions(n.data)
  if(!scopes.some(s=>s.loopId===n.id)){
   try{scopes.push(inferLoopScope(g.nodes,g.edges,n.id))}catch{ /* Incomplete graphs remain editable with normal range validation. */ }
  }
 }
 if(scopes.length||g.layout)g.layout={version:1,scopes,positions:g.layout?.positions||{}}
 g.edges=g.edges.map(e=>{
  const target=containerTarget(scopes,e.source,e.target,e.sourceHandle)
  return target===e.target?e:{...e,target,targetHandle:undefined}
 })
 config.graph=g
 return normalizeInfluences(config)
}

// Enter the outermost crossed container, never a child halfway through its body.
export function containerTarget(scopes,source,target,handle){
 const crossed=(scopes||[]).filter(s=>s.members.includes(target)&&s.loopId!==source&&!s.members.includes(source))
 return crossed.sort((a,b)=>b.members.length-a.members.length)[0]?.loopId||target
}

