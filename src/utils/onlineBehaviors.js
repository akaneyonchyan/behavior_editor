import {validateConfig} from '../store/documentValidation'
import {NODE_CONFIG} from '../constants/behaviorTypes'
export const REPO='akaneyonchyan/behavior_editor', FOLDER='behaviors', BRANCH='main'
export const REPO_URL='https://github.com/'+REPO
const API='https://api.github.com/repos/'+REPO
export const MAX_BYTES=2*1024*1024
export function validateFileName(name){
 if(typeof name!=='string'||!name.toLowerCase().endsWith('.json')||name.length>160||/[<>:"/\\|?*\x00-\x1f]/.test(name)||name.startsWith('.')||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])\./i.test(name))throw new Error('文件名必须是可保存到本地的 .json 文件名，不能包含路径或特殊字符')
 return name
}
export function parseBehavior(text){
 if(new TextEncoder().encode(text).length>MAX_BYTES)throw new Error('单个行为文件不能超过 2 MB')
 const config=JSON.parse(text.replace(/^\uFEFF/,''));validateConfig(config,NODE_CONFIG);return config
}
async function api(path,token='',body,method=body?'POST':'GET'){
 let response
 try{response=await fetch(API+path,{method,cache:'no-store',headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})})}
 catch{throw new Error('无法连接 GitHub，请检查网络后重试；写入请求的结果可能需要在仓库核对')}
 if(!response.ok){const error=new Error(response.status===401?'GitHub Token 无效或已过期':response.status===403||response.status===429?'GitHub 权限不足或请求次数受限，请检查权限或稍后重试':response.status===409||response.status===422?'仓库版本冲突或请求被拒绝，请刷新目录并检查分支状态':'GitHub 请求失败（'+response.status+'），请检查仓库访问权限');error.status=response.status;throw error}
 return response.status===204?null:response.json()
}
function checkedTree(tree){if(tree.truncated)throw new Error('仓库目录过大，GitHub 未返回完整目录，请拆分目录后重试');return tree.tree}
export async function listOnlineFiles(token=''){
 const ref=await api('/git/ref/heads/'+BRANCH,token),head=ref.object.sha
 const commit=await api('/git/commits/'+head,token),tree=commit.tree.sha
 const root=checkedTree(await api('/git/trees/'+tree,token)),folder=root.find(x=>x.path===FOLDER)
 if(folder&&folder.type!=='tree')throw new Error('behaviors 路径不是文件夹，请检查仓库')
 const entries=folder?checkedTree(await api('/git/trees/'+folder.sha,token)):[]
 return {head,tree,files:entries.filter(x=>x.type==='blob'&&x.mode==='100644'&&/\.json$/i.test(x.path)).map(x=>({name:x.path,sha:x.sha,size:x.size})).sort((a,b)=>a.name.localeCompare(b.name,'zh-CN',{numeric:true}))}
}
export async function readOnlineFile(file,token=''){
 validateFileName(file.name)
 if(file.size>MAX_BYTES)throw new Error('文件超过 2 MB，无法在编辑器中预览')
 const blob=await api('/git/blobs/'+encodeURIComponent(file.sha),token)
 if(blob.encoding!=='base64')throw new Error('GitHub 返回了不支持的文件编码')
 const text=new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(blob.content.replace(/\s/g,'')),c=>c.charCodeAt(0)))
 return {...file,text,config:parseBehavior(text)}
}
export async function prepareUpload(files,token=''){
 if(!files.length||files.length>20)throw new Error('每次请选择 1 至 20 个行为 JSON 文件')
 const names=new Set(),items=[];let total=0
 for(const file of files){validateFileName(file.name);if(names.has(file.name.toLowerCase()))throw new Error('所选文件存在重名（含大小写不同的名称）');names.add(file.name.toLowerCase());if(file.size>MAX_BYTES)throw new Error(file.name+' 超过 2 MB');const text=await file.text();parseBehavior(text);total+=new TextEncoder().encode(text).length;items.push({name:file.name,text})}
 if(total>10*1024*1024)throw new Error('每次上传总大小不能超过 10 MB')
 const base=await listOnlineFiles(token)
 for(const item of items){const collision=base.files.find(f=>f.name.toLowerCase()===item.name.toLowerCase()&&f.name!==item.name);if(collision)throw new Error('线上已有仅大小写不同的文件：'+collision.name+'，请统一文件名');item.previousSha=base.files.find(f=>f.name===item.name)?.sha||null}
 for(const item of items){let known=null;try{known=localStorage.getItem('pps-online-base:'+item.name)}catch{}if(known&&known!==item.previousSha)throw new Error(item.name+' 自上次下载后线上已有更新，请先下载最新版本并整合本地修改，或在 GitHub 手动创建分支处理冲突')}
return {base,items}
}
export async function submitUpload(plan,token,onProgress=()=>{}){
 if(!token.trim())throw new Error('请填写自己的 GitHub Token 后再上传')
 // Compare every affected file, then branch from the exact reviewed snapshot.
 const current=await listOnlineFiles(token)
 for(const item of plan.items){validateFileName(item.name);parseBehavior(item.text);if((current.files.find(f=>f.name===item.name)?.sha||null)!==item.previousSha)throw new Error(item.name+' 的线上版本已变化，请重新选择文件并确认替换')}
 const branch='behavior-upload/'+crypto.randomUUID()
 const recoveryUrl=REPO_URL+'/compare/'+BRANCH+'...'+branch+'?expand=1'
 let phase='commit'
 try{
  const tree=await api('/git/trees',token,{base_tree:current.tree,tree:plan.items.map(f=>({path:FOLDER+'/'+f.name,mode:'100644',type:'blob',content:f.text}))})
  const commit=await api('/git/commits',token,{message:'提交行为文件：'+plan.items.map(f=>f.name).join('、').slice(0,180),tree:tree.sha,parents:[current.head]})
  phase='branch';onProgress({branch,recoveryUrl})
  await api('/git/refs',token,{ref:'refs/heads/'+branch,sha:commit.sha})
  phase='pr'
  const pr=await api('/pulls',token,{title:'行为文件更新：'+plan.items.map(f=>f.name).join('、').slice(0,160),head:branch,base:BRANCH,body:'通过行为编辑器上传，待审核合并。\n\n'+plan.items.map(f=>'- '+(f.previousSha?'替换':'新增')+'：`'+f.name.replace(/`/g,'')+'`').join('\n')+'\n\n请审阅行为内容；合并后在线目录可刷新读取。'})
  return {branch,url:REPO_URL+'/pull/'+pr.number,number:pr.number}
 }catch(error){if(phase!=='commit'){error.recoveryUrl=recoveryUrl;error.message+='。分支可能已创建，请先打开分支核对或继续创建 PR，避免重复上传'}throw error}
}
