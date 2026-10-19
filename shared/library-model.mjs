export const TABLES = ['objects','attributes','buffs']
export function validateLibrary(data) {
  if(!data || data.version!==1)throw new Error('公共库版本无效')
  if(Array.isArray(data.attributes)){
    const invalid=data.attributes.filter(row=>row&& !['数值','枚举'].includes(row.kind))
    if(invalid.length)throw new Error('属性类型请选择数值或枚举；非法条目：'+invalid.map(row=>JSON.stringify({id:row.id,name:row.name,kind:row.kind??null})).join('；'))
  }
  for(const key of TABLES) {
    if(!Array.isArray(data[key])||data[key].length>10000)throw new Error('公共库表无效或条目过多：'+key)
    const ids=new Set(),names=new Set()
    for(const row of data[key]) {
      if(!row || typeof row.id!=='string'||!row.id.trim()||ids.has(row.id)||row.id.length>200)throw new Error('条目标识为空、过长或重复')
      if(typeof row.name!=='string'||!row.name.trim()||names.has(row.name.trim())||row.name.length>200)throw new Error('同一表中的名称不能为空、过长或重复')
      if(typeof row.enabled!=='boolean'||typeof row.description!=='string'||row.description.length>10000)throw new Error('启用状态或说明格式无效')
      if(key!=='objects'&&(!Array.isArray(row.objectTypes)||!row.objectTypes.every(id=>data.objects.some(o=>o.id===id))))throw new Error('适用对象引用无效')
      if(key==='attributes'&&!['数值','枚举'].includes(row.kind))throw new Error('属性类型请选择数值或枚举')
      ids.add(row.id);names.add(row.name.trim())
    }
  }
  if(data.items!==undefined){
    if(!Array.isArray(data.items)||data.items.length>100000)throw new Error('对象名录无效或条目过多')
    const ids=new Set(),names=new Set()
    for(const row of data.items){
      if(!row||typeof row.id!=='string'||!row.id.trim()||row.id.length>500||ids.has(row.id))throw new Error('对象名录标识为空、过长或重复')
      if(!data.objects.some(o=>o.id===row.objectType))throw new Error('对象名录的对象类型引用无效')
      const key=JSON.stringify([row.objectType,typeof row.name==='string'?row.name.trim():null])
      if(typeof row.name!=='string'||!row.name.trim()||row.name.length>200||names.has(key))throw new Error('同一对象类型的对象名称不能为空、过长或重复')
      if(typeof row.enabled!=='boolean'||typeof row.description!=='string'||row.description.length>10000)throw new Error('对象名录启用状态或说明无效')
      ids.add(row.id);names.add(key)
    }
  }
  return data
}
export function canonicalRow(row) {
  if(!row)return null
  return {id:row.id,name:row.name,description:row.description,enabled:row.enabled,...(row.kind!==undefined?{kind:row.kind}:{}),...(row.objectTypes?{objectTypes:[...new Set(row.objectTypes)].sort()}: {})}
}
export const sameRow=(a,b)=>JSON.stringify(canonicalRow(a))===JSON.stringify(canonicalRow(b))
export function canonicalLibrary(lib) {return {version:1,...Object.fromEntries(TABLES.map(k=>[k,lib[k].map(canonicalRow).sort((a,b)=>a.id.localeCompare(b.id))])),items:(lib.items||[]).map(r=>({...canonicalRow(r),objectType:r.objectType})).sort((a,b)=>a.id.localeCompare(b.id))}}
export const sameLibrary=(a,b)=>JSON.stringify(canonicalLibrary(a))===JSON.stringify(canonicalLibrary(b))
export function planChanges(base,desired,current) {
  validateLibrary(base);validateLibrary(desired);validateLibrary(current)
  if(JSON.stringify(canonicalLibrary(base).items)!==JSON.stringify(canonicalLibrary(desired).items))throw new Error('对象名录请在飞书对应对象表中维护，旧后台不支持写入')
  const merged=structuredClone(current),changes=[],conflicts=[]
  for(const table of TABLES) {
    for(const old of base[table])if(!desired[table].some(r=>r.id===old.id))throw new Error('团队库不支持整行删除或整库替换，请改为停用条目')
    for(const after of desired[table]) {
      const before=base[table].find(r=>r.id===after.id)
      if(sameRow(before,after))continue
      const live=current[table].find(r=>r.id===after.id)
      if(sameRow(live,after))continue // A prior request may have succeeded before its response was lost.
      if(!sameRow(live,before)){conflicts.push({table,id:after.id,name:after.name,before,local:after,remote:live||null});continue}
      changes.push({table,before,after:canonicalRow(after)})
      const index=merged[table].findIndex(r=>r.id===after.id)
      if(index<0)merged[table].push(canonicalRow(after));else merged[table][index]=canonicalRow(after)
    }
  }
  if(!conflicts.length)validateLibrary(merged)
  return {changes,conflicts,merged}
}
