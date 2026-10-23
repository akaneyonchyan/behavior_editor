import assert from 'node:assert/strict'
import {objectStates,visualPosition} from '../src/preview/sceneStatus.mjs'
import {layoutIsland} from '../src/preview/mapLayout.mjs'
const o={id:'table',name:'桌子',type:'interactObject',attrs:{durability:0,cleanliness:15},buffs:{}}
assert.deepEqual(objectStates(o).map(s=>s.id),['broken','dirty'])
o.attrs={durability:100,cleanliness:100};assert.deepEqual(objectStates(o),[])
assert.deepEqual(objectStates({attrs:{},buffs:{}}),[])
assert.deepEqual(objectStates({type:'environmentItem',attrs:{reczz28PBhFkUjct:0,reczz28PBpzFKg4B:'0'}}).map(s=>s.id),['empty'])
assert.equal(objectStates({...o,occupied:'pip'},[{id:'pip',name:'皮普'}])[0].detail,'皮普 正在占用')
assert.equal(objectStates({...o,buffs:{b:0} },[],{buffs:[{id:'b',name:'测试',enabled:true}]}).length,0)
assert.equal(objectStates({...o,buffs:{b:2} },[],{buffs:[{id:'b',name:'测试',enabled:true}]}).at(0).label,'测试')
assert.equal(objectStates({...o,inactive:true,occupied:'pip'}).length,0)
const world=layoutIsland(['乔木','矿石','灌木','床','桌子','钓台','工匠台','工具柜'].map(name=>({name})))
assert.ok(Math.max(...world.map(o=>o.x))-Math.min(...world.map(o=>o.x))>100)
for(let i=0;i<world.length;i++)for(let j=0;j<i;j++)assert.ok(Math.hypot(world[i].x-world[j].x,world[i].z-world[j].z)>10)
const tool={id:'axe',type:'equippedItem',location:'pip',x:0,z:0},original=JSON.stringify(tool)
assert.deepEqual(visualPosition(tool,[{id:'pip',type:'partner',x:60,z:40}]),{x:62.5,z:41.5,carried:true})
assert.equal(JSON.stringify(tool),original)
console.log('PASS: scene state derivation, recovery removes badges, absent attributes, active Buffs, occupancy, spread layout and visual-only carried tools')
