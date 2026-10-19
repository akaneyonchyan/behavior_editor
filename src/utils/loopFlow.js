export const LOOP_OUTPUTS = [
  {id:'complete',label:'目标达成 → 成功结算'},
  {id:'insufficient',label:'准入不满足 → 结束收尾'},
  {id:'rest',label:'触发稍息 → 待机'},
  {id:'continue',label:'不稍息 → 继续执行'}
]
export const isLoopOutput=id=>LOOP_OUTPUTS.some(o=>o.id===id)
export const isLoopOutputEnabled=(data,handle)=>isLoopOutput(handle)&&!(handle==='rest'&&data.restEnabled===false)&&!(handle==='insufficient'&&data.admissionEnabled===false)
// Ordered short-circuit semantics. These booleans are outcomes, not numeric simulation.
export function resolveLoopOutput({complete,admissionSatisfied,resourcesEnough,restTriggered},restEnabled=true,admissionEnabled=true) {
  if(complete)return 'complete'
  if(admissionEnabled&&!(admissionSatisfied??resourcesEnough))return 'insufficient'
  return restEnabled&&restTriggered?'rest':'continue'
}
