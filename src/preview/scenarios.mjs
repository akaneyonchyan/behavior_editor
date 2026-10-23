import {RhythmScheduler} from './rhythmScheduler.mjs'
import {GoalScheduler,makeScenarioWorld} from './scheduler.mjs'
import {CATALOG} from './integration.mjs'
import {addBuff} from './state.mjs'
import {executeService} from './preparation.mjs'

// Explicit test fixtures, never an automatic mutation in the live day scheduler.
export function scenario(files,lib,name,params={}){
 const c=new (params.rhythm?RhythmScheduler:GoalScheduler)(files,lib,makeScenarioWorld(lib,{initial:50},files),'pip',params,{dayMode:true,scenarioOnly:true,daySeconds:1440})
 c.goals=[]
 const p=CATALOG.find(x=>x.name===name)?.id,a=c.world.find(x=>x.id===c.actor),target=c.world.find(e=>e.name==='桌子'),tree=c.world.find(e=>e.name==='乔木')
 if(target){target.attrs.durability=30;target.attrs.cleanliness=30;a.previewTarget=target.id}
 for(const [id,buff]of [['dizzy','design_dizzy'],['showoff','buff_showoff'],['laugh','emotion_super_happy']])if(p===id)addBuff(a,buff,0,'逐图验证场景')
 if(['put','repair','clean'].includes(p))executeService({action:'equip',tool:'斧头'},c.world,c.actor)
 if(p==='unstick'){
  const axe=c.world.find(e=>e.name==='斧头');axe.location='stuck:'+tree.id;tree.stuckTool=axe.id;tree.attrs.reczz28PBpzFKg4B='1';addBuff(tree,'buff_be_stuck',0,'逐图验证场景');addBuff(axe,'buff_stuck',0,'逐图验证场景')
 }
 c.log('验证场景：为指定行为设置测试初始状态；不会覆盖当前日常场景或源文件。')
 c.requestBehavior(name);return c
}
export function validateFile(files,lib,f){
 const runs=[42,1,7].map(seed=>{
  const c=scenario(files,lib,f.name,{seed})
  for(let i=0;i<14400;i++){c.tick(.1);if(c.completed.some(x=>x.file===f.name)&&!c.goal||c.cooldowns['request:'+f.name])break}
  const rows=c.completed.filter(x=>x.file===f.name),passed=!!rows.length&&!c.goal&&!c.cooldowns['request:'+f.name]
  return {seed,passed,steps:c.completed.map(x=>({file:x.file,status:x.status})),reason:passed?'实际目标达成':c.active?.error||c.logs.find(l=>/冷却|前置|无法|没有可执行/.test(l.text))?.text||'目标未达成',notes:c.files.find(x=>x.name===f.name)?.notes||[]}
 })
 const successful=runs.find(r=>r.passed)
 return {name:f.name,sha:f.sha,passed:!!successful,steps:(successful||runs[0]).steps,reason:successful?'三组种子中 '+runs.filter(r=>r.passed).length+'/3 达成目标；失败/跳出保留真实结果':runs[0].reason,notes:runs[0].notes,runs}
}
export function validateCatalog(files,lib){return files.map(f=>validateFile(files,lib,f))}
