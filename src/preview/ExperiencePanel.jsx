import React,{useEffect,useState} from 'react'
import {SOURCES} from './experience.mjs'

const states={running:'进行中',done:'已结束',blocked:'失败',exited:'已跳出',interrupted:'已中断',waiting:'等待中'}
export function recordTime(minutes){const m=Math.max(0,Math.floor(minutes||0));return '第'+(Math.floor(m/1440)+1)+'天 '+String(Math.floor(m%1440/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0')}
function Effects({rows,empty}){return rows.length?<ul className="experience-effects">{rows.map(r=><li key={r.key}>{r.text}{r.count>1&&<small> · 累计 {r.count} 次结算</small>}</li>)}</ul>:<p className="experience-muted">{empty}</p>}
function Card({record:r,now,onLocate,canLocate,observationEnded}){
 const priority=x=>x.key.endsWith(':attrs:'+r.goalId)?-1:({inventory:0,buffs:1,relation:2,attrs:3}[x.area]??4)
 const [icon,label]=SOURCES[r.source]||SOURCES.unknown,rows=(r.effects||[]).slice().sort((a,b)=>priority(a)-priority(b)),elapsed=Math.max(0,(r.end??now??r.start)-r.start),waiting=r.kind==='wait'||r.name==='等待目标调度',process=r.events.filter(e=>e.kind!=='debug')
 return <article id={r.id} className={'experience-card experience-'+r.source} data-status={r.status}>
  <header><span className="experience-source"><b aria-hidden="true">{icon}</b>{waiting?'等待记录':label}</span><span className={'experience-status status-'+r.status}>{waiting&&r.status==='done'?'等待结束':states[r.status]||r.status}</span></header>
  <h3>{r.name}</h3>
  {!waiting&&<p className="experience-origin">为了：{r.goal||'手动运行所选行为'}{r.parent&&<span>为「{r.parent}」准备</span>}</p>}
  {r.service&&<span className="experience-service">预览服务 · 暂无对应在线行为图</span>}
  {r.trigger&&<p className="experience-trigger">{r.trigger}</p>}
  {r.turn&&<section className="experience-turn"><strong>关键转折</strong><p>{r.turn}</p></section>}
  {!waiting&&<section><strong className="experience-caption">实际影响</strong><Effects rows={rows.slice(0,3)} empty={r.end==null?'尚无已提交的节点效果':'未记录到节点直接效果'}/>{rows.length>3&&<details><summary>另有 {rows.length-3} 项影响</summary><Effects rows={rows.slice(3)}/></details>}</section>}
  {!waiting&&!!r.net?.filter(x=>x.key.startsWith(r.actor+':')).length&&<section><strong className="experience-caption">伙伴期间净变化 · 含自然消耗</strong><Effects rows={r.net.filter(x=>x.key.startsWith(r.actor+':')).slice(0,3)}/></section>}
  {(r.reason||waiting)&&<p className="experience-reason">{r.reason}</p>}
  {!waiting&&<p className="experience-goal-result">{r.goalResult}</p>}
  {observationEnded&&r.end==null&&<p className="experience-muted">观察已结束，本段经历尚未结束。</p>}
  <footer><time>{recordTime(r.start)}{r.end!=null?' — '+recordTime(r.end):' 起'}</time><span>{elapsed.toFixed(1)} 游戏分钟</span></footer>
  {r.parentId&&<button className="experience-link" disabled={!canLocate(r.parentId)} onClick={()=>onLocate(r.parentId)}>查看关联准备经历{!canLocate(r.parentId)&&'（已超出保留范围）'}</button>}
  {!waiting&&<details className="experience-process"><summary>展开行为过程 · {process.length} 条</summary>
   {r.goalScore!=null&&<p className="experience-muted">选择时目标得分：{Number(r.goalScore).toFixed(2)}</p>}
   {!!r.omitted&&<p className="experience-muted">此行为省略了最早 {r.omitted} 条过程；累计影响仍保留。</p>}
   <ol>{process.map(e=><li key={e.id} className={'event-'+e.kind}><small>{recordTime(e.time)}</small><p>{e.text}{e.count>1?' ×'+e.count:''}</p>{e.candidates&&<details><summary>查看候选与判断依据</summary>{e.candidates.map((c,i)=><div key={i}><p>{c.name} · {(c.probability*100).toFixed(1)}%</p>{c.gate&&<p className="experience-muted">预览门槛：{c.gate}</p>}{c.evidence?.map((f,j)=><p className="experience-muted" key={j}>{f}</p>)}</div>)}</details>}</li>)}</ol>
   <details><summary>期间净变化 · 包含自然消耗及外部变化</summary><Effects rows={r.net||[]} empty="未记录到期间净变化"/><p className="experience-muted">与开始时快照比较，不全部归因于本行为。</p></details>
  </details>}
 </article>
}
export default function ExperiencePanel({controller,simulation}){
 const records=controller?.experiences||(simulation?.experience?[simulation.experience]:[]),owner=controller||simulation
 const [source,setSource]=useState('all'),[onlyProblems,setOnlyProblems]=useState(false),[page,setPage]=useState(1),[known,setKnown]=useState(()=>records.map(r=>r.id))
 useEffect(()=>{setKnown((controller?.experiences||(simulation?.experience?[simulation.experience]:[])).map(r=>r.id));setPage(1)},[owner])
 useEffect(()=>{if(!known.length&&records.length)setKnown(records.map(r=>r.id))},[records.length,known.length])
 const ids=new Set(known),pending=records.filter(r=>!ids.has(r.id)).length
 const filtered=records.filter(r=>ids.has(r.id)&&(source==='all'||r.source===source)&&(!onlyProblems||r.kind==='wait'||['blocked','exited','interrupted','waiting'].includes(r.status))).slice().reverse(),shown=filtered.slice((page-1)*20,page*20),pages=Math.max(1,Math.ceil(filtered.length/20))
 function refresh(){setKnown(records.map(r=>r.id));setPage(1)}
 function locate(id){setSource('all');setOnlyProblems(false);setKnown(records.map(r=>r.id));const position=records.slice().reverse().findIndex(r=>r.id===id);setPage(Math.floor(position/20)+1);setTimeout(()=>document.getElementById(id)?.scrollIntoView({block:'nearest',behavior:'smooth'}),0)}
 return <section className="experience-panel" aria-label="伙伴经历">
  <div className="experience-toolbar"><label>来源<select aria-label="经历来源" value={source} onChange={e=>{setSource(e.target.value);setPage(1)}}><option value="all">全部来源</option>{Object.entries(SOURCES).map(([key,[,label]])=><option key={key} value={key}>{label}</option>)}</select></label><label><input type="checkbox" checked={onlyProblems} onChange={e=>{setOnlyProblems(e.target.checked);setPage(1)}}/>只看异常与等待</label></div>
  {!!pending&&<button className="experience-new" onClick={refresh}>有 {pending} 段新经历 · 点击查看</button>}
  {!!controller?.omittedExperiences&&<p className="experience-muted">保留最近5000段经历，更早 {controller.omittedExperiences} 段已移出。重置会清空本次记录。</p>}
  {!shown.length&&<p className="experience-empty">{records.length?'当前筛选下暂无经历':'开始运行后，在这里查看伙伴为何行动、如何选择和带来的影响。'}</p>}
  {shown.map((r,i)=><React.Fragment key={r.id}>{(i===0||Math.floor(shown[i-1].start/1440)!==Math.floor(r.start/1440))&&<h4 className="experience-day">第 {Math.floor(r.start/1440)+1} 天</h4>}<Card record={r} now={controller?.elapsed??simulation?.elapsed} onLocate={locate} canLocate={id=>records.some(r=>r.id===id)} observationEnded={controller?.status==='day-complete'}/></React.Fragment>)}
  {pages>1&&<div className="experience-pagination"><button disabled={page<=1} onClick={()=>setPage(p=>p-1)}>上一页</button><span>{page} / {pages}</span><button disabled={page>=pages} onClick={()=>setPage(p=>p+1)}>下一页</button></div>}
  {!!(controller?.logs||simulation?.logs)?.length&&<details className="experience-raw"><summary>原始调试日志 · 最近200条</summary>{(controller?.logs||simulation?.logs).map((l,i)=><p key={i}><small>{l.time.toFixed(1)} 分钟</small><br/>{l.text}</p>)}</details>}
  <p className="experience-muted">预览模拟记录 · 重置后清空；影响不代表正式游戏数值。</p>
 </section>
}
