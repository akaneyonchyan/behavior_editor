export const LOOP_OUTPUTS = [
  {id:'complete',label:'目标达成 → 成功结算'},
  {id:'insufficient',label:'资源不足 → 失败结算'},
  {id:'rest',label:'触发稍息 → 待机'},
  {id:'continue',label:'不稍息 → 继续执行'}
]
export const isLoopOutput=id=>LOOP_OUTPUTS.some(o=>o.id===id)
// Ordered short-circuit semantics. These booleans are outcomes, not numeric simulation.
export function resolveLoopOutput({complete,resourcesEnough,restTriggered},restEnabled=true) {
  if(complete)return 'complete'
  if(!resourcesEnough)return 'insufficient'
  return restEnabled&&restTriggered?'rest':'continue'
}
