export const GOAL_TYPES=['增加','减少','改变']
export const CONSUMPTION_TYPES=['有可用存量','足够完成一次行为','持续消耗直至目标达成']
export const initialGoal=()=>({id:'goal_initial',source:'',attribute:'',influence:'增加'})
export function normalizeMetadata(info){
  const p=info.preconditions||{}
  const goals=[...(info.targetRules||[]),...(info.matchTargets||[]).filter(t=>t.trim()).map((t,i)=>({id:`legacy_goal_${i}`,source:'',attribute:'',influence:t}))]
  const objects=[...(p.interactObjectRules||[])]
  if(p.interactObjectType)objects.push({id:'legacy_object_type',objectType:p.interactObjectType})
  if(p.interactObject?.trim())objects.push({id:'legacy_object_text',objectType:p.interactObject})
  return {...info,matchTargets:[],targetRules:goals.length?goals:[initialGoal()],preconditions:{...p,interactObject:'',interactObjectType:'',consumables:[],attributes:[],interactObjectRules:objects,consumableRules:[...(p.consumableRules||[]),...(p.consumables||[]).filter(t=>t.trim()).map((t,i)=>({id:`legacy_consumable_${i}`,objectType:'',requirement:t}))],attributeRules:[...(p.attributeRules||[]),...(p.attributes||[]).filter(t=>t.trim()).map((t,i)=>({id:`legacy_condition_${i}`,source:'',attribute:'',influence:t}))]}}
}
export function ensureStart(nodes,edges){
  const existing=nodes.find(n=>n.type==='start')
  if(existing)return {nodes:nodes.map(n=>n.type==='start'?{...n,deletable:false}:n),edges}
  let id='behavior_start';while(nodes.some(n=>n.id===id))id+='_'
  const x=nodes.length?Math.min(...nodes.map(n=>n.position.x))-380:80
  const y=nodes.length?Math.min(...nodes.map(n=>n.position.y)):80
  const start={id,type:'start',position:{x,y},data:{},deletable:false}
  const roots=nodes.filter(n=>!edges.some(e=>e.target===n.id))
  return {nodes:[start,...nodes],edges:roots.length===1?[{id:'start_entry_'+id,source:id,target:roots[0].id},...edges]:edges}
}
export const emptyBehavior=()=>({behavior:normalizeMetadata({name:'未命名行为',preconditions:{}}),graph:ensureStart([],[])})
