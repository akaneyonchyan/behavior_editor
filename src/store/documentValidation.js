import { validateFactor } from '../utils/weightFactors'
import { isLoopOutput } from '../utils/loopFlow'
export function validateConfig(config, types) {
  const fail = message => { throw new Error(message) }
  const strings = value => value === undefined || (Array.isArray(value) && value.every(v => typeof v === 'string'))
  const rules=value=>{
    if(value===undefined)return
    if(!Array.isArray(value))fail('属性规则必须是列表')
    const ids=new Set()
    for(const r of value){
      if(!r||typeof r.id!=='string'||!r.id||ids.has(r.id)||['source','attribute','influence'].some(k=>typeof r[k]!=='string'))fail('属性规则需包含唯一标识、来源、属性名和规则描述')
      ids.add(r.id)
    }
  }
  if (!config || typeof config.behavior?.name !== 'string' || !Array.isArray(config.graph?.nodes) || !Array.isArray(config.graph?.edges)) fail('文件需包含行为名称、节点和连线列表')
  if (!strings(config.behavior.matchTargets)) fail('行为目标必须是文字列表')
  const p = config.behavior.preconditions
  rules(p?.attributeRules)
  if (p && (typeof p !== 'object' || !strings(p.consumables) || !strings(p.attributes) || (p.interactObject !== undefined && typeof p.interactObject !== 'string'))) fail('行为准入配置格式错误')
  const ids = new Map()
  for (const n of config.graph.nodes) {
    if (typeof n.id !== 'string' || !n.id || ids.has(n.id) || !Object.hasOwn(types, n.type) || !n.data || typeof n.data !== 'object' || Array.isArray(n.data)) fail('节点 ID 重复、类型未知或属性格式错误')
    if (n.position && (!Number.isFinite(n.position.x) || !Number.isFinite(n.position.y))) fail('节点坐标必须是有效数值')
    for (const field of ['name','description','animation','destination','destinationType','loopCondition','resourceCheck','successAnimation','failAnimation']) if (n.data[field] !== undefined && typeof n.data[field] !== 'string') fail('节点属性 ' + field + ' 必须是文字')
    if (!strings(n.data.attributeChanges) || !strings(n.data.releaseResources)) fail('属性变化和释放资源必须是文字列表')
    for(const key of ['effectRules','loopRules','completionRules','resourceRules','restRules'])rules(n.data[key])
    for(const key of ['completionCondition','failureReason','restExpectation','restCondition'])if(n.data[key]!==undefined&&typeof n.data[key]!=='string')fail(key+' 必须是文字')
    if(n.data.restEnabled!==undefined&&typeof n.data.restEnabled!=='boolean')fail('稍息启用状态必须为布尔值')
    if(n.data.loopVersion!==undefined&&n.data.loopVersion!==2)fail('不支持的循环节点版本')
    if(n.data.objectType!==undefined&&typeof n.data.objectType!=='string')fail('对象类型必须是文字标识')
    if (n.data.outputs !== undefined && !Array.isArray(n.data.outputs)) fail('产出必须是列表')
    if (n.data.restProbability !== undefined && (!Number.isFinite(n.data.restProbability) || n.data.restProbability < 0 || n.data.restProbability > 100)) fail('稍息概率必须在 0 到 100 之间')
    if (n.data.branches !== undefined) {
      if (!Array.isArray(n.data.branches)) fail('判断分支必须是列表')
      const branches = new Set()
      for (const b of n.data.branches) {
        if (!b || typeof b.id !== 'string' || !b.id || branches.has(b.id) || typeof b.name !== 'string' || (b.weight !== undefined && (!Number.isFinite(b.weight) || b.weight < 0))) fail('判断分支 ID、名称或旧权重格式错误')
        if (b.weightExpectation !== undefined && typeof b.weightExpectation !== 'string') fail('发生倾向必须是文字')
        if (b.condition !== undefined && typeof b.condition !== 'string') fail('判断条件必须是文字')
        if (b.weightFactors !== undefined) {
          if (!Array.isArray(b.weightFactors)) fail('属性影响必须是列表')
          for (const factor of b.weightFactors) { const issue = validateFactor(factor, false); if (issue) fail(issue) }
        }
        branches.add(b.id)
      }
    }
    ids.set(n.id, n)
  }
  const loopPorts=new Set()
  for (const e of config.graph.edges) {
    if (!e || !ids.has(e.source) || !ids.has(e.target)) fail('连线引用了不存在的节点')
    if(ids.get(e.source).type==='loop'){
      if(e.sourceHandle){
        if(!isLoopOutput(e.sourceHandle))fail('连线引用了不存在的循环出口')
        const key=JSON.stringify([e.source,e.sourceHandle])
        if(loopPorts.has(key))fail('每个循环出口只能连接一个后续节点')
        loopPorts.add(key)
      } // Old unlabelled edges are retained for explicit reassignment.
    }else if (e.sourceHandle && !ids.get(e.source).data.branches?.some(b => b.id === e.sourceHandle)) fail('连线引用了不存在的分支出口')
  }
}
