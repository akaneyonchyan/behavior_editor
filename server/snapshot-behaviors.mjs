import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {resolve} from 'node:path'
import {failure} from './gitlab-behaviors.mjs'
export class SnapshotBehaviors{
 constructor({directory,parseBehavior,validateFileName}){Object.assign(this,{directory:resolve(directory),parseBehavior,validateFileName})}
 async list(){
  const manifest=JSON.parse(await readFile(resolve(this.directory,'index.json'),'utf8'))
  if(manifest.version!==1||!Array.isArray(manifest.files)||!/^[a-f0-9]{40}$/.test(manifest.head||''))throw failure(503,'行为快照目录无效')
  const seen=new Set()
  for(const f of manifest.files){this.validateFileName(f.name);if(!/^[a-f0-9]{40}$/.test(f.sha)||seen.has(f.name.toLowerCase()))throw failure(503,'行为快照文件版本或名称无效');seen.add(f.name.toLowerCase())}
  return {...manifest,branch:'master',files:manifest.files.map(f=>({...f,ref:manifest.head}))}
 }
 async read({name,ref,sha}){
  const manifest=await this.list()
  if(ref!==manifest.head||!manifest.files.some(f=>f.name===name&&f.sha===sha))throw failure(409,'此快照版本已更新，请刷新在线目录')
  const bytes=await readFile(resolve(this.directory,sha+'.json'))
  if(bytes.length>2*1024*1024)throw failure(422,'行为文件过大')
  const actual=createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex')
  if(actual!==sha)throw failure(503,'行为快照校验失败')
  const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);this.parseBehavior(text);return {text}
 }
 validateUpload(){throw failure(403,'服务器不连接内网 GitLab，请在内网仓库提交行为文件')}
 async submit(){this.validateUpload()}
}
