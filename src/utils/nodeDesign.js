import { designFactor } from './weightFactors'
export const PROBABILITIES = ['极高','高','中','低','极低']
export const EFFECTS = ['越高，概率越大','越低，概率越大','指定值，概率提高','指定值，概率降低','不影响']
export const CHANGES = ['增','减']
export const PLAY_MODES = ['单次','计次','计时']
// Derive a common list for old files without changing the saved branch effects.
export function judgeAttributes(data) {
  if(Array.isArray(data.judgeAttributes))return data.judgeAttributes
  const result=[]
  for(const b of data.branches||[])for(const original of b.weightFactors||[]){
    const f=designFactor(original)
    if(!result.some(a=>a.source===f.source&&a.attribute===f.attribute))result.push({id:`shared_${result.length}`,source:f.source,attribute:f.attribute})
  }
  return result
}
export function branchFactors(branch,attributes) {
  return attributes.map(a=>{
    const old=(branch.weightFactors||[]).map(designFactor).find(f=>f.attributeId===a.id||(!f.attributeId&&f.source===a.source&&f.attribute===a.attribute))
    return {...old,version:2,id:old?.id||a.id,attributeId:a.id,source:a.source,attribute:a.attribute,influence:old?.influence||'不影响'}
  })
}
export function setJudgeAttributes(data,attributes) {
  // Match legacy rows before applying source/name edits to the shared list.
  const previous=judgeAttributes(data)
  return {judgeAttributes:attributes,branches:(data.branches||[]).map(b=>({...b,weightFactors:branchFactors({...b,weightFactors:branchFactors(b,previous)},attributes)}))}
}
export function resultRules(data,kind) {
  return (data.effectRules||[]).filter(r=> (r.kind||(r.attribute?.startsWith('buff:')?'buff':'attribute'))===kind)
}
