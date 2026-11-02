import {PersonalGitLab} from '../../shared/gitlab-personal.mjs'
import {GitLabBehaviorReader} from '../../shared/gitlab-behavior-reader.mjs'
import {parseBehavior,validateFileName} from './onlineBehaviors'
let active=null,direct=false,generation=0
const repository=token=>new PersonalGitLab({token,parseBehavior,validateFileName})
export function personalReader(){return active&&new GitLabBehaviorReader({token:active.token,parseBehavior,validateFileName,fetchImpl:(url,init)=>fetch(url,{...init,credentials:'omit'})})}
export async function browserGitLabRequest(name,input,send){
 if(input.action==='authStatus'){
  const result=await send({name,input});direct=!!result.direct
  if(active&&active.owner!==result.credentialOwner){active=null;generation++}
  if(direct&&active)return verify(active.token,result.credentialOwner,send)
  return result
 }
 if(!direct)return send({name,input})
 if(input.action==='authToken')return verify(input.token,input.credentialOwner,send)
 if(input.action==='authForget'){active=null;generation++;return send({name,input})}
 if(!active)throw new Error('请先在在线页签验证个人 GitLab Token')
 if(active.until<Date.now())await verify(active.token,active.owner,send)
 const session=active,gitlab=repository(session.token)
 const call=(value,extra={})=>send({name,input:value,ticket:session.ticket,...extra})
 if(input.action==='join'){
  const browserBase=await gitlab.load(name)
  return call(input,{token:session.token,browserBase:{sha:browserBase.sha,commit:browserBase.commit}})
 }
 if(input.action==='save'){
  const reserved=await call({...input,action:'saveBegin'})
  if(!reserved.saveIntent)return reserved
  await gitlab.save(name,reserved.saveIntent)
  return call({...input,action:'saveComplete',intent:reserved.saveIntent.id},{token:session.token})
 }
 return call(input)
}
async function verify(token,owner,send){
 const ticket=++generation
 active=null
 await repository(token).inspect()
 const result=await send({input:{action:'authToken',token,credentialOwner:owner}})
 if(ticket!==generation)throw new Error('凭据已变化，请重新验证')
 active={token,owner,ticket:result.ticket,until:Date.now()+10000}
 return result
}
