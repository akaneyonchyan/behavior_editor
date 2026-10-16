import React from 'react'
import { useBehaviorStore } from '../store/behaviorStore'
import { useContentLibrary } from '../store/contentLibrary'
import LibraryRules from './LibraryRules'
import TextChoice from './TextChoice'

export default function BehaviorMetadata() {
  const {behaviorInfo:info,updateBehaviorInfo:update}=useBehaviorStore()
  const objects=useContentLibrary(s=>s.library.objects)
  const p=info.preconditions||{}, consumables=p.consumableRules||[]
  const pre=patch=>update({preconditions:{...p,...patch}})
  const objectSelect=(value,onChange,label)=><select aria-label={label} value={value||''} onChange={e=>onChange(e.target.value)}><option value="">请选择对象类型</option>{value&&!objects.some(o=>o.id===value&&o.enabled)&&<option value={value}>{objects.find(o=>o.id===value)?.name||value}（停用或未入库，原值保留）</option>}{objects.filter(o=>o.enabled).map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select>
  const legacy=(label,value,onChange)=>value?.length>0&&<div className="form-group"><label>{label}（原有文字，保留）</label><textarea aria-label={label+'原有文字'} value={Array.isArray(value)?value.join(String.fromCharCode(10)):value} onChange={e=>onChange(Array.isArray(value)?e.target.value.split(String.fromCharCode(10)):e.target.value)}/><p className="form-hint">原描述不自动转换，避免改变含义；可用上方规则逐项替换。</p></div>
  return <div className="property-panel" aria-label="行为元数据">
    <div className="panel-header"><div className="panel-title">行为元数据</div></div>
    <div className="panel-content">
      <p className="form-hint">选择节点可编辑节点属性；点击画布空白处返回行为元数据。</p>
      <div className="form-group"><label>行为名称</label><input aria-label="行为名称" value={info.name} onChange={e=>update({name:e.target.value})}/></div>
      <LibraryRules title="满足目标" mode="goal" value={info.targetRules} onChange={targetRules=>update({targetRules})}/>
      {legacy('满足目标',info.matchTargets,matchTargets=>update({matchTargets}))}
      <div className="form-group"><label>交互对象类型</label>{objectSelect(p.interactObjectType,value=>pre({interactObjectType:value}),'行为交互对象类型')}</div>
      {legacy('交互对象',p.interactObject,interactObject=>pre({interactObject}))}
      <div className="weight-factors"><div className="section-header"><label>消耗品要求</label><button className="btn-small" onClick={()=>pre({consumableRules:[...consumables,{id:crypto.randomUUID(),objectType:'',requirement:'有可用存量'}]})}>+ 添加消耗品</button></div>
        {consumables.map((r,i)=><div className="weight-factor" key={r.id}><div className="factor-actions"><strong>消耗品 {i+1}</strong><button className="btn-small" onClick={()=>pre({consumableRules:consumables.filter(x=>x.id!==r.id)})}>删除</button></div>
          <label>对象类型{objectSelect(r.objectType,objectType=>pre({consumableRules:consumables.map(x=>x.id===r.id?{...x,objectType}:x)}),'消耗品对象类型')}</label>
          <label>要求<TextChoice label="消耗品要求" value={r.requirement} options={['有可用存量','足够完成一次行为','持续消耗直至目标达成']} onChange={requirement=>pre({consumableRules:consumables.map(x=>x.id===r.id?{...x,requirement}:x)})}/></label>
        </div>)}
      </div>
      {legacy('消耗品',p.consumables,consumables=>pre({consumables}))}
      <LibraryRules title="属性准入条件" value={p.attributeRules} onChange={attributeRules=>pre({attributeRules})}/>
      {legacy('属性门槛',p.attributes,attributes=>pre({attributes}))}
      <p className="form-hint">规则引用公共库的对象、属性与 Buff；这里只描述规则和大致期望，具体数值留待数值设计。修改即时写入当前行为，可撤销。</p>
    </div>
  </div>
}
