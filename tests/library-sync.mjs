import assert from 'node:assert/strict'
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {syncLibrary} from '../server/library-sync.mjs'
import {createPreviewServer} from '../server/cloud-preview.mjs'
import http from 'node:http'
const dir=await mkdtemp(join(tmpdir(),'editor-library-sync-'))
let time='2026-10-26T08:00:00.000Z',library={version:1,objects:[],attributes:[],buffs:[],items:[]}
const options={outputDir:dir,readLibrary:async()=>library,now:()=>time}
const server=createPreviewServer({origin:'https://behavior-editor.online',libraryPath:join(dir,'library.json'),service:{list:async()=>({files:[]})},authorize:()=>false})
await new Promise(r=>server.listen(0,'127.0.0.1',r))
const served=()=>new Promise((resolve,reject)=>{http.get({hostname:'127.0.0.1',port:server.address().port,path:'/data/library.json',headers:{Host:'behavior-editor.online'}},response=>{const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('end',()=>{try{assert.equal(response.statusCode,200);resolve(JSON.parse(Buffer.concat(chunks)))}catch(error){reject(error)}})}).on('error',reject)})
try{
 const first=await syncLibrary(options);assert.equal(first.changed,true)
 const original=await readFile(join(dir,'library.json'),'utf8')
 assert.equal((await served()).library.objects.length,0)
 time='2026-10-26T08:05:00.000Z';assert.equal((await syncLibrary(options)).changed,false)
 assert.equal(await readFile(join(dir,'library.json'),'utf8'),original)
 assert.equal(JSON.parse(await readFile(join(dir,'library-sync-status.json'),'utf8')).checkedAt,time)
 library={...library,objects:[{id:'actor',name:'伙伴',description:'',enabled:true}]}
 const changed=await syncLibrary(options);assert.equal(changed.changed,true);assert.equal(changed.syncedAt,time)
 assert.equal((await served()).library.objects[0].id,'actor','HTTP server must read updates without restarting')
 assert.equal(await readFile(join(dir,'library.previous.json'),'utf8'),original)
 const valid=await readFile(join(dir,'library.json'),'utf8')
 library={...library,attributes:[{id:'invalid',name:'bad',description:'',enabled:true,kind:'invalid',objectTypes:[]}]}
 await assert.rejects(syncLibrary(options));assert.equal(await readFile(join(dir,'library.json'),'utf8'),valid)
 await assert.rejects(syncLibrary({...options,readLibrary:async()=>{throw Error('provider unavailable')}}))
 assert.equal(await readFile(join(dir,'library.json'),'utf8'),valid)
 const config=join(dir,'missing-config.json');await writeFile(config,'{}')
 await assert.rejects(syncLibrary({outputDir:dir,configFile:config}))
 assert.equal(await readFile(join(dir,'library.json'),'utf8'),valid)
 console.log('PASS: validated atomic sync, unchanged timestamp, backup, invalid data/provider/config failure preserves live library')
}finally{await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true})}
