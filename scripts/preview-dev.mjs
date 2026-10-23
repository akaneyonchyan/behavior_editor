import {mkdir,writeFile,rename} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {spawn} from 'node:child_process'
import {validateLibrary} from '../shared/library-model.mjs'
const base='https://akaneyonchyan.github.io/behavior_editor/data/'
async function get(path){const r=await fetch(base+path,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(path+' HTTP '+r.status);return r}
try{
 console.log('正在拉取已发布的在线行为和公共库快照…')
 const index=await (await get('behaviors/index.json')).json(),library=await (await get('library.json')).json()
 validateLibrary(library.library);if(!Number.isFinite(Date.parse(library.syncedAt)))throw Error('公共库版本时间无效')
 if(index.version!==1||!Array.isArray(index.files))throw Error('行为目录格式无效')
 await mkdir('public/data/behaviors',{recursive:true})
 for(const f of index.files){if(!/^[a-f0-9]{40}$/.test(f.sha))throw Error('文件版本无效');const bytes=Buffer.from(await (await get('behaviors/'+f.sha+'.json')).arrayBuffer());const hash=createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');if(hash!==f.sha)throw Error('行为校验失败：'+f.name);JSON.parse(bytes.toString('utf8'));await writeFile('public/data/behaviors/'+f.sha+'.json',bytes)}
 await writeFile('public/data/library.json',JSON.stringify(library));await writeFile('public/data/behaviors/index.json.tmp',JSON.stringify(index));await rename('public/data/behaviors/index.json.tmp','public/data/behaviors/index.json')
 console.log('已准备 '+index.files.length+' 个在线行为；公共库 '+library.syncedAt)
 if(!process.argv.includes('--prepare-only')){const child=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5193','--strictPort','--open','/?view=preview'],{stdio:'inherit',env:{...process.env,VITE_LIBRARY_MODE:'published'}});child.on('exit',code=>process.exit(code||0))}
}catch(e){console.error('准备失败：'+e.message+'。检查网络后重新运行 npm run dev:preview。');process.exitCode=1}
