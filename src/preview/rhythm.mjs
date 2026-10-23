import DATA from './balance-data.json' with {type:'json'}
export const NEEDS=['energy','satiety','social','leisure']
export const RHYTHM_MAP={rest:['睡觉','原值：睡眠恢复99/420分钟；一个睡眠段按420分钟补时，循环仍由原图判断'],chair:['打盹','类比：坐姿休息借用打盹5分钟恢复10'],eat:['小吃','小吃原值；用餐时段借用正餐数值，仍执行原进食图'],fish:['钓鱼','原值：每轮5分钟、娱乐恢复2；等待/提竿分配为推导'],wood:['伐木','原值：每轮5分钟、木材2'],banyan:['伐木','类比：榕树使用伐木耗时消耗'],take:['拿取并装备工具','原值：拿取2分钟'],put:['归还工具','原值：归还2分钟'],bait:['小家具','类比：制作消耗借小家具；制作有效段沿用12分钟映射，不虚构材料配方'],play:['散步','类比：踩水借休闲30分钟恢复15，三轮各10分钟'],wash:['小吃','推导：清洗每轮5分钟，清洁恢复2/分钟；需求按日常活动消耗'],clean:['小家具','类比：打扫按轻工作消耗，清洁恢复2/分钟'],repair:['小家具','类比：维修按轻工作消耗，耐久恢复2/分钟'],unstick:['伐木','类比：解卡按重体力消耗，每次尝试2分钟'],dizzy:['打盹','推导：趴地恢复按打盹消耗，Buff仍按原图'],fall:['等待（无候选）','推导：摔倒恢复用日常活动消耗，Buff仍按原图'],laugh:['散步','推导：大笑用轻娱乐消耗，Buff仍按原图'],showoff:['社交','类比：炫耀用社交消耗；自主多人暂不调度双人图']}
export function schedule(attribute,minute){const key=attribute==='energy'?'睡眠日程':attribute==='satiety'?'用餐日程':'';return DATA.schedules.find(s=>s.goal===key&&minute%1440>=s.start&&minute%1440<s.end)}
export function profile(config,minute=0){
 const id=config.previewIntegration,mapping=RHYTHM_MAP[id];if(!mapping)throw Error('缺少行为数值映射：'+config.behavior?.name)
 const name=id==='eat'&&schedule('satiety',minute)?'正餐':mapping[0],p=structuredClone(DATA.actions.find(p=>p.name===name))
 if(['wash','dizzy','fall','unstick','laugh','showoff'].includes(id))p.recovery=[0,0,0,0]
 if(id==='wash')p.cost=[6,12,3,6]
 return {...p,id,basis:mapping[1]}
}
export function attachRhythm(s){
 s.rhythm=profile(s.config,(s.params.worldNow||0)/60);s.rhythmRecovery=[0,0,0,0]
 const actor=s.world.find(o=>o.id===s.actor)
 s.rhythmTargets=Object.fromEntries(NEEDS.map((k,i)=>[k,Math.min(100,Number(actor.attrs[k]??100)+s.rhythm.recovery[i])]))
 s.log('数值依据：'+s.rhythm.name+'；'+s.rhythm.basis+'。恢复/轮 '+s.rhythm.recovery.join('/')+'；消耗/小时 '+s.rhythm.cost.join('/'))
}
export function rhythmDuration(s,n){
 if(!['result','wait','end'].includes(n.type))return .1
 if(n.type==='end')return .1
 const id=s.rhythm.id,key=n.id
 // Explicit timings in the authored graph keep their units. Missing prose receives a mapping.
 const explicit=n.data.playMode==='计时'&&String(n.data.playExpectation||'').match(/^\s*(\d+(?:\.\d+)?)\s*(秒|分钟|小时|s)\s*$/)
 if(explicit)return Number(explicit[1])*({秒:1/60,s:1/60,分钟:1,小时:60}[explicit[2]])
 if(id==='rest'&&key==='sleep')return 420
 if(id==='chair'&&key==='rest')return 5
 if(id==='eat'&&key==='bite')return s.rhythm.minutes/3
 if(id==='play'&&['result_splash_face','result_stomp'].includes(key))return 10
 if(['wood','banyan'].includes(id)&&key==='chop')return 5
 if(id==='fish'&&key==='ba3cf311-f3ee-452b-8d8e-7ed4479a8231')return 4
 if(id==='fish'&&['waiting','early'].includes(key))return key==='early'?.25:1
 if(['take','put'].includes(id)&&key.startsWith('result_'))return 2
 if(id==='bait'&&n.data.previewAction==='craft')return 1
 if(id==='wash'&&key.startsWith('wash_'))return 5/3
 if(id==='clean'&&key.startsWith('wipe_'))return 5
 if(id==='repair'&&key==='repair_normal')return 5
 if(id==='unstick'&&key==='axe_try')return 2
 if(n.type==='wait')return 1
 return .25
}
export function recoveryNode(s,n){const id=s.rhythm.id;return id==='rest'?n.id==='sleep':id==='chair'?n.id==='rest':id==='eat'?n.id==='bite':id==='play'?['result_splash_face','result_stomp'].includes(n.id):['fish','repair','clean','bait'].includes(id)&&['result','wait'].includes(n.type)}
export function applyRhythm(s,dt,moving=false){
 const n=s.node(),actor=s.world.find(o=>o.id===s.actor),p=s.rhythm,active=!moving&&recoveryNode(s,n)
 for(let i=0;i<4;i++){const k=NEEDS[i];if(typeof actor.attrs[k]!=='number')continue
  let gain=active?p.recovery[i]/p.minutes*dt:0
  if(p.id==='eat'){const food=s.world.find(o=>o.id===actor.foodRef);if(!food||food.bites<=0||food.attrs.freshness<=0)gain=0;else if(food.attrs.freshness<(food.freshnessMax||100)*.1)gain*=.5}
  s.rhythmRecovery[i]+=gain
  actor.attrs[k]=Math.max(0,Math.min(100,actor.attrs[k]+gain)-p.cost[i]/60*dt)
 }
}
export function applyIdle(world,actor,dt){const a=world.find(o=>o.id===actor),p=DATA.actions.find(p=>p.name==='等待（无候选）');for(let i=0;i<4;i++)if(typeof a?.attrs[NEEDS[i]]==='number')a.attrs[NEEDS[i]]=Math.max(0,a.attrs[NEEDS[i]]-p.cost[i]/60*dt)}
export function rhythmEffect(s,r){
 if(!s.rhythm||!NEEDS.includes(r.attribute)||s.entity(r).id!==s.actor)return false
 // Need depletion/recovery has already been settled for elapsed time. Keep food debit once per bite.
 if(s.rhythm.id==='eat'&&r.attribute==='satiety'&&['增','增加'].includes(r.influence)){
  const a=s.world.find(o=>o.id===s.actor),food=s.world.find(o=>o.id===a.foodRef)
  if(!food||food.bites<=0||food.attrs.freshness<=0)throw Error('食物已耗尽或变质，停止本口结算')
  food.bites--;if(food.bites===0)a.attrs.equipped_slot_food='0';s.log('消耗一口食物；恢复量已按实际进食时间结算')
 }
 return true
}
export function inferredDelta(s,r){if(!s.rhythm)return s.params.delta;return r.attribute==='durability'&&s.entity(r).type==='equippedItem'?.2*s.duration(s.node()):2*s.duration(s.node())}
