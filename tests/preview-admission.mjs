import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createRequire} from 'node:module'
import {buildSync} from 'esbuild'
import {singleScenario} from '../src/preview/singleScenario.mjs'
import {RhythmScheduler} from '../src/preview/rhythmScheduler.mjs'
import {makeScenarioWorld} from '../src/preview/scheduler.mjs'
import {OnlineColony} from '../src/preview/onlineColony.mjs'
import {CHARACTERS,makeWorld} from '../src/preview/runtime.mjs'
const require=createRequire(import.meta.url),Module=require('node:module'),m=new Module(import.meta.filename)
m._compile(buildSync({entryPoints:['src/utils/onlineBehaviors.js'],bundle:true,platform:'node',format:'cjs',write:false,logLevel:'silent'}).outputFiles[0].text,import.meta.filename)
const lib=JSON.parse(fs.readFileSync('public/data/library.json','utf8')).library,index=JSON.parse(fs.readFileSync('public/data/behaviors/index.json','utf8'))
const files=index.files.map(f=>({...f,config:m.exports.parseBehavior(fs.readFileSync('public/data/behaviors/'+f.sha+'.json','utf8'))}))
const source=makeScenarioWorld(lib,{initial:100},files),before=JSON.stringify({source,files,lib})
const q=new RhythmScheduler(files,lib,source,'pip',{}, {dayMode:true})
for(const f of q.files){
 for(const actor of ['pip','nana']){
  const s=singleScenario(f.config,q.lib,makeWorld(lib,{initial:100},f.config),actor,{initial:100})
  assert.notEqual(s.status,'blocked',f.name+': '+s.error)
  assert.ok((f.config.behavior.preconditions.attributeRules||[]).every(r=>s.condition(r)),f.name)
  s.step();assert.notEqual(s.status,'blocked',f.name+': '+s.error)
 }
 console.log('PASS single admission: '+f.name)
}
assert.equal(JSON.stringify({source,files,lib}),before,'single tests must not modify source scene/graphs/library')
const rest=q.files.find(f=>f.config.previewIntegration==='rest')
const manual=singleScenario(rest.config,q.lib,source,'pip',{},false);manual.step();assert.equal(manual.status,'blocked','manual admission failures stay testable')
const colony=new OnlineColony(files,lib,source,Object.fromEntries(CHARACTERS.map(c=>[c.id,true])),{}, {dayMode:true,rhythm:true,daySeconds:1440})
const pip=colony.members.pip,bed=colony.world.find(o=>o.name==='床')
pip.world.find(o=>o.id==='pip').attrs.energy=40;colony.locks.set(bed.id,'nana')
const goal=pip.goals.find(g=>g.id==='energy');const sleep=pip.evaluate(rest,goal),chair=pip.evaluate(pip.files.find(f=>f.config.previewIntegration==='chair'),goal)
assert.ok(sleep.reasons.some(r=>r.includes('预约')));assert.equal(sleep.weight,0);assert.equal(chair.reasons.length,0,'free chair is eligible while bed reserved')
pip.files=[];pip.selectGoal();assert.deepEqual(pip.candidates,[],'waiting candidates must not retain stale selection')
const eat=q.files.find(f=>f.config.previewIntegration==='eat'),eating=singleScenario(eat.config,q.lib,source,'pip')
eating.step();assert.ok(eating.world.filter(o=>o.type==='environmen').every(o=>!o.occupied),'eating must not monopolize the whole environment')
for(let i=0;i<120&&!['done','blocked','exited'].includes(eating.status);i++)eating.step()
assert.equal(eating.status,'done',eating.error);assert.equal(eating.world.find(o=>o.id==='pip').attrs.equipped_slot_food,'0','empty food slot must not block future sleep')
console.log('PASS isolated fixtures, reservations before scoring, shared environment and food slot cleanup')
