const assert=require('node:assert/strict'),{buildSync}=require('esbuild'),Module=require('node:module'),path=require('node:path')
class Storage{getItem(k){return this[k]??null}setItem(k,v){this[k]=String(v)}}
global.localStorage=new Storage();global.window=new EventTarget();global.document=new EventTarget();global.indexedDB={open(){throw Error('unavailable')}}
window.confirm=()=>true;global.setInterval=()=>1;global.clearInterval=()=>{}
const code=buildSync({stdin:{contents:"export * from './src/store/documentSession.js';export {useBehaviorStore as graph} from './src/store/behaviorStore.js';export {blankTemplate} from './src/utils/blankTemplate.js'",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text
const filename=path.join(process.cwd(),'drop-test.cjs'),m=new Module(filename,module);m.paths=module.paths;m._compile(code,filename);const a=m.exports
const state=()=>a.useDocumentSession.getState(),config=()=>JSON.stringify(a.graph.getState().exportConfig())
const file=(name,text)=>({name,text:async()=>text}),transfer=(f,item)=>({files:[f],items:item?[item]:[]})
async function main(){
 const stop=a.startPersistence();await a.waitForInitialization();a.skipSetup()
 const json=JSON.stringify(a.blankTemplate()),good=file('drop.JSON','\ufeff'+json)
 let handleRequested=false,reads=0
 const handle={kind:'file',name:'drop.JSON',text:'\ufeff'+json,async queryPermission(){return 'granted'},async getFile(){return file(this.name,this.text)},async createWritable(){const h=this;return {async write(t){h.text=t},async close(){},async abort(){}}}}
 good.text=async()=>{assert.ok(handleRequested);reads++;return '\ufeff'+json}
 assert.equal(await a.openDroppedFiles(transfer(good,{kind:'file',getAsFileSystemHandle(){handleRequested=true;return Promise.resolve(handle)}})),true)
 assert.equal(reads,1);assert.equal(state().fileName,'drop.JSON');assert.equal(state().dirty,false)
 a.graph.getState().updateBehaviorInfo({name:'save dropped file'});window.showSaveFilePicker=()=>{throw Error('must reuse dropped handle')}
 assert.equal(await a.saveDocument(),true);assert.equal(JSON.parse(handle.text).behavior.name,'save dropped file')
 a.graph.getState().updateBehaviorInfo({name:'my edits'});const before=config();window.confirm=()=>false
 assert.equal(await a.openDroppedFiles(transfer(file('other.json',json))),false);assert.equal(config(),before)
 for(const t of [{files:[]},{files:[file('a.json',json),file('b.json',json)]},transfer(file('a.txt',json)),transfer(file('a.json','{}')),transfer(file('a.json','bad')),transfer(file('folder.json',json),{kind:'file',webkitGetAsEntry:()=>({isDirectory:true})})]){
  assert.equal(await a.openDroppedFiles(t),false);assert.equal(config(),before)
 }
 window.confirm=()=>true
 assert.equal(await a.openDroppedFiles(transfer(file('other.json',json),{kind:'file',getAsFileSystemHandle:()=>Promise.reject(Error('unsupported'))})),true)
 assert.match(state().notice,/首次保存/);assert.ok(a.recoveryDrafts().some(d=>d.config.behavior.name==='my edits'))
 let release;const pending=a.openDroppedFiles(transfer({name:'slow.json',text:()=>new Promise(r=>release=r)}));assert.equal(state().busy,true)
 assert.equal(await a.openDroppedFiles(transfer(file('second.json',json))),false)
 a.graph.getState().updateBehaviorInfo({name:'edited during read'});release(json);assert.equal(await pending,false);assert.equal(a.graph.getState().behaviorInfo.name,'edited during read');assert.equal(state().busy,false)
 stop();console.log('PASS: file drop handle timing, BOM, direct save, cancel, invalid/multiple/directory files, fallback, draft archive, busy guard and mid-read edit preservation')
}
main().catch(e=>{console.error(e);process.exitCode=1})
