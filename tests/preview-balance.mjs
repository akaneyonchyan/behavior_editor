import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {BalanceSimulation,BALANCE_DATA,minuteEffect,needScore} from '../src/preview/balance.mjs'

// Independent oracle: cached 08 数值计算 rows 6..10085 in the supplied workbook.
// Hash includes actual profile, completion flag, goal and four rounded needs EVERY minute.
const expected='a1309381502b86bfb003906f03d53c8f171f5ba7d6eb64d09421e5557fcfce6c'
const week=new BalanceSimulation([],'pip',{days:7});week.tick(10080)
assert.equal(week.status,'day-complete');assert.equal(week.history.length,10080)
const digest=createHash('sha256').update(JSON.stringify(week.history.map(r=>[r.profile,r.done,r.goal,...r.needs]))).digest('hex')
assert.equal(digest,expected,'7 days must match the workbook minute by minute')
assert.equal(week.statistics['睡觉'],7);assert.equal(week.statistics['小建筑'],26)
assert.equal(week.timeSpent['散步'],2816);assert.equal(week.action.name,'散步');assert.equal(week.action.progress,26)
assert.equal(Object.values(week.timeSpent).reduce((a,b)=>a+b,0),10080)
for(const [tool,initial] of Object.entries(BALANCE_DATA.initial.tools))assert.equal(week.tools[tool]+Number(week.tool===tool),initial)
for(const m of week.materials)assert.ok(m.carry>=0&&m.store>=0&&m.world>=0)
for(const name of ['石头','木材']){const m=week.materials.find(m=>m.name===name),i=week.materials.indexOf(m);assert.equal(m.carry+m.store+m.world+26*BALANCE_DATA.actions.find(p=>p.name==='小建筑').materials[i],264)}

const chunked=new BalanceSimulation([],'pip',{days:7});for(let i=0;i<16800;i++)chunked.tick(.6)
assert.deepEqual(chunked.history,week.history,'playback speed and fractional ticks must not alter the model')
assert.equal(minuteEffect(99.9,10,6,5),99.9,'cap recovery before consuming')
assert.equal(needScore(99.9,90),needScore(99,90))
assert.equal(needScore(100,90),.9,'full needs still compete')

const prep=new BalanceSimulation();prep.tick(1)
assert.equal(prep.action.name,'拿取材料');assert.equal(prep.materials[0].carry,0)
prep.tick(1);assert.equal(prep.materials[0].carry,2);assert.equal(prep.materials[0].store,22)
prep.tick(2);assert.equal(prep.materials[1].carry,4);assert.equal(prep.tools['建造锤'],1)
prep.tick(1);assert.equal(prep.tool,null);prep.tick(1);assert.equal(prep.tool,'建造锤')
assert.equal(prep.materials[0].carry,0,'cost is deducted when main action starts')

const wait=new BalanceSimulation([],'pip',{initial:{enabled:[0,0,0,0,0]}});wait.tick(1)
assert.equal(wait.statistics['等待（无候选）'],1);assert.deepEqual(wait.needs,[99.9,99.8,99.95,99.9])
const fallback=new BalanceSimulation([],'pip',{initial:{enabled:[0,0,0,1,0],tools:{}}});fallback.tick(.1)
assert.equal(fallback.action.name,'散步','unavailable hobby falls back to leisure')
const pauseData=structuredClone(BALANCE_DATA);pauseData.actions.find(p=>p.name==='小建筑').minutes=null
const pause=new BalanceSimulation([],'pip',{},pauseData);pause.tick(1)
assert.equal(pause.status,'blocked');assert.match(pause.error,/小建筑/);assert.equal(pause.settled,0)
const fullSleep=new BalanceSimulation([],'pip',{initial:{enabled:[1,0,0,0,0]}});fullSleep.tick(419)
assert.equal(fullSleep.statistics['睡觉'],undefined);fullSleep.tick(1);assert.equal(fullSleep.statistics['睡觉'],1)
const boundary=new BalanceSimulation();boundary.settled=300;assert.equal(boundary.schedule(0).percent,200)
boundary.settled=360;assert.equal(boundary.schedule(0),undefined);assert.equal(boundary.schedule(1).percent,2000)
boundary.settled=1440;assert.equal(boundary.schedule(0).percent,10000)
console.log('PASS: V3.2 10,080-minute oracle, speed invariance, material/tool conservation, schedules, fallbacks and partial actions')
