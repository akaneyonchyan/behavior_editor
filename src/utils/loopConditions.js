// Ordered OR: evaluate in list order and stop at the first satisfied condition.
export const defaultLoopConditions=()=>[
 {id:'goal',kind:'goal',condition:'',rules:[]},
 {id:'count',kind:'count',maxIterations:''}
]
export function loopConditions(data){
 if(Array.isArray(data.loopConditions))return data.loopConditions
 return data.loopMode==='count'?[{id:'count',kind:'count',maxIterations:data.maxIterations||''}]:[{id:'goal',kind:'goal',condition:data.completionCondition||'',rules:data.completionRules||[]}]
}
export function firstSatisfiedLoopCondition(conditions,isSatisfied){
 for(const condition of conditions)if(isSatisfied(condition))return condition.id
 return null
}
