import React from 'react'
export default function GoalPanel({controller:c}){
 return <div className="goal-panel">
  {c?.settings.dayMode&&<section className="day-summary"><h3>{c.status==='day-complete'?'一天观察完成':c.clock()}</h3><progress value={c.elapsed} max={c.settings.daySeconds}/><p>已观察 {(c.elapsed/60).toFixed(1)} / 24 小时 · {c.completed.length} 次行为 · {Object.keys(c.statistics).length} 种</p>{Object.entries(c.statistics).map(([name,count])=><p key={name}>{name.replace(/.json$/,'')} <strong>×{count}</strong></p>)}<small>1×：24分钟观察一天；60×：约24秒。暂停时世界与 Buff 同时暂停。</small></section>}
  <h3>{c?.goal?.name||'等待选择目标'}</h3>
  <p>{c?.goal?'当前值 '+c.value(c.goal).toFixed(1)+' / 期望 '+c.goal.threshold+' · 尝试 '+c.attempts+'/'+c.settings.maxAttempts:c?.waitReason||'根据当前属性选择目标，行为图完成后重新验证。'}</p>
  <p>行为队列：{c?.queue.join(' → ')||'无待执行行为'}</p>
  {c?.settings.dayMode&&<details><summary>全天模拟参数与假设</summary><p>行为消耗／世界小时：精力6、饱腹8、娱乐5；对应恢复行为不扣该项。清洁度每小时下降2。</p><p>场景供餐：每种食物32份，每份3口，保鲜48小时。08:00–20:00小雨，其他时段晴天。</p><p>情绪层暂定10分钟，最多10层。陶醉／厌倦的PAD增量为模拟值，不代表正式情绪分类。缺少拿取行为的供餐由场景完成，日志明示。</p></details>}
  <p className="preview-help">精力、饱腹、娱乐、清洁度，以及采集、对象维护和已触发的Buff目标，按当前状态加权选择。全天模式中：执行非恢复行为才消耗需求，等待不扣需求；清洁度按常用属性文档随世界运转下降。消耗速度、持续时长为模拟参数。</p>
  <details open><summary>目标候选与得分（最近一轮）</summary>{c?.goalScores.map(g=><p key={g.id}>{g.name} · {g.value.toFixed(1)}/{g.threshold} · {g.cooldown>0?'冷却中':g.weight>0?'得分 '+g.weight.toFixed(1):'已满足'}</p>)}</details>
  <details open><summary>最近规划的行为候选</summary>{c?.candidates.map(row=><article key={row.file.sha||row.file.name}><strong>{row.file.name.replace(/.json$/,'')}</strong><p>{row.reasons.length?row.reasons.join('；'):row.kept?'入围 · 路径分 '+row.weight.toFixed(1):'本轮未抽中保留'}</p></article>)}</details>
  <details><summary>已执行 {c?.completed.length||0} 次行为</summary>{c?.completed.map((row,i)=><p key={i}>{row.time.toFixed(1)}s · {row.file} · {row.status==='done'?'完成':row.status==='exited'?'跳出':'受阻'}</p>)}</details>
  <p className="preview-help">已接入拿斧头、归还斧头、制作鱼饵的在线准备链；鱼竿、扳手和抹布拿取暂用标注的预览准备。右侧“接入”可逐张验证或创建事件场景。所有映射只用于预览。</p>
 </div>
}
