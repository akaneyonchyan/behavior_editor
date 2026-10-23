import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createRequire} from 'node:module'
import {buildSync} from 'esbuild'
import {scenario,validateCatalog} from '../src/preview/scenarios.mjs'
import {preparationPath,bound,executeService} from '../src/preview/preparation.mjs'
import {inspect,Simulation} from '../src/preview/runtime.mjs'
import {previewEffect} from '../src/preview/integration.mjs'
import {expireWorldBuffs} from '../src/preview/state.mjs'

if(!fs.existsSync('public/data/behaviors/index.json')){
 console.log('SKIP published integration fixtures: run npm run dev:preview to fetch snapshots')
}else{
 const require=createRequire(import.meta.url),Module=require('node:module'),m=new Module(import.meta.filename)
 m._compile(buildSync({entryPoints:['src/utils/onlineBehaviors.js'],bundle:true,platform:'node',format:'cjs',write:false,logLevel:'silent'}).outputFiles[0].text,import.meta.filename)
 const index=JSON.parse(fs.readFileSync('public/data/behaviors/index.json','utf8')),lib=JSON.parse(fs.readFileSync('public/data/library.json','utf8')).library
 const files=index.files.map(f=>({...f,config:m.exports.parseBehavior(fs.readFileSync('public/data/behaviors/'+f.sha+'.json','utf8'))})),original=JSON.stringify({files,lib})
 const results=validateCatalog(files,lib)
 assert.equal(results.length,18);assert.deepEqual(results.filter(r=>!r.passed).map(r=>[r.name,r.reason]),[])
 for(const result of results){console.log(result.name+' : '+result.reason);for(const run of result.runs)assert.ok(run.steps.every(s=>s.status!=='blocked'),result.name+' runtime blocked')}
 assert.equal(JSON.stringify({files,lib}),original,'online source and library unchanged')

 const repair=scenario(files,lib,'用扳手维修交互物.json'),file=repair.files.find(f=>f.config.previewIntegration==='repair'),before=JSON.stringify(repair.world)
 const path=preparationPath(file,repair.files,repair.lib,repair.world,'pip',repair.params)
 assert.equal(JSON.stringify(repair.world),before,'planning must be pure')
 assert.deepEqual(path.steps.map(s=>s.config?.previewIntegration||s.action),['put','equip','repair'])
 const target=repair.world.find(e=>e.name==='桌子');target.occupied='nana'
 assert.match(preparationPath(file,repair.files,repair.lib,repair.world,'pip',repair.params).error,/占用/);delete target.occupied
 const axe=repair.world.find(e=>e.name==='斧头'),axeId=axe.id,axeDur=axe.attrs.durability
 for(let i=0;i<3000;i++){repair.tick(.1);if(repair.completed.some(x=>x.file===file.name)&&!repair.goal)break}
 assert.equal(repair.world.filter(e=>e.id===axeId).length,1);assert.equal(repair.world.find(e=>e.id===axeId).attrs.durability,axeDur)
 assert.equal(repair.world.find(e=>e.id===axeId).location,repair.world.find(e=>e.name==='工具柜').id)
 assert.ok(repair.world.find(e=>e.id===target.id).attrs.durability>30)

 const wood=scenario(files,lib,'用斧头砍伐树木获取木材.json'),wf=wood.files.find(f=>f.config.previewIntegration==='wood')
 assert.match(preparationPath(wf,wood.files.filter(f=>f.config.previewIntegration!=='take'),wood.lib,wood.world,'pip',wood.params).error,/缺少在线前置/)
 const tree=wood.world.find(e=>e.name==='乔木'),material=wood.lib.items.find(i=>i.name==='木材');tree.attrs.reczz28PBhFkUjct=7
 executeService({action:'equip',tool:'斧头'},wood.world,'pip')
 const sim=new Simulation(wf.config,wood.lib,wood.world,bound(wf.config,wood.lib,wood.world,'pip'),'pip',{stateRules:true})
 const output=wf.config.graph.nodes.find(n=>n.data.effectRules?.some(r=>r.previewOp==='quantity'));sim.current=output.id
 for(const r of output.data.effectRules.filter(r=>r.previewOp))previewEffect(sim,r)
 assert.equal(sim.world.find(e=>e.id==='pip').inventory[material.id],7);assert.equal(sim.world.find(e=>e.id===tree.id).attrs.reczz28PBhFkUjct,0)

 const stuck=scenario(files,lib,'斧头被树卡住.json'),sf=stuck.files.find(f=>f.config.previewIntegration==='wood')
 const sp=preparationPath(sf,stuck.files,stuck.lib,stuck.world,'pip',stuck.params)
 assert.equal(sp.error,undefined);assert.equal(sp.steps[0].config.previewIntegration,'unstick')
 expireWorldBuffs(stuck.world,601)
 const expiredPath=preparationPath(sf,stuck.files,stuck.lib,stuck.world,'pip',stuck.params)
 assert.equal(expiredPath.error,undefined);assert.equal(expiredPath.steps[0].config.previewIntegration,'unstick','expired Buff must not strand a physically stuck tool')
 for(const f of stuck.files)assert.deepEqual(inspect(f.config,stuck.lib,stuck.world,bound(f.config,stuck.lib,stuck.world,'pip')),[],f.name)
 console.log('18 published graphs × 3 seeds; equipment identity, finite yield, recursive unstick chain, missing preparation, occupied objects and source isolation passed')
}
