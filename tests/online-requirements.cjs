const assert=require('node:assert/strict'),{buildSync}=require('esbuild'),Module=require('node:module'),path=require('node:path')
const file=path.join(process.cwd(),'online-requirements-test.cjs'),m=new Module(file,module);m.filename=file;m.paths=module.paths
m._compile(buildSync({stdin:{contents:"export {loadRequirementFiles} from './src/utils/onlineRequirements';export {collectOnlineRequirements,requirementsMarkdown} from './src/utils/requirements';export {blankTemplate} from './src/utils/blankTemplate'",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',define:{'import.meta.env.BASE_URL':'"/"'},write:false,logLevel:'silent'}).outputFiles[0].text,file)
const {loadRequirementFiles,collectOnlineRequirements,requirementsMarkdown,blankTemplate}=m.exports
const lib={objects:[{id:'partner',name:'伙伴角色',enabled:true},{id:'place',name:'场所',enabled:true}],attributes:[],buffs:[],items:[]}
const config=blankTemplate(),r=config.graph.nodes.find(n=>n.type==='result')
r.data.effectRules=[{id:'a',source:'object:partner',attribute:'发光度',influence:'增'}]
r.data.animation='自定义表演'
const files=['甲.json','乙.json'].map((name,i)=>({name,sha:String(i).repeat(40),config:structuredClone(config)}))
files[1].config.behavior.name='第二个行为'
const before=JSON.stringify(files),report=collectOnlineRequirements(files,lib)
assert.equal(report.attributes.length,1);assert.equal(report.attributes[0].locations.length,2);assert.equal(report.attributes[0].files.length,2)
assert.equal(report.performances.length,1);assert.equal(report.performances[0].files.length,2)
assert.equal(JSON.stringify(files),before)
const different=structuredClone(files);different[1].config.graph.nodes.find(n=>n.type==='result').data.effectRules[0].source='object:place'
assert.equal(collectOnlineRequirements(different,lib).attributes.length,2,'different object contexts remain distinct')
const fixed={...lib,attributes:[{id:'glow',name:'发光度',enabled:true,objectTypes:['partner']}]}
assert.equal(collectOnlineRequirements(files,fixed).attributes.length,0,'library updates resolve merged requirements')
const markdown=requirementsMarkdown(report,'全部在线行为','2026-10-20',{online:true,files,total:3,publishedAt:'2026-10-20',failures:[{name:'坏文件.json',message:'读取失败'}]})
for(const value of ['甲.json','乙.json','第二个行为','坏文件.json','清单不完整','2 / 3'])assert.ok(markdown.includes(value),value)
async function main(){
 let running=0,max=0;const progress=[]
 const manifest={publishedAt:'snapshot',files:Array.from({length:9},(_,i)=>({name:i+'.json',sha:String(i).repeat(40)}))}
 const result=await loadRequirementFiles({list:async()=>manifest,read:async f=>{
  running++;max=Math.max(max,running);await new Promise(r=>setTimeout(r,2));running--
  if(f.name==='3.json')throw Error('失效版本')
  return {...f,config}
 },onProgress:p=>progress.push(p)})
 assert.equal(max,4);assert.equal(result.files.length,8);assert.equal(result.total,9);assert.deepEqual(result.failures,[{name:'3.json',message:'失效版本'}])
 assert.deepEqual(result.files.map(f=>f.name),manifest.files.filter(f=>f.name!=='3.json').map(f=>f.name))
 assert.deepEqual(progress.at(-1),{completed:9,total:9})
 await assert.rejects(()=>loadRequirementFiles({list:async()=>{throw Error('目录失败')}}),/目录失败/)
 const empty=await loadRequirementFiles({list:async()=>({files:[]}),read:async()=>{throw Error('must not read')}})
 assert.deepEqual(empty.files,[]);assert.equal(empty.total,0)
 const controller=new AbortController();let reads=0
 await assert.rejects(()=>loadRequirementFiles({signal:controller.signal,list:async()=>manifest,read:async()=>{
  reads++;controller.abort();throw new DOMException('aborted','AbortError')
 }}),{name:'AbortError'})
 assert.equal(reads,1,'cancelled scan must stop scheduling files')
 console.log('PASS: cross-file merge/provenance, distinct contexts, library refresh, export scope, bounded concurrency, partial failures, empty list and cancellation')
}
main().catch(e=>{console.error(e);process.exitCode=1})
