const assert=require('node:assert/strict'),{buildSync}=require('esbuild'),Module=require('node:module'),path=require('node:path')
const file=path.join(process.cwd(),'metadata-test.cjs'),m=new Module(file,module);m.filename=file;m.paths=module.paths
const code=buildSync({stdin:{contents:"export {default as Panel} from './src/components/PropertyPanel.jsx';export {useBehaviorStore as store} from './src/store/behaviorStore.js'; export {NODE_CONFIG} from './src/constants/behaviorTypes.js'; export {validateConfig} from './src/store/documentValidation.js'",resolveDir:process.cwd()},loader:{'.css':'empty'},bundle:true,external:['react','react-dom'],platform:'node',format:'cjs',write:false,logLevel:'silent'}).outputFiles[0].text;m._compile(code,file)
const {Panel,store,NODE_CONFIG,validateConfig}=m.exports,React=require('react'),{renderToStaticMarkup}=require('react-dom/server')

let html=renderToStaticMarkup(React.createElement(Panel));assert.ok(html.includes('选择节点可编辑节点属性'));assert.ok(html.includes('行为名称'));assert.ok(html.includes('满足目标'))
store.getState().updateBehaviorInfo({targetRules:[{id:'goal',source:'actor',attribute:'energy',influence:'恢复至正常状态'}],preconditions:{interactObject:'旧对象',consumables:['旧消耗品'],attributes:['旧门槛'],interactObjectType:'food',consumableRules:[{id:'c',objectType:'food',requirement:'有可用存量'}],attributeRules:[{id:'a',source:'actor',attribute:'energy',influence:'较低时'}]}})
const config=store.getState().exportConfig();validateConfig(config,NODE_CONFIG);store.getState().importConfig(config);assert.deepEqual(store.getState().exportConfig(),config)
store.getState().updateBehaviorInfo({name:'修改名称'});store.getState().undo();assert.equal(store.getState().behaviorInfo.name,config.behavior.name)
assert.equal(store.getState().behaviorInfo.preconditions.interactObject,'旧对象')
const node={id:'test',type:'wait',position:{x:0,y:0},data:{name:'待机'}};store.getState().addNode(node);assert.equal(store.getState().selectedNode.id,'test')
store.getState().selectNode(null);assert.ok(store.getState().nodes.every(n=>!n.selected));html=renderToStaticMarkup(React.createElement(Panel));assert.ok(html.includes('aria-label="行为元数据"'))
const bad=structuredClone(config);bad.behavior.targetRules[0].attribute=1;assert.throws(()=>validateConfig(bad,NODE_CONFIG));const bad2=structuredClone(config);bad2.behavior.preconditions.consumableRules.push(bad2.behavior.preconditions.consumableRules[0]);assert.throws(()=>validateConfig(bad2,NODE_CONFIG))
console.log('PASS: metadata panel, selection switching, legacy retention, structured rules round trip, undo and validation')
