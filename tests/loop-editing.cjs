const assert=require('node:assert/strict'),{buildSync}=require('esbuild'),Module=require('node:module'),path=require('node:path')
const f=path.join(process.cwd(),'loop-editing-test.cjs'),m=new Module(f,module);m.filename=f;m.paths=module.paths
m._compile(buildSync({stdin:{contents:"export * from './src/utils/structureEditing';export * from './src/utils/loopConditions';export {structureLayout} from './src/utils/structureLayout';export {blankTemplate} from './src/utils/blankTemplate';export {normalizeBehavior} from './src/utils/normalizeBehavior';export {useBehaviorStore as store} from './src/store/behaviorStore';export {validateConfig} from './src/store/documentValidation';export {NODE_CONFIG} from './src/constants/behaviorTypes';export {collectRequirements} from './src/utils/requirements'",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',write:false,logLevel:'silent'}).outputFiles[0].text,f)
const {moveStructureNode,directOwner,structureLayout,blankTemplate,normalizeBehavior,store,validateConfig,NODE_CONFIG,loopConditions,firstSatisfiedLoopCondition,dropContainer}=m.exports
const file=blankTemplate(),s=()=>store.getState(),node=(id,type)=>({id,type,position:{x:0,y:0},data:structuredClone(NODE_CONFIG[type].defaultData)})
file.graph.nodes.push(node('empty','loop'),node('free','result'))
const original=structuredClone(file);s().importConfig(file)
const before=s().exportConfig();s().moveStructureNode('free',null,{free:{x:100,y:700}})
assert.deepEqual(s().edges,before.graph.edges.map(e=>({...e,type:'default'})))
assert.equal(s().layout.positions.free.y,700);assert.equal(s().layout.scopes.find(x=>x.loopId==='empty').members.length,0)
const freeState=s().exportConfig();s().moveStructureNode('free','empty',{free:{x:120,y:450}})
assert.equal(directOwner(s().layout.scopes,'free'),'empty');assert.equal(s().layout.scopes.find(x=>x.loopId==='empty').entry,'free')
assert.ok(s().edges.some(e=>e.source==='empty'&&e.sourceHandle==='continue'&&e.target==='free'))
assert.ok(s().edges.some(e=>e.source==='free'&&e.target==='empty'))
s().undo();assert.deepEqual(s().exportConfig(),freeState);s().redo()
// Transferring a connected member discards all incident old-range edges and preserves every unrelated edge.
const old=s().exportConfig(),unrelated=old.graph.edges.filter(e=>e.source!=='template_result_1'&&e.target!=='template_result_1')
s().moveStructureNode('template_result_1','empty',{})
assert.equal(directOwner(s().layout.scopes,'template_result_1'),'empty')
assert.ok(!s().edges.some(e=>e.target==='template_result_1'))
assert.deepEqual(s().edges.filter(e=>e.source==='template_result_1').map(e=>e.target),['empty'])
for(const e of unrelated)assert.ok(s().edges.some(n=>n.id===e.id))
validateConfig(s().exportConfig(),NODE_CONFIG);s().undo();assert.deepEqual(s().exportConfig(),old)
// Move the entry out, then the final node out: repair the old entry and leave a valid empty container.
s().moveStructureNode('free',null,{free:{x:0,y:0}});assert.equal(s().layout.scopes.find(x=>x.loopId==='empty').entry,'');assert.ok(!s().edges.some(e=>e.source==='empty'&&e.sourceHandle==='continue'));validateConfig(s().exportConfig(),NODE_CONFIG)
// Nested container moves retain subtree internals; prevent self/descendant parenting.
s().moveStructureNode('free','empty',{});const subtree=s().edges.filter(e=>['empty','free'].includes(e.source)&&['empty','free'].includes(e.target))
s().moveStructureNode('empty','template_loop',{});for(const edge of subtree)assert.ok(s().edges.some(e=>e.id===edge.id&&e.source===edge.source&&e.target===edge.target));assert.equal(directOwner(s().layout.scopes,'empty'),'template_loop')
assert.throws(()=>s().moveStructureNode('template_loop','empty',{}),/自身/)
s().moveStructureNode('empty',null,{});assert.equal(directOwner(s().layout.scopes,'empty'),null)
assert.deepEqual(file,original)
// New nodes added inside a scope are one transaction and save their relative position.
const addBefore=s().exportConfig();s().addStructureNode(node('added','wait'),'empty',{added:{x:120,y:500}});assert.equal(directOwner(s().layout.scopes,'added'),'empty');s().undo();assert.deepEqual(s().exportConfig(),addBefore)
// Saved positions grow the owning wrapper; stationary overlapping nodes are not adopted.
const visual=structureLayout(s().nodes,s().edges,{...s().layout,positions:{template_result_2:{x:2400,y:1500}}})
assert.ok(visual.nodes.find(n=>n.data?.scope?.loopId==='template_loop').style.width>2600)
const start=visual.nodes.find(n=>n.type==='start');assert.equal(dropContainer(start,visual.nodes,visual.scopes),null)
// Ordered OR and backward reading retain only the previously active mode.
assert.deepEqual(loopConditions(NODE_CONFIG.loop.defaultData).map(c=>c.kind),['goal','count'])
const calls=[];assert.equal(firstSatisfiedLoopCondition([{id:'goal'},{id:'count'}],c=>{calls.push(c.id);return true}),'goal');assert.deepEqual(calls,['goal'])
assert.equal(firstSatisfiedLoopCondition([{id:'goal'},{id:'count'}],c=>c.id==='count'),'count');assert.equal(firstSatisfiedLoopCondition([{id:'goal'}],()=>false),null)
const prior=blankTemplate(),d=prior.graph.nodes.find(n=>n.type==='loop').data;delete d.loopConditions;d.loopMode='count';d.maxIterations='6'
assert.deepEqual(normalizeBehavior(prior).graph.nodes.find(n=>n.type==='loop').data.loopConditions,[{id:'count',kind:'count',maxIterations:'6'}])
const conditions=[{id:'custom',kind:'goal',rules:[{id:'r',source:'custom',objectName:'my object',attribute:'my attribute',influence:'my rule'}]},{id:'limit',kind:'count',maxIterations:'rough limit'}]
s().updateNode('template_loop',{loopConditions:conditions});const current=s().exportConfig();validateConfig(current,NODE_CONFIG);s().updateNode('template_loop',{loopConditions:[...conditions].reverse()});s().undo();assert.deepEqual(s().exportConfig(),current)
s().importConfig(current);assert.deepEqual(s().nodes.find(n=>n.id==='template_loop').data.loopConditions,conditions)
const report=m.exports.collectRequirements(current.behavior,current.graph.nodes,{version:1,objects:[],attributes:[],buffs:[]})
assert.ok(report.attributes.some(r=>r.value==='my attribute'));assert.ok(report.attributes.some(r=>r.value==='my rule'))
for(const bad of [null,[{id:'x',kind:'bad'}],[{id:'x',kind:'count',maxIterations:2}],[{id:'x',kind:'goal'},{id:'x',kind:'count'}]]){
 const config=structuredClone(current);config.graph.nodes.find(n=>n.type==='loop').data.loopConditions=bad;assert.throws(()=>validateConfig(config,NODE_CONFIG))
}
console.log('PASS: independent movement, drop ownership, entry repair, discarded stale edges, nested guards, one-step undo, resizing, ordered OR, migration and condition validation')
