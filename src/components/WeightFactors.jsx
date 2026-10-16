import React from 'react'
import { INFLUENCES, newFactor, designFactor } from '../utils/weightFactors'
import { RuleInputs } from './LibraryRules'

export default function WeightFactors({ branch, onChange }) {
  const factors = branch.weightFactors || []
  const update = (i,patch) => onChange(factors.map((f,j)=>i===j?{...designFactor(f),...patch}:f))
  return <div className="weight-factors">
    <div className="section-header"><label>属性影响</label><button className="btn-small" onClick={()=>onChange([...factors,newFactor()])}>+ 添加属性规则</button></div>
    {!factors.length && <div className="form-hint">可添加影响该分支发生倾向的属性。</div>}
    {factors.map((original,i)=>{
      const f=designFactor(original)
      return <div className="weight-factor" key={f.id||i}>
        <div className="factor-actions"><strong>规则 {i+1}</strong><button className="btn-small" onClick={()=>onChange(factors.filter((_,j)=>j!==i))}>删除</button></div>
        <RuleInputs rule={f} onChange={patch=>update(i,patch)} influences={INFLUENCES} influenceLabel="影响方式"/>
      </div>
    })}
  </div>
}

