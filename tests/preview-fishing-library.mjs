import assert from 'node:assert/strict'
import fs from 'node:fs'
import {integrationLibrary,integrateFile,prepareIntegrationWorld} from '../src/preview/integration.mjs'
import {makeWorld,inspect} from '../src/preview/runtime.mjs'
import {bound} from '../src/preview/preparation.mjs'
import {fishingEffect,fishingFactor,fishingNodeComplete,finishFishing,FISHING_BUFF_IDS} from '../src/preview/fishingCore.mjs'
const source=JSON.parse(fs.readFileSync('public/data/library.json','utf8')).library
const publicLib=structuredClone(source)
publicLib.buffs=publicLib.buffs.filter(b=>b.id!=='fishing_focus')
publicLib.buffs.push({id:'fishing_focus',name:'认真钓鱼',enabled:true,objectTypes:['partner']})
const lib=integrationLibrary(publicLib)
assert.equal(lib.buffs.filter(b=>b.id==='fishing_focus').length,1)
assert.equal(lib.buffs.find(b=>b.id==='fishing_focus').previewOnly,undefined)
const actor={id:'a',type:'partner',attrs:{fishing_posture:'站姿'},buffs:{},inventory:{},padBase:[0,0,0]}
const s={actor:'a',world:[actor],config:{previewIntegration:'fishCore',previewFishing:{buffSeconds:600}},params:{worldNow:0},metrics:{},lib,log(){},status:'running'}
for(let i=0;i<8;i++)fishingEffect(s,{effect:'buff',buff:'fishing_focus'})
assert.equal(actor.buffs.fishing_focus,5)
assert.equal(fishingFactor(s,{previewFishingFactor:'认真钓鱼buff'}),1)
const f={previewFishingFactor:'fishing_posture',fishingPostureValue:'站姿',influenceType:'属于'}
assert.equal(fishingFactor(s,f),1)
fishingNodeComplete(s,{data:{previewFishingAction:'sit'}})
assert.equal(actor.attrs.fishing_posture,'坐姿');assert.equal(fishingFactor(s,f),0)
assert.equal(fishingFactor(s,{...f,influenceType:'不属于'}),1)
fishingNodeComplete(s,{data:{previewFishingAction:'空军'}});assert.equal(s.metrics.rounds,1);assert.equal(s.metrics.fish||0,0)
s.status='done';finishFishing(s);assert.equal(actor.buffs.fishing_focus||0,0);assert.equal(actor.attrs.fishing_posture,'未钓鱼')
for(const id of Object.values(FISHING_BUFF_IDS))assert.ok(lib.buffs.some(b=>b.id===id))
const wording={behavior:{name:'钓鱼细分-核心行为',preconditions:{}},graph:{nodes:[{id:'pose',type:'judge',data:{branches:['满足','不满足'].map((influenceType,i)=>({id:String(i),name:String(i),weightExpectation:'条件指定',weightFactors:[{source:'object:partner',attribute:'属于钓鱼站姿',influenceType,influenceRule:'允许选中'}]}))}}],edges:[]}}
const adaptedWording=integrateFile({name:'钓鱼细分-核心行为.json',config:wording})
assert.deepEqual(adaptedWording.config.graph.nodes[0].data.branches.map(b=>b.weightFactors[0].influenceType),['具有（1）','不具有（0）'])
assert.equal(wording.graph.nodes[0].data.branches[0].weightFactors[0].influenceType,'满足')
if(process.env.FISHING_LIBRARY_FIXTURE){
 const actual=JSON.parse(fs.readFileSync(process.env.FISHING_LIBRARY_FIXTURE,'utf8'))
 const actualLib=integrationLibrary(actual),raw=JSON.parse(fs.readFileSync(process.env.FISHING_CORE_FIXTURE,'utf8'))
 const adapted=integrateFile({name:'钓鱼细分-核心行为.json',config:raw}),world=makeWorld(actualLib,{initial:50},raw);prepareIntegrationWorld(world)
 const issues=inspect(adapted.config,actualLib,world,bound(adapted.config,actualLib,world,'pip'))
 assert.deepEqual(issues.filter(i=>i.kind!=='graph'),[])
 assert.deepEqual(adapted.config.graph.edges,raw.graph.edges)
 console.log('PUBLIC_LIBRARY_PREFLIGHT',JSON.stringify(issues))
}
console.log('PASS public fishing references, bounded focus stacks, exclusive posture and exit cleanup')
