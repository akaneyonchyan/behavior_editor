import {listPublishedBehaviors,readPublishedBehavior} from './publishedBehaviors'

// Scan one manifest snapshot. Never replace or import into the local document.
export async function loadRequirementFiles({signal,onProgress=()=>{},list=listPublishedBehaviors,read=readPublishedBehavior}={}) {
  const check=()=>{if(signal?.aborted)throw new DOMException('已取消读取','AbortError')}
  check()
  const manifest=await list({signal})
  check()
  const results=new Array(manifest.files.length),failures=new Array(manifest.files.length)
  let cursor=0,completed=0
  onProgress({completed,total:manifest.files.length})
  await Promise.all(Array.from({length:Math.min(4,manifest.files.length)},async()=>{
    while(cursor<manifest.files.length){
      check()
      const i=cursor++,file=manifest.files[i]
      try{results[i]=await read(file,{signal})}
      catch(e){check();failures[i]={name:file.name,message:e.message||'读取失败'}}
      check()
      onProgress({completed:++completed,total:manifest.files.length})
    }
  }))
  return {files:results.filter(Boolean),failures:failures.filter(Boolean),total:manifest.files.length,publishedAt:manifest.publishedAt||''}
}
