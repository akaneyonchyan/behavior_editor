const assert=require('node:assert/strict')
const {buildSync}=require('esbuild'), Module=require('node:module'), path=require('node:path')
const filename=path.join(process.cwd(),'routing-tests.cjs'), m=new Module(filename,module);m.filename=filename;m.paths=module.paths
const code=buildSync({stdin:{contents:"export { default as WeightFactors } from './src/components/WeightFactors.jsx'; export * from './src/utils/edgeRouting.js'; export * from './src/utils/weightFactors.js'; export {validateConfig} from './src/store/documentValidation.js'; export {NODE_CONFIG} from './src/constants/behaviorTypes.js'; export {default as example} from './examples/eat-snack.json'; export {useBehaviorStore as graph} from './src/store/behaviorStore.js'",resolveDir:process.cwd()},bundle:true,loader:{'.css':'empty'},external:['react','react-dom'],platform:'node',format:'cjs',write:false,logLevel:'silent'}).outputFiles[0].text
m._compile(code,filename)
const {routeEdge,inside,newFactor,designFactor,factorSummary,validateFactor,validateConfig,NODE_CONFIG,example,graph}=m.exports
const rect=(id,x,y,w=200,h=140)=>({id,left:x,top:y,right:x+w,bottom:y+h})
function verify(route,rects){
  assert.ok(!route.error,route.error)
  let previous
  for(const command of route.commands){
    const [op,...v]=command
    if(op==='M'){previous={x:v[0],y:v[1]};continue}
    const from=previous,to=op==='Q'?{x:v[2],y:v[3]}:{x:v[0],y:v[1]}
    for(let i=1;i<100;i++){const t=i/100,p=op==='Q'?{x:(1-t)**2*from.x+2*(1-t)*t*v[0]+t*t*to.x,y:(1-t)**2*from.y+2*(1-t)*t*v[1]+t*t*to.y}:{x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t};assert.ok(!rects.some(r=>inside(p,r)),JSON.stringify({command,p}))}
    previous=to
  }
}
const a=rect('a',0,0),b=rect('b',800,0),block=rect('obstacle',350,-40,220,240)
const request={source:{x:200,y:70},target:{x:800,y:70},sourceId:'a',targetId:'b',rects:[a,b,block]}
const routed=routeEdge(request);verify(routed,request.rects);assert.match(routed.path,/Q/)
verify(routeEdge({...request,source:{x:1000,y:70},target:{x:0,y:70},sourceId:'b',targetId:'a'}),request.rects)
verify(routeEdge({...request,source:{x:200,y:110},target:{x:0,y:30},sourceId:'a',targetId:'a'}),request.rects)
const tall=rect('obstacle',350,-400,220,900);verify(routeEdge({...request,rects:[a,b,tall]}),[a,b,tall])
assert.ok(routeEdge({...request,rects:[a,b,rect('overlap',190,0)]}).error)
assert.ok(routeEdge({...request,rects:[]}).error)
// Deterministic scattered obstacles, including negative coordinates.
for(let i=0;i<30;i++){
  const obstacles=Array.from({length:8},(_,j)=>rect('o'+j,300+(j%4)*90,-240+Math.floor(j/4)*350+(i%5)*13,60,80))
  const r=routeEdge({...request,rects:[a,b,...obstacles]});verify(r,[a,b,...obstacles])
}
const started=performance.now()
const large=[a,rect('z',4200,0),...Array.from({length:300},(_,i)=>rect('o'+i,300+(i%30)*120,-1500+Math.floor(i/30)*300,70,160))]
verify(routeEdge({source:{x:200,y:70},target:{x:4200,y:70},sourceId:'a',targetId:'z',rects:large}),large)
console.log('300-obstacle routing ms:',Math.round(performance.now()-started))
const f=newFactor()
assert.deepEqual(Object.keys(f).sort(), ['attribute','id','influence','influenceRule','influenceType','source','version'])
assert.equal(validateFactor(f),'')
assert.ok(validateFactor({...f,influence:100}))
const legacy={version:1,id:'old',source:'actor',attribute:'energy',rule:'negative',objectRef:'',min:0,max:98,amount:20}
const simplified=designFactor(legacy)
assert.equal(simplified.influence,'越高，越不容易触发')
assert.deepEqual(simplified.legacyConfig,legacy)
assert.ok(!factorSummary(legacy).includes('98'))
assert.ok(!factorSummary(legacy).includes('20'))
assert.equal(designFactor({...legacy,rule:'threshold'}).influence,'满足指定条件时调整触发倾向（待说明）')
assert.equal(validateFactor({...f,source:'伙伴A',attribute:'自定义状态',influence:'疲惫时更容易放弃'}),'')
const config=structuredClone(example),branch=config.graph.nodes.find(n=>n.type==='judge').data.branches[0]
branch.weightFactors=[newFactor(),f];validateConfig(config,NODE_CONFIG)
graph.getState().importConfig(config)
assert.deepEqual(graph.getState().exportConfig().graph.nodes.find(n=>n.type==='judge').data.branches[0].weightFactors,branch.weightFactors)
const judge=graph.getState().nodes.find(n=>n.type==='judge')
graph.getState().updateNode(judge.id,{branches:judge.data.branches.map((b,i)=>i===0?{...b,weightFactors:[]}:b)});graph.getState().undo()
assert.equal(graph.getState().nodes.find(n=>n.type==='judge').data.branches[0].weightFactors.length,2)
console.log('PASS: obstacle curves, reverse edges, self loop, tall nodes, blocked ports, missing dimensions, randomized geometry, qualitative rules, legacy preservation, simplified summaries, JSON round trip, undo')


const React=require('react'), {renderToStaticMarkup}=require('react-dom/server')
const html=renderToStaticMarkup(React.createElement(m.exports.WeightFactors,{branch:{weightFactors:[newFactor()]},onChange:()=>{}}))
assert.equal((html.match(/<input/g)||[]).length,5)
for(const label of ['对象大类','判断项','影响类型','影响规则'])assert.ok(html.includes(label))
for(const removed of ['试算','属性上界','属性下界','最大增加权重','倍率'])assert.ok(!html.includes(removed))
console.log('PASS: rule editor renders source/object/property/rule inputs without numerical controls')



