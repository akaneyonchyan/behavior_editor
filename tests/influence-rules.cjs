const assert=require('node:assert/strict'),{buildSync}=require('esbuild'),Module=require('node:module'),path=require('node:path')
const file=path.join(process.cwd(),'influence-test.cjs'),m=new Module(file,module);m.filename=file;m.paths=module.paths
m._compile(buildSync({stdin:{contents:"export * from './src/utils/influenceRules';export {validateFactor} from './src/utils/weightFactors';export {collectRequirements} from './src/utils/requirements'",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',write:false,logLevel:'silent'}).outputFiles[0].text,file)
const {splitInfluence,updateInfluence,normalizeInfluences,validateFactor,collectRequirements}=m.exports
for(const [text,type,rule] of [['越高，概率越大','数值高','概率越高'],['越低，概率越大','数值低','概率越高'],['指定值，概率降低','具体值','概率越低'],['不影响','','不影响'],['有该buff','','有该buff']]){
 const original={id:'a',version:2,source:'custom',attribute:'test',influence:text}
 const result=splitInfluence(original);assert.equal(result.influenceType,type);assert.equal(result.influenceRule,rule);assert.equal(original.influenceType,undefined);assert.deepEqual(splitInfluence(result),result)
}
for(const rule of ['允许选中','排除选中','不影响','自定义条件']){
 const f=updateInfluence({version:2,source:'x',attribute:'y',influence:'越高，概率越大'},{influenceType:'具体值',influenceRule:rule})
 assert.equal(splitInfluence(f).influenceRule,rule);assert.equal(validateFactor(f),'');assert.ok(validateFactor({...f,influenceType:12}))
}
const config={graph:{nodes:[{type:'judge',data:{branches:[{id:'b',weightFactors:[{id:'f',version:2,source:'x',attribute:'y',influence:'未实现规则'}]}]}}],edges:[{source:'a',target:'b'}]}}
const normalized=normalizeInfluences(structuredClone(config));assert.deepEqual(normalizeInfluences(structuredClone(normalized)),normalized);assert.deepEqual(normalized.graph.edges,config.graph.edges)
const rows=collectRequirements({},normalized.graph.nodes,{objects:[],attributes:[],buffs:[],items:[]})
assert.ok(rows.attributes.some(r=>r.field==='影响规则'&&r.value==='未实现规则'))
console.log('PASS: split influences, explicit migration, custom preservation, independent overrides, validation and requirement inventory')

