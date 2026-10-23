import React from 'react'
import {BALANCE_DATA,NEED_NAMES} from './balance.mjs'
export function BalancePanel({controller:c}){
 if(!c)return <p>使用 V3.2 工作簿试验条件：00:00 开始，四项需求均为 100，家园样本为小建筑，爱好样本为钓鱼。点击开始观察。</p>
 return <div className="goal-panel">
  <section className="day-summary"><h3>{c.clock()}</h3><progress value={c.elapsed} max={c.settings.daySeconds}/><p>{(c.elapsed/60).toFixed(1)} / {c.settings.daySeconds/60} 小时 · 完成 {c.completed.length} 次</p><small>1×：每秒推进 1 游戏分钟。按分钟结算；未完成动作保留进度。</small></section>
  <h3>四项需求</h3>{c.needs.map((n,i)=><label key={i}>{NEED_NAMES[i]}<strong>{n.toFixed(2)}</strong><progress max="100" value={n}/></label>)}
  <h3>{c.goal?.name||'等待（无候选）'}</h3><p>每个动作结束后重选最高分目标；同分按下方顺序。</p>
  <details open><summary>目标竞争（最近一次）</summary>{c.goalScores.map(g=><p key={g.id}>{g.name}：{g.eligible?g.weight.toFixed(2)+' 分':'条件不具备'}<small className="balance-detail">基础 {g.base.toFixed(2)} × 日程 {g.multiplier} → {g.profile}</small></p>)}</details>
  <details open><summary>家园准备与库存</summary><p>待办：{c.pendingHome||'无'} · 当前工具：{c.tool||'无'}</p><table className="balance-table"><thead><tr><th>材料</th><th>已备</th><th>仓库</th><th>可采</th></tr></thead><tbody>{c.materials.map(m=><tr key={m.name}><td>{m.name}</td><td>{m.carry}</td><td>{m.store}</td><td>{m.world}</td></tr>)}</tbody></table><p>仓库工具：{Object.entries(c.tools).map(([k,v])=>k+' ×'+v).join('、')}</p></details>
  <details open><summary>行为时间分布 · 含未完成部分</summary>{Object.entries(c.timeSpent).sort((a,b)=>b[1]-a[1]).map(([name,minutes])=><p key={name}>{name} · {minutes} 分钟 / 完成 {c.statistics[name]||0} 次<progress className="balance-bar" max={Math.max(1,c.settled)} value={minutes}/></p>)}</details>
  <details><summary>技能与低需求观察</summary>{Object.entries(c.skills).map(([k,s])=><p key={k}>{k}：{s.minutes} 分钟 / 完成 {s.count} 次</p>)}{c.lowMinutes.map((m,i)=><p key={i}>{NEED_NAMES[i]}低于20：{m} 分钟</p>)}<small>仅观察，不生成技能等级，不参与评分。</small></details>
  <p className="preview-help">本模式仅运行数值样本，不执行在线图节点、Buff 或产物规则，防止与表内结算重复。在线图及事件验证仍在“目标自主调度／单行为调试”中。</p>
 </div>
}
export function BalanceTimeline({controller:c}){
 const a=c?.action,p=a?.profile
 return <section className="preview-graph balance-timeline"><header className="preview-graph-title">数值表节奏 · 行为时间线（不是在线行为图）</header><div className="balance-scroll">
  {p?<><h3>{p.name}{a.tool?' · '+a.tool:''}{a.material!=null?' · '+c.materials[a.material].name+' ×'+a.amount:''}</h3><p>{a.progress} / {p.minutes} 游戏分钟 · {c.goal?.name||'无候选'}</p><progress max={p.minutes} value={a.progress}/><p>整轮恢复（体力 / 饥饿满足度 / 社交 / 娱乐）：{p.recovery.join(' / ')}<br/>每小时消耗：{p.cost.join(' / ')}</p><small>{p.source}</small></>:<p>{c?.status==='day-complete'?'观察结束':'开始后展示当前数值样本和进度。'}</p>}
  <h3>最近完成的动作</h3><div className="balance-history">{c?.completed.slice(-24).reverse().map((r,i)=><article key={i}><strong>{r.file}</strong><span>{r.start} → {r.time} 分钟</span><small>{r.operation==='main'?'目标行为':'准备步骤'}</small></article>)}</div>
 </div></section>
}
export function BalanceConfig(){return <><h3>V3.2 数值来源</h3><p className="preview-help">{BALANCE_DATA.source.name}。此模式采用表内试验初值，不读取单行为调试参数；不改公共库或在线文件。</p><p>需求分＝exp((100−向下取整(需求))/10) × 权重/100，再乘日程倍率。家园基础分100；娱乐基础分低于200选爱好，否则选休闲。先恢复封顶，再扣每小时消耗/60，保留4位小数。</p><details><summary>22 项行为数值</summary>{BALANCE_DATA.actions.map(p=><p key={p.name}>{p.name} · {p.minutes} 分钟<br/><small>恢复 {p.recovery.join('/')} · 每小时消耗 {p.cost.join('/')}</small></p>)}</details></>}
