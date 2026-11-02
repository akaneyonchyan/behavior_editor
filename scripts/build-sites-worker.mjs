import {build} from 'esbuild'
import {build as buildVite} from 'vite'
import {cp,mkdir,readFile,rm} from 'node:fs/promises'
import {validateLibrary} from '../shared/library-model.mjs'

const snapshot=JSON.parse(await readFile('public/data/library.json','utf8'))
validateLibrary(snapshot.library)
if(!Number.isFinite(Date.parse(snapshot.syncedAt)))throw Error('公共库快照时间无效')
process.env.PAGES_BASE='/'
process.env.VITE_ONLINE_PROVIDER='gitlab-live'
process.env.VITE_LIBRARY_MODE='published'
process.env.VITE_AUTH_MODE=''
await buildVite()
const out='release/sites-worker'
await rm(out,{recursive:true,force:true})
await mkdir(out,{recursive:true})
await cp('dist',out+'/assets',{recursive:true})
await rm(out+'/assets/data/behaviors',{recursive:true,force:true})
await build({entryPoints:['server/sites-worker.mjs'],bundle:true,platform:'browser',format:'esm',target:'es2022',outfile:out+'/worker.mjs',define:{'import.meta.env':'{}'},logLevel:'warning'})
console.log('Worker 产物：'+out+'；静态资源：assets；入口：worker.mjs')
