import assert from 'node:assert/strict'
import {addBuff,removeBuff,expireBuffs,expireWorldBuffs,effectiveValue,completeBuffNode,initializeState,DEFAULT_BUFF_SECONDS} from '../src/preview/state.mjs'
import {GoalScheduler} from '../src/preview/scheduler.mjs'
import {RhythmScheduler} from '../src/preview/rhythmScheduler.mjs'
import fs from 'node:fs'
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
// All library and custom acquisitions have finite lifetimes, independent per layer.
const timed={id:'timed',attrs:{energy:80},buffs:{}}
const library=JSON.parse(fs.readFileSync('public/data/library.json','utf8')).library
for(const id of [...library.buffs.map(b=>b.id),'custom-buff']){const b=addBuff(timed,id,20,'source');assert.ok(Number.isFinite(b.expires)&&b.expires>20,id)}
expireBuffs(timed,20+DEFAULT_BUFF_SECONDS);assert.equal(timed.buffInstances.length,0)
addBuff(timed,'same',0,'source',{seconds:10,pad:[10,0,0]});addBuff(timed,'same',5,'source',{seconds:10,pad:[20,0,0]})
expireBuffs(timed,10);assert.equal(timed.buffs.same,1);assert.equal(timed.pad[0],20);expireBuffs(timed,15);assert.equal(timed.pad[0],0)
for(const seconds of [null,0,-1,Infinity,NaN]){const before=structuredClone(timed);assert.throws(()=>addBuff(timed,'invalid',20,'source',{seconds}));assert.deepEqual(timed,before)}
const legacy={id:'legacy',attrs:{},buffs:{old:1},buffInstances:[{id:1,buffId:'old',obtained:100,expires:null}]}
initializeState([legacy]);assert.equal(legacy.buffInstances[0].expires,700);expireBuffs(legacy,500);assert.equal(legacy.buffInstances[0].expires,700);expireBuffs(legacy,700);assert.equal(legacy.buffInstances.length,0)
const item={id:'item',location:'timed',attrs:{},buffs:{}}
addBuff(timed,'held',0,'unrelated-source',{requiredRelation:{itemId:'item',holderId:'timed'}})
expireWorldBuffs([timed,item],1);assert.equal(timed.buffs.held,1,'source disappearance is not relation release')
item.location='storage';expireWorldBuffs([timed,item],2);assert.equal(timed.buffs.held,undefined)
const old=addBuff(timed,'counted',0,'source',{nodeId:'node',completions:3}),eligible=new Set([old.id])
const fresh=addBuff(timed,'fresh',0,'source',{nodeId:'node',completions:1})
completeBuffNode(timed,'node','actor:1',eligible);assert.equal(fresh.remaining,1)
completeBuffNode(timed,'node','actor:2',eligible);completeBuffNode(timed,'node','actor:1',eligible);assert.equal(old.remaining,1)
completeBuffNode(timed,'node','other-actor:1',eligible);assert.equal(timed.buffs.counted,undefined)
const tree={id:'tree',attrs:{},buffs:{},stuckTool:'axe'};addBuff(tree,'buff_be_stuck',0,'source');expireBuffs(tree,600)
assert.equal(tree.stuckTool,'axe');assert.equal(GoalScheduler.prototype.extraValue.call({world:[tree],actor:'tree'},{id:'unstick',kind:'buff',target:'tree',buff:'buff_be_stuck'}),1)
console.log('Buff finite defaults, independent deadlines, expiry effects, atomic invalid duration rejection, legacy deadlines, relation release, event eligibility/deduplication and physical stuck relation passed')
for(const service of [false,true]){
 const actor={id:'pip',type:'partner',name:'皮普',attrs:{energy:50,satiety:50,social:50,leisure:50,cleanliness:50},buffs:{}}
 const q={world:[actor],actor:'pip',elapsed:0,settings:{...DAY_DEFAULTS,rhythm:true,dayMode:true},status:'waiting',nextCheck:100,log(){},finish(){}}
 initializeDay(q.world,q.settings);addBuff(actor,'idle-test',0,'test',{seconds:30})
 if(service)q.service={progress:0,minutes:2}
 ;(service?RhythmScheduler:GoalScheduler).prototype.advance.call(q,1)
 assert.equal(actor.buffs['idle-test'],undefined,service?'preparation service expiry':'waiting expiry')
}
