const assert=require('node:assert/strict'),{buildSync}=require('esbuild'),Module=require('node:module'),path=require('node:path')
const filename=path.join(process.cwd(),'requirements-tests.cjs'),m=new Module(filename,module);m.filename=filename;m.paths=module.paths
m._compile(buildSync({stdin:{contents:"export * from './src/utils/requirements.js';export {blankTemplate} from './src/utils/blankTemplate.js'",resolveDir:process.cwd()},bundle:true,external:['react','react-dom'],platform:'node',format:'cjs',write:false,logLevel:'silent'}).outputFiles[0].text,filename)
const {collectRequirements:scan,requirementsMarkdown,blankTemplate}=m.exports
const lib={version:1,objects:[{id:'partner',name:'伙伴角色',enabled:true},{id:'food',name:'食物',enabled:true}],attributes:[{id:'energy',name:'精力',enabled:true,objectTypes:['partner']},{id:'old',name:'旧属性',enabled:false,objectTypes:['partner']}],buffs:[{id:'happy',name:'开心',enabled:true,objectTypes:['partner']}],items:[{id:'food/apple',name:'苹果',objectType:'food',enabled:true}]}
const graph=blankTemplate(),nodes=graph.graph.nodes,info=graph.behavior
assert.ok(Object.values(scan(info,nodes,lib)).every(a=>!a.length),'Empty fields are not unsupported requests')
const result=nodes.find(n=>n.type==='result'),second=nodes.filter(n=>n.type==='result')[1],rule={id:'a',source:'object:partner',attribute:'energy',influence:'增'}
result.data.effectRules=[rule,{...rule,id:'b',kind:'buff',attribute:'buff:happy'}]
assert.ok(Object.values(scan(info,nodes,lib)).every(a=>!a.length),'Known references and standard rules are excluded')
result.data.effectRules.push({...rule,id:'c',attribute:'新属性',influence:'翻倍'},{...rule,id:'d',attribute:'old'},{...rule,id:'e',source:'object:food'})
second.data.effectRules=[{...rule,attribute:'新属性',influence:'翻倍'},{...rule,id:'buff',kind:'buff',attribute:'新Buff',influence:'叠加'}]
result.data.animation='跳舞|转圈\n鼓掌';second.data.animation=result.data.animation
result.data.outputs=['神秘产物'];result.data.playMode='循环至事件'
info.preconditions.interactObjectRules=[{id:'o',objectType:'partner',objectName:'item:food/apple'}]
const loop=nodes.find(n=>n.type==='loop');loop.data.restEnabled=false;loop.data.restRules=[{...rule,attribute:'隐藏属性'}]
const before=JSON.stringify({info,nodes,lib}),report=scan(info,nodes,lib)
assert.equal(JSON.stringify({info,nodes,lib}),before,'Scan must not mutate inputs')
assert.equal(report.attributes.find(r=>r.value==='新属性').locations.length,2)
assert.ok(report.attributes.some(r=>r.reason==='条目已停用'));assert.ok(report.attributes.some(r=>r.reason.includes('不适用')))
assert.ok(report.attributes.some(r=>r.value==='翻倍'));assert.ok(!report.attributes.some(r=>r.value==='隐藏属性'))
assert.ok(report.buffs.some(r=>r.value==='新Buff'));assert.ok(report.buffs.some(r=>r.value==='叠加'))
assert.ok(report.objects.some(r=>r.reason==='对象不属于所选类型'));assert.ok(report.objects.some(r=>r.field==='产物'))
assert.equal(report.performances.find(r=>r.field==='表演资产').locations.length,2)
assert.ok(report.performances.every(r=>!r.reason.includes('资产不存在')))
const md=requirementsMarkdown(report,'测试行为','2026-10-19T00:00:00Z');assert.ok(md.includes('\n## 表演'));assert.ok(md.includes('跳舞\\|转圈<br>鼓掌'))
lib.attributes.push({id:'new',name:'新属性',enabled:true,objectTypes:['partner']})
assert.ok(!scan(info,nodes,lib).attributes.some(r=>r.value==='新属性'),'Library updates resolve custom names')
const judge=nodes.find(n=>n.type==='judge');judge.data.judgeAttributes=[{id:'a',source:'object:partner',attribute:'分支属性'}];judge.data.branches.forEach(b=>b.weightFactors=[{version:2,attributeId:'a',influence:'特殊影响'}])
const next=scan(info,nodes,lib);assert.equal(next.attributes.find(r=>r.value==='分支属性').locations.length,1);assert.equal(next.attributes.find(r=>r.value==='特殊影响').locations.length,2)
console.log('PASS: requirement categories, validity, deduplication, locations, rules, disabled/incompatible refs, rest exclusion, empty template, asset caveats, live library and export')
