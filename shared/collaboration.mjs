// Entity-level optimistic concurrency: edits to different nodes commute.
export const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
export function entities(config){
 const result=new Map([['behavior',config.behavior],['layout',config.graph.layout??null]])
 for(const kind of ['nodes','edges'])for(const item of config.graph[kind])result.set(kind+':'+item.id,item)
 return result
}
export function diff(before,after){
 const a=entities(before),b=entities(after)
 return [...new Set([...a.keys(),...b.keys()])].filter(k=>!equal(a.get(k)??null,b.get(k)??null)).map(key=>({key,before:a.get(key)??null,after:b.get(key)??null}))
}
export function apply(config,changes){
 const values=entities(config)
 for(const c of changes){
  if(!c||typeof c.key!=='string'||!Object.hasOwn(c,'before')||!Object.hasOwn(c,'after'))throw Object.assign(new Error('协作修改格式无效'),{status:400})
  if((c.key.startsWith('nodes:')||c.key.startsWith('edges:'))&&[c.before,c.after].some(v=>v!==null&&v.id!==c.key.slice(6)))throw Object.assign(new Error('节点或连线 ID 不匹配'),{status:400})
  if(!equal(values.get(c.key)??null,c.before))throw Object.assign(new Error('内容已变化，请保留本机副本并重新加入协作'),{status:409})
  if(c.after===null)values.delete(c.key);else values.set(c.key,c.after)
 }
 const graph={...config.graph,nodes:[],edges:[]}
 for(const [key,value] of values){if(key.startsWith('nodes:'))graph.nodes.push(value);if(key.startsWith('edges:'))graph.edges.push(value)}
 if(values.get('layout'))graph.layout=values.get('layout');else delete graph.layout
 return {...config,behavior:values.get('behavior'),graph}
}
export function affected(config,changes){
 const ids=new Set(),start=config.graph.nodes.find(n=>n.type==='start')?.id
 for(const c of changes){
  if(c.key==='behavior')ids.add(start)
  else if(c.key==='layout')for(const n of config.graph.nodes)ids.add(n.id)
  else if(c.key.startsWith('nodes:'))ids.add(c.key.slice(6))
  else if(c.key.startsWith('edges:')){for(const e of [c.before,c.after])if(e){ids.add(e.source);ids.add(e.target)}}
  else throw Object.assign(new Error('不支持的协作修改'),{status:400})
 }
 return [...ids].filter(Boolean)
}
