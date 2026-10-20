
const assert=require('node:assert/strict'),{buildSync}=require('esbuild'),Module=require('node:module'),path=require('node:path')
global.localStorage={getItem:()=>null}
const filename=path.join(process.cwd(),'online-tests.cjs'),m=new Module(filename,module);m.filename=filename;m.paths=module.paths
m._compile(buildSync({stdin:{contents:"export * from './src/utils/onlineBehaviors.js';export {blankTemplate} from './src/utils/blankTemplate.js'",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',write:false,logLevel:'silent'}).outputFiles[0].text,filename)
const a=m.exports,text=JSON.stringify(a.blankTemplate()),file={name:'行为.json',size:text.length,text:async()=>text}
let calls=[],sha='old',failPR=false
global.fetch=async(url,options={})=>{
 const route=url.split('/behavior_editor')[1];calls.push({route,...options,body:options.body&&JSON.parse(options.body)})
 let data
 if(route==='/git/ref/heads/main')data={object:{sha:'head'}}
 else if(route==='/git/commits/head')data={tree:{sha:'root'}}
 else if(route==='/git/trees/root')data={tree:[{path:'behaviors',type:'tree',sha:'folder'}]}
 else if(route==='/git/trees/folder')data={tree:[{path:'行为.json',type:'blob',mode:'100644',sha,size:100},{path:'ignore.json',type:'tree'},{path:'symlink.json',type:'blob',mode:'120000'}]}
 else if(route==='/git/blobs/old')data={encoding:'base64',content:Buffer.from('\ufeff'+text).toString('base64')}
 else if(route==='/git/trees')data={sha:'newtree'}
 else if(route==='/git/commits')data={sha:'newcommit'}
 else if(route==='/git/refs')data={}
 else if(route==='/pulls'){if(failPR)return {ok:false,status:403};data={number:12}}
 else throw Error(route)
 return {ok:true,status:200,json:async()=>data}
}
async function main(){
 const list=await a.listOnlineFiles();assert.equal(list.files.length,1);assert.equal((await a.readOnlineFile(list.files[0])).config.behavior.name,'空白行为')
 assert.equal(calls.every(c=>!c.headers.Authorization),true)
 for(const n of ['../evil.json','a/b.json','CON.json','.env','a\\b.json'])assert.throws(()=>a.validateFileName(n))
 await assert.rejects(a.prepareUpload([{...file,text:async()=> '{}'}]),/行为名称/)
 await assert.rejects(a.prepareUpload([file,{...file,name:'行为.JSON'}]),/重名/)
 const plan=await a.prepareUpload([file]);assert.equal(plan.items[0].previousSha,'old')
 calls=[];sha='changed';await assert.rejects(a.submitUpload(plan,'fake-test-token'),/线上版本已变化/);assert.ok(calls.every(c=>c.method==='GET'))
 sha='old';calls=[];const result=await a.submitUpload(plan,'fake-test-token')
 assert.equal(result.url,a.REPO_URL+'/pull/12')
 const writes=calls.filter(c=>c.method==='POST');assert.deepEqual(writes.map(c=>c.route),['/git/trees','/git/commits','/git/refs','/pulls'])
 assert.equal(writes[0].body.tree[0].path,'behaviors/行为.json');assert.equal(writes[1].body.parents[0],'head');assert.ok(writes[2].body.ref.startsWith('refs/heads/behavior-upload/'));assert.equal(writes[3].body.base,'main')
 assert.ok(!calls.some(c=>c.method==='PATCH'||c.method==='PUT'))
 failPR=true;await assert.rejects(a.submitUpload(plan,'fake-test-token'),e=>!!e.recoveryUrl&&e.message.includes('分支可能已创建'))
 global.localStorage={getItem:()=> 'stale'};await assert.rejects(a.prepareUpload([file]),/自上次下载后/)
 global.fetch=async()=>({ok:false,status:401});await assert.rejects(a.listOnlineFiles('fake'),/Token 无效/)
 console.log('PASS: snapshot reads, Unicode/BOM, upload validation, path restrictions, stale-base rejection, branch-only writes, PR creation and partial-failure recovery')
}
main().catch(e=>{console.error(e);process.exitCode=1})
