import {mkdir,readFile,writeFile,rename} from 'node:fs/promises'
import {validateLibrary} from '../shared/library-model.mjs'

// A checked-in snapshot makes a fresh GitHub clone usable without old credentials.
const source=process.argv[2]||'resources/content-library/library.snapshot.json'
const snapshot=JSON.parse(await readFile(source,'utf8'))
if(!Number.isFinite(Date.parse(snapshot.syncedAt)))throw Error('公共库快照同步时间无效')
validateLibrary(snapshot.library)
await mkdir('public/data',{recursive:true})
await writeFile('public/data/library.json.tmp',JSON.stringify(snapshot))
await rename('public/data/library.json.tmp','public/data/library.json')
await import('./export-behaviors.mjs')
console.log('GitHub 内容准备完成：已校验公共库和仓库行为图。')
