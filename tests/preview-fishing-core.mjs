import assert from 'node:assert/strict'
import fs from 'node:fs'
import {integrateFile,integrationLibrary,prepareIntegrationWorld} from '../src/preview/integration.mjs'
import {makeWorld,inspect,Simulation} from '../src/preview/runtime.mjs'
import {singleScenario} from '../src/preview/singleScenario.mjs'
import {bound} from '../src/preview/preparation.mjs'
import {fishingFactor,fishingEffect,inspectFishingRoutes} from '../src/preview/fishingCore.mjs'
import {expireWorldBuffs} from '../src/preview/state.mjs'

const sourceLib=JSON.parse(fs.readFileSync('public/data/library.json','utf8')).library,lib=integrationLibrary(sourceLib)
const actorRule=(attribute,influence)=>({source:'object:partner',attribute,influence})
const node=(id,type,name,data={})=>({id,type,position:{x:0,y:0},data:{name,...data}})
const nodes=[node('start','start','开始'),node('round','loop','抛竿循环',{loopConditions:[{kind:'count',maxIterations:'3~5'},{kind:'count',maxIterations:''}]}),node('cast','result','抛竿'),node('wait','loop','等鱼循环',{loopConditions:[{kind:'count',maxIterations:'5~10min'}]}),node('look','result','坐着看鱼',{effectRules:[actorRule('认真钓鱼buff','+1')]}),node('catch','result','普通上鱼',{effectRules:[actorRule('fishing_experience','增')],outputs:['肉类']}),node('end','end','结束')]
const edges=[['start','round'],['round','cast','continue'],['round','end','complete'],['cast','wait'],['wait','look','continue'],['look','wait'],['wait','catch','complete'],['catch','round']].map(([source,target,sourceHandle],i)=>({id:'e'+i,source,target,sourceHandle}))
const config={behavior:{name:'钓鱼细分-核心行为',preconditions:{attributeRules:[],interactObjectRules:[],consumableRules:[{objectType:'buff',objectName:'item:buff/design_fishing_bait',requirement:'有可用存量'}]},targetRules:[actorRule('fishing_experience','增加X点'),actorRule('钓鱼行为','进行X次'),{source:'object:collectible',objectName:'鱼类',attribute:'数量',influence:'增加X份'}]},graph:{nodes,edges,layout:{scopes:[{loopId:'round',entry:'cast',members:['cast','wait','look','catch']},{loopId:'wait',entry:'look',members:['look']}]}}}
function adapt(c=config){return integrateFile({name:'钓鱼细分-核心行为.json',config:c})}
function simulation(c=config,prepare=true){const f=adapt(c),world=makeWorld(sourceLib,{initial:30},c);return singleScenario(f.config,lib,world,'pip',{seed:42},prepare)}
const original=JSON.stringify({config,sourceLib}),f=adapt(),s=simulation()
assert.equal(s.status,'ready',s.error)
assert.deepEqual(inspect(s.config,lib,s.world,s.bindings),[])
assert.equal(f.config.graph.nodes.find(n=>n.id==='round').data.loopConditions.length,1)
assert.equal(f.config.graph.nodes.find(n=>n.id==='round').data.loopConditions[0].maxIterations,4)
assert.equal(f.config.graph.nodes.find(n=>n.id==='wait').data.loopConditions[0].rules[0].amount,7.5)
assert.equal(s.world.find(e=>e.id==='pip').buffs.design_fishing_bait,1)
s.step();assert.equal(s.world.find(e=>e.id==='pip').buffs.design_fishing_bait||0,0)
while(!['done','blocked','exited'].includes(s.status))s.step()
assert.equal(s.status,'done',s.error)
assert.equal(s.metrics.rounds,4);assert.equal(s.metrics.fish,4);assert.equal(s.metrics.experience,40)
assert.ok(s.elapsed>=30&&s.elapsed<40,s.elapsed)
assert.equal(s.world.find(e=>e.id==='pip').inventory['material/reczz28P81TfjMNa'],8)
assert.equal(s.experience.goalResult,'行为目标已满足')
assert.equal(JSON.stringify({config,sourceLib}),original,'source graph and library are immutable')
const unprepared=simulation(config,false);unprepared.step();assert.equal(unprepared.status,'blocked')
const playback=[]
for(const dt of [.1,6]){
 const run=simulation();for(let i=0;i<10000&&!['done','blocked','exited'].includes(run.status);i++)run.tick(dt)
 assert.equal(run.status,'done',run.error);playback.push(run)
}
assert.deepEqual(playback[0].visited,playback[1].visited,'60x preserves 1x node order')
assert.deepEqual(playback[0].metrics,playback[1].metrics,'60x preserves catches and experience')
assert.equal(playback[0].elapsed,playback[1].elapsed,'60x preserves game time and bait admission')
const bad=structuredClone(config);bad.graph.nodes.find(n=>n.id==='look').data.effectRules.push(actorRule('未知钓鱼新属性','随意增加'))
assert.throws(()=>simulation(bad),/未支持/,'unknown rules stay blocked')
const explicit=structuredClone(config);explicit.behavior.targetRules[0].influence='增加80点'
assert.equal(adapt(explicit).config.behavior.targetRules[0].amount,80)
const a=s.world.find(e=>e.id==='pip');a.attrs.fishing_experience=95;a.attrs.fishingLevel=3;s.initial.find(e=>e.id==='pip').attrs.fishing_experience=95;s.initial.find(e=>e.id==='pip').attrs.fishingLevel=3
fishingEffect(s,{effect:'experience',amount:10});assert.equal(a.attrs.fishing_experience,105);assert.equal(a.attrs.fishingLevel,4)
fishingEffect(s,{effect:'emotion',emotion:'relax'});assert.deepEqual(a.pad,[10,-10,-10]);assert.equal(fishingFactor(s,{previewFishingFactor:'情绪-安适'}),1)
expireWorldBuffs(s.world,(s.params.worldNow||0)+601);assert.deepEqual(a.pad,[0,0,0])

const missing=structuredClone(config);missing.graph.edges=missing.graph.edges.filter(e=>e.source!=='catch'&&!(e.source==='wait'&&e.sourceHandle==='complete'))
const missingBefore=JSON.stringify(missing),missingFile=adapt(missing),missingWorld=makeWorld(sourceLib,{initial:50},missing)
prepareIntegrationWorld(missingWorld)
const missingIssues=inspect(missingFile.config,lib,missingWorld,bound(missingFile.config,lib,missingWorld,'pip'))
assert.equal(missingIssues.length,2);assert.ok(missingIssues.every(i=>i.kind==='graph'))
assert.deepEqual(missingIssues.map(i=>i.where),['等鱼循环 / 循环完成','普通上鱼 / 执行后续'])
assert.deepEqual(missingFile.config.graph.edges,missing.graph.edges,'adapter never inserts implicit return edges')
assert.equal(JSON.stringify(missing),missingBefore)
const exiting=structuredClone(missing);exiting.graph.nodes.find(n=>n.id==='wait').data.externalExits=[{handle:'complete'}];exiting.graph.nodes.find(n=>n.id==='catch').data.externalExits=[{handle:''}]
assert.deepEqual(inspectFishingRoutes(exiting),[],'authored external exits are valid')
const duplicate=structuredClone(config);duplicate.graph.edges.push({...duplicate.graph.edges[0],id:'duplicate'})
assert.match(inspectFishingRoutes(duplicate)[0].text,/多条连线/)

// Labels cannot silently invert the author's exclusion rule.
const posture=structuredClone(config)
const branches=[{id:'switch',name:'切换姿态',weightExpectation:'条件指定',weightFactors:[{...actorRule('属于钓鱼站姿','不属于 · 排除选中'),influenceType:'不属于',influenceRule:'排除选中'}]},{id:'keep',name:'保持姿态',weightExpectation:'条件指定',weightFactors:[{...actorRule('属于钓鱼站姿','属于 · 允许选中'),influenceType:'属于',influenceRule:'允许选中'}]}]
posture.graph.nodes.push(node('posture','judge','当前姿态',{branches}))
posture.graph.edges.push(...branches.map(b=>({id:'pose-'+b.id,source:'posture',target:'end',sourceHandle:b.id})))
const ps=simulation(posture),pb=ps.config.graph.nodes.find(n=>n.id==='posture').data.branches
assert.equal(pb[0].weightFactors[0].influenceRule,'排除选中')
ps.world.find(e=>e.id==='pip').attrs.preview_fishing_standing='0'
assert.equal(ps.branchWeight(pb[0]),0);assert.equal(ps.branchWeight(pb[1]),0,'no eligible branch stays visible, not silently fixed')

// Optional local acceptance against the actual designer file; do not commit private graph data.
if(process.env.FISHING_CORE_FIXTURE){
 const raw=JSON.parse(fs.readFileSync(process.env.FISHING_CORE_FIXTURE,'utf8')),before=JSON.stringify(raw),file=adapt(raw)
 const world=makeWorld(sourceLib,{initial:70},raw);prepareIntegrationWorld(world)
 const issues=inspect(file.config,lib,world,bound(file.config,lib,world,'pip'))
 assert.deepEqual(issues.filter(i=>i.kind!=='graph'),[],'actual source rules supported; report authored graph issues separately')
 assert.deepEqual(file.config.graph.edges,raw.graph.edges)
 console.log('Actual fishing graph preflight',JSON.stringify(issues))
 assert.equal(JSON.stringify(raw),before)
}
console.log('PASS fishing numeric targets, timed nested loops, finite bait, catches, XP levels, PAD expiry, explicit routes, exact posture rules and source isolation')
