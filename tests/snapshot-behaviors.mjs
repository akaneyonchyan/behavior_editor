import assert from 'node:assert/strict'
import {mkdtemp,readFile,writeFile,rm,readdir} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {execFileSync} from 'node:child_process'
import {createRequire} from 'node:module'
import {createHash} from 'node:crypto'
import {SnapshotBehaviors} from '../server/snapshot-behaviors.mjs'
execFileSync(process.execPath,['scripts/build-server-validator.mjs'])
const validator=createRequire(import.meta.url)('../server/generated/behavior-validation.cjs')
const name=(await readdir('behaviors')).find(x=>x.endsWith('.json')),bytes=await readFile('behaviors/'+name)
const sha=createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex'),head='a'.repeat(40)
const directory=await mkdtemp(join(tmpdir(),'pps-snapshot-'))
try{
 await writeFile(join(directory,sha+'.json'),bytes)
 await writeFile(join(directory,'index.json'),JSON.stringify({version:1,head,files:[{name,sha}]}))
 const service=new SnapshotBehaviors({directory,...validator})
 const list=await service.list();assert.equal(list.files[0].ref,head)
 assert.equal((await service.read({name,sha,ref:head})).text,bytes.toString())
 await assert.rejects(service.read({name,sha:'../etc/passwd',ref:head}))
 await assert.rejects(service.read({name,sha,ref:'b'.repeat(40)}),/版本已更新/)
 await assert.rejects(service.submit({}),/内网/)
 await writeFile(join(directory,sha+'.json'),'{}')
 await assert.rejects(service.read({name,sha,ref:head}),/校验失败/)
 console.log('PASS: offline snapshot list/read, immutable digest, revision mismatch and uploads denied')
}finally{await rm(directory,{recursive:true,force:true})}
