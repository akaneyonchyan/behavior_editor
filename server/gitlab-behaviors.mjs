import {FOLDER} from '../shared/behavior-source.mjs'
import {createHash} from 'node:crypto'
import {GitLabBehaviorReader,PROJECT,REPOSITORY,failure} from '../shared/gitlab-behavior-reader.mjs'
export {PROJECT,REPOSITORY,failure}
export class GitLabBehaviors extends GitLabBehaviorReader{
 validateUpload(input){
  if(!input||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(input.requestId||''))throw failure(400,'上传请求标识无效')
  if(!Array.isArray(input.items)||!input.items.length||input.items.length>20)throw failure(400,'每次上传 1 至 20 个文件')
  const names=new Set();let total=0
  const items=input.items.map(item=>{
   this.validateFileName(item.name)
   if(names.has(item.name.toLowerCase()))throw failure(400,'文件名重复（包含大小写差异）')
   names.add(item.name.toLowerCase())
   if(typeof item.text!=='string')throw failure(400,'文件内容必须是文本')
   if(item.previousSha!==null&&!/^[a-f0-9]{40}$/.test(item.previousSha||''))throw failure(400,'原文件版本无效')
   this.parseBehavior(item.text);total+=Buffer.byteLength(item.text)
   return {name:item.name,text:item.text,previousSha:item.previousSha}
  })
  if(total>10*1024*1024)throw failure(413,'上传总大小不能超过 10 MB')
  return items
 }
 async submit(input){
  const items=this.validateUpload(input),branch='feature/proto_behavior_upload_'+input.requestId
  const fingerprint=createHash('sha256').update(JSON.stringify({target:this.branch,items})).digest('hex')
  const marker='behavior-upload:'+input.requestId+':'+fingerprint
  const recoveryUrl=REPOSITORY+'/-/tree/'+encodeURIComponent(branch)
  let existing
  try{existing=await this.api('/repository/branches/'+encodeURIComponent(branch))}catch(e){if(e.status!==404)throw e}
  if(existing&&!existing.commit.message.includes(marker))throw failure(409,'上传请求与已有分支不一致，请重新选择文件')
  if(!existing){
   const current=await this.list()
   for(const item of items){
    if(current.files.some(f=>f.name.toLowerCase()===item.name.toLowerCase()&&f.name!==item.name))throw failure(409,'线上存在仅大小写不同的文件：'+item.name)
    if((current.files.find(f=>f.name===item.name)?.sha||null)!==item.previousSha)throw failure(409,item.name+' 的线上版本已变化，请重新选择文件并核对')
   }
   // GitLab atomically creates the commit and new branch from the pinned snapshot.
   try{await this.api('/repository/commits',{method:'POST',body:{
    branch,start_sha:current.head,commit_message:'行为文件更新\n\n'+marker,
    actions:items.map(f=>({action:f.previousSha?'update':'create',file_path:FOLDER+'/'+f.name,content:f.text}))
   }})}catch(e){e.recoveryUrl=recoveryUrl;throw e}
  }
  try{
   const matches=await this.api('/merge_requests?'+new URLSearchParams({source_branch:branch,target_branch:this.branch,state:'all',per_page:'100'}))
   let mr=matches[0]
   if(!mr)mr=await this.api('/merge_requests',{method:'POST',body:{
    source_branch:branch,target_branch:this.branch,title:'Draft: 行为文件更新：'+items.map(f=>f.name).join('、').slice(0,140),
    description:'通过行为编辑器测试服务提交，使用服务端凭据；未接入飞书身份，不代表个人署名。\n\n'+items.map(f=>'- '+(f.previousSha?'替换':'新增')+'：'+f.name.replace(/[`<>]/g,'')).join('\n')+'\n\n请人工审核，禁止自动合并。'
   }})
   return {branch,url:REPOSITORY+'/-/merge_requests/'+mr.iid,number:mr.iid,state:mr.state}
  }catch(e){e.recoveryUrl=recoveryUrl;e.message+='。分支已提交，可在当前窗口重试以恢复 MR，不要重新选择文件';throw e}
 }
}
