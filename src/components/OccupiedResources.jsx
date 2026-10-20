import {useDisplayGraph} from '../store/graphDisplay'
import React from 'react'
import {ObjectNameText} from './ObjectNameInput'
import {sourceType} from '../store/contentLibrary'
import {useBehaviorStore} from '../store/behaviorStore'
import {PropertyInputs,ChoiceText,choicesFor} from './DesignInputs'
import {useContentLibrary,sourceName,sourceChoices,propertyName} from '../store/contentLibrary'
import {upstreamOccupancies} from '../utils/occupiedResources'

function ResourceText({rule}){
 const lib=useContentLibrary(s=>s.library)
 return <><ChoiceText value={sourceName(lib,rule.source)} options={sourceChoices(lib).map(s=>s.name)}/>{rule.objectName&&<> · <ObjectNameText type={sourceType(rule.source)} value={rule.objectName}/></>} · <ChoiceText value={propertyName(lib,rule.attribute)} options={choicesFor(lib,rule.source).map(p=>p.name)}/></>
}
export function OccupiedResources({node}){
 const update=useBehaviorStore(s=>s.updateNode),rows=node.data.occupiedResources||[]
 const set=next=>update(node.id,{occupiedResources:next})
 return <div className="weight-factors"><div className="section-header"><label>占用资源</label><button className="btn-small" onClick={()=>set([...rows,{id:crypto.randomUUID(),source:'',attribute:''}])}>+ 添加占用资源</button></div>
  <p className="form-hint">此节点执行时产生的占用，持续到行为结束。只声明本行为持有的资源；结束节点会自动引用。</p>
  {rows.map((r,i)=><div className="weight-factor" key={r.id}><div className="factor-actions"><strong>占用 {i+1}</strong><button className="btn-small" onClick={()=>set(rows.filter((_,j)=>j!==i))}>删除</button></div><PropertyInputs rule={r} onChange={patch=>set(rows.map((row,j)=>j===i?{...row,...patch}:row))}/></div>)}
 </div>
}
export function OccupiedSummary({data}){
 const rows=data.occupiedResources||[]
 return rows.length?<div className="summary-row"><span>占用资源</span><ol>{rows.map(r=><li key={r.id}><ResourceText rule={r}/></li>)}</ol></div>:null
}
export function ReleaseSummary({id,panel=false}){
 const nodes=useDisplayGraph(s=>s.nodes),edges=useDisplayGraph(s=>s.edges)
 const rows=upstreamOccupancies(nodes,edges,id)
 return <div className={panel?'form-group':'summary-row'} aria-label="自动释放资源"><span>释放资源（自动）</span><div>
  {rows.length?<ol>{rows.map(r=><li key={r.nodeId+':'+r.id}><ResourceText rule={r}/><small> ← {r.nodeName}</small></li>)}</ol>:<div>暂无可追溯的前序占用</div>}
  {panel&&<p className="form-hint">引用从开始可达、且能通向此结束节点的位移／执行节点。前序配置和连线变化会自动同步；仅释放本次路径实际产生、且仍由本行为持有的占用。未声明的旧文字占用不会自动猜测。</p>}
 </div></div>
}
