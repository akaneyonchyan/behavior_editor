import assert from 'node:assert/strict'
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {resolve,join} from 'node:path'
import {spawnSync} from 'node:child_process'
const script=resolve('scripts/reuse-public-library.mjs'),dir=await mkdtemp(join(tmpdir(),'editor-deploy-'))
const source=join(dir,'private.json'),target=join(dir,'public/data/library.json')
const valid=JSON.stringify({syncedAt:'2026-10-26T00:21:05.446Z',library:{version:1,objects:[],attributes:[],buffs:[],items:[]}})
const run=()=>spawnSync(process.execPath,[script,source],{cwd:dir,encoding:'utf8'})
try{
 await writeFile(source,'\uFEFF'+valid);assert.equal(run().status,0)
 assert.equal(await readFile(target,'utf8'),'\uFEFF'+valid)
 await writeFile(source,JSON.stringify({syncedAt:'not-a-date',library:{}}));assert.notEqual(run().status,0)
 assert.equal(await readFile(target,'utf8'),'\uFEFF'+valid,'invalid source must preserve the deployed snapshot')
 assert.ok(!(await readFile(script,'utf8')).includes('github.io'))
 console.log('PASS: private snapshot, BOM, original timestamp, invalid source preserves previous data, no old-site dependency')
}finally{await rm(dir,{recursive:true,force:true})}
