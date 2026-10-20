const assert=require('node:assert/strict'),{buildSync}=require('esbuild'),Module=require('node:module'),path=require('node:path')
const file=path.join(process.cwd(),'endings-test.cjs'),m=new Module(file,module);m.filename=file;m.paths=module.paths
m._compile(buildSync({stdin:{contents:"export * from './src/utils/endings.js';export {blankTemplate} from './src/utils/blankTemplate.js';export {useBehaviorStore as store} from './src/store/behaviorStore.js'",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text,file)
const {splitLegacyEnd,blankTemplate,store}=m.exports
const template=blankTemplate(),ends=template.graph.nodes.filter(n=>n.type==='end')
assert.equal(ends.length,1);assert.ok(ends.every(n=>!Object.hasOwn(n.data,'endReason')));assert.equal(m.exports.endLabel({endReason:'中断'}),'结束')
assert.ok(!template.graph.edges.some(e=>e.sourceHandle==='insufficient'))
const nodes=[{id:'loop',type:'loop',position:{x:0,y:0},data:{}},{id:'other',type:'result',position:{x:0,y:0},data:{}},{id:'end',type:'end',position:{x:400,y:100},data:{successAnimation:'欢呼',failAnimation:'叹气',playMode:'计时',playExpectation:'短暂',releaseResources:['点位'],targetCondition:'自定义目标',custom:'保留'}}]
const edges=[{id:'a',source:'loop',sourceHandle:'complete',target:'end'},{id:'b',source:'loop',sourceHandle:'insufficient',target:'end'},{id:'c',source:'other',target:'end'}],before=JSON.stringify({nodes,edges})
assert.throws(()=>splitLegacyEnd(nodes,edges,'end',{},'new'),/每条入线/)
assert.throws(()=>splitLegacyEnd(nodes,edges,'end',{c:'完成'},'loop'),/重复/)
assert.throws(()=>splitLegacyEnd(nodes,[...edges,{source:'end',target:'loop'}],'end',{c:'完成'},'new'),/出线/)
const result=splitLegacyEnd(nodes,edges,'end',{c:'中断'},'new')
assert.deepEqual(result.edges.map(e=>e.target),['end','new','new'])
assert.deepEqual(result.nodes.filter(n=>n.type==='end').map(n=>n.data.animation),['欢呼','叹气'])
for(const n of result.nodes.filter(n=>n.type==='end')){assert.equal(Object.hasOwn(n.data,'endReason'),false);assert.equal(n.data.playMode,'计时');assert.equal(n.data.targetCondition,'自定义目标');assert.equal(n.data.custom,'保留');assert.deepEqual(n.data.legacyEndConfig,nodes[2].data);assert.equal(Object.hasOwn(n.data,'successAnimation'),false)}
assert.equal(JSON.stringify({nodes,edges}),before)
const s=()=>store.getState();s().importConfig({behavior:{name:'旧图'},graph:{nodes,edges}})
const old=s().exportConfig();s().splitEnd('end',{[s().edges.find(e=>e.source==='other').id]:'中断'});const after=s().exportConfig()
assert.equal(after.graph.nodes.filter(n=>n.type==='end').length,2)
s().undo();assert.deepEqual(s().exportConfig(),old);s().redo();assert.deepEqual(s().exportConfig(),after)
s().importConfig(after);assert.deepEqual(s().exportConfig().graph.nodes,after.graph.nodes);assert.deepEqual(s().edges.map(e=>[e.source,e.target,e.sourceHandle]),after.graph.edges.map(e=>[e.source,e.target,e.sourceHandle]))
const count=s().edges.length;s().connect({source:'end',target:'other'});assert.equal(s().edges.length,count)
console.log('PASS: separate endings, legacy routing, lossless preservation, validation, atomic undo/redo, roundtrip and terminal connection guard')
