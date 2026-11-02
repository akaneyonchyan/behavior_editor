import assert from 'node:assert/strict'
import {GitLabUserAuth} from '../server/gitlab-user-auth.mjs'
const user={id:'sso-a'},other={id:'sso-b'}
let now=1000,push=true,revoked=false,api=true,calls=0
const auth=new GitLabUserAuth({clock:()=>now,repositoryFor:token=>({token}),fetchImpl:async(url,init)=>{
 calls++;assert.equal(new URL(url).origin,'https://git.xindong.com');assert.equal(init.redirect,'error');assert.equal(init.headers['PRIVATE-TOKEN'],'test-personal-token')
 if(revoked)return new Response('',{status:401})
 if(url.endsWith('/user'))return Response.json({id:12,name:'GitLab 策划'})
 if(url.endsWith('/personal_access_tokens/self'))return Response.json({active:true,scopes:api?['api','write_repository']:['read_api'],expires_at:'2027-01-01'})
 if(url.endsWith('/branches/master'))return Response.json({can_push:push})
 assert.ok(url.includes(encodeURIComponent('petpals/shared/design_workspace')));return Response.json({id:100})
}})
const initial=await auth.handle(user,{action:'authStatus'}),credentialOwner=initial.credentialOwner
assert.equal(initial.authorized,false)
await assert.rejects(()=>auth.handle(other,{action:'authToken',credentialOwner,token:'test-personal-token'}),{status:403});assert.equal(calls,0)
const result=await auth.handle(user,{action:'authToken',credentialOwner,token:'test-personal-token'})
assert.equal(result.canEdit,true);assert.equal(result.gitlabId,12);assert.ok(!JSON.stringify(result).includes('test-personal-token'))
assert.equal((await auth.authorize(user,{action:'join'})).repository.token,'test-personal-token')
push=false;assert.equal((await auth.handle(user,{action:'authStatus'})).canEdit,false)
await assert.rejects(()=>auth.authorize(user,{action:'save'}),{status:403})
push=true;api=false
await assert.rejects(()=>auth.authorize(user,{action:'save'}),{status:403})
api=true;revoked=true
await assert.rejects(()=>auth.authorize(user,{action:'save'}),{status:401})
assert.equal((await auth.handle(user,{action:'authStatus'})).authorized,false)
revoked=false;await auth.handle(user,{action:'authToken',credentialOwner,token:'test-personal-token'})
await auth.handle(user,{action:'authForget',credentialOwner})
await assert.rejects(()=>auth.authorize(user,{action:'join'}),{status:401})
await auth.handle(user,{action:'authToken',credentialOwner,token:'test-personal-token'})
now+=28800001;assert.equal((await auth.handle(user,{action:'authStatus'})).authorized,false)
console.log('Personal GitLab token: SSO binding, target repository, api scope, branch permission, revocation, clear and memory-session expiry passed')
