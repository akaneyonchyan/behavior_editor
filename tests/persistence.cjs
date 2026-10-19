const assert = require('node:assert/strict')
const { buildSync } = require('esbuild')
const Module = require('node:module')
const path = require('node:path')
const { randomUUID } = require('node:crypto')
global.crypto ||= { randomUUID }
class Storage { getItem(k) { return this[k] ?? null } setItem(k,v) { this[k] = String(v) } removeItem(k) { delete this[k] } }
global.localStorage = new Storage()
global.window = new EventTarget()
window.isSecureContext = true
window.confirm = () => true
global.document = new EventTarget()
document.visibilityState = 'visible'
document.createElement = () => ({ click() {} })
global.indexedDB = { open() { throw Error('test storage unavailable') } }
const intervals = new Map()
global.setInterval = (fn, ms) => { const id = randomUUID(); intervals.set(id, {fn,ms}); return id }
global.clearInterval = id => intervals.delete(id)
const bundle = buildSync({ stdin: { contents: "export * from './src/store/documentSession.js'; export { useBehaviorStore as graph } from './src/store/behaviorStore.js'; export { default as example } from './examples/eat-snack.json'", resolveDir: process.cwd(), loader: 'js' }, bundle: true, platform: 'node', format: 'cjs', write: false, logLevel: 'silent' }).outputFiles[0].text
function load() { const filename = path.join(process.cwd(), 'test-bundle.cjs'); const m = new Module(filename, module); m.filename = filename; m.paths = module.paths; m._compile(bundle, filename); return m.exports }
function handle(name) {
  return { name, text: '', writes: 0, permission: 'granted', fail: false,
    async queryPermission() { return this.permission }, async requestPermission() { return this.permission },
    async getFile() { return { name: this.name, text: async () => this.text } },
    async createWritable() { if (this.fail) throw Error('disk full'); let pending; const h = this; return { async write(t) { pending = t }, async close() { h.text = pending; h.writes++ }, async abort() {} } }
  }
}
async function main() {
  const a = load(), stop = a.startPersistence(), s = () => a.useDocumentSession.getState()
  await a.waitForInitialization()
  assert.equal(s().firstRun, true)
  a.skipSetup(); a.loadExample(a.example)
  assert.equal(s().dirty, true)
  a.flushDraft()
  const key = localStorage.getItem('pps-behavior-v2:latest')
  assert.equal(JSON.parse(localStorage.getItem(key)).config.graph.nodes.length, a.example.graph.nodes.length+1)
  const leave = new Event('beforeunload', {cancelable:true}); window.dispatchEvent(leave); assert.equal(leave.defaultPrevented,true)
  window.confirm = () => false; a.newDocument(); assert.equal(a.graph.getState().nodes.length,a.example.graph.nodes.length+1)
  window.confirm = () => true
  const formal = handle('formal.json'); window.showSaveFilePicker = async () => formal
  assert.equal(await a.saveDocument(), true); assert.equal(s().dirty,false)
  a.graph.getState().updateNode('move_1', { destination: '保存测试' }); assert.equal(s().dirty,true)
  a.graph.getState().undo(); assert.equal(s().dirty,false)
  a.graph.getState().redo(); assert.equal(s().dirty,true)
  formal.text = 'changed externally'; assert.equal(await a.saveDocument(),false); assert.equal(formal.text,'changed externally')
  const other = handle('other.json'); window.showSaveFilePicker = async () => other
  assert.equal(await a.saveDocument(true),true); assert.equal(s().fileName,'other.json')
  a.graph.getState().updateNode('move_1', { destination: 'new edits' })
  other.fail = true; assert.equal(await a.saveDocument(),false); assert.equal(s().dirty,true)
  window.showSaveFilePicker = async () => { const e = Error('cancel'); e.name='AbortError'; throw e }
  assert.equal(await a.saveDocument(true), false); assert.equal(s().dirty,true)
  const backups = new Map(); let granted = true
  window.showDirectoryPicker = async () => ({ name: 'test-dir', async queryPermission() { return granted ? 'granted' : 'denied' }, async getDirectoryHandle(){return {async getFileHandle(n,options){if(!backups.has(n)){if(!options?.create)throw Object.assign(Error('missing'),{name:'NotFoundError'});backups.set(n,handle(n))}return backups.get(n)}}} })
  await a.chooseDirectory(); assert.equal(backups.size,2)
  const backup = backups.get(a.AUTOSAVE_FILE), count = backup.writes
  await a.backupToDirectory(); assert.equal(backup.writes,count)
  a.graph.getState().updateNode('move_1', { destination: 'timer backup' })
  await [...intervals.values()].find(v=>v.ms===15000).fn()
  assert.equal(JSON.parse(backup.text).graph.nodes.find(n=>n.id==='move_1').data.destination, 'timer backup')
  assert.equal(s().dirty,true, 'backup must not mark formal document saved')
  granted = false; a.graph.getState().updateNode('move_1', { destination: 'permission lost' }); await a.backupToDirectory(); assert.match(s().error,/授权已失效/)
  const before = a.fingerprint(a.graph.getState().exportConfig())
  await a.openFallback({name:'bad.json',text:async()=>'{oops'}); assert.equal(a.fingerprint(a.graph.getState().exportConfig()),before)
  const broken = structuredClone(a.example); broken.graph.nodes[0].position.x='invalid'
  await a.openFallback({name:'bad.json',text:async()=>JSON.stringify(broken)}); assert.equal(a.fingerprint(a.graph.getState().exportConfig()),before)
  a.flushDraft(); stop()
  const b = load(), stopB = b.startPersistence()
  await b.waitForInitialization()
  assert.equal(b.graph.getState().nodes.find(n=>n.id==='move_1').data.destination,'permission lost')
  assert.equal(b.useDocumentSession.getState().dirty,true)
  assert.equal(b.useDocumentSession.getState().firstRun,false)
  const restoredKey = localStorage.getItem('pps-behavior-v2:latest'); assert.notEqual(restoredKey,key)
  b.newDocument(); assert.equal(b.graph.getState().nodes.length,9); assert.equal(b.graph.getState().edges.length,12); assert.equal(b.useDocumentSession.getState().dirty,false)
  const previous = b.recoveryDrafts().find(d=>d.config.graph.nodes.length===a.example.graph.nodes.length+1)
  assert.ok(previous); b.recoverDraft(previous); assert.equal(b.graph.getState().nodes.length,a.example.graph.nodes.length+1)
  await b.openFallback({name:'bom.json',text:async()=>String.fromCharCode(0xfeff)+JSON.stringify(b.example)})
  assert.equal(b.useDocumentSession.getState().dirty,false)
  b.graph.getState().updateNode('move_1',{destination:'quota test'})
  const originalSet=localStorage.setItem; localStorage.setItem=()=>{throw Error('quota')}; b.flushDraft(); assert.match(b.useDocumentSession.getState().error,/草稿写入失败/); localStorage.setItem=originalSet
  stopB()
  console.log('PASS: first run, drafts, leave guard, cancel switch, save/save-as, undo dirty state, external conflict, disk errors, picker cancel, 15s backup, permission loss, invalid import, reload recovery, independent tab drafts, archive recovery, BOM, quota error')
}
main().catch(e=>{console.error(e);process.exitCode=1})
