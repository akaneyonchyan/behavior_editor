import {externalExit,supportsExit} from '../utils/externalExits'
import { validateFactor } from '../utils/weightFactors'
import { isLoopOutput } from '../utils/loopFlow'
export function validateConfig(config, types) {
  const fail = message => { throw new Error(message) }
  const objectRef=r=>{if(r?.objectName!==undefined&&typeof r.objectName!=='string')fail('对象名必须是文字标识或自定义文字')}
  const strings = value => value === undefined || (Array.isArray(value) && value.every(v => typeof v === 'string'))
  const rules=value=>{
    if(value===undefined)return
    if(!Array.isArray(value))fail('属性规则必须是列表')
    const ids=new Set()
    for(const r of value){
      if(!r||typeof r.id!=='string'||!r.id||ids.has(r.id)||['source','attribute','influence'].some(k=>typeof r[k]!=='string'))fail('属性规则需包含唯一标识、来源、属性名和规则描述')
      objectRef(r);ids.add(r.id)
    }
  }
  if (!config || typeof config.behavior?.name !== 'string' || !Array.isArray(config.graph?.nodes) || !Array.isArray(config.graph?.edges)) fail('文件需包含行为名称、节点和连线列表')
  if (!strings(config.behavior.matchTargets)) fail('行为目标必须是文字列表')
  rules(config.behavior.targetRules)
  const p = config.behavior.preconditions
  if(p?.interactObjectType!==undefined&&typeof p.interactObjectType!=='string')fail('交互对象类型必须是文字标识')
  if(p?.consumableRules!==undefined){
    if(!Array.isArray(p.consumableRules))fail('消耗品规则必须是列表')
    const seen=new Set()
    for(const r of p.consumableRules){if(!r||typeof r.id!=='string'||!r.id||seen.has(r.id)||typeof r.objectType!=='string'||typeof r.requirement!=='string')fail('消耗品规则需包含唯一标识、对象类型和要求');objectRef(r);seen.add(r.id)}
  }
  rules(p?.attributeRules)
  if(p?.interactObjectRules!==undefined){
    if(!Array.isArray(p.interactObjectRules))fail('交互对象规则必须是列表')
    const seen=new Set()
    for(const r of p.interactObjectRules){if(!r||typeof r.id!=='string'||!r.id||seen.has(r.id)||typeof r.objectType!=='string')fail('交互对象规则需要唯一标识和对象类型');objectRef(r);seen.add(r.id)}
  }
  if (p && (typeof p !== 'object' || !strings(p.consumables) || !strings(p.attributes) || (p.interactObject !== undefined && typeof p.interactObject !== 'string'))) fail('行为准入配置格式错误')
  const ids = new Map()
  for (const n of config.graph.nodes) {
    if (typeof n.id !== 'string' || !n.id || ids.has(n.id) || !Object.hasOwn(types, n.type) || !n.data || typeof n.data !== 'object' || Array.isArray(n.data)) fail('节点 ID 重复、类型未知或属性格式错误')
    if (n.position && (!Number.isFinite(n.position.x) || !Number.isFinite(n.position.y))) fail('节点坐标必须是有效数值')
    for (const field of ['name','description','animation','destination','destinationType','loopCondition','resourceCheck','successAnimation','failAnimation']) if (n.data[field] !== undefined && typeof n.data[field] !== 'string') fail('节点属性 ' + field + ' 必须是文字')
    if (!strings(n.data.attributeChanges) || !strings(n.data.releaseResources)) fail('属性变化和释放资源必须是文字列表')
    for(const key of ['effectRules','loopRules','completionRules','resourceRules','restRules'])rules(n.data[key])
    for(const key of ['completionCondition','failureReason','restExpectation','restCondition'])if(n.data[key]!==undefined&&typeof n.data[key]!=='string')fail(key+' 必须是文字')
    if(n.data.admissionEnabled!==undefined&&typeof n.data.admissionEnabled!=='boolean')fail('准入检查启用状态必须为布尔值')
    if(n.data.restEnabled!==undefined&&typeof n.data.restEnabled!=='boolean')fail('稍息启用状态必须为布尔值')
    if(n.data.checkTiming!==undefined&&n.data.checkTiming!=='before')fail('循环判定时机只支持 before；旧图可不填')
    if(n.data.loopVersion!==undefined&&![2,3].includes(n.data.loopVersion))fail('不支持的循环节点版本')
    if(n.data.loopMode!==undefined&&!['count','goal'].includes(n.data.loopMode))fail('循环执行条件只支持最大次数或目标满足情况')
    if(n.data.maxIterations!==undefined&&typeof n.data.maxIterations!=='string')fail('最大次数必须是文字')
    if(n.data.objectType!==undefined&&typeof n.data.objectType!=='string')fail('对象类型必须是文字标识')
    if (n.data.outputs !== undefined && !Array.isArray(n.data.outputs)) fail('产出必须是列表')
    for(const key of ['playMode','playExpectation','endReason','targetCondition'])if(n.data[key]!==undefined&&typeof n.data[key]!=='string')fail(key+' 必须是文字')
    if(n.data.occupiedResources!==undefined){
      if(!Array.isArray(n.data.occupiedResources))fail('占用资源必须是列表')
      const seen=new Set()
      for(const r of n.data.occupiedResources){
        if(!r||typeof r.id!=='string'||!r.id||seen.has(r.id)||typeof r.source!=='string'||typeof r.attribute!=='string')fail('占用资源需要唯一标识、来源和属性名')
        objectRef(r);seen.add(r.id)
      }
    }
    if(n.data.judgeAttributes!==undefined){
      if(!Array.isArray(n.data.judgeAttributes))fail('参与判断的属性必须是列表')
      const selected=new Set()
      for(const a of n.data.judgeAttributes){
        if(!a||typeof a.id!=='string'||!a.id||selected.has(a.id)||typeof a.source!=='string'||typeof a.attribute!=='string')fail('参与判断的属性需要唯一标识、来源和属性名')
        objectRef(a);selected.add(a.id)
      }
    }
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
    if(n.data.externalExits!==undefined){
      if(!Array.isArray(n.data.externalExits))fail('跳出行为配置必须是列表')
      const seen=new Set()
      for(const r of n.data.externalExits){
        if(!r||typeof r.handle!=='string'||!supportsExit(n,r.handle)||seen.has(r.handle)||typeof r.note!=='string')fail('跳出行为出口或说明无效')
        seen.add(r.handle)
      }
    }
    objectRef(n.data);ids.set(n.id, n)
  }
  const layout=config.graph.layout
  if(layout!==undefined){
    if(!layout||layout.version!==1||!Array.isArray(layout.scopes)||!layout.positions||typeof layout.positions!=='object'||Array.isArray(layout.positions))fail('结构布局格式无效')
    const seen=new Set()
    for(const scope of layout.scopes){
      if(scope&&ids.get(scope.loopId)?.type==='loop'&&ids.get(scope.loopId)?.data.loopVersion===3&&scope.entry===''&&Array.isArray(scope.members)&&scope.members.length===0&&!seen.has(scope.loopId)){seen.add(scope.loopId);continue}
      if(!scope||ids.get(scope.loopId)?.type!=='loop'||seen.has(scope.loopId)||typeof scope.entry!=='string'||!Array.isArray(scope.members)||!scope.members.includes(scope.entry)||scope.members.includes(scope.loopId)||new Set(scope.members).size!==scope.members.length||scope.members.some(id=>typeof id!=='string'||!ids.has(id)||ids.get(id).type==='start'))fail('循环范围引用无效')
      seen.add(scope.loopId)
    }
    for(const p of Object.values(layout.positions))if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))fail('结构布局坐标无效')
  }
  const loopPorts=new Set()
  const starts=config.graph.nodes.filter(n=>n.type==='start')
  if(starts.length>1)fail('每个行为只能有一个开始节点')
  if(starts.length&&config.graph.edges.filter(e=>e.source===starts[0].id).length>1)fail('开始节点只能连接一个入口')
  for (const e of config.graph.edges) {
    if (!e || !ids.has(e.source) || !ids.has(e.target)) fail('连线引用了不存在的节点')
    if(externalExit(ids.get(e.source).data,e.sourceHandle))fail('同一出口不能同时连接节点和跳出行为')
    if(ids.get(e.target).type==='start')fail('开始节点不能作为连线终点')
    if(ids.get(e.source).type==='loop'){
      if(ids.get(e.source).data.loopVersion===3&&!['continue','complete'].includes(e.sourceHandle))fail('循环容器仅支持进入循环体和循环结束出口')
      if(e.sourceHandle){
        if(!isLoopOutput(e.sourceHandle))fail('连线引用了不存在的循环出口')
        const key=JSON.stringify([e.source,e.sourceHandle])
        if(loopPorts.has(key))fail('每个循环出口只能连接一个后续节点')
        loopPorts.add(key)
      } // Old unlabelled edges are retained for explicit reassignment.
    }else if(ids.get(e.source).type==='move'){
      if(e.sourceHandle&&e.sourceHandle!=='unreachable')fail('连线引用了不存在的位移出口')
      if(e.sourceHandle==='unreachable'){
        if(ids.get(e.target).type!=='end')fail('目的地不可达必须连接结束节点')
        if(loopPorts.has(e.source))fail('目的地不可达只能连接一个结束节点')
        loopPorts.add(e.source)
      }
    }else if (e.sourceHandle && !ids.get(e.source).data.branches?.some(b => b.id === e.sourceHandle)) fail('连线引用了不存在的分支出口')
  }
}
