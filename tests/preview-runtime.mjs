import assert from 'node:assert/strict'
import {Simulation,makeWorld,bindingsFor,inspect,DEFAULTS} from '../src/preview/runtime.mjs'
import {initializeState,addBuff} from '../src/preview/state.mjs'
const lib={objects:[{id:'partner',name:'伙伴',enabled:true}],attributes:[{id:'energy',name:'精力',kind:'数值',objectTypes:['partner'],enabled:true}],buffs:[{id:'stuck',name:'卡住',objectTypes:['partner'],enabled:true}],items:[]}
const rule={source:'object:partner',objectName:'',attribute:'energy',influence:'增'}
const node=(id,type,data={})=>({id,type,data:{name:id,...data}})
const graph={behavior:{preconditions:{attributeRules:[]},targetRules:[]},graph:{nodes:[node('start','start'),node('loop','loop',{loopConditions:[{kind:'goal',rules:[{...rule,influence:'较高时'}]},{kind:'count',maxIterations:5}]}),node('action','result',{effectRules:[rule],playMode:'单次'}),node('end','end')],edges:[{id:'1',source:'start',target:'loop'},{id:'2',source:'action',target:'loop'},{id:'3',source:'loop',sourceHandle:'complete',target:'end'}],layout:{scopes:[{loopId:'loop',entry:'action',members:['action']}]}}}
function setup(config=graph){const world=makeWorld(lib),bindings=bindingsFor(config,lib,world,'pip');return new Simulation(config,lib,world,bindings,'pip')}
const original=JSON.stringify(graph),s=setup();while(!['done','blocked'].includes(s.status))s.step();assert.equal(s.status,'done');assert.equal(s.world[0].attrs.energy,70);assert.equal(s.loops.loop,2);assert.equal(JSON.stringify(graph),original)
const before=setup();before.world[0].attrs.energy=80;while(!['done','blocked'].includes(before.status))before.step();assert.equal(before.visited.includes('action'),false)
const max=structuredClone(graph);max.graph.nodes[1].data.loopConditions=[{kind:'count',maxIterations:1}];const once=setup(max);while(!['done','blocked'].includes(once.status))once.step();assert.equal(once.world[0].attrs.energy,60)
const custom=structuredClone(graph);custom.graph.nodes[2].data.effectRules[0].influence='神秘改变';assert.equal(setup(custom).status,'blocked')
const missing=structuredClone(graph);missing.graph.edges=[];const blocked=setup(missing);blocked.step();assert.equal(blocked.status,'blocked');assert.match(blocked.error,/连线/)
const exit=structuredClone(graph);exit.graph.nodes[2].data.externalExits=[{handle:''}];const out=setup(exit);out.step();out.step();out.step();assert.equal(out.status,'exited');assert.equal(out.visited.includes('end'),false)
const timed=setup();timed.step();timed.step();timed.tick(1);assert.equal(timed.world[0].attrs.energy,50);timed.tick(2);assert.equal(timed.world[0].attrs.energy,60)
const buff=structuredClone(graph);buff.graph.nodes[2].data.effectRules=[{...rule,attribute:'buff:stuck',influence:'增'}];buff.graph.nodes[1].data.loopConditions=[{kind:'count',maxIterations:1}];const b=setup(buff);while(!['done','blocked'].includes(b.status))b.step();assert.equal(b.world[0].buffs.stuck,1)
const judge={behavior:{preconditions:{}},graph:{nodes:[node('start','start'),node('j','judge',{branches:[{id:'a',name:'A',weightExpectation:'中',weightFactors:[]},{id:'b',name:'B',weightExpectation:'中',weightFactors:[]}]}),node('end','end')],edges:[{source:'start',target:'j'},{source:'j',sourceHandle:'a',target:'end'},{source:'j',sourceHandle:'b',target:'end'}]}}
const j1=setup(judge),j2=setup(judge);for(let i=0;i<3;i++){j1.step();j2.step()}assert.deepEqual(j1.logs,j2.logs)
console.log('Preview runtime: ordered OR, precheck, count, unknown rules, missing edges, external exit, timing, Buff, deterministic seed, source isolation passed')
const nested=structuredClone(graph);nested.graph.nodes[1].data.loopConditions=[{kind:'count',maxIterations:2}];nested.graph.nodes.push(node('inner','loop',{loopConditions:[{kind:'count',maxIterations:2}]}));nested.graph.layout.scopes=[{loopId:'loop',entry:'inner',members:['inner','action']},{loopId:'inner',entry:'action',members:['action']}];nested.graph.edges[1].target='inner';nested.graph.edges.push({source:'inner',sourceHandle:'complete',target:'loop'});const ns=setup(nested);while(!['done','blocked'].includes(ns.status))ns.step();assert.equal(ns.status,'done');assert.equal(ns.visited.filter(id=>id==='action').length,4)
const denied=structuredClone(graph);denied.behavior.preconditions.attributeRules=[{...rule,influence:'大于80'}];const ds=setup(denied);ds.step();assert.equal(ds.status,'blocked');assert.equal(ds.world[0].attrs.energy,50)
const instant=structuredClone(judge);instant.graph.nodes[1].data.branches[0].weightFactors=[{...rule,influenceType:'具有（1）',influenceRule:'允许选中'}];const js=setup(instant);js.step();js.step();assert.match(js.logs[0].text,/B/)
assert.equal(setup().initial[0].attrs.energy,50)
for(const manual of [true,false]){
 const clocked=setup();initializeState(clocked.world);clocked.params.stateRules=true;clocked.params.selfClock=true
 const actor=clocked.world[0];addBuff(actor,'temporary',0,'test',{seconds:1,add:{energy:10}})
 assert.equal(actor.buffInstances.length,1)
 if(manual)clocked.step();else clocked.tick(.1)
 assert.equal(actor.buffInstances.length,0,'single '+(manual?'step':'tick')+' expires buffs')
}
console.log('Nested loop reentry, failed admission and branch exclusion passed')
const zero=structuredClone(graph);zero.graph.nodes[1].data.loopConditions=[{kind:'count',maxIterations:0}];const zs=setup(zero);while(!['done','blocked'].includes(zs.status))zs.step();assert.equal(zs.visited.includes('action'),false)
