const assert=require('node:assert/strict'),{buildSync}=require('esbuild'),Module=require('node:module'),path=require('node:path')
class Storage{getItem(k){return this[k]??null}setItem(k,v){this[k]=String(v)}removeItem(k){delete this[k]}}
global.localStorage=new Storage();global.window=new EventTarget();window.isSecureContext=true;window.confirm=()=>true
global.document=new EventTarget();document.visibilityState='visible';document.createElement=()=>({click(){}})
global.setInterval=()=>1;global.clearInterval=()=>{}
const settings=new Map()
global.indexedDB={open(){const req={};queueMicrotask(()=>{req.result={createObjectStore(){},close(){},transaction(){const tx={objectStore(){return {get(key){const op={};queueMicrotask(()=>{op.result=settings.get(key);tx.oncomplete?.()});return op},put(value,key){const op={};queueMicrotask(()=>{settings.set(key,value);tx.oncomplete?.()});return op}}}};return tx}};req.onsuccess?.()});return req}}
const missing=()=>Object.assign(Error('missing'),{name:'NotFoundError'})
function file(name,text=''){return {name,text,permission:'granted',exists:true,writes:0,requests:0,async queryPermission(){return this.permission},async requestPermission(){this.requests++;return this.permission='granted'},async getFile(){if(!this.exists)throw missing();return {name:this.name,text:async()=>this.text}},async createWritable(){const target=this;let pending;return {async write(text){pending=text},async close(){target.text=pending;target.writes++},async abort(){}}}}}
const cache=new Map(),directory={name:'team-behaviors',permission:'granted',requests:0,async queryPermission(){return this.permission},async requestPermission(){this.requests++;return this.permission='granted'},async getDirectoryHandle(name){assert.equal(name,'.behavior-editor-cache');return {async getFileHandle(name,opts){if(!cache.has(name)){if(!opts?.create)throw missing();cache.set(name,file(name))}return cache.get(name)}}}}
let pickerCount=0,openOptions,saveOptions
window.showDirectoryPicker=async()=>{pickerCount++;return directory}
const filename=path.join(process.cwd(),'startup-test-bundle.cjs')
const code=buildSync({stdin:{contents:"export * from './src/store/documentSession.js';export {useBehaviorStore as graph} from './src/store/behaviorStore.js';export {validateConfig} from './src/store/documentValidation.js';export {NODE_CONFIG} from './src/constants/behaviorTypes.js'",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',write:false,logLevel:'silent'}).outputFiles[0].text
async function boot(){const m=new Module(filename,module);m.filename=filename;m.paths=module.paths;m._compile(code,filename);const api=m.exports;api.stop=api.startPersistence();await api.waitForInitialization();return api}
const state=a=>a.useDocumentSession.getState(),config=a=>a.graph.getState().exportConfig()
async function main(){
  const a=await boot();assert.equal(state(a).firstRun,true);assert.equal(localStorage.getItem('pps-behavior-v2:latest'),null)
  await a.chooseDirectory();assert.equal(config(a).graph.nodes.length,9);assert.equal(config(a).graph.edges.length,12);assert.equal(state(a).fileName,'');assert.equal(state(a).dirty,false)
  assert.equal(config(a).behavior.targetRules[0].influence,'');a.validateConfig(config(a),a.NODE_CONFIG)
  assert.equal(cache.size,2);assert.ok(cache.has(a.TEMPLATE_FILE));assert.equal(JSON.parse(cache.get(a.TEMPLATE_FILE).text).graph.nodes.length,9);assert.ok(localStorage.getItem('pps-behavior-v2:latest'))
  assert.ok(config(a).graph.nodes.filter(n=>n.type==='result').every(n=>n.data.animation===''&&n.data.playMode===''))
  const formal=file('behavior.json');window.showSaveFilePicker=async options=>{saveOptions=options;return formal}
  assert.equal(formal.writes,0);assert.equal(await a.saveDocument(),true);assert.equal(formal.writes,1);assert.equal(saveOptions.startIn,directory);a.stop()
  const changed=JSON.parse(formal.text);changed.behavior.name='磁盘新版本';formal.text=JSON.stringify(changed)
  const b=await boot();assert.equal(config(b).behavior.name,'磁盘新版本');assert.equal(state(b).dirty,false);assert.equal(state(b).fileName,'behavior.json');assert.equal(pickerCount,1)
  b.graph.getState().updateNode('template_result_1',{animation:'尚未保存的修改'});b.flushDraft();b.stop()
  const c=await boot();assert.equal(config(c).graph.nodes.find(n=>n.id==='template_result_1').data.animation,'尚未保存的修改');assert.equal(state(c).dirty,true)
  window.showSaveFilePicker=async()=>{throw Error('should reuse saved handle')};assert.equal(await c.saveDocument(),true);assert.equal(formal.writes,2)
  c.graph.getState().updateNode('template_result_1',{animation:'发生冲突'});formal.text=JSON.stringify({...JSON.parse(formal.text),externalChange:true});const external=formal.text
  assert.equal(await c.saveDocument(),false);assert.equal(formal.text,external);assert.match(state(c).error,/其他窗口/)
  const other=file('other.json');window.showSaveFilePicker=async options=>{saveOptions=options;return other};assert.equal(await c.saveDocument(true),true);assert.equal(saveOptions.startIn,directory);c.stop()
  other.permission='prompt';directory.permission='prompt'
  const d=await boot();assert.equal(state(d).needsAuthorization,true);assert.equal(pickerCount,1);await d.authorizeStoredAccess();assert.equal(other.requests,1);assert.equal(directory.requests,1);assert.equal(state(d).needsAuthorization,false);assert.equal(state(d).fileName,'other.json')
  window.showOpenFilePicker=async options=>{openOptions=options;return [other]};await d.openDocument();assert.equal(openOptions.startIn,directory);await d.saveDocument();d.stop()
  localStorage.removeItem('pps-behavior-v2:latest')
  const e=await boot();assert.equal(state(e).fileName,'other.json');assert.equal(config(e).graph.nodes.find(n=>n.id==='template_result_1').data.animation,'发生冲突');e.stop()
  other.exists=false
  const f=await boot();assert.equal(config(f).behavior.name,'空白行为');assert.equal(config(f).graph.nodes.length,9);assert.equal(state(f).fileName,'');assert.match(state(f).notice,/找不到/);assert.ok(f.recoveryDrafts().some(r=>r.fileName==='other.json'));f.stop()
  assert.equal(pickerCount,1,'restoration never reopens directory picker')
  // Reloads, edits, and switches must reuse the same two disk cache files.
  const g=await boot(),writes=cache.get(g.AUTOSAVE_FILE).writes;g.stop()
  const h=await boot();assert.equal(cache.get(h.AUTOSAVE_FILE).writes,writes,'unchanged reload must not rewrite cache')
  h.newDocument();await h.backupToDirectory();assert.equal(cache.size,2)
  const i=await boot()
  h.graph.getState().updateBehaviorInfo({name:'tab one'});h.flushDraft();await h.backupToDirectory()
  i.graph.getState().updateBehaviorInfo({name:'tab two'});i.flushDraft();await i.backupToDirectory()
  assert.equal(cache.size,2,'multiple tabs and document switches must not create recovery files')
  assert.equal(JSON.parse(cache.get(i.AUTOSAVE_FILE).text).behavior.name,'tab two')
  assert.ok(i.recoveryDrafts().some(d=>d.config.behavior.name==='tab one'),'other tab draft remains recoverable')
  h.stop();i.stop()
  console.log('PASS: first-use cache-only template, blank fields, fixed cache subdirectory, file handle restore, external disk refresh, dirty draft priority, conflict guard, picker defaults, permission reauthorization, missing-file fallback, no-cache file restore')
}
main().catch(e=>{console.error(e);process.exitCode=1})
