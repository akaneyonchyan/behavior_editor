import assert from 'node:assert/strict'
import {GoalScheduler} from '../src/preview/scheduler.mjs'
import {makeWorld} from '../src/preview/runtime.mjs'
const lib={objects:[{id:'partner',enabled:true}],attributes:['energy','cleanliness'].map(id=>({id,name:id,kind:'数值',enabled:true,objectTypes:['partner']})),buffs:[],items:[]}
const rule=a=>({source:'object:partner',attribute:a,influence:'增'})
function file(a,extra={}){return {name:a+'.json',config:{behavior:{targetRules:[rule(a)],preconditions:{}},graph:{nodes:[{id:'s',type:'start',data:{}},{id:'a',type:'result',data:{effectRules:[rule(a)],...extra}},{id:'e',type:'end',data:{}}],edges:[{source:'s',target:'a'},{source:'a',target:'e'}]}}}}
const files=[file('energy'),file('cleanliness')],world=makeWorld(lib),original=JSON.stringify({files,world})
const sim=new GoalScheduler(files,lib,world,'pip',{seconds:.1,delta:20})
for(let i=0;i<100;i++)sim.tick(.5)
assert.equal(sim.world[0].attrs.energy,70);assert.equal(sim.world[0].attrs.cleanliness,70)
assert.deepEqual(new Set(sim.completed.map(c=>c.file)),new Set(['energy.json','cleanliness.json']))
assert.equal(sim.completed.length,2);assert.equal(sim.status,'waiting');assert.equal(sim.goal,null)
assert.equal(JSON.stringify({files,world}),original)
const repeat=new GoalScheduler(files,lib,world,'pip',{seconds:.1,delta:20});for(let i=0;i<100;i++)repeat.tick(.5);assert.deepEqual(sim.logs,repeat.logs)
// Actual failure/empty result cannot complete a goal merely because its graph ended.
const failed=new GoalScheduler([file('energy',{effectRules:[]})],lib,world,'pip',{seconds:.1},{maxAttempts:2,failCooldownSec:100})
for(let i=0;i<40;i++)failed.tick(.5)
assert.equal(failed.completed.length,2);assert.equal(failed.world[0].attrs.energy,50);assert.ok(failed.cooldowns.energy>failed.elapsed)
// Initial satisfaction skips goals and empty/unavailable catalogs back off without a tight loop.
const satisfied=makeWorld(lib,{initial:90});const idle=new GoalScheduler(files,lib,satisfied,'pip');idle.tick(1);assert.equal(idle.completed.length,0);assert.equal(idle.status,'waiting')
const missing=new GoalScheduler([],lib,world,'pip');for(let i=0;i<10;i++)missing.tick(.1);assert.equal(missing.completed.length,0);assert.ok(missing.nextCheck>missing.elapsed)
const denied=file('energy');denied.config.behavior.preconditions.attributeRules=[{...rule('energy'),influence:'大于80'}]
const blocked=new GoalScheduler([denied],lib,world,'pip');for(let i=0;i<10;i++)blocked.tick(1);assert.equal(blocked.completed.length,0);assert.ok(blocked.logs.some(l=>l.text.includes('没有可执行')))
// Jump carries effects to external policy; it is not an artificial successful end.
const jump=new GoalScheduler([file('energy',{externalExits:[{handle:''}]})],lib,world,'pip',{delta:20,seconds:.1});for(let i=0;i<15;i++)jump.tick(.5)
assert.equal(jump.completed[0].status,'exited');assert.equal(jump.world[0].attrs.energy,70)
console.log('Goal scheduler: cross-behavior state, two goals, actual verification, retry limit, cooldown, idle backoff, admission, jump, deterministic seed and source isolation passed')
