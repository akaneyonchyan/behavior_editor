import {validateConfig} from '../store/documentValidation'
import {NODE_CONFIG} from '../constants/behaviorTypes'

// Only inspect direct JSON children. Cache directories and other folders are never traversed.
export async function listBehaviorFiles(directory,currentHandle){
 if(!directory)return {files:[],permission:'missing'}
 if(await directory.queryPermission({mode:'read'})!=='granted')return {files:[],permission:'prompt'}
 const files=[]
 for await(const handle of directory.values()){
  if(handle.kind!=='file'||!/\.json$/i.test(handle.name))continue
  const row={name:handle.name,handle,current:false,title:'',nodes:0,error:''}
  try{
   const file=await handle.getFile(),text=await file.text(),config=JSON.parse(text.replace(/^\ufeff/,''))
   validateConfig(config,NODE_CONFIG)
   row.title=config.behavior.name||'未命名行为';row.nodes=config.graph.nodes.length;row.modified=file.lastModified
   if(currentHandle){try{row.current=handle===currentHandle||!!(handle.isSameEntry&&await handle.isSameEntry(currentHandle))}catch{/* A stale current handle must not hide a readable file. */}}
  }catch(e){row.error='无法作为行为图打开：'+e.message}
  files.push(row)
 }
 files.sort((a,b)=>a.name.localeCompare(b.name,'zh-CN',{numeric:true}))
 return {files,permission:'granted'}
}
