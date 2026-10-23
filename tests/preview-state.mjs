import assert from 'node:assert/strict'
import {addBuff,removeBuff,expireBuffs,effectiveValue,completeBuffNode} from '../src/preview/state.mjs'
import {advanceDayState,DAY_DEFAULTS,prepareMeal,initializeDay} from '../src/preview/day.mjs'
const e={id:'p',name:'伙伴',attrs:{energy:90},buffs:{}}
addBuff(e,'a',0,'source',{seconds:10,add:{energy:20}});assert.equal(effectiveValue(e,'energy'),100);e.attrs.energy-=5;expireBuffs(e,10);assert.equal(effectiveValue(e,'energy'),85)
addBuff(e,'b',10,'source',{multiply:{energy:0}});assert.equal(effectiveValue(e,'energy'),0);removeBuff(e,'b');assert.equal(effectiveValue(e,'energy'),85);removeBuff(e,'b');assert.equal(effectiveValue(e,'energy'),85)
addBuff(e,'x',11,'source',{group:'emotion',capacity:2,pad:[120,0,0]});addBuff(e,'y',12,'source',{group:'emotion',capacity:2,pad:[30,0,0]});assert.equal(e.pad[0],150);removeBuff(e,'y');assert.equal(e.pad[0],120)
addBuff(e,'x',13,'source',{group:'emotion',capacity:2,pad:[20,0,0]});addBuff(e,'z',14,'source',{group:'emotion',capacity:2,pad:[10,0,0]});assert.equal(e.pad[0],30);assert.equal(e.buffs.x,1)
const before=structuredClone(e);assert.throws(()=>addBuff(e,'bad',15,'source',{multiply:{energy:-1}}));assert.deepEqual(e,before)
addBuff(e,'n',15,'source',{nodeId:'node',completions:2});completeBuffNode(e,'node','one');completeBuffNode(e,'node','one');assert.equal(e.buffs.n,1);completeBuffNode(e,'node','two');assert.equal(e.buffs.n,undefined)
const world=[{id:'p',name:'伙伴',type:'partner',attrs:{energy:50,satiety:50,leisure:50,cleanliness:50,equipped_slot_food:'0'},buffs:{}},{id:'food',name:'饼干',type:'food',attrs:{freshness:100},buffs:{}}]
initializeDay(world,DAY_DEFAULTS);const settings={...DAY_DEFAULTS,worldSecondsPerSecond:60}
advanceDayState(world,60,60,settings,'p',null,false,()=>{});assert.equal(world[0].attrs.energy,50);assert.equal(world[0].attrs.satiety,50);assert.equal(world[0].attrs.cleanliness,48);assert.equal(world[1].attrs.freshness,47*3600)
advanceDayState(world,60,120,settings,'p','rest',true,()=>{});assert.equal(world[0].attrs.energy,50);assert.equal(world[0].attrs.satiety,42)
const meal=prepareMeal(world,'p',{previewProfile:'eat'},7200);assert.equal(meal.food.stock,31);assert.equal(world[1].stock,32);meal.food.bites=0;const next=prepareMeal(meal.world,'p',{previewProfile:'eat'},7200);assert.equal(next.food.stock,30);assert.equal(next.food.bites,3)
assert.ok(prepareMeal(world,'p',{previewProfile:'eat'},48*3600).error)
console.log('State: capped effective values, zero multiplier removal, independent PAD layers, eviction, atomic rejection, node-event deduplication, action-only need costs, freshness, finite meal stock passed')
