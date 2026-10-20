
const assert=require('node:assert/strict'),{buildSync}=require('esbuild'),Module=require('node:module'),path=require('node:path')
class Storage{getItem(k){return this[k]??null}setItem(k,v){this[k]=String(v)}}
global.localStorage=new Storage();global.window=new EventTarget();window.isSecureContext=true;window.confirm=()=>true;global.document=new EventTarget();global.indexedDB={open(){throw Error('test')}};global.setInterval=()=>1;global.clearInterval=()=>{}
const filename=path.join(process.cwd(),'download-tests.cjs'),m=new Module(filename,module);m.filename=filename;m.paths=module.paths
m._compile(buildSync({stdin:{contents:"export * from './src/utils/downloadBehavior.js';export * from './src/store/documentSession.js';export {useBehaviorStore as graph} from './src/store/behaviorStore.js';export {blankTemplate} from './src/utils/blankTemplate.js'",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',write:false,logLevel:'silent'}).outputFiles[0].text,filename)
const a=m.exports,remote={name:'行为.json',sha:'sha',text:JSON.stringify(a.blankTemplate())}
let permission='granted',writes=0,fail=false
const handle={name:'行为.json',text:'original',getFile:async()=>({name:'行为.json',text:async()=>handle.text}),isSameEntry:async h=>h===handle,createWritable:async()=>({write:async t=>{if(fail)throw Error('disk full');handle.text=t;writes++},close:async()=>{},abort:async()=>{}})}
const dir={name:'test',queryPermission:async()=> 'denied',requestPermission:async()=>permission,getFileHandle:async()=>handle}
async function main(){
 const stop=a.startPersistence();await a.waitForInitialization();a.skipSetup()
 await assert.rejects(a.downloadBehavior(remote),/保存目录/)
 window.showDirectoryPicker=async()=>dir;await a.chooseDirectory()
 window.confirm=()=>false;assert.equal(await a.downloadBehavior(remote),false);assert.equal(writes,0)
 window.confirm=()=>{handle.text='external';return true};await assert.rejects(a.downloadBehavior(remote),/刚被其他程序修改/);assert.equal(writes,0)
 window.confirm=()=>true;permission='denied';await assert.rejects(a.downloadBehavior(remote),/写入权限/);permission='granted'
 fail=true;await assert.rejects(a.downloadBehavior(remote),/disk full/);assert.equal(writes,0);fail=false
 const result=await a.downloadBehavior(remote);assert.equal(result.opened,true);assert.equal(handle.text,remote.text);assert.equal(localStorage.getItem('pps-online-base:行为.json'),'sha')
 a.graph.getState().updateBehaviorInfo({name:'unsaved'})
 await assert.rejects(a.downloadBehavior(remote),/正在编辑且尚未保存/);assert.equal(writes,1)
 stop();console.log('PASS: directory required, cancel overwrite, external write conflict, permissions, disk failure, original bytes, provenance and dirty local protection')
}
main().catch(e=>{console.error(e);process.exitCode=1})
