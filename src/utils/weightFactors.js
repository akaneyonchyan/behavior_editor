export const SOURCES = [
  ['actor','执行伙伴'], ['partner','互动伙伴'], ['interactObject','交互对象'],
  ['handheld','手持物'], ['consumable','消耗品'], ['custom','指定对象']
]
export const INFLUENCES = ['越高，越容易触发', '越高，越不容易触发', '处于指定状态时，更容易触发', '处于指定状态时，更不容易触发']
export const EXPECTATIONS = ['待定','很少发生','较少发生','通常发生','较容易发生','优先发生']
export const newFactor = () => ({ version:2, id:crypto.randomUUID(), source:'actor', attribute:'energy', influence:INFLUENCES[0] })
export function designFactor(f) {
  if(f.version===2)return f
  const source = (SOURCES.find(([v])=>v===f.source)?.[1] || f.source || '待指定来源') + (f.objectRef ? ' · '+f.objectRef : '')
  const influence = f.rule==='positive' ? INFLUENCES[0] : f.rule==='negative' ? INFLUENCES[1] : '满足指定条件时调整触发倾向（待说明）'
  return {version:2,id:f.id,source,attribute:typeof f.attribute==='string'?f.attribute:'',influence,legacyConfig:f}
}
export function validateFactor(f) {
  if (!f || typeof f !== 'object' || Array.isArray(f)) return '属性影响规则必须是对象'
  if(f.version!==2)return '' // Old numeric configuration is preserved without reinterpreting its calculation.
  if(typeof f.source!=='string'||typeof f.attribute!=='string'||typeof f.influence!=='string')return '属性规则需要来源、属性名、影响方式三项文字'
  return ''
}
export function factorSummary(f, attributes=[]) {
  const rule=designFactor(f)
  const source=SOURCES.find(([v])=>v===rule.source)?.[1]||rule.source||'待指定来源'
  const attribute=attributes.find(a=>a.value===rule.attribute)?.label||rule.attribute||'待指定属性'
  return source+' · '+attribute+' · '+(rule.influence||'待说明影响方式')
}

