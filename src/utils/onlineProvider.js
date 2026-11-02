import {SOURCE_KEY} from '../../shared/behavior-source.mjs'
import {protectedFetch,authGeneration} from './authSession'
export const staticSnapshotMode=import.meta.env?.VITE_ONLINE_PROVIDER==='gitlab-static'
export const liveGitlabMode=import.meta.env?.VITE_ONLINE_PROVIDER==='gitlab-live'
export const snapshotMode=staticSnapshotMode||import.meta.env?.VITE_ONLINE_PROVIDER==='gitlab-snapshot'
export const gitlabMode=liveGitlabMode||snapshotMode||import.meta.env?.VITE_ONLINE_PROVIDER==='gitlab'
export const revisionKey=name=>gitlabMode?'pps-online-base:gitlab:'+SOURCE_KEY+':'+name:'pps-online-base:'+name
export async function behaviorApi(path,body,signal){
 const generation=authGeneration()
 const response=await protectedFetch('/api/behaviors'+path,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',signal:signal||AbortSignal.timeout(45000),...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})})
 const data=await response.json().catch(()=>{throw Error('行为文件服务返回了无效响应，请重新登录后刷新')})
 if(generation!==authGeneration())throw Error('会话已变化，已取消旧请求')
 if(!response.ok){const error=new Error(data.message||'行为文件服务暂不可用');error.recoveryUrl=data.recoveryUrl;throw error}
 return data
}
