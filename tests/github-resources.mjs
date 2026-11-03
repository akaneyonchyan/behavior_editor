import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {validateLibrary} from '../shared/library-model.mjs'
import {integrationLibrary,integrateFile} from '../src/preview/integration.mjs'
import {makeWorld} from '../src/preview/runtime.mjs'
import {singleScenario} from '../src/preview/singleScenario.mjs'
const manifest=JSON.parse(fs.readFileSync('resources/sync-manifest.json','utf8'))
for(const file of manifest.files){
 assert.ok(!file.targetPath.includes('..'))
 const bytes=fs.readFileSync(file.targetPath)
 assert.equal(bytes.length,file.bytes,file.targetPath)
 assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256,file.targetPath)
 assert.equal(createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex'),file.gitBlob,file.targetPath)
}
const names=manifest.files.filter(f=>f.kind==='behavior').map(f=>f.targetPath.slice('behaviors/'.length)).sort()
assert.deepEqual(fs.readdirSync('behaviors').filter(n=>n.endsWith('.json')).sort(),names)
const snapshot=JSON.parse(fs.readFileSync('resources/content-library/library.snapshot.json','utf8'))
validateLibrary(snapshot.library)
for(const [key,count]of Object.entries(manifest.libraryCounts))assert.equal(snapshot.library[key].length,count)
const lib=integrationLibrary(snapshot.library),raw=JSON.parse(fs.readFileSync('behaviors/钓鱼细分-核心行为.json','utf8'))
const file=integrateFile({name:'钓鱼细分-核心行为.json',config:raw})
for(const seed of [1,42,99]){
 const s=singleScenario(file.config,lib,makeWorld(lib,{initial:100},raw),'pip',{seed})
 for(let i=0;i<1000&&!['done','blocked','exited'].includes(s.status);i++)s.tick(6)
 assert.equal(s.status,'done',s.error)
 assert.equal(s.metrics.rounds,4)
}
console.log('PASS complete source hashes, official graph catalog, public snapshot and accelerated real fishing graph')
