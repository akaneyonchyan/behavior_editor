const assert=require('node:assert/strict'),{buildSync}=require('esbuild'),Module=require('node:module'),path=require('node:path')
const filename=path.join(process.cwd(),'boundary-tests.cjs'),m=new Module(filename,module);m.filename=filename;m.paths=module.paths
m._compile(buildSync({stdin:{contents:"export {normalizeBehavior,containerTarget} from './src/utils/normalizeBehavior';export {structureLayout} from './src/utils/structureLayout';export {blankTemplate} from './src/utils/blankTemplate';export {blankTemplate as legacyTemplate} from './tests/fixtures/legacyTemplate';export {validateConfig} from './src/store/documentValidation';export {NODE_CONFIG} from './src/constants/behaviorTypes';export {useBehaviorStore as store} from './src/store/behaviorStore';export {parseBehavior} from './src/utils/onlineBehaviors'",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text,filename)
const {normalizeBehavior,structureLayout,blankTemplate,legacyTemplate,validateConfig,NODE_CONFIG,store,parseBehavior}=m.exports
const clean=blankTemplate(),old=legacyTemplate(),original=structuredClone(old)
old.graph.nodes.find(n=>n.type==='loop').data.resourceRules=[{id:'a',source:'custom source',objectName:'custom object',attribute:'custom property',influence:'custom rule'}]
old.graph.edges.find(e=>e.source==='template_wait').target='template_judge'
const before=structuredClone(old),converted=normalizeBehavior(old)
assert.deepEqual(old,before);assert.deepEqual(normalizeBehavior(converted),converted);assert.deepEqual(normalizeBehavior(old),converted)
validateConfig(converted,NODE_CONFIG)
assert.equal(converted.graph.edges.find(e=>e.source==='behavior_start').target,'template_loop')
assert.equal(converted.graph.edges.find(e=>e.source==='template_wait').target,'template_loop')
const gate=converted.graph.nodes.find(n=>n.id==='template_loop_admission')
assert.equal(gate.data.judgeAttributes[0].objectName,'custom object');assert.match(gate.data.branches[0].weightFactors[0].influence,/custom rule/)
assert.deepEqual(converted.graph.nodes.find(n=>n.type==='loop').data.legacyLoopLogic.data,before.graph.nodes.find(n=>n.type==='loop').data)
// Direct middle-entry edges must connect to the loop's entry, including store edits.
const direct=blankTemplate();direct.graph.edges.find(e=>e.source==='behavior_start').target='template_result_1'
const redirected=normalizeBehavior(direct);assert.equal(redirected.graph.edges[0].target,'template_loop')
store.getState().importConfig(clean);store.getState().connect({source:'behavior_start',target:'template_result_2'});assert.equal(store.getState().edges.find(e=>e.source==='behavior_start').target,'template_loop')
// A child can leave the loop via a distinct boundary port without becoming the normal completion branch.
const f=blankTemplate();f.graph.nodes.push({id:'outside',type:'result',position:{x:0,y:0},data:{name:'Outside'}})
f.graph.edges.find(e=>e.source==='template_result_1').target='outside';f.graph.edges.push({id:'outside_end',source:'outside',target:'template_end'})
const sameLevel=visual=>{const nodes=new Map(visual.nodes.map(n=>[n.id,n]));for(const e of visual.edges){assert.ok(nodes.has(e.source)&&nodes.has(e.target));assert.equal(nodes.get(e.source).parentNode,nodes.get(e.target).parentNode,'cross-container visual edge '+e.id)}}
let v=structureLayout(f.graph.nodes,f.graph.edges,f.graph.layout);sameLevel(v)
assert.ok(v.edges.some(e=>e.source==='__scope_template_loop'&&e.target==='outside'&&e.sourceHandle.startsWith('exit:')))
assert.ok(v.edges.some(e=>e.source==='__scope_template_loop'&&e.target==='template_end'&&e.sourceHandle==='complete'))
assert.ok(v.nodes.some(n=>n.type==='loopPortal'&&n.data.kind==='entry'))
assert.ok(!v.edges.some(e=>e.source==='__scope_template_loop'&&e.sourceHandle==='continue'))
for(const collapse of [[],['template_loop']]){v=structureLayout(f.graph.nodes,f.graph.edges,f.graph.layout,{},collapse);sameLevel(v);assert.ok(v.edges.some(e=>e.target==='outside'))}
// Nested branches leave through every crossed container; nested completion remains in its parent.
const inner={id:'inner',type:'loop',position:{x:0,y:0},data:{...NODE_CONFIG.loop.defaultData}},body={id:'body',type:'judge',position:{x:0,y:0},data:{branches:[{id:'return',name:'Return'},{id:'leave',name:'Leave'}]}}
f.graph.nodes.push(inner,body);f.graph.edges.find(e=>e.source==='template_judge'&&e.sourceHandle==='branch_1').target='inner'
f.graph.edges.push({id:'inner_entry',source:'inner',sourceHandle:'continue',target:'body'},{id:'inner_return',source:'body',sourceHandle:'return',target:'inner'},{id:'inner_done',source:'inner',sourceHandle:'complete',target:'template_result_1'},{id:'inner_exit',source:'body',sourceHandle:'leave',target:'outside'})
f.graph.layout.scopes[0].members.push('inner','body');f.graph.layout.scopes.push({loopId:'inner',entry:'body',members:['body']})
validateConfig(f,NODE_CONFIG)
for(const collapsed of [[],['inner'],['template_loop'],['inner','template_loop']]){
 v=structureLayout(f.graph.nodes,f.graph.edges,f.graph.layout,{},collapsed);assert.equal(v.warnings.length,0);sameLevel(v)
 assert.equal(v.edges.filter(e=>e.target==='outside').length,2)
 assert.ok(v.edges.some(e=>e.target==='outside'&&e.source==='__scope_template_loop'&&e.sourceHandle==='exit:inner_exit'))
}
// Both local and online ingestion use the pure normalizer; source JSON is unchanged.
const text=JSON.stringify(original),online=parseBehavior(text);assert.equal(online.graph.nodes.find(n=>n.type==='loop').data.loopVersion,3);assert.equal(JSON.stringify(original),text)
const malformed=structuredClone(original);malformed.graph.edges.filter(e=>e.source==='template_loop').forEach(e=>delete e.sourceHandle)
const previous=store.getState().exportConfig();assert.throws(()=>store.getState().importConfig(malformed));assert.deepEqual(store.getState().exportConfig(),previous)
console.log('PASS: automatic deterministic/idempotent conversion, rule preservation, direct entries, nested boundary ports, collapsed routing and local/online isolation')

