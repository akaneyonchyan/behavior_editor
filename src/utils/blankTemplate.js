import {emptyBehavior} from './behaviorMetadata'
export function blankTemplate(){
  const config=emptyBehavior()
  config.behavior.name='空白行为'
  config.behavior.templateVersion=2
  config.behavior.targetRules=[{id:'goal_initial',source:'',attribute:'',influence:''}]
  const node=(id,type,x,y,data={})=>({id,type,position:{x:x?x-360:0,y},data})
  config.graph.nodes=[
    node('behavior_start','start',0,180),
    node('template_judge','judge',720,180,{judgeAttributes:[],branches:[{id:'branch_1',name:'',weightExpectation:'',weightFactors:[]},{id:'branch_2',name:'',weightExpectation:'',weightFactors:[]}]}),
    node('template_result_1','result',1080,0,{animation:'',playMode:'',effectRules:[],outputs:[]}),
    node('template_result_2','result',1080,380,{animation:'',playMode:'',effectRules:[],outputs:[]}),
    node('template_loop','loop',1440,180,{loopVersion:2,completionCondition:'',completionRules:[],resourceCheck:'',resourceRules:[],failureReason:'',admissionEnabled:true,restEnabled:true,restExpectation:'',restCondition:'',restRules:[],externalExits:[{handle:'insufficient',note:''}]}),
    node('template_wait','wait',1800,560),
    node('template_end','end',1800,0,{animation:'',playMode:'单次',playExpectation:''}),
  ]
  const edge=(source,target,sourceHandle)=>({id:`${source}_${sourceHandle||'next'}`,source,target,...(sourceHandle?{sourceHandle}:{})})
  config.graph.edges=[edge('behavior_start','template_judge'),edge('template_judge','template_result_1','branch_1'),edge('template_judge','template_result_2','branch_2'),edge('template_result_1','template_loop'),edge('template_result_2','template_loop'),edge('template_loop','template_end','complete'),edge('template_loop','template_wait','rest'),edge('template_loop','template_judge','continue'),edge('template_wait','template_judge')]
  return config
}
