export const INFLUENCE_TYPES=['数值高','数值低','具体值']
export const INFLUENCE_RULES=['概率越高','概率越低','允许选中','排除选中','不影响']
const mapping={
 '越高，概率越大':['数值高','概率越高'],
 '越低，概率越大':['数值低','概率越高'],
 '越高，概率越小':['数值高','概率越低'],
 '越低，概率越小':['数值低','概率越低'],
 '指定值，概率提高':['具体值','概率越高'],
 '指定值，概率降低':['具体值','概率越低'],
 '越高，越容易触发':['数值高','概率越高'],
 '越高，越不容易触发':['数值高','概率越低'],
 '处于指定状态时，更容易触发':['具体值','概率越高'],
 '处于指定状态时，更不容易触发':['具体值','概率越低'],
 '不影响':['','不影响'],
}
// Keep the old description for lossless compatibility. New fields are authoritative.
export function splitInfluence(f){
 if(typeof f.influenceType==='string'&&typeof f.influenceRule==='string')return f
 const [type,rule]=mapping[f.influence]||['',f.influence||'不影响']
 return {...f,influenceType:f.influenceType??type,influenceRule:f.influenceRule??rule}
}
export function updateInfluence(f,patch){
 const next={...splitInfluence(f),...patch}
 return {...next,influence:[next.influenceType,next.influenceRule].filter(Boolean).join(' · ')}
}
export function normalizeInfluences(config){
 for(const n of config.graph?.nodes||[])for(const b of n.data?.branches||[]){
  if(Array.isArray(b.weightFactors))b.weightFactors=b.weightFactors.map(f=>f.version===2?splitInfluence(f):f)
 }
 return config
}

