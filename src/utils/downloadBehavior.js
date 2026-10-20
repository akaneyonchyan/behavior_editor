import {getSaveDirectory,getCurrentFileHandle,useDocumentSession,openDirectoryFile} from '../store/documentSession'
import {parseBehavior,validateFileName} from './onlineBehaviors'
export async function downloadBehavior(file){
 validateFileName(file.name);parseBehavior(file.text)
 const dir=getSaveDirectory()
 if(!dir)throw new Error('请先在顶部“保存目录”选择本地文件夹，再下载')
 if(useDocumentSession.getState().busy)throw new Error('本地文件正在处理，请稍后再下载')
 if(await dir.requestPermission({mode:'readwrite'})!=='granted')throw new Error('未获得保存目录写入权限，请重新授权')
 let handle=null,previous=null
 try{handle=await dir.getFileHandle(file.name);previous=await (await handle.getFile()).text()}catch(e){if(e.name!=='NotFoundError')throw e}
 if(handle){
  const current=getCurrentFileHandle()
  if(current&&await current.isSameEntry(handle)&&useDocumentSession.getState().dirty)throw new Error('同名本地文件正在编辑且尚未保存，请先保存或另存为，再下载')
  if(!window.confirm('本地已存在 '+file.name+'，是否用此线上版本覆盖？'))return false
  if(await (await handle.getFile()).text()!==previous)throw new Error('本地文件刚被其他程序修改，已停止覆盖，请重新下载')
 }
 if(dir!==getSaveDirectory())throw new Error('保存目录已改变，请重新下载')
 handle=handle||await dir.getFileHandle(file.name,{create:true})
 const stream=await handle.createWritable()
 try{await stream.write(file.text);await stream.close()}catch(e){await stream.abort().catch(()=>{});throw e}
 // Provenance contains only the public blob revision, never credentials or graph contents.
 try{localStorage.setItem('pps-online-base:'+file.name,file.sha)}catch{}
 const opened=await openDirectoryFile(handle,dir)
 return {opened,name:file.name}
}
