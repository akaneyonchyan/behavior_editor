import React from 'react'
import {CATALOG} from './integration.mjs'
export default function CatalogPanel({files,results,busy,onVerify,onScenario,onRequest,controller}){
 return <div className="preview-catalog"><h3>在线行为接入 · {files.length} 份</h3>
  <p>需求、采集和维护按当前状态调度；拿取/归还由准备链调用。晕倒、摔倒等事件行为需要对应触发条件，不会为了凑齐行为而随机触发。</p>
  <button disabled={busy} onClick={onVerify}>{busy?'正在逐张验证…':'逐张验证当前快照'}</button>
  <p>{results.length?'已验证 '+results.length+' / '+files.length+'，其中 '+results.filter(r=>r.passed).length+' 份找到目标达成路径。':'每份使用3组固定随机种子，展示实际结果；不会改动正在运行的场景。'}</p>
  {files.map(f=>{const meta=CATALOG.find(x=>x.name===f.name),result=results.find(r=>r.sha===f.sha&&r.name===f.name);return <details key={f.sha||f.name}><summary>{f.name.replace(/.json$/,'')}<span>{meta?.category||'待关联'} · {result?(result.passed?'已验证':'待处理'):'未验证'}</span></summary>
   <div className="catalog-actions"><button disabled={busy} onClick={()=>onScenario(f.name)}>新建验证场景</button><button disabled={!controller||busy||controller.status==='day-complete'} onClick={()=>onRequest(f.name)}>加入当前目标队列</button></div>
   <p>新建验证场景会重置当前预览，并配置该行为需要的初始状态。加入目标队列则保留当前状态，条件不满足时展示阻塞原因。</p>
   {result&&<><p className={result.passed?'catalog-state':'catalog-warning'}>{result.reason}</p>{result.runs.map(r=><p key={r.seed}>种子 {r.seed}：{r.reason}<br/>{r.steps.map(s=>s.file.replace(/.json$/,'')+'（'+({done:'结束',exited:'跳出',blocked:'受阻'}[s.status]||s.status)+'）').join(' → ')}</p>)}<details><summary>本图预览映射与待确认项</summary>{result.notes.map((n,i)=><p key={i}>{n}</p>)}</details></>}
  </details>})}
 </div>
}
