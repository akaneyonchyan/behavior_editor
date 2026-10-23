import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createRequire} from 'node:module'
import {buildSync} from 'esbuild'
import {Colony} from '../src/preview/colony.mjs'
import {OnlineColony} from '../src/preview/onlineColony.mjs'
import {CHARACTERS,makeWorld} from '../src/preview/runtime.mjs'
import {makeScenarioWorld} from '../src/preview/scheduler.mjs'
const enabled=Object.fromEntries(CHARACTERS.map(c=>[c.id,true]))
const world=CHARACTERS.map(c=>({...c,type:'partner',attrs:{},buffs:{},inventory:{},x:40,z:65}))
const c=new Colony(world,enabled)
c.tick(30)
assert.ok(c.conflicts.length>0)
for(const s of Object.values(c.members)){assert.ok(s.completed.length>0);assert.equal(s.enabled[2],0);assert.notEqual(s.status,'blocked')}
const owner=c.locks.values().next().value
assert.ok(owner);c.setEnabled(owner,false)
assert.ok(![...c.locks.values()].includes(owner));assert.equal(c.world.find(o=>o.id===owner).inactive,true)
const before=[...c.members[owner].needs];c.tick(20);assert.deepEqual(c.members[owner].needs,before)
c.setEnabled(owner,true);c.tick(10);assert.equal(c.world.find(o=>o.id===owner).inactive,false)
c.tick(1380)
assert.equal(c.status,'day-complete');for(const s of Object.values(c.members)){assert.equal(s.status,'day-complete');assert.equal(s.elapsed,1440)}
for(const [tool,n] of Object.entries(c.tools))assert.equal(n+Object.values(c.members).filter(s=>s.tool===tool).length,1)
for(const m of c.materials)assert.ok(m.store>=0&&m.world>=0)
assert.ok(new Set(Object.values(c.members).map(s=>JSON.stringify(s.needs))).size>1)
console.log('Numeric colony: six independent actors, shared stock, conflicts, disable/re-enable, one day and tool conservation passed')
if(fs.existsSync('public/data/behaviors/index.json')){
 const require=createRequire(import.meta.url),Module=require('node:module'),m=new Module(import.meta.filename)
 m._compile(buildSync({entryPoints:['src/utils/onlineBehaviors.js'],bundle:true,platform:'node',format:'cjs',write:false,logLevel:'silent'}).outputFiles[0].text,import.meta.filename)
 const lib=JSON.parse(fs.readFileSync('public/data/library.json','utf8')).library,index=JSON.parse(fs.readFileSync('public/data/behaviors/index.json','utf8'))
 const files=index.files.map(f=>({...f,config:m.exports.parseBehavior(fs.readFileSync('public/data/behaviors/'+f.sha+'.json','utf8'))}))
 const o=new OnlineColony(files,lib,makeScenarioWorld(lib,undefined,files),enabled,{seconds:.1},{dayMode:true})
 o.tick(60)
 for(const s of Object.values(o.members)){assert.ok(s.completed.length>0,s.actor+' must complete real graphs');assert.ok(!s.files.some(f=>f.name.includes('炫耀')))}
 o.setEnabled('pip',false);const pos=structuredClone(o.world.find(e=>e.id==='pip'));o.tick(2)
 assert.equal(o.world.find(e=>e.id==='pip').x,pos.x);assert.equal(o.world.find(e=>e.id==='pip').z,pos.z)
 assert.ok(!o.world.some(e=>e.occupied==='pip'));assert.ok(![...o.locks.values()].includes('pip'))
 console.log('Online colony: six graph interpreters, no paired graph, occupancy cleanup and disabled movement passed')
}
