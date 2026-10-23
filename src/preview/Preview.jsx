import React,{useEffect,useMemo,useRef,useState} from 'react'
import {listPublishedBehaviors,readPublishedBehavior} from '../utils/publishedBehaviors'
import {validateSnapshot} from '../store/publishedLibrary'
import {CHARACTERS,DEFAULTS,Simulation,makeWorld,bindingsFor,allRules,refKey,inspect,definition} from './runtime.mjs'
import Island from './Island'
import {objectStates} from './sceneStatus.mjs'
import TraceGraph from './TraceGraph'
import PreviewSplit from './PreviewSplit'
import RuleAdapters,{adaptPreview} from './RuleAdapters'
import {GoalScheduler,makeScenarioWorld,schedulerConfig} from './scheduler.mjs'
import {singleScenario} from './singleScenario.mjs'
import GoalPanel from './GoalPanel'
import RhythmPanel,{RhythmConfig} from './RhythmPanel'
import {integrateFile,integrationLibrary,prepareIntegrationWorld} from './integration.mjs'
import {dayConfig,initializeDay,DAY_DEFAULTS,prepareMeal,dayBindings} from './day.mjs'
import {bound} from './preparation.mjs'
import CatalogPanel from './CatalogPanel'
import {OnlineColony} from './onlineColony.mjs'
import {scenario,validateFile} from './scenarios.mjs'
import './preview.css'

export default function Preview({navigation}){
 const [files,setFiles]=useState([]),[snapshot,setSnapshot]=useState(null),[file,setFile]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 const [actor,setActor]=useState('pip'),[selected,setSelected]=useState('pip'),[world,setWorld]=useState([]),[bindings,setBindings]=useState({}),[params,setParams]=useState({...DEFAULTS,initial:100}),[running,setRunning]=useState(false),[speed,setSpeed]=useState(1),[revision,render]=useState(0),[tab,setTab]=useState('目标')
 const sim=useRef(null),request=useRef(0)
 const scheduler=useRef(null)
 const [mode,setMode]=useState('auto'),[fullDay,setFullDay]=useState(true)
 const [balanceDays,setBalanceDays]=useState(1)
 const [enabledActors,setEnabledActors]=useState(()=>Object.fromEntries(CHARACTERS.map(c=>[c.id,true])))
 function toggleActor(id,on){setEnabledActors(v=>({...v,[id]:on}));scheduler.current?.setEnabled?.(id,on);render(x=>x+1)}
 const [adapters,setAdapters]=useState({})
 const [autoPrepare,setAutoPrepare]=useState(true)
 const [verification,setVerification]=useState([]),[verifying,setVerifying]=useState(false)
 const config=useMemo(()=>file?integrateFile(dayConfig(schedulerConfig({...file,config:adaptPreview(file.config,adapters)}))).config:null,[file,adapters])
 useEffect(()=>{setAdapters({})},[file])
 async function refresh(){const generation=++request.current;setBusy(true);setError('');try{const [index,response]=await Promise.all([listPublishedBehaviors(),fetch(import.meta.env.BASE_URL+'data/library.json',{cache:'no-store'})]);if(!response.ok)throw Error('公共库快照未就绪，请运行 npm run dev:preview');const next=validateSnapshot(await response.json());if(generation!==request.current)return;setFiles(index.files);if(sim.current||file){setError('目录已刷新；重新选择行为后应用新版本，当前运行保持不变。')}else {setSnapshot(next);setWorld(makeWorld(next.library,params));const first=index.files.find(f=>f.name==='在床上睡觉.json')||index.files[0];if(first)await choose(first.name,index.files,next)}}catch(e){if(generation===request.current)setError(e.message)}finally{if(generation===request.current)setBusy(false)}}
 useEffect(()=>{refresh();return()=>{request.current++}},[])
 async function choose(name,entries=files,knownSnapshot=null){const generation=++request.current;setRunning(false);sim.current=null;setFile(null);setBusy(true);setError('');try{const f=entries.find(f=>f.name===name);if(!f)return;const next=await readPublishedBehavior(f);let snap=knownSnapshot;if(!snap){const response=await fetch(import.meta.env.BASE_URL+'data/library.json',{cache:'no-store'});if(!response.ok)throw Error('无法读取公共库');snap=validateSnapshot(await response.json())}if(generation!==request.current)return;const w=makeWorld(snap.library,params,next.config);setSnapshot(snap);setFile(next);setWorld(w);setSelected(actor);setBindings(bindingsFor(next.config,snap.library,w,actor))}catch(e){if(generation===request.current)setError(e.message)}finally{if(generation===request.current)setBusy(false)}}
 const refs=useMemo(()=>config?[...new Map(allRules(config).map(x=>[refKey(x.r),x.r])).values()]:[],[config])
 const runtimeLibrary=useMemo(()=>snapshot?integrationLibrary(snapshot.library):null,[snapshot])
 const issues=useMemo(()=>{if(!config||!runtimeLibrary)return [];const w=structuredClone(world);prepareIntegrationWorld(w);return inspect(config,runtimeLibrary,w,bound(config,runtimeLibrary,w,actor))},[config,runtimeLibrary,world,actor])
 function create(){if(!file||issues.length)return null;try{const s=singleScenario(config,runtimeLibrary,world,actor,params,autoPrepare);sim.current=s;setError('');return s}catch(e){setError('测试准备失败：'+e.message);return null}}

 function reset(){setRunning(false);sim.current=null;scheduler.current=null;render(x=>x+1)}
 function step(){const s=sim.current||create();if(s){s.step();render(x=>x+1)}}
 async function start(){
  if(mode==='auto'){
   if(scheduler.current){setRunning(!running);return}
   const generation=++request.current;setBusy(true);setError('')
   try{const all=await Promise.all(files.map(f=>readPublishedBehavior(f)));if(generation!==request.current)return;const scene=makeScenarioWorld(snapshot.library,params,all).map(o=>world.find(w=>w.id===o.id&&!o.placeholder)||o);scheduler.current=new OnlineColony(all,snapshot.library,scene,enabledActors,params,{dayMode:true,rhythm:true,daySeconds:balanceDays*1440});setTab('目标');setRunning(true);render(x=>x+1)}catch(e){if(generation===request.current)setError('在线行为加载失败：'+e.message)}finally{if(generation===request.current)setBusy(false)}
   return
  }
  if(issues.length){setTab('配置');setError('这份行为有 '+issues.length+' 项未支持配置，暂时不能执行。请查看右侧运行前检查，或先选择“在床上睡觉”体验。');return}const active=sim.current||create();if(active)setRunning(!running)
 }
 useEffect(()=>{if(!running)return;const timer=setInterval(()=>{if(mode!=='single'){scheduler.current?.tick(.1*speed);if(['day-complete','blocked'].includes(scheduler.current?.status))setRunning(false);render(x=>x+1);return}const s=sim.current;if(!s)return; s.tick(.1*speed);render(x=>x+1);if(['done','blocked','exited'].includes(s.status))setRunning(false)},100);return()=>clearInterval(timer)},[running,speed,mode])
 async function verifyAll(){
  setVerifying(true);setVerification([]);setError('')
  try{const all=await Promise.all(files.map(f=>readPublishedBehavior(f)));for(const f of all){await new Promise(resolve=>setTimeout(resolve,0));const result=validateFile(all,snapshot.library,f);setVerification(rows=>[...rows,result])}}catch(e){setError('验证失败：'+e.message)}finally{setVerifying(false)}
 }
 async function testScenario(name){
  setRunning(false);setBusy(true);setError('')
  try{const all=await Promise.all(files.map(f=>readPublishedBehavior(f)));scheduler.current=scenario(all,snapshot.library,name,{...params,rhythm:true});sim.current=null;setActor('pip');setSelected('pip');setMode('auto');setFullDay(true);setTab('目标');setRunning(true);render(x=>x+1)}catch(e){setError('创建验证场景失败：'+e.message)}finally{setBusy(false)}
 }
 const controller=scheduler.current?.view?scheduler.current.view(actor):scheduler.current,s=mode!=='single'?controller?.active:sim.current,shown=controller?.world||s?.world||world,entity=shown.find(o=>o.id===selected),node=s?.node(),locked=!!s||!!controller||busy,displayFile=mode==='auto'?controller?.currentFile:file
 function edit(id,area,key,value){setWorld(w=>w.map(o=>o.id===id?{...o,[area]:{...o[area],[key]:value}}:o))}
 const shownLibrary=controller?.lib||snapshot?.library
 const properties=shownLibrary?.attributes.filter(a=>a.enabled&&a.objectTypes?.includes(entity?.type))||[]
 const buffs=shownLibrary?.buffs.filter(a=>a.enabled&&a.objectTypes?.includes(entity?.type)&&Number(entity?.buffs?.[a.id])>0)||[]
 function changeActor(id){setActor(id);setSelected(id);if(config)setBindings(bindingsFor(config,snapshot.library,world,id))}
 const status=mode!=='single'&&controller?(controller.status==='day-complete'?'观察结束':controller.status==='blocked'?'需处理':controller.status==='disabled'?'伙伴已关闭':running?(controller.status==='waiting'?'等待调度':'自主运行'):'已暂停'):{ready:'就绪',running:running?'运行中':'已暂停',blocked:'需处理',done:'已结束',exited:'已跳出'}[s?.status]||'配置场景'
 const currentBehavior=mode==='single'?(file?.config.behavior.name||'请选择行为'):['running','day-complete','blocked'].includes(controller?.status)?(controller.service?.step.name||controller.currentFile?.config.behavior.name||'暂无执行行为'):'暂无执行行为'
 return <section className="behavior-preview" onKeyDown={e=>e.stopPropagation()}>
  <header className="preview-toolbar">{navigation}<span className="preview-badge">在线图 × V3.2数值</span><select aria-label="预览模式" value={mode} disabled={busy} onChange={e=>{reset();setMode(e.target.value);setError('');setTab(e.target.value!=='single'?'目标':'记录')}}><option value="auto">行为模拟（数值表驱动）</option><option value="single">单行为调试</option></select>{mode==='single'&&<select aria-label="在线行为" value={file?.name||''} onChange={e=>choose(e.target.value)} disabled={busy}><option value="">选择在线行为…</option>{files.map(f=><option key={f.sha} value={f.name}>{f.name.replace(/\.json$/,'')}</option>)}</select>}{mode==='auto'&&<select aria-label="观察天数" disabled={locked} value={balanceDays} onChange={e=>setBalanceDays(Number(e.target.value))}>{[1,2,3,4,5,6,7].map(n=><option value={n} key={n}>{n} 天</option>)}</select>}<button onClick={refresh} disabled={busy}>刷新目录</button><button disabled={!file||busy||['day-complete','blocked'].includes(controller?.status)||(mode==='single'&&['done','blocked','exited'].includes(s?.status))} onClick={start}>{running?'暂停':'开始'}</button>{mode==='single'&&<button disabled={!file||issues.length>0||running||['done','blocked','exited'].includes(s?.status)} onClick={step}>单步</button>}<button onClick={reset}>重置</button><select aria-label="播放倍速" value={speed} onChange={e=>setSpeed(Number(e.target.value))}>{[1,3,5,20,60].map(n=><option key={n} value={n}>{n}×</option>)}</select><span>{status} · {controller?.settings.dayMode?(scheduler.current?.clock?.()||controller.clock()):(controller?.elapsed||s?.elapsed||0).toFixed(1)+' 游戏分钟'}</span></header>
  {error&&<div className="preview-notice" role="status">{error}</div>}
  {!s&&!controller&&file&&!busy&&<div className="preview-notice" role="status">{mode==='auto'?'点击开始：在线图决定执行流程，数值表提供消耗、恢复和目标权重；已启用伙伴共享场景，不执行双人互动。':issues.length?'当前行为有 '+issues.length+' 项未支持规则，点击“开始”可查看原因。':'已载入在线行为。点击“开始”运行；当前只执行选中的伙伴，其他伙伴不会自主行动。'}</div>}
  <div className="preview-body"><aside className="preview-left">
   <h3>伙伴</h3><div className="cast">{CHARACTERS.map(c=><div className="cast-entry" key={c.id}><button className={selected===c.id?'chosen':''} onClick={()=>{setSelected(c.id);if(mode!=='single')setActor(c.id)}}><i style={{background:c.color}}/>{c.name}<small>{c.species}{mode!=='single'?(enabledActors[c.id]?' · 已启用':' · 已关闭'):''}</small></button>{mode!=='single'&&<label><input type="checkbox" aria-label={'启用'+c.name} checked={enabledActors[c.id]} onChange={e=>toggleActor(c.id,e.target.checked)}/>启用</label>}</div>)}</div>
   <label>{mode==='single'?'执行伙伴':'观察伙伴'}<select disabled={mode==='single'&&locked} value={actor} onChange={e=>changeActor(e.target.value)}>{CHARACTERS.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label>
   <h3>{entity?.name||'场景对象'} <small>{entity?.hobby||entity?.zone}{entity?.previewOnly?' · 预览占位工具（公共库条目停用）':entity?.placeholder?' · 自定义名称占位实例':''}</small></h3>
   {entity&&<div className="selected-object-states">{objectStates(entity,shown,shownLibrary).map(s=><p key={s.id}><span className={'scene-badge '+s.tone}>{s.label}</span> {s.detail}</p>)}</div>}
   <p className="preview-help">{locked?'重置后可调整初始状态。':'初始值仅供模拟，不修改公共库或行为文件。'}</p>
   <details open><summary>属性（{properties.length}）</summary><div className="preview-properties">{properties.map(a=><label key={a.id}>{a.name}<input aria-label={a.name} disabled={locked} type={a.kind==='数值'?'number':'text'} min="0" max="100" value={typeof entity.attrs[a.id]==='number'?Number(entity.attrs[a.id].toFixed(1)):entity.attrs[a.id]??''} onChange={e=>edit(entity.id,'attrs',a.id,a.kind==='数值'?Math.max(0,Math.min(100,Number(e.target.value))):e.target.value)}/></label>)}</div></details>
   {(s||controller)&&<details open className="preview-buff-layers"><summary>当前 Buff · PAD</summary><p>累计 PAD：{entity?.pad?.map(v=>v.toFixed(1)).join(' / ')||'0 / 0 / 0'}</p>{!entity?.buffInstances?.length&&<p className="preview-help">暂无已触发 Buff</p>}{entity?.buffInstances?.map(b=><p key={b.id}>{shownLibrary.buffs.find(x=>x.id===b.buffId)?.name||b.buffId} · #{b.id} · 剩余 {Math.max(0,Math.ceil(b.expires-(controller?controller.elapsed*(controller.settings.worldSecondsPerSecond||60):s?.params.worldNow||0)))} 秒{b.remaining!=null&&<> · 节点完成剩余 {b.remaining} 次</>}<small className="preview-help" style={{display:'block'}}>{b.durationBasis} · 游戏时间</small></p>)}</details>}<details><summary>Buff（{buffs.length}）</summary>{!buffs.length&&<p className="preview-help">暂无已触发 Buff</p>}{buffs.map(b=><label key={b.id}>{b.name}<input disabled={locked} type="number" min="0" max="99" value={entity.buffs[b.id]||0} onChange={e=>edit(entity.id,'buffs',b.id,Math.max(0,Math.min(99,Number(e.target.value))))}/></label>)}</details>
   {!!Object.keys(entity?.inventory||{}).length&&<details open><summary>产物</summary>{Object.entries(entity.inventory).map(([id,count])=><p key={id}>{id==='preview:treasure'?'宝箱（预览占位）':snapshot.library.items.find(i=>i.id===id)?.name||id} ×{count}</p>)}</details>}
  </aside>
  <PreviewSplit><Island selected={selected} library={shownLibrary} world={shown.map(o=>o.type==='partner'&&mode!=='single'?{...o,inactive:!enabledActors[o.id]}:o)} actor={actor} current={controller?.service?controller.service.step.name:mode==='auto'&&controller?.status==='waiting'?'等待目标调度':node?.data.name} running={running&&(mode==='single'||controller?.status==='running')} progress={controller?.service?controller.service.progress/controller.service.minutes:node?s.progress/s.duration(node):0} onSelect={id=>{setSelected(id);if(mode!=='single'&&CHARACTERS.some(c=>c.id===id))setActor(id)}}/>
   {<section className="preview-graph"><header className="preview-graph-title">执行路径 · {displayFile?.config.behavior.name||'请选择在线行为'} <small>{displayFile?.sha.slice(0,8)}</small></header>{controller?.service&&<p className="preview-help">{controller.service.step.name} · 2分钟，暂缺对应在线准备稿。</p>}<TraceGraph config={displayFile?.config} simulation={s}/><div className="path-trace">{s?.visited.map(id=>displayFile.config.graph.nodes.find(n=>n.id===id)?.data.name||id).slice(-20).join(' → ')||'按原图连线执行；高亮当前节点与已走过的连线'}</div></section>}
  </PreviewSplit><aside className="preview-right"><nav>{['目标','节点','记录','接入','配置'].map(t=><button key={t} className={tab===t?'selected':''} onClick={()=>setTab(t)}>{t}</button>)}</nav>
   <div className="current-action"><div className="current-action-heading"><strong>{currentBehavior}</strong><small>› 当前执行节点</small></div><h3>{controller?.status==='disabled'?'伙伴已关闭':controller?.service?controller.service.step.name:mode==='auto'&&controller?.status==='waiting'?'等待目标调度':node?.data.name||'等待开始'}</h3><p>{controller?.service?'按工具拿还配置执行2分钟':mode==='auto'&&controller?.status==='waiting'?'正在重新检查可行目标，具体原因见下方候选列表。':node?.data.animation||node?.data.description||'启动后在这里查看具体动作描述，无需动画资产。'}</p>{node&&(mode==='single'||controller?.status==='running')&&<><progress value={s.progress} max={s.duration(node)}/><small>{node.data.playMode||'节点判定'} · 耗时 {s.duration(node).toFixed(2)} 游戏分钟</small></>}</div>
   {mode==='single'&&<div className="single-preparation"><label><input type="checkbox" checked={autoPrepare} disabled={locked} onChange={e=>setAutoPrepare(e.target.checked)}/>自动准备准入状态</label><p className="preview-help">仅修改本次测试副本的属性、Buff、装备及交互对象。关闭后可手动测试准入失败。</p>{s?.preparationNotes?.length>0&&<details><summary>本次准备 · {s.preparationNotes.length} 项</summary>{s.preparationNotes.map((note,i)=><p key={i}>{note}</p>)}</details>}</div>}
   {controller?.error&&<pre className="preview-error">{controller.error}</pre>}{s?.error&&<pre className="preview-error">{s.error}</pre>}
   {tab==='目标'&&(controller?.calibrated||!controller?<RhythmPanel controller={controller}/>:<GoalPanel controller={controller}/>)}
   {tab==='接入'&&<CatalogPanel files={files} results={verification} busy={busy||verifying} onVerify={verifyAll} onScenario={testScenario} onRequest={name=>{controller?.requestBehavior(name);render(x=>x+1)}} controller={controller}/>}
   {tab==='记录'&&<div className="event-list">{(controller?.logs||s?.logs)?.map((l,i)=><article key={i}><time>{l.time.toFixed(1)} 分钟</time><p>{l.text}</p></article>)||<p>执行后显示分支概率、属性与 Buff 变化。</p>}</div>}
   {tab==='节点'&&<><h3>行为说明</h3><p>{displayFile?.config.behavior.description}</p><h3>循环轮次</h3>{Object.entries(s?.loops||{}).map(([id,n])=><p key={id}>{displayFile.config.graph.nodes.find(x=>x.id===id)?.data.name}：{n}</p>)}<h3>已占用</h3>{shown.filter(o=>o.occupied).map(o=><p key={o.id}>{o.name}</p>)}</>}
   {tab==='配置'&&<RhythmConfig/>}
   {tab==='配置'&&file&&mode==='single'&&<><p className="preview-help">“具体值”暂用配置的具体数值（默认 70，相等）/ 枚举 1；明确数字比较按原值。“达到期望”用高值阈值；“默认次数”用默认次数参数。自定义对象用同类型占位实例，物品名录不自动新增。</p><RuleAdapters config={file.config} library={snapshot.library} adapters={adapters} disabled={locked} onChange={a=>{setAdapters(a);setBindings(b=>({...bindingsFor(adaptPreview(file.config,a),snapshot.library,world,actor),...b}))}}/></>}
   {mode==='single'&&<details className="preview-issues" open={issues.length>0}><summary>运行前检查 · {issues.length} 项待处理</summary>{issues.map((i,k)=><p key={k}><strong>{i.where}</strong><br/>{i.text}</p>)}{!issues.length&&<p>{file?'规则检查通过，可开始预览。':'请先选择行为。'}</p>}</details>}
  </aside></div>
 </section>
}

