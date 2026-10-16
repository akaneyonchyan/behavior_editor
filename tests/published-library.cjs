const assert = require('node:assert/strict'), {buildSync} = require('esbuild'), Module = require('node:module'), path = require('node:path')
global.localStorage = {values:new Map(),getItem(k){return this.values.get(k)||null},setItem(k,v){this.values.set(k,v)}}
global.window = new EventTarget(); global.document = new EventTarget(); document.visibilityState='visible'
let tick, interval, cleared=false
global.setInterval=(fn,ms)=>{tick=fn;interval=ms;return 1};global.clearInterval=()=>{cleared=true}
const code=buildSync({stdin:{contents:"export * from './src/store/publishedLibrary.js'; export {useContentLibrary as store} from './src/store/contentLibrary.js'",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',define:{'import.meta.env':'{"VITE_LIBRARY_MODE":"published","BASE_URL":"/behavior_editor/"}'},write:false,logLevel:'silent'}).outputFiles[0].text
const m=new Module(path.join(process.cwd(),'test-published.cjs'),module);m.filename=path.join(process.cwd(),'test-published.cjs');m.paths=module.paths;m._compile(code,m.filename)
const {store,startPublishedLibrary,refreshPublishedLibrary}=m.exports
const library={version:1,objects:[{id:'p',name:'伙伴',enabled:true,description:''}],attributes:[],buffs:[]}
let data={syncedAt:'2026-10-17T10:00:00Z',library}, calls=0, url
global.fetch=async u=>{calls++;url=u;return {ok:true,json:async()=>structuredClone(data)}}
async function main(){
  const stop=startPublishedLibrary();await refreshPublishedLibrary()
  assert.equal(calls,1);assert.ok(url.startsWith('/behavior_editor/data/library.json?'));assert.equal(interval,60000)
  assert.equal(store.getState().library.objects[0].name,'伙伴');assert.equal(store.getState().save(library),false)
  data={syncedAt:'2026-10-17T10:05:00Z',library:{...library,objects:[{...library.objects[0],name:'伙伴新版'}]}}
  await tick();assert.equal(store.getState().library.objects[0].name,'伙伴新版')
  const checked=store.getState().checkedAt
  global.fetch=async()=>{throw Error('offline')};assert.equal(await refreshPublishedLibrary(),false)
  assert.equal(store.getState().checkedAt,checked);assert.equal(store.getState().library.objects[0].name,'伙伴新版');assert.match(store.getState().error,/当前内容保留/)
  global.fetch=async()=>({ok:true,json:async()=>({syncedAt:'2026-10-17T09:00:00Z',library})})
  assert.equal(await refreshPublishedLibrary(),false);assert.equal(store.getState().library.objects[0].name,'伙伴新版')
  global.fetch=async()=>({ok:true,json:async()=>({syncedAt:'bad',library})});assert.equal(await refreshPublishedLibrary(),false)
  stop();assert.equal(cleared,true)
  startPublishedLibrary();assert.equal(store.getState().library.objects[0].name,'伙伴新版');await refreshPublishedLibrary()
  console.log('PASS: published path, deduplication, 60s refresh, read-only, cache restore, invalid/older snapshot rejection, failure retention and timer cleanup')
}
main().catch(e=>{console.error(e);process.exitCode=1})
