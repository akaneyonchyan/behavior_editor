const assert=require('node:assert/strict'),{buildSync}=require('esbuild'),Module=require('node:module'),path=require('node:path')
const values=new Map();global.localStorage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)}
const filename=path.join(process.cwd(),'library-tests.cjs'),m=new Module(filename,module);m.filename=filename;m.paths=module.paths
const code=buildSync({stdin:{contents:"export * from './src/store/contentLibrary.js'; export {useBehaviorStore} from './src/store/behaviorStore.js'; export {validateConfig} from './src/store/documentValidation.js'; export {NODE_CONFIG} from './src/constants/behaviorTypes.js'; export {default as example} from './examples/eat-snack.json'",resolveDir:process.cwd()},bundle:true,external:['react','react-dom'],platform:'node',format:'cjs',write:false,logLevel:'silent'}).outputFiles[0].text;m._compile(code,filename)
const {DEFAULT_LIBRARY,validateLibrary,propertyChoices,propertyName,ruleSummary,useContentLibrary:store,useBehaviorStore:graph,validateConfig,NODE_CONFIG,example}=m.exports
let lib=structuredClone(DEFAULT_LIBRARY)
assert.ok(propertyChoices(lib,'actor').some(a=>a.id==='energy'))
assert.ok(!propertyChoices(lib,'actor').some(a=>a.id==='freshness'))
assert.deepEqual(propertyChoices(lib,'object:food').map(a=>a.id),['freshness'])
assert.deepEqual(propertyChoices(lib,'interactObject'),[],'Generic roles must not silently imply an object type')
lib.buffs.push({id:'test-buff',name:'鼓舞',objectTypes:['partner'],description:'示例测试',enabled:true})
assert.ok(propertyChoices(lib,'actor').some(a=>a.id==='buff:test-buff'))
assert.ok(!propertyChoices(lib,'object:food').some(a=>a.id==='buff:test-buff'))
assert.equal(store.getState().save(lib),true)
assert.deepEqual(JSON.parse(values.get('pps-content-library-v1')),lib)
lib.attributes.find(a=>a.id==='energy').name='活力'
assert.match(ruleSummary(lib,{source:'actor',attribute:'energy',influence:'减少'}),/活力/)
lib.attributes.find(a=>a.id==='energy').enabled=false
assert.ok(!propertyChoices(lib,'actor').some(a=>a.id==='energy'))
assert.equal(propertyName(lib,'energy'),'活力','Disabled references still retain their name')
const invalid=structuredClone(lib);invalid.buffs[0].objectTypes=['missing'];assert.throws(()=>validateLibrary(invalid))
const duplicate=structuredClone(lib);duplicate.objects[1].name=duplicate.objects[0].name;assert.throws(()=>validateLibrary(duplicate))
const before=store.getState().library;assert.equal(store.getState().save(invalid),false);assert.deepEqual(store.getState().library,before)
global.localStorage.setItem=()=>{throw new Error('QuotaExceededError')};assert.equal(store.getState().save(lib),false);assert.deepEqual(store.getState().library,before)
const config=structuredClone(example),rule={id:'rule',source:'actor',attribute:'buff:test-buff',influence:'添加 Buff'}
config.graph.nodes.find(n=>n.type==='result').data.effectRules=[rule]
config.graph.nodes.find(n=>n.type==='loop').data.loopRules=[{...rule,influence:'具有鼓舞时'}]
config.behavior.preconditions.attributeRules=[{...rule,influence:'具有鼓舞时'}]
validateConfig(config,NODE_CONFIG);graph.getState().importConfig(config)
assert.deepEqual(graph.getState().exportConfig().behavior.preconditions.attributeRules.find(r=>r.id==='rule'),{...rule,influence:'具有鼓舞时'})
assert.ok(graph.getState().exportConfig().behavior.preconditions.attributeRules.some(r=>r.influence==='食物可食用'))
const result=graph.getState().nodes.find(n=>n.type==='result');graph.getState().updateNode(result.id,{effectRules:[]});graph.getState().undo()
assert.deepEqual(graph.getState().nodes.find(n=>n.id===result.id).data.effectRules,[rule])
config.graph.nodes.find(n=>n.type==='result').data.effectRules=[{...rule,influence:3}];assert.throws(()=>validateConfig(config,NODE_CONFIG))
console.log('PASS: type filtering, independent Buffs, stable rename/disable references, storage and quota errors, invalid imports, qualitative rule round trip and undo')
