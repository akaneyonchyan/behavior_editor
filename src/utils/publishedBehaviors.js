import {parseBehavior,validateFileName} from './onlineBehaviors'
import {gitlabMode,staticSnapshotMode,behaviorApi} from './onlineProvider'
import {personalReader} from './browserGitLab'
const base=import.meta.env.BASE_URL+'data/behaviors/'
export async function listPublishedBehaviors({signal}={}){
 if(gitlabMode&&!staticSnapshotMode&&personalReader())return personalReader().list()
 if(gitlabMode&&!staticSnapshotMode)return behaviorApi('',undefined,signal)
 const r=await fetch(base+'index.json',{cache:'no-store',credentials:staticSnapshotMode?'same-origin':'omit',signal})
 if(!r.ok)throw new Error('公开目录暂不可用，请等待网页发布完成后刷新')
 const data=await r.json()
 if(data.version!==1||!Array.isArray(data.files))throw new Error('公开目录格式错误，请重新发布')
 for(const f of data.files){validateFileName(f.name);if(!/^[a-f0-9]{40}$/.test(f.sha))throw new Error('公开文件版本无效')}
 return data
}
export async function readPublishedBehavior(file,{signal}={}){
 if(gitlabMode&&!staticSnapshotMode&&personalReader()){const result=await personalReader().read(file);return {...file,text:result.text,config:parseBehavior(result.text)}}
 if(gitlabMode&&!staticSnapshotMode){const result=await behaviorApi('/file?'+new URLSearchParams({name:file.name,ref:file.ref,sha:file.sha}),undefined,signal);return {...file,text:result.text,config:parseBehavior(result.text)}}
 const r=await fetch(base+file.sha+'.json',{credentials:staticSnapshotMode?'same-origin':'omit',signal})
 if(!r.ok)throw new Error('此版本文件暂不可用，请刷新在线目录后重新打开')
 const text=await r.text();return {...file,text,config:parseBehavior(text)}
}
