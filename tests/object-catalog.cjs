const assert=require('node:assert/strict'),{buildSync}=require('esbuild'),Module=require('node:module'),path=require('node:path')
const filename=path.join(process.cwd(),'catalog-tests.cjs'),m=new Module(filename,module);m.filename=filename;m.paths=module.paths
m._compile(buildSync({stdin:{contents:"export * from './src/store/contentLibrary.js';export * from './shared/library-model.mjs';export * from './src/utils/nodeDesign.js';export {blankTemplate} from './src/utils/blankTemplate.js';export {useBehaviorStore} from './src/store/behaviorStore.js';export {validateConfig} from './src/store/documentValidation.js';export {NODE_CONFIG} from './src/constants/behaviorTypes.js';",resolveDir:process.cwd()},bundle:true,external:['react','react-dom'],platform:'node',format:'cjs',write:false,logLevel:'silent'}).outputFiles[0].text,filename)
const {DEFAULT_LIBRARY,objectChoices,objectName,validateLibrary,sameLibrary,branchFactors,judgeAttributes,setJudgeAttributes,useBehaviorStore:store,validateConfig,NODE_CONFIG}=m.exports
const lib=structuredClone(DEFAULT_LIBRARY),row=(id,objectType,name,enabled=true)=>({id,objectType,name,enabled,description:''})
lib.items=[row('food/apple','food','苹果'),row('material/apple','material','苹果'),row('food/hidden','food','停用食物',false)]
validateLibrary(lib);assert.equal(objectChoices(lib,'food').length,1);assert.equal(objectChoices(lib,'food')[0].id,'item:food/apple');assert.deepEqual(objectChoices(lib,''),[])
assert.equal(objectName(lib,'item:food/apple'),'苹果');lib.items[0].name='红苹果';assert.equal(objectName(lib,'item:food/apple'),'红苹果')
assert.equal(objectName(lib,'自定对象'),'自定对象');lib.objects.find(o=>o.id==='food').enabled=false;assert.deepEqual(objectChoices(lib,'food'),[]);assert.equal(objectName(lib,'item:food/apple'),'红苹果')
assert.equal(sameLibrary(DEFAULT_LIBRARY,{...DEFAULT_LIBRARY,items:[]}),true);assert.equal(sameLibrary(lib,{...lib,items:[]}),false)
for(const patch of [{name:7},{objectType:'missing'},{enabled:'true'},{description:null},{id:''}]){const bad=structuredClone(lib);Object.assign(bad.items[0],patch);assert.throws(()=>validateLibrary(bad))}
const duplicate=structuredClone(lib);duplicate.items.push({...duplicate.items[0],id:'other'});assert.throws(()=>validateLibrary(duplicate),/名称/)
const attributes=[{id:'a',source:'object:food',objectName:'item:food/apple',attribute:'freshness'}]
assert.equal(branchFactors({},attributes)[0].objectName,'item:food/apple')
const updated=setJudgeAttributes({judgeAttributes:attributes,branches:[{id:'b',weightFactors:[{...branchFactors({},attributes)[0],influence:'不影响'}]}]},[{...attributes[0],objectName:'自定苹果'}])
assert.equal(updated.branches[0].weightFactors[0].objectName,'自定苹果')
assert.equal(judgeAttributes({branches:[{weightFactors:[{version:2,...attributes[0],influence:''},{version:2,...attributes[0],objectName:'其他苹果',influence:''}]}]}).length,2)
const config=m.exports.blankTemplate(),rule={id:'r',source:'object:food',objectName:'item:food/apple',attribute:'freshness',influence:'减少'}
config.behavior.targetRules=[rule];config.behavior.preconditions.interactObjectRules=[{id:'r',objectType:'food',objectName:'手填对象'}]
const execute=config.graph.nodes.find(n=>n.type==='result');execute.data.effectRules=[rule];execute.data.occupiedResources=[{...rule}]
validateConfig(config,NODE_CONFIG);store.getState().importConfig(config)
assert.equal(store.getState().exportConfig().behavior.targetRules[0].objectName,'item:food/apple')
store.getState().updateNode(execute.id,{effectRules:[{...rule,objectName:'修改对象'}]});store.getState().undo();assert.equal(store.getState().exportConfig().graph.nodes.find(n=>n.id===execute.id).data.effectRules[0].objectName,'item:food/apple')
config.behavior.targetRules[0].objectName={};assert.throws(()=>validateConfig(config,NODE_CONFIG),/对象名/)
console.log('PASS: catalog validation, per-type names, disabled/rename, snapshot comparison, shared branch inheritance, custom references, JSON roundtrip and undo')
