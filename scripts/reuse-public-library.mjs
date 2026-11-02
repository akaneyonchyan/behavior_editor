import {mkdir,readFile,writeFile,rename} from 'node:fs/promises'
import {validateLibrary} from '../shared/library-model.mjs'

// Code-only releases preserve the last published data and its original sync time.
const source=process.argv[2]||process.env.LIBRARY_SNAPSHOT_FILE||'public/data/library.json'
const text=await readFile(source,'utf8'),snapshot=JSON.parse(text.replace(/^\uFEFF/,''))
if(typeof snapshot.syncedAt!=='string'||!Number.isFinite(Date.parse(snapshot.syncedAt)))throw Error('公共库快照缺少有效同步时间')
validateLibrary(snapshot.library)
await mkdir('public/data',{recursive:true})
await writeFile('public/data/library.json.tmp',text,'utf8')
await rename('public/data/library.json.tmp','public/data/library.json')
console.log('复用已发布公共库；原同步时间：'+snapshot.syncedAt)
