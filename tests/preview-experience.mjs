import assert from 'node:assert/strict'
import {Simulation,makeWorld,bindingsFor} from '../src/preview/runtime.mjs'
import {experience,changes,effect,beginRecord,finishRecord,syncWaiting,sourceFor,waitingTitle} from '../src/preview/experience.mjs'
const lib={objects:[{id:'partner',name:'伙伴',enabled:true}],attributes:[{id:'energy',name:'精力',kind:'数值',objectTypes:['partner'],enabled:true}],buffs:[],items:[]}
const rule={source:'object:partner',objectName:'',attribute:'energy',influence:'增'}
const node=(id,type,data={})=>({id,type,data:{name:id,...data}})
const config={behavior:{name:'恢复精力',preconditions:{attributeRules:[]},targetRules:[{...rule,influence:'较高时'}]},graph:{nodes:[node('start','start'),node('judge','judge',{branches:[{id:'yes',name:'休息',weightExpectation:'中',weightFactors:[]},{id:'no',name:'继续休息',weightExpectation:'中',weightFactors:[]}]}),node('action','result',{effectRules:[rule]}),node('end','end')],edges:[{id:'1',source:'start',target:'judge'},{id:'2',source:'judge',sourceHandle:'yes',target:'action'},{id:'3',source:'judge',sourceHandle:'no',target:'action'},{id:'4',source:'action',target:'end'}],layout:{scopes:[]}}}
function sim(){const world=makeWorld(lib);return new Simulation(config,lib,world,bindingsFor(config,lib,world,'pip'),'pip')}
const s=sim(),other=sim();assert.notEqual(s.experience.id,other.experience.id)
const scheduler={actor:'pip',elapsed:1500,goal:{id:'energy',name:'恢复精力',weight:33},pendingSteps:[],experiences:[]}
beginRecord(scheduler,{config},s)
while(!['done','blocked'].includes(s.status))s.step()
assert.equal(s.status,'done');assert.equal(s.experience.status,'done');assert.equal(s.experience.goalResult,'行为目标未满足')
assert.equal(s.experience.effects.length,1);assert.equal(s.experience.effects[0].to,60)
assert.ok(s.experience.events.every(e=>e.time>=1500));assert.match(s.experience.turn,/随机选中/)
assert.equal(s.experience.events.find(e=>e.kind==='branch').candidates.length,2)
assert.equal(scheduler.experiences[0],s.experience)
// A later malformed output rolls back earlier effects and the narrative together.
const failed=sim();failed.step();failed.step();failed.node().data.outputs=['missing-output'];failed.step()
assert.equal(failed.status,'blocked');assert.equal(failed.experience.effects.length,0);assert.equal(failed.world[0].attrs.energy,50)
assert.ok(!failed.experience.events.some(e=>e.text.includes('50 → 60')))
// Waiting is a duration; same reason does not create one card per scheduling tick.
scheduler.status='waiting';scheduler.waitReason='工具被占用';syncWaiting(scheduler);const count=scheduler.experiences.length
scheduler.elapsed+=2;syncWaiting(scheduler);assert.equal(scheduler.experiences.length,count)
scheduler.waitReason='等待冷却';syncWaiting(scheduler);assert.equal(scheduler.experiences.length,count+1);assert.ok(scheduler.experiences.at(-2).end)
// Normal scheduler hand-off creates no wait card, even when the prior wait ended.
scheduler.waitReason='';syncWaiting(scheduler);const waitingCount=scheduler.experiences.length
scheduler.elapsed+=.1;syncWaiting(scheduler);assert.equal(scheduler.experiences.length,waitingCount);assert.equal(scheduler.waitExperience,null)
assert.equal(waitingTitle(''),'正在选择下一个行为')
// Countdown changes and cause ordering keep the same card and start time.
scheduler.waitReason='恢复精力冷却剩余 10 分钟；工具柜 已被娜娜预约';syncWaiting(scheduler)
const continuous=scheduler.waitExperience,start=continuous.start,id=continuous.id
scheduler.elapsed+=1;scheduler.waitReason='工具柜 已被娜娜预约；恢复精力冷却剩余 9 分钟';syncWaiting(scheduler)
assert.equal(scheduler.waitExperience.id,id);assert.equal(scheduler.waitExperience.start,start);assert.match(continuous.reason,/9 分钟/)
assert.equal(scheduler.experiences.length,waitingCount+1);assert.equal(continuous.kind,'wait')
assert.equal(waitingTitle('占位等待：工具柜'),'等待「工具柜」空闲')
assert.equal(waitingTitle('恢复精力冷却剩余 9 分钟'),'等待目标冷却结束')
// A genuinely different resource is a different cause, not a countdown update.
scheduler.elapsed+=1;scheduler.waitReason='占位等待：椅子';syncWaiting(scheduler)
assert.notEqual(scheduler.waitExperience.id,id);assert.equal(continuous.end,scheduler.elapsed)
const finishedWait=scheduler.waitExperience;scheduler.status='running';syncWaiting(scheduler);assert.equal(finishedWait.status,'done')
// Prerequisites retain the intended goal and link only to the matching next execution.
scheduler.pendingSteps=[{config}];const prep=beginRecord(scheduler,{name:'拿取工具'});assert.equal(prep.source,'prerequisite')
finishRecord(scheduler,'done');scheduler.pendingSteps=[];const next=beginRecord(scheduler,{config},sim());assert.equal(next.parentId,prep.id)
const repeated=beginRecord(scheduler,{config},sim());assert.equal(repeated.parentId,null)
assert.equal(sourceFor({...scheduler,goal:{kind:'buff',name:'解除晕眩'}},{config}).source,'listener')
assert.match(sourceFor({...scheduler,goal:{kind:'buff',name:'解除晕眩'}},{config}).trigger,/未中断/)
finishRecord(scheduler,'interrupted','关闭伙伴');assert.equal(repeated.status,'interrupted')
// Attribute changes from elsewhere are not accumulated as direct effects.
const before=makeWorld(lib),after=structuredClone(before);after[0].attrs.energy=60
const record=experience({actor:'pip',name:'test'});effect(record,changes(before,after,lib));const middle=structuredClone(after);middle[0].attrs.energy=30;const final=structuredClone(middle);final[0].attrs.energy=40;effect(record,changes(middle,final,lib));assert.equal(record.effects[0].delta,20)
for(let i=0;i<250;i++)s.log('debug '+i);assert.equal(s.logs.length,200);assert.ok(s.experience.events.length>200)
console.log('PASS experience identity, global time, random branches, rollback, waiting merge, preparation links, listener provenance, interruption and direct-effect attribution')
