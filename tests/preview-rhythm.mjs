import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createRequire} from 'node:module'
import {buildSync} from 'esbuild'
import {RhythmScheduler} from '../src/preview/rhythmScheduler.mjs'
import {makeScenarioWorld} from '../src/preview/scheduler.mjs'
import {OnlineColony} from '../src/preview/onlineColony.mjs'
import {Simulation,CHARACTERS} from '../src/preview/runtime.mjs'
import {bound} from '../src/preview/preparation.mjs'
import {RHYTHM_MAP,applyIdle} from '../src/preview/rhythm.mjs'
import {previewEffect} from '../src/preview/integration.mjs'
import {advanceDayState} from '../src/preview/day.mjs'
const require=createRequire(import.meta.url),Module=require('node:module'),m=new Module(import.meta.filename)
m._compile(buildSync({entryPoints:['src/utils/onlineBehaviors.js'],bundle:true,platform:'node',format:'cjs',write:false,logLevel:'silent'}).outputFiles[0].text,import.meta.filename)
const lib=JSON.parse(fs.readFileSync('public/data/library.json','utf8')).library,index=JSON.parse(fs.readFileSync('public/data/behaviors/index.json','utf8'))
const files=index.files.map(f=>({...f,config:m.exports.parseBehavior(fs.readFileSync('public/data/behaviors/'+f.sha+'.json','utf8'))})),original=JSON.stringify({files,lib})
const q=new RhythmScheduler(files,lib,makeScenarioWorld(lib,undefined,files),'pip',{}, {dayMode:true})
assert.equal(q.files.length,18);for(const f of q.files)assert.ok(RHYTHM_MAP[f.config.previewIntegration])
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,a+' vs '+b)
function sim(id){const f=q.files.find(f=>f.config.previewIntegration===id);return new Simulation(f.config,q.lib,q.world,bound(f.config,q.lib,q.world,'pip'),'pip',{rhythm:true,stateRules:true,delta:999})}
const sleep=sim('rest');sleep.current='sleep';sleep.tick(60)
const actor=s=>s.world.find(x=>x.id==='pip')
near(actor(sleep).attrs.energy,50+99/7);near(actor(sleep).attrs.satiety,44)
assert.equal(sleep.duration(sleep.node()),420)
const energy=actor(sleep).attrs.energy;sleep.step(false);near(actor(sleep).attrs.energy,energy);assert.ok(sleep.visited.includes('sleep'));assert.ok(sleep.edges.length)
const wood=sim('wood');wood.current='chop';wood.tick(1)
near(actor(wood).attrs.energy,49.8);near(actor(wood).attrs.satiety,49.7)
const old=actor(wood).attrs.energy;wood.step(false);near(actor(wood).attrs.energy,old)
previewEffect(wood,{previewOp:'weightCost'});near(actor(wood).attrs.energy,old)
const idle=structuredClone(q.world);applyIdle(idle,'pip',60);near(idle.find(o=>o.id==='pip').attrs.satiety,38)
const before=actor(wood).attrs.energy;advanceDayState(wood.world,1,1,{...q.settings,rhythm:true},'pip','work',true,()=>{});near(actor(wood).attrs.energy,before)
const g=q.goals.find(g=>g.id==='energy');q.world.find(o=>o.id==='pip').attrs.energy=80;near(q.score(g),Math.exp(2)*.9*100)
q.elapsed=400;near(q.score(g),Math.exp(2)*.9)
q.goal=q.goals.find(g=>g.id==='leisure');q.pendingSteps=[{service:true,name:'拿取鱼竿',action:'equip',tool:'鱼竿'}];q.startNext();assert.equal(q.service.minutes,2)
q.advance(1);assert.notEqual(q.world.find(o=>o.name==='鱼竿').location,'pip');q.advance(1);assert.equal(q.world.find(o=>o.name==='鱼竿').location,'pip');assert.equal(q.goal,null)
assert.equal(JSON.stringify({files,lib}),original)
console.log('PASS: 18 graph numeric mappings, real edges, 420-minute sleep, rates, no duplicate outputs/costs, weights, timed services and source isolation')

const colony=new OnlineColony(files,lib,makeScenarioWorld(lib,{initial:100},files),Object.fromEntries(CHARACTERS.map(c=>[c.id,true])),{initial:100},{dayMode:true,rhythm:true,daySeconds:1440})
colony.tick(1440)
assert.equal(colony.status,'day-complete')
for(const s of Object.values(colony.members)){
 assert.ok(s.calibrated)
 assert.ok(s.completed.filter(c=>c.status==='done').length>2,s.actor+' must finish multiple real behaviors')
 assert.ok(Object.keys(s.statistics).length>1,s.actor+' must run different graphs')
 assert.ok(s.completed.every(c=>!c.file.includes('炫耀')))
 const a=colony.world.find(o=>o.id===s.actor)
 for(const key of ['energy','satiety','social','leisure'])assert.ok(a.attrs[key]>=0&&a.attrs[key]<=100)
}
console.log('PASS: six calibrated actors x 1440 minutes; real graph completions: '+JSON.stringify(Object.fromEntries(Object.entries(colony.members).map(([id,s])=>[id,s.statistics]))))
