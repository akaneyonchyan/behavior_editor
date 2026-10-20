const assert=require('node:assert/strict'),{buildSync}=require('esbuild'),Module=require('node:module'),path=require('node:path')
const filename=path.join(process.cwd(),'loop-tests.cjs'),m=new Module(filename,module);m.filename=filename;m.paths=module.paths
const code=buildSync({stdin:{contents:"export * from './src/utils/loopFlow.js'; export {useBehaviorStore as graph} from './src/store/behaviorStore.js'; export {validateConfig} from './src/store/documentValidation.js'; export {NODE_CONFIG} from './src/constants/behaviorTypes.js'; export {default as example} from './examples/eat-snack.json'; export {default as LoopFields} from './src/components/LoopEditor.jsx'",resolveDir:process.cwd()},bundle:true,loader:{'.css':'empty'},external:['react','react-dom'],platform:'node',format:'cjs',write:false,logLevel:'silent'}).outputFiles[0].text;m._compile(code,filename)
const {resolveLoopOutput,graph,validateConfig,NODE_CONFIG,example,LOOP_OUTPUTS}=m.exports
// All combinations, including short-circuit precedence and skipping disabled rest.
for(const complete of [false,true])for(const resourcesEnough of [false,true])for(const restTriggered of [false,true])for(const enabled of [false,true]){
  assert.equal(resolveLoopOutput({complete,resourcesEnough,restTriggered},enabled),complete?'complete':!resourcesEnough?'insufficient':enabled&&restTriggered?'rest':'continue')
}
validateConfig(example,NODE_CONFIG);graph.getState().importConfig(example)
const outs=()=>graph.getState().edges.filter(e=>e.source==='loop_1')
assert.deepEqual(outs().map(e=>e.sourceHandle).sort(),LOOP_OUTPUTS.map(o=>o.id).sort())
graph.getState().setLoopTarget('loop_1','complete','end_failed');assert.equal(outs().find(e=>e.sourceHandle==='complete').target,'end_failed');assert.equal(outs().length,4)
graph.getState().undo();assert.equal(outs().find(e=>e.sourceHandle==='complete').target,'end_1')
graph.getState().connect({source:'loop_1',sourceHandle:'complete',target:'end_failed'});assert.equal(outs().length,4)
graph.getState().updateNode('loop_1',{restEnabled:false});const count=outs().length
graph.getState().connect({source:'loop_1',sourceHandle:'rest',target:'end_1'});assert.equal(outs().length,count);assert.equal(outs().find(e=>e.sourceHandle==='rest').target,'wait_rest')
graph.getState().setLoopTarget('loop_1','continue','');assert.ok(!outs().some(e=>e.sourceHandle==='continue'));graph.getState().undo()
const roundTrip=graph.getState().exportConfig();validateConfig(roundTrip,NODE_CONFIG);graph.getState().importConfig(roundTrip)
assert.equal(graph.getState().nodes.find(n=>n.id==='loop_1').data.restEnabled,false)
const malformed=structuredClone(roundTrip);malformed.graph.edges.find(e=>e.source==='loop_1').sourceHandle='unknown';assert.throws(()=>validateConfig(malformed,NODE_CONFIG),/循环出口/)
const duplicate=structuredClone(roundTrip);duplicate.graph.edges.push({...duplicate.graph.edges.find(e=>e.source==='loop_1')});assert.throws(()=>validateConfig(duplicate,NODE_CONFIG),/一个后续节点/)
// Ambiguous legacy connections are preserved, never guessed into success/failure.
const legacy=structuredClone(example);legacy.graph.edges.filter(e=>e.source==='loop_1').forEach(e=>delete e.sourceHandle)
legacy.graph.nodes.find(n=>n.id==='loop_1').data={name:'旧循环',loopCondition:'食物数量 > 0',resourceCheck:'食物可用',restProbability:30}
graph.getState().importConfig(legacy);assert.equal(outs().filter(e=>!e.sourceHandle).length,4)
const edge=outs()[0];graph.getState().assignLoopEdge(edge.id,'complete');assert.equal(outs().find(e=>e.id===edge.id).sourceHandle,'complete')
graph.getState().undo();assert.equal(outs().find(e=>e.id===edge.id).sourceHandle,undefined)
assert.equal(graph.getState().nodes.find(n=>n.id==='loop_1').data.loopCondition,'食物数量 > 0')
// Copying a subgraph preserves port labels and remaps only target IDs.
graph.getState().importConfig(example);graph.getState().changeNodes(graph.getState().nodes.map(n=>({id:n.id,type:'select',selected:true})));graph.getState().copy();graph.getState().paste()
const copied=graph.getState().nodes.filter(n=>n.selected),loop=copied.find(n=>n.type==='loop'),ids=new Set(copied.map(n=>n.id))
assert.equal(graph.getState().edges.filter(e=>e.source===loop.id&&ids.has(e.target)).length,4)
validateConfig(graph.getState().exportConfig(),NODE_CONFIG)
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
const html=renderToStaticMarkup(React.createElement(m.exports.LoopFields,{node:loop}))
for(const label of ['① 目标达成判定','② 准入检查','③ 稍息判定','达成后去向','不满足后去向','触发 → 待机节点','不触发 → 继续执行节点'])assert.ok(html.includes(label),label)
assert.ok(!html.includes('type="number"'))
console.log('PASS: ordered loop decisions, four outputs, rest bypass, single destination, undo, copy, JSON validation, explicit legacy mapping and qualitative editor')

for(const admission of [false,true])for(const rest of [false,true])for(const satisfied of [false,true]){
 assert.equal(resolveLoopOutput({complete:false,admissionSatisfied:satisfied,restTriggered:true},rest,admission),admission&&!satisfied?'insufficient':rest?'rest':'continue')
}
graph.getState().importConfig(example)
const shape=()=>JSON.stringify(outs().map(e=>[e.source,e.sourceHandle,e.target]));const before=shape()
graph.getState().updateNode('loop_1',{admissionEnabled:false})
graph.getState().setLoopTarget('loop_1','insufficient','end_1')
assert.equal(shape(),before)
const saved=graph.getState().exportConfig();validateConfig(saved,NODE_CONFIG);graph.getState().importConfig(saved)
assert.equal(graph.getState().nodes.find(n=>n.id==='loop_1').data.admissionEnabled,false)
const bad=structuredClone(saved);bad.graph.nodes.find(n=>n.id==='loop_1').data.admissionEnabled='false'
assert.throws(()=>validateConfig(bad,NODE_CONFIG),/准入检查/)
graph.getState().updateNode('loop_1',{admissionEnabled:true})
assert.equal(shape(),before)
console.log('PASS: admission bypass combinations, disabled target guard, preserved edges and JSON switch validation')
