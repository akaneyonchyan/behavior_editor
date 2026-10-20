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
assert.deepEqual(outs().map(e=>e.sourceHandle).sort(),['complete','continue'])
graph.getState().setLoopTarget('loop_1','complete','end_failed');assert.equal(outs().find(e=>e.sourceHandle==='complete').target,'end_failed');assert.equal(outs().length,2)
graph.getState().undo();assert.equal(outs().find(e=>e.sourceHandle==='complete').target,'end_1')
graph.getState().connect({source:'loop_1',sourceHandle:'complete',target:'end_failed'});assert.equal(outs().length,2)
const before=graph.getState().exportConfig();graph.getState().connect({source:'loop_1',sourceHandle:'rest',target:'end_1'});assert.deepEqual(graph.getState().exportConfig(),before)
graph.getState().setLoopTarget('loop_1','continue','');assert.ok(!outs().some(e=>e.sourceHandle==='continue'));graph.getState().undo()
const roundTrip=graph.getState().exportConfig();validateConfig(roundTrip,NODE_CONFIG);graph.getState().importConfig(roundTrip)
assert.equal(graph.getState().nodes.find(n=>n.id==='loop_1').data.restEnabled,undefined)
const malformed=structuredClone(roundTrip);malformed.graph.edges.find(e=>e.source==='loop_1').sourceHandle='unknown';assert.throws(()=>validateConfig(malformed,NODE_CONFIG),/循环容器/)
const duplicate=structuredClone(roundTrip);duplicate.graph.edges.push({...duplicate.graph.edges.find(e=>e.source==='loop_1')});assert.throws(()=>validateConfig(duplicate,NODE_CONFIG),/一个后续节点/)
// Ambiguous unlabeled exits are rejected without replacing the current document.
const legacy=structuredClone(example);legacy.graph.edges.filter(e=>e.source==='loop_1').forEach(e=>delete e.sourceHandle)
const snapshot=graph.getState().exportConfig();assert.throws(()=>graph.getState().importConfig(legacy));assert.deepEqual(graph.getState().exportConfig(),snapshot)
graph.getState().importConfig(example);graph.getState().changeNodes(graph.getState().nodes.map(n=>({id:n.id,type:'select',selected:true})));graph.getState().copy();graph.getState().paste()
const copied=graph.getState().nodes.filter(n=>n.selected),loop=copied.find(n=>n.type==='loop'),ids=new Set(copied.map(n=>n.id))
assert.equal(graph.getState().edges.filter(e=>e.source===loop.id&&ids.has(e.target)).length,2)
validateConfig(graph.getState().exportConfig(),NODE_CONFIG)
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
const html=renderToStaticMarkup(React.createElement(m.exports.LoopFields,{node:loop}))
for(const label of ['循环执行条件','按配置的最大次数','按目标满足情况','循环结束后去向'])assert.ok(html.includes(label),label)
for(const label of ['旧版','迁移','启用准入检查','启用稍息判定'])assert.ok(!html.includes(label),label)
assert.ok(!html.includes('type="number"'))
console.log('PASS: automatic loop conversion, two ports, destinations, undo/copy, invalid import isolation, qualitative single-standard editor')
