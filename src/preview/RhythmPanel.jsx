import React from 'react'
import {RHYTHM_MAP} from './rhythm.mjs'
export function RhythmConfig(){return <><h3>在线图执行 · 数值表补值</h3><p>图决定分支、循环和结算对象；V3.2提供评分、消耗和恢复速率。1模拟秒＝1游戏分钟。需求按实际执行时间变化，不再叠加节点±10。</p><p>日常消耗/小时：精力6、饱腹12、社交3、娱乐6。采集：12/18/3/6。睡眠：0/6/3/6，精力恢复99/420分钟。进食时段采用正餐78/30分钟，其他时段小吃10/5分钟。</p><details><summary>逐行为补值依据</summary>{Object.entries(RHYTHM_MAP).map(([id,[name,basis]])=><p key={id}><strong>{name} · {id}</strong><br/>{basis}</p>)}</details><p className="preview-help">表外暂定：清洁/修理每有效分钟恢复2，工具每工作分钟磨损0.2；普通过渡动作0.25分钟、判断0.1分钟。图内明确时长优先。Buff概率和时限沿用已标注的预览规则，不是表中原值。</p></>}
export default function RhythmPanel({controller:c}){
 const r=c?.active?.rhythm
 return <div className="goal-panel">
  <h3>{c?.clock()||'等待开始'}</h3>{c&&<><progress value={c.elapsed} max={c.settings.daySeconds}/><p>{(c.elapsed/60).toFixed(1)} / {c.settings.daySeconds/60} 小时 · {c.completed.length} 次实际行为</p></>}
  <p>在线行为图负责执行；数值表负责节奏。每个行为或准备步骤完成后，按当前属性重新选目标。</p>
  {r&&<section className="rhythm-profile current-action-style"><strong>当前补值：{r.name}</strong><p>{r.basis}</p><small>每小时消耗（精力/饱腹/社交/娱乐）：{r.cost.join(' / ')}<br/>完整样本恢复：{r.recovery.join(' / ')}；基准{r.minutes}分钟</small></section>}
  {c?.service&&<p>前置准备：{c.service.step.name} · {c.service.progress.toFixed(1)} / 2 分钟（暂缺在线准备稿）</p>}
  <h3>{c?.goal?.name||'等待目标调度'}</h3><p>{c?.queue.join(' → ')||c?.waitReason||'选择可行目标的最高分，同分按体力、饱腹、社交、娱乐、家园顺序。'}</p>
  <details open><summary>目标得分（最近一次选择）</summary>{c?.goalScores.map(g=><p key={g.id}>{g.name} · {g.weight.toFixed(2)}<small className="balance-detail">{!g.eligible?'暂无可行在线稿件':g.cooldown?'目标冷却中':'基础分 '+g.base.toFixed(2)}{g.id==='social'?'；双人交互关闭':''}</small></p>)}</details>
  <details open><summary>在线行为候选</summary>{c?.candidates.map(row=><p key={row.file.name}>{row.file.name.replace(/\.json$/,'')}<small className="balance-detail">{row.reasons.length?row.reasons.join('；'):row.kept?'本轮执行':'可行候选'}</small></p>)}</details>
  <details open><summary>实际执行统计</summary>{Object.entries(c?.statistics||{}).map(([name,n])=><p key={name}>{name.replace(/\.json$/,'')} ×{n}</p>)}</details>
  <p className="preview-help">家园100基础分暂用于已有采集、清洗、维修、打扫图；不存在的建造/家具图不会虚构执行。娱乐按基础分200分流，缺少对应休闲稿时回退可行娱乐图。</p>
 </div>
}
