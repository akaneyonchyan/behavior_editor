const assert=require('node:assert/strict'),{buildSync}=require('esbuild'),Module=require('node:module'),path=require('node:path')
const file=path.join(process.cwd(),'return-tests.cjs'),m=new Module(file,module);m.filename=file;m.paths=module.paths
m._compile(buildSync({stdin:{contents:"export * from './src/utils/loopReturns';export {structureLayout} from './src/utils/structureLayout';export {normalizeBehavior} from './src/utils/normalizeBehavior';export {blankTemplate} from './src/utils/blankTemplate'",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text,file)
const {migrateLoopReturns,loopReturnConnection,structureLayout,normalizeBehavior,blankTemplate}=m.exports
const c=blankTemplate(),g=c.graph,v=structureLayout(g.nodes,g.edges,g.layout),marker=v.nodes.find(n=>n.data.kind==='repeat')
assert.ok(marker);assert.ok(v.edges.some(e=>e.source==='template_wait'&&e.target===marker.id&&e.data.originalEdgeId))
assert.ok(marker.position.x>v.nodes.find(n=>n.id==='template_wait').position.x)
const input={source:'template_wait',target:marker.id}
assert.equal(loopReturnConnection(input,g.nodes,v.scopes,v.nodes).target,'template_loop')
for(const source of ['behavior_start','template_end',marker.id])assert.equal(loopReturnConnection({...input,source},g.nodes,v.scopes,v.nodes),null)
assert.equal(loopReturnConnection({...input,target:'template_end'},g.nodes,v.scopes,v.nodes),null)
const old=structuredClone(c);old.graph.edges.find(e=>e.source==='template_wait').target='template_judge'
const converted=normalizeBehavior(old)
assert.equal(converted.graph.edges.find(e=>e.source==='template_wait').target,'template_loop')
assert.equal(old.graph.edges.find(e=>e.source==='template_wait').target,'template_judge')
assert.deepEqual(normalizeBehavior(converted),converted)
const unconnected=structuredClone(c);unconnected.graph.edges=unconnected.graph.edges.filter(e=>e.source!=='template_wait')
assert.ok(!normalizeBehavior(unconnected).graph.edges.some(e=>e.source==='template_wait'))
const nested=structuredClone(c),inner={id:'inner',type:'loop',data:{loopVersion:3},position:{x:0,y:0}},body={id:'body',type:'result',data:{},position:{x:0,y:0}}
nested.graph.nodes.push(inner,body);nested.graph.layout.scopes[0].members.push('inner','body')
nested.graph.layout.scopes.push({loopId:'inner',entry:'body',members:['body']})
nested.graph.edges.push({id:'ie',source:'inner',sourceHandle:'continue',target:'body'},{id:'ir',source:'body',target:'inner'},{id:'ic',source:'inner',sourceHandle:'complete',target:'template_loop'})
let visual=structureLayout(nested.graph.nodes,nested.graph.edges,nested.graph.layout),outer=visual.nodes.find(n=>n.data.kind==='repeat'&&n.data.loopId==='template_loop')
assert.equal(loopReturnConnection({source:'body',target:outer.id},nested.graph.nodes,visual.scopes,visual.nodes),null)
assert.ok(visual.edges.some(e=>e.source==='__scope_inner'&&e.target===outer.id))
// An authored return to an ancestor traverses the intermediate container boundary.
nested.graph.edges.find(e=>e.id==='ir').target='template_loop'
visual=structureLayout(nested.graph.nodes,nested.graph.edges,nested.graph.layout)
const byId=new Map(visual.nodes.map(n=>[n.id,n]))
for(const e of visual.edges)assert.equal(byId.get(e.source).parentNode,byId.get(e.target).parentNode)
assert.ok(visual.edges.some(e=>e.data.originalEdgeId==='ir'&&e.target===outer.id))
console.log('PASS: repeat markers, explicit returns, migration idempotence, empty output preservation, nested scopes and boundary routing')

