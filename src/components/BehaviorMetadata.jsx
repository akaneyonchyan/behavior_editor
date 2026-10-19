import React from 'react'
import {useBehaviorStore} from '../store/behaviorStore'
import {useContentLibrary} from '../store/contentLibrary'
import LibraryRules from './LibraryRules'
import {PropertyInputs} from './DesignInputs'
import TextChoice from './TextChoice'
import {GOAL_TYPES,CONSUMPTION_TYPES} from '../utils/behaviorMetadata'
export default function BehaviorMetadata(){
  const {behaviorInfo:info,updateBehaviorInfo:update}=useBehaviorStore()
  const objects=useContentLibrary(s=>s.library.objects),p=info.preconditions||{}
  const goals=info.targetRules,interactions=p.interactObjectRules||[],consumables=p.consumableRules||[]
  const pre=patch=>update({preconditions:{...p,...patch}})
  const objectSelect=(value,onChange,label)=><TextChoice label={label} options={objects.filter(o=>o.enabled).map(o=>o.name)} value={objects.find(o=>o.id===value)?.name||value||''} placeholder="选择对象类型或自定义" onChange={name=>onChange(objects.find(o=>o.enabled&&o.name===name)?.id||name)}/>
  return <div className="property-panel" aria-label="行为准入数据"><div className="panel-header"><div className="panel-title">开始 · 行为准入数据</div></div><div className="panel-content">
    <p className="form-hint">选择节点可编辑节点属性；点击开始节点或画布空白处编辑行为准入数据。</p>
    <div className="form-group"><label>行为名称</label><input aria-label="行为名称" value={info.name} onChange={e=>update({name:e.target.value})}/></div>
    <div className="weight-factors"><div className="section-header"><label>满足目标</label><button className="btn-small" onClick={()=>update({targetRules:[...goals,{id:crypto.randomUUID(),source:'',attribute:'',influence:'增加'}]})}>+ 添加目标</button></div>
      {goals.map((r,i)=><div className="weight-factor" key={r.id}><div className="factor-actions"><strong>目标 {i+1}</strong>{goals.length>1&&<button className="btn-small" onClick={()=>update({targetRules:goals.filter((_,j)=>i!==j)})}>删除</button>}</div><PropertyInputs rule={r} onChange={patch=>update({targetRules:goals.map((row,j)=>j===i?{...row,...patch}:row)})}/><label>规则类型<TextChoice label="目标规则类型" options={GOAL_TYPES} value={r.influence} onChange={influence=>update({targetRules:goals.map((row,j)=>i===j?{...row,influence}:row)})}/></label></div>)}
    </div>
    <div className="weight-factors"><div className="section-header"><label>交互对象类型</label><button className="btn-small" onClick={()=>pre({interactObjectRules:[...interactions,{id:crypto.randomUUID(),objectType:''}]})}>+ 添加交互对象</button></div>
      {interactions.map((r,i)=><div className="weight-factor" key={r.id}><div className="factor-actions"><strong>交互对象 {i+1}</strong><button className="btn-small" onClick={()=>pre({interactObjectRules:interactions.filter((_,j)=>i!==j)})}>删除</button></div><label>对象类型{objectSelect(r.objectType,objectType=>pre({interactObjectRules:interactions.map((row,j)=>i===j?{...row,objectType}:row)}),'行为交互对象类型')}</label></div>)}
    </div>
    <div className="weight-factors"><div className="section-header"><label>消耗品要求</label><button className="btn-small" onClick={()=>pre({consumableRules:[...consumables,{id:crypto.randomUUID(),objectType:'',requirement:'有可用存量'}]})}>+ 添加消耗品</button></div>
      {consumables.map((r,i)=><div className="weight-factor" key={r.id}><div className="factor-actions"><strong>消耗品 {i+1}</strong><button className="btn-small" onClick={()=>pre({consumableRules:consumables.filter((_,j)=>i!==j)})}>删除</button></div><label>对象类型{objectSelect(r.objectType,objectType=>pre({consumableRules:consumables.map((row,j)=>i===j?{...row,objectType}:row)}),'消耗品对象类型')}</label><label>要求<TextChoice label="消耗品要求" options={CONSUMPTION_TYPES} value={r.requirement} onChange={requirement=>pre({consumableRules:consumables.map((row,j)=>i===j?{...row,requirement}:row)})}/></label></div>)}
    </div>
    <LibraryRules title="准入条件" value={p.attributeRules} onChange={attributeRules=>pre({attributeRules})}/>
    <p className="form-hint">满足目标至少保留一条，其余条件按需添加。下拉框支持自由输入，非标准选项以下划线标记；旧版文字也在这些选项中保留。</p>
  </div></div>
}
