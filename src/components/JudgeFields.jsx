import React from 'react'
import SortableList from './SortableList'
import {ObjectNameText} from './ObjectNameInput'
import {sourceType} from '../store/contentLibrary'
import {useBehaviorStore} from '../store/behaviorStore'
import {sourceName,sourceChoices,propertyName,useContentLibrary} from '../store/contentLibrary'
import TextChoice from './TextChoice'
import {PropertyInputs,ChoiceText,choicesFor} from './DesignInputs'
import {judgeAttributes,branchFactors,setJudgeAttributes,PROBABILITIES,EFFECTS} from '../utils/nodeDesign'
export default function JudgeFields({node}){
  const updateNode=useBehaviorStore(s=>s.updateNode),lib=useContentLibrary(s=>s.library)
  const attrs=judgeAttributes(node.data),branches=node.data.branches||[]
  const updateAttrs=next=>updateNode(node.id,setJudgeAttributes(node.data,next))
  const updateBranch=(index,patch)=>updateNode(node.id,{judgeAttributes:attrs,branches:branches.map((b,i)=>({...b,weightFactors:branchFactors(b,attrs),...(i===index?patch:{})}))})
  return <>
    <div className="weight-factors"><div className="section-header"><label>参与判断的属性</label><button className="btn-small" onClick={()=>updateAttrs([...attrs,{id:crypto.randomUUID(),source:'',attribute:''}])}>+ 添加属性</button></div>
      <p className="form-hint">统一选择来源和属性。每个分支自动携带这些属性，分别设置影响方式；自定义内容以下划线标记。</p>
      <SortableList items={attrs} onChange={updateAttrs} label="判断属性">{(a,i,handle)=><div className="weight-factor"><div className="factor-actions">{handle}<strong>属性 {i+1}</strong><button className="btn-small" onClick={()=>updateAttrs(attrs.filter((_,j)=>j!==i))}>删除</button></div><PropertyInputs rule={a} onChange={patch=>updateAttrs(attrs.map((row,j)=>i===j?{...row,...patch}:row))}/></div>}</SortableList>
    </div>
    <div className="judge-branches"><div className="section-header"><label>分支设置</label><button className="btn-small" onClick={()=>updateNode(node.id,{judgeAttributes:attrs,branches:[...branches.map(b=>({...b,weightFactors:branchFactors(b,attrs)})),{id:crypto.randomUUID(),name:`分支${branches.length+1}`,weightExpectation:'中',weightFactors:branchFactors({},attrs)}]})}>+ 添加分支</button></div>
      <SortableList items={branches} onChange={branches=>updateNode(node.id,{branches})} label="判断分支" itemLabel={(b,i)=>b?.name||"分支 "+(i+1)}>{(b,i,handle)=><div className="branch-item"><div className="branch-header">{handle}<input className="branch-name-input" aria-label="分支名称" value={b.name} onChange={e=>updateBranch(i,{name:e.target.value})}/>{branches.length>2&&<button className="btn-remove" onClick={()=>updateNode(node.id,{branches:branches.filter((_,j)=>i!==j)})}>×</button>}</div>
        <label>默认概率<TextChoice label="默认概率" options={PROBABILITIES} value={b.weightExpectation||''} onChange={weightExpectation=>updateBranch(i,{weightExpectation})}/></label>
        {branchFactors(b,attrs).map((f,j)=><div className="weight-factor" key={f.attributeId}><strong>{j+1}. <ChoiceText value={sourceName(lib,f.source)} options={sourceChoices(lib).map(s=>s.name)}/>{f.objectName&&<> · <ObjectNameText type={sourceType(f.source)} value={f.objectName}/></>} · <ChoiceText value={propertyName(lib,f.attribute)} options={choicesFor(lib,f.source).map(p=>p.name)}/></strong><label>影响方式<TextChoice label="影响方式" options={EFFECTS} value={f.influence} onChange={influence=>updateBranch(i,{weightFactors:branchFactors(b,attrs).map((row,k)=>j===k?{...row,influence}:row)})}/></label></div>)}
      </div>}</SortableList>
    </div>
  </>
}
