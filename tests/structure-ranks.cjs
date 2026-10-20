const assert=require('node:assert/strict'),{buildSync}=require('esbuild'),Module=require('node:module'),path=require('node:path')
const file=path.join(process.cwd(),'rank-tests.cjs'),m=new Module(file,module);m.filename=file;m.paths=module.paths
m._compile(buildSync({stdin:{contents:"export {structureRanks} from './src/utils/structureRanks';export {structureLayout} from './src/utils/structureLayout';export {blankTemplate} from './src/utils/blankTemplate'",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text,file)
const {structureRanks,structureLayout,blankTemplate}=m.exports
const items=['result','retry','entry','judge','finish'],links=[['entry','judge'],['judge','result'],['judge','retry'],['retry','entry'],['result','finish']]
const r=structureRanks(items,links,'entry')
assert.equal(r.get('entry'),0);assert.ok(r.get('judge')>r.get('entry'));assert.equal(r.get('result'),r.get('retry'));assert.ok(r.get('finish')>r.get('result'))
const local=structureRanks(['entry','wait','judge','retry','finish'],[['entry','wait'],['wait','judge'],['judge','retry'],['retry','wait'],['judge','finish']],'entry')
assert.ok(local.get('entry')<local.get('wait'));assert.ok(local.get('wait')<local.get('judge'));assert.ok(local.get('judge')<local.get('finish'))
const graph=blankTemplate().graph
graph.edges.find(e=>e.source==='template_result_1').target='template_judge'
const before=structuredClone(graph),v=structureLayout(graph.nodes,graph.edges,graph.layout)
const pos=id=>v.nodes.find(n=>n.id===id).position
assert.ok(pos('template_judge').x<pos('template_result_1').x);assert.ok(pos('template_result_2').x<pos('template_wait').x)
assert.deepEqual(graph,before)
assert.ok(v.edges.some(e=>e.source==='template_result_1'&&e.target==='template_judge'))
const saved={...graph.layout,positions:{template_result_1:{x:140,y:900}}},manual=structureLayout(graph.nodes,graph.edges,saved)
assert.deepEqual(manual.nodes.find(n=>n.id==='template_result_1').position,{x:140,y:900})
assert.deepEqual([...structureRanks(items,links,'entry')],[...r])
console.log('PASS: retry cycles keep horizontal forward ranks, branches align, real edges and manual positions preserved')

