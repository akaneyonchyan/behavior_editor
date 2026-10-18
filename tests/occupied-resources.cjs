const assert=require('node:assert/strict'),{buildSync}=require('esbuild'),Module=require('node:module'),path=require('node:path')
const file=path.join(process.cwd(),'occupied-test.cjs'),m=new Module(file,module);m.filename=file;m.paths=module.paths
m._compile(buildSync({stdin:{contents:"export * from './src/utils/occupiedResources.js';export {blankTemplate} from './src/utils/blankTemplate.js';export {useBehaviorStore as store} from './src/store/behaviorStore.js'",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text,file)
const {upstreamOccupancies:derive,blankTemplate,store}=m.exports,c=blankTemplate(),nodes=c.graph.nodes,edges=c.graph.edges
const row=id=>({id,source:'object:point',attribute:'occupied'})
nodes.find(n=>n.type==='move').data.occupiedResources=[row('move')]
nodes.find(n=>n.id==='template_result_1').data.occupiedResources=[row('branch1')]
nodes.find(n=>n.id==='template_result_2').data.occupiedResources=[row('branch2')]
nodes.push({id:'orphan',type:'result',position:{x:0,y:0},data:{occupiedResources:[row('orphan')]}})
edges.push({id:'orphan-edge',source:'orphan',target:'template_end'})
assert.deepEqual(derive(nodes,edges,'template_end').map(r=>r.id),['move','branch1','branch2'])
const cut=edges.filter(e=>e.target!=='template_result_2')
assert.deepEqual(derive(nodes,cut,'template_end').map(r=>r.id),['move','branch1'])
const tiny=[{id:'s',type:'start',data:{}},{id:'l',type:'loop',data:{restEnabled:false}},{id:'r',type:'result',data:{occupiedResources:[row('rest')]}},{id:'e',type:'end',data:{}},{id:'e2',type:'end',data:{}}]
const links=[{source:'s',target:'l'},{source:'l',sourceHandle:'rest',target:'r'},{source:'r',target:'e'},{source:'e',target:'e2'}]
assert.deepEqual(derive(tiny,links,'e'),[]);tiny[1].data.restEnabled=true;assert.equal(derive(tiny,links,'e').length,1);assert.deepEqual(derive(tiny,links,'e2'),[])
const s=()=>store.getState();s().importConfig(c);const rows=()=>derive(s().nodes,s().edges,'template_end')
assert.equal(rows().length,3);s().updateNode('template_move',{occupiedResources:[]});assert.equal(rows().length,2);s().undo();assert.equal(rows().length,3)
const config=s().exportConfig();s().importConfig(config);assert.equal(rows().length,3);assert.equal(config.graph.nodes.find(n=>n.id==='template_end').data.releaseResources,undefined)
const bad=structuredClone(config);bad.graph.nodes[1].data.occupiedResources=[{id:'bad',source:7,attribute:'x'}];assert.throws(()=>s().importConfig(bad),/占用资源/)
console.log('PASS: upstream references, branches, disconnected nodes, cycles, disabled rest, terminal boundary, undo, roundtrip and validation')
