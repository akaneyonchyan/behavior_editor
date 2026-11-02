import {readFile,writeFile,rename,mkdir} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {createHash,randomUUID} from 'node:crypto'
import {FeishuRepository} from './feishu.mjs'
import {validateLibrary} from '../shared/library-model.mjs'
const required=['FEISHU_APP_ID','FEISHU_APP_SECRET','FEISHU_BASE_TOKEN','FEISHU_OBJECT_TABLE','FEISHU_ATTRIBUTE_TABLE','FEISHU_BUFF_TABLE']
async function atomic(path,value){const temp=path+'.'+randomUUID()+'.tmp';await writeFile(temp,JSON.stringify(value),{mode:0o600});await rename(temp,path)}
export async function syncLibrary({configFile,outputDir,readLibrary,now=()=>new Date().toISOString()}){
 await mkdir(outputDir,{recursive:true,mode:0o700})
 const snapshotPath=join(outputDir,'library.json'),statusPath=join(outputDir,'library-sync-status.json')
 try{
  if(!readLibrary){
   const config=JSON.parse(await readFile(configFile,'utf8'))
   if(required.some(k=>typeof config[k]!=='string'||!config[k].trim()))throw Error('飞书同步配置缺失')
   const repository=new FeishuRepository(config)
   repository.tables={objects:config.FEISHU_OBJECT_TABLE,attributes:config.FEISHU_ATTRIBUTE_TABLE,buffs:config.FEISHU_BUFF_TABLE}
   readLibrary=async()=>(await repository.read()).library
  }
  const library=await readLibrary();validateLibrary(library)
  let previous
  try{previous=JSON.parse(await readFile(snapshotPath,'utf8'))}catch(error){if(error.code!=='ENOENT')throw error}
  const encoded=JSON.stringify(library),changed=JSON.stringify(previous?.library)!==encoded
  const checkedAt=now(),snapshot=changed?{syncedAt:checkedAt,library}:previous
  if(changed){
   if(previous)await atomic(join(outputDir,'library.previous.json'),previous)
   await atomic(snapshotPath,snapshot)
  }
  const status={ok:true,checkedAt,syncedAt:snapshot.syncedAt,changed,sha256:createHash('sha256').update(encoded).digest('hex'),counts:Object.fromEntries(['objects','attributes','buffs','items'].map(k=>[k,(library[k]||[]).length]))}
  await atomic(statusPath,status);return status
 }catch(error){
  await atomic(statusPath,{ok:false,checkedAt:now(),error:'同步失败，保留上次有效快照；请检查飞书配置、权限、字段和条目校验。'})
  throw error
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{console.log(JSON.stringify(await syncLibrary({configFile:process.env.LIBRARY_SYNC_CONFIG_FILE,outputDir:process.env.LIBRARY_OUTPUT_DIR||'/app/library-data'})))}
 catch{console.error('公共库同步失败，未替换有效快照。请检查飞书配置、权限和数据校验。');process.exitCode=1}
}
