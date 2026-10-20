const assert=require('node:assert/strict'),{buildSync}=require('esbuild'),Module=require('node:module'),path=require('node:path')
class Storage{getItem(k){return this[k]??null}setItem(k,v){this[k]=String(v)}}
global.localStorage=new Storage();global.window=new EventTarget();window.isSecureContext=true;window.confirm=()=>true;global.document=new EventTarget();global.indexedDB={open(){throw Error('unavailable')}};global.setInterval=()=>1;global.clearInterval=()=>{}
const filename=path.join(process.cwd(),'files-tests.cjs'),m=new Module(filename,module);m.filename=filename;m.paths=module.paths
m._compile(buildSync({stdin:{contents:"export * from './src/utils/behaviorFiles.js';export * from './src/store/documentSession.js';export {useBehaviorStore as graph} from './src/store/behaviorStore.js';export {blankTemplate} from './src/utils/blankTemplate.js'",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',write:false,logLevel:'silent'}).outputFiles[0].text,filename)
const a=m.exports,file=(name,text)=>({name,kind:'file',text,async getFile(){return {name,text:async()=>this.text,lastModified:10}},async isSameEntry(h){return h===this},async queryPermission(){return 'granted'},async createWritable(){const h=this;return {write:async t=>{h.text=t},close:async()=>{},abort:async()=>{}}}})
const good=file('行为.JSON','\ufeff'+JSON.stringify(a.blankTemplate())),bad=file('错误.json','{}'),nonjson=file('图片.png',''),cache={kind:'directory',name:'.behavior-editor-cache',values(){throw Error('must never traverse cache')}}
const dir={name:'行为目录',async queryPermission({mode}){return mode==='read'?'granted':'denied'},async *values(){yield cache;yield nonjson;yield bad;yield good}}
async function main(){
 const stop=a.startPersistence();await a.waitForInitialization();a.skipSetup();window.showDirectoryPicker=async()=>dir;await a.chooseDirectory()
 const listed=await a.listBehaviorFiles(dir,good);assert.equal(listed.files.length,2);assert.ok(listed.files.find(f=>f.name===bad.name).error);assert.equal(listed.files.find(f=>f.current).nodes,7)
 assert.equal((await a.listBehaviorFiles(null)).permission,'missing');assert.equal((await a.listBehaviorFiles({...dir,queryPermission:async()=> 'prompt'})).permission,'prompt')
 assert.equal(await a.openDirectoryFile(good,dir),true);assert.equal(a.getCurrentFileHandle(),good);assert.equal(a.useDocumentSession.getState().dirty,false)
 a.graph.getState().updateBehaviorInfo({name:'未保存'});const before=JSON.stringify(a.graph.getState().exportConfig());window.confirm=()=>false
 assert.equal(await a.openDirectoryFile(good,dir),false);assert.equal(JSON.stringify(a.graph.getState().exportConfig()),before)
 window.confirm=()=>true;assert.equal(await a.openDirectoryFile(bad,dir),false);assert.equal(JSON.stringify(a.graph.getState().exportConfig()),before)
 assert.equal(await a.openDirectoryFile(good,{}),false)
 let release;const delayed=file('慢文件.json','');delayed.getFile=()=>new Promise(r=>release=r)
 const pending=a.openDirectoryFile(delayed,dir);a.graph.getState().updateBehaviorInfo({name:'读取期间修改'});release({name:delayed.name,text:async()=>good.text});assert.equal(await pending,false);assert.equal(a.graph.getState().behaviorInfo.name,'读取期间修改')
 assert.equal(await a.openDirectoryFile(good,dir),true);assert.ok(a.recoveryDrafts().some(d=>d.config.behavior.name==='读取期间修改'))
 a.graph.getState().updateBehaviorInfo({name:'保存回原文件'});assert.equal(await a.saveDocument(),true);assert.equal(JSON.parse(good.text).behavior.name,'保存回原文件')
 a.graph.getState().updateBehaviorInfo({name:'冲突'});good.text='external change';assert.equal(await a.saveDocument(),false);assert.equal(good.text,'external change')
 stop();console.log('PASS: directory filtering, BOM, invalid files, permission, identity, cancel, stale directory, mid-read edits, archive and original-handle conflict protection')
}
main().catch(e=>{console.error(e);process.exitCode=1})
