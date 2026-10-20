import React from 'react'
import TextChoice from './TextChoice'
import {ChoiceText} from './DesignInputs'
import {INFLUENCE_TYPES,INFLUENCE_RULES,splitInfluence,updateInfluence} from '../utils/influenceRules'
export default function InfluenceInputs({factor,onChange}){
 const f=splitInfluence(factor)
 return <><label>影响类型<TextChoice label="影响类型" options={INFLUENCE_TYPES} value={f.influenceType} onChange={influenceType=>onChange(updateInfluence(f,{influenceType}))}/></label><label>影响规则<TextChoice label="影响规则" options={INFLUENCE_RULES} value={f.influenceRule} onChange={influenceRule=>onChange(updateInfluence(f,{influenceRule}))}/></label></>
}
export function InfluenceText({factor}){
 const f=splitInfluence(factor)
 return <>{f.influenceType&&<><ChoiceText value={f.influenceType} options={INFLUENCE_TYPES}/> · </>}<ChoiceText value={f.influenceRule} options={INFLUENCE_RULES}/></>
}

