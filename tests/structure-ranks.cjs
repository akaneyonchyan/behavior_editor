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
// Targets created in reverse order must follow source port heights, including
// through nested loops. Edge insertion order is not a visual ordering rule.
const node=(id,type)=>({id,type,position:{x:0,y:0},data:{name:id,loopVersion:3}})
const downstream={nodes:[node('s','start'),node('source','loop'),node('bottom','result'),node('middle','result'),node('top','result'),node('c','loop'),node('b','loop'),node('a','loop'),node('done','loop')],edges:[{id:'s-source',source:'s',target:'source'},{id:'entry',source:'source',sourceHandle:'continue',target:'top'},{id:'low',source:'bottom',target:'c'},{id:'mid',source:'middle',target:'b'},{id:'high',source:'top',target:'a'},{id:'done-edge',source:'source',sourceHandle:'complete',target:'done'}],layout:{version:1,scopes:[{loopId:'source',entry:'top',members:['top','middle','bottom']},...['a','b','c','done'].map(loopId=>({loopId,entry:'',members:[]}))],positions:{top:{x:120,y:200},middle:{x:120,y:500},bottom:{x:120,y:800}}}}
const ordered=(graph,collapsed=[],handles={})=>structureLayout(graph.nodes,graph.edges,graph.layout,{},collapsed,handles)
const targetOrder=visual=>visual.nodes.filter(n=>['a','b','c','done'].includes(n.data?.scope?.loopId)).sort((a,b)=>a.position.y-b.position.y).map(n=>n.data.scope.loopId)
const unchanged=structuredClone(downstream)
assert.deepEqual(targetOrder(ordered(downstream)),['done','a','b','c'])
assert.deepEqual(targetOrder(ordered({...downstream,edges:[...downstream.edges].reverse()})),['done','a','b','c'])
assert.deepEqual(downstream,unchanged)
// Collapsed outgoing ports have their own compact visible order.
assert.deepEqual(targetOrder(ordered(downstream,['source'])),['done','c','b','a'])
const nested=structuredClone(downstream)
nested.nodes.push(node('inner','loop'));nested.layout.scopes[0].members.push('inner')
nested.layout.scopes[0].entry='inner';nested.edges.find(e=>e.id==='entry').target='inner'
nested.edges.push({id:'nested-entry',source:'inner',sourceHandle:'continue',target:'top'})
nested.layout.scopes.push({loopId:'inner',entry:'top',members:['top','middle','bottom']})
assert.deepEqual(targetOrder(ordered(nested)),['done','a','b','c'])
assert.deepEqual(targetOrder(ordered(nested,['inner'])),['done','c','b','a'])
// Measured judge ports can differ from branch array order; use rendered height.
const judge=structuredClone(downstream)
judge.nodes=judge.nodes.filter(n=>!['top','middle','bottom'].includes(n.id));judge.nodes.push({...node('j','judge'),data:{branches:[{id:'low'},{id:'mid'},{id:'high'}]}})
judge.layout.scopes[0]={loopId:'source',entry:'j',members:['j']};judge.layout.positions={}
judge.edges=judge.edges.map(e=>['low','mid','high'].includes(e.id)?{...e,source:'j',sourceHandle:e.id}:e.id==='entry'?{...e,target:'j'}:e)
assert.deepEqual(targetOrder(ordered(judge,[],{j:{low:300,mid:200,high:100}})),['done','a','b','c'])
const pinned=structuredClone(downstream);pinned.layout.positions.__scope_c={x:1300,y:20}
assert.deepEqual(ordered(pinned).nodes.find(n=>n.id==='__scope_c').position,{x:1300,y:20})
console.log('PASS: downstream containers follow visible source exits, nested and collapsed sources, measured branch handles, stable edge order and pinned positions')

