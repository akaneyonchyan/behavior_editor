const assert=require('node:assert/strict'),{buildSync}=require('esbuild'),Module=require('node:module'),path=require('node:path')
const file=path.join(process.cwd(),'node-design-test.cjs'),m=new Module(file,module);m.filename=file;m.paths=module.paths
const code=buildSync({stdin:{contents:"export * from './src/utils/nodeDesign.js';export {useBehaviorStore as store} from './src/store/behaviorStore.js';export {validateConfig} from './src/store/documentValidation.js';export {NODE_CONFIG} from './src/constants/behaviorTypes.js';export {default as ResultFields} from './src/components/ResultFields.jsx';export {default as JudgeFields} from './src/components/JudgeFields.jsx';export {default as TextChoice} from './src/components/TextChoice.jsx'",resolveDir:process.cwd()},loader:{'.css':'empty'},bundle:true,external:['react','react-dom'],platform:'node',format:'cjs',write:false,logLevel:'silent'}).outputFiles[0].text;m._compile(code,file)
const {judgeAttributes,branchFactors,setJudgeAttributes,resultRules,store,validateConfig,NODE_CONFIG,ResultFields,JudgeFields,TextChoice}=m.exports,React=require('react'),{renderToStaticMarkup:render}=require('react-dom/server')
const old={branches:[{id:'a',name:'A',weightFactors:[{id:'f',version:2,source:'actor',attribute:'energy',influence:'自定义影响'}]},{id:'b',name:'B',weightFactors:[{id:'f',version:2,source:'actor',attribute:'satiety',influence:'另一规则'}]}]}
let attrs=judgeAttributes(old);assert.equal(attrs.length,2);assert.equal(new Set(attrs.map(a=>a.id)).size,2)
let data={...old,...setJudgeAttributes(old,attrs)};assert.equal(data.branches[0].weightFactors[0].influence,'自定义影响');assert.equal(data.branches[1].weightFactors[0].influence,'不影响')
attrs=attrs.map((a,i)=>i? a:{...a,source:'自定义对象',attribute:'新属性'});data={...data,...setJudgeAttributes(data,attrs)}
assert.equal(data.branches[0].weightFactors[0].influence,'自定义影响');assert.equal(data.branches[0].weightFactors[0].source,'自定义对象')
assert.equal(branchFactors({},attrs).length,2);assert.ok(branchFactors({},attrs).every(f=>f.influence==='不影响'))
const removed=setJudgeAttributes(data,attrs.slice(1));assert.ok(removed.branches.every(b=>b.weightFactors.length===1))
store.getState().addNode({id:'j',type:'judge',position:{x:0,y:0},data});let config=store.getState().exportConfig();validateConfig(config,NODE_CONFIG);store.getState().importConfig(config);assert.deepEqual(store.getState().exportConfig(),config)
store.getState().updateNode('j',removed);store.getState().undo();assert.deepEqual(store.getState().nodes.find(n=>n.id==='j').data,data)
const effects={effectRules:[{id:'a',source:'actor',attribute:'energy',influence:'增'},{id:'b',source:'actor',attribute:'buff:happy',influence:'减'},{id:'c',kind:'buff',source:'自定义对象',attribute:'自定义Buff',influence:'自定义方式'}],outputs:['自定义产物'],playMode:'计时',playExpectation:'短暂播放'}
assert.equal(resultRules(effects,'attribute').length,1);assert.equal(resultRules(effects,'buff').length,2)
const html=render(React.createElement(ResultFields,{node:{id:'r',data:effects}}));assert.ok(html.includes('Buff名'));assert.ok(html.includes('时长期望'));assert.ok(html.includes('产物名'));assert.ok(!html.includes('属性 / Buff'))
assert.ok(render(React.createElement(TextChoice,{label:'test',value:'未知',options:['中'],onChange:()=>{}})).includes('custom-choice'))
assert.ok(!render(React.createElement(TextChoice,{label:'test',value:'中',options:['中'],onChange:()=>{}})).includes('class="custom-choice"'))
const judge=render(React.createElement(JudgeFields,{node:{id:'j',data}}));assert.ok(judge.indexOf('参与判断的属性')<judge.indexOf('分支设置'));assert.equal((judge.match(/aria-label="对象大类"/g)||[]).length,2);assert.equal((judge.match(/aria-label="影响规则"/g)||[]).length,4)
const invalid=structuredClone(config);invalid.graph.nodes[0].data.judgeAttributes=[{id:'x',source:42,attribute:''}];assert.throws(()=>validateConfig(invalid,NODE_CONFIG))
console.log('PASS: shared attributes, legacy union, inherited branches, edits/removal, custom values, result kinds, playback, round trip, undo, invalid file rejection')

