import SortableList from './SortableList'
import {loopConditions} from '../utils/loopConditions'
import LoopScopeSettings from './LoopScopeSettings'
import BranchDestination,{BranchPort} from './BranchDestination'
import React,{useEffect} from 'react'
import {useBehaviorStore} from '../store/behaviorStore'
import {useContentLibrary} from '../store/contentLibrary'
import {useUpdateNodeInternals} from 'reactflow'
import LibraryRules from './LibraryRules'
import {RuleText} from './DesignInputs'
import './LoopEditor.css'

export function LoopConditionSummary({data}){
 const conditions=loopConditions(data)
 return <div className="loop-condition-summary"><strong>结束条件 · 满足任一项</strong>{conditions.length?conditions.map((c,i)=><div key={c.id}>{i+1}. {c.kind==='count'?'达到最大次数 · '+(c.maxIterations||'待设置'):'目标满足'}{c.kind==='goal'&&<>{c.condition&&<div>{c.condition}</div>}{c.rules?.map(r=><div key={r.id}><RuleText rule={r} kind={r.attribute?.startsWith('buff:')?'buff':'attribute'} influences={['较低时','较高时','处于指定状态时','具有指定 Buff 时','不具有指定 Buff 时']}/></div>)}{!c.condition&&!c.rules?.length&&<small>引用行为目标</small>}</>}</div>):<span>未设置结束条件</span>}</div>
}
export function LoopConditionsEditor({node,compact=false,onUpdate}){
 const storeUpdate=useBehaviorStore(s=>s.updateNode),conditions=loopConditions(node.data)
 const update=next=>(onUpdate||storeUpdate)(node.id,{loopConditions:next})
 const patch=(id,change)=>update(conditions.map(c=>c.id===id?{...c,...change}:c))
 return <div className={'loop-conditions-editor nodrag nowheel '+(compact?'compact':'')}>
  <div className="section-header"><label>循环结束条件</label><button className="btn-small" onClick={()=>update([...conditions,{id:crypto.randomUUID(),kind:'goal',condition:'',rules:[]}])}>+ 添加结束条件</button></div>
  <p className="form-hint">按顺序检查，满足任一项即结束；都不满足才执行本轮。</p>
  <SortableList items={conditions} onChange={update} label="循环结束条件">{(c,i,handle)=><section className="loop-condition-row" data-condition-id={c.id}>
   <div className="loop-condition-heading">{handle}<strong>条件 {i+1}</strong><select aria-label={'结束条件 '+(i+1)+' 类型'} value={c.kind} onChange={e=>patch(c.id,{kind:e.target.value})}><option value="goal">按目标满足情况</option><option value="count">按配置的最大次数</option></select><button aria-label={'删除结束条件 '+(i+1)} onClick={()=>update(conditions.filter(x=>x.id!==c.id))}>×</button></div>
   {c.kind==='count'?<label>最大次数<input aria-label={'结束条件 '+(i+1)+' 最大次数'} value={c.maxIterations||''} placeholder="填写次数或设计期望" onChange={e=>patch(c.id,{maxIterations:e.target.value})}/></label>:compact?<div className="loop-goal-summary">{c.condition}{c.rules?.map(r=><div key={r.id}><RuleText rule={r} kind={r.attribute?.startsWith('buff:')?'buff':'attribute'} influences={['较低时','较高时','处于指定状态时','具有指定 Buff 时','不具有指定 Buff 时']}/></div>)}{!c.condition&&!c.rules?.length&&<small>引用行为目标 · 可在右侧设置</small>}</div>:<>
    <LibraryRules title="目标满足属性条件" value={c.rules||[]} onChange={rules=>patch(c.id,{rules})}/>
    <p className="form-hint">此项内属性规则全部满足时结束；不填规则时引用行为准入数据中的满足目标。</p>
   </>}
  </section>}</SortableList>
 </div>
}
export function LoopNodeStages({id,data}) {
 const library=useContentLibrary(s=>s.library),updateInternals=useUpdateNodeInternals()
 useEffect(()=>{updateInternals(id)},[id,data,library,updateInternals])
 return <div className="loop-stages"><LoopConditionSummary data={data}/><p>每轮执行前判定；本轮结束后自动进入下一次判定</p>{[['continue','循环体起点'],['complete','循环结束']].map(([handle,label])=><div key={handle} className="loop-output"><span>{label}</span><BranchPort data={data} handle={handle}/></div>)}</div>
}
export default function LoopFields({node}){
 const {updateNode}=useBehaviorStore()
 const d=node.data,update=patch=>updateNode(node.id,patch)
 return <div className="loop-editor">
  <LoopConditionsEditor node={node}/>
  <BranchDestination node={node} handle="continue" label="进入循环体"/>
  <BranchDestination node={node} handle="complete" label="循环结束后去向"/>
  <p className="form-hint">准入用内部判断节点，个性待机用内部待机节点。末尾需要继续循环时，连接容器右侧的 ↻ 标记。</p>
  <LoopScopeSettings key={node.id} node={node}/>
 </div>
}
