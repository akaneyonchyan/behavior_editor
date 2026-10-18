import assert from 'node:assert/strict'
import {mkdtemp,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {spawnSync} from 'node:child_process'
const dir=await mkdtemp(join(tmpdir(),'library-validation-')),path=join(dir,'snapshot.json')
const library={version:1,objects:[{id:'o',name:'对象',enabled:true,description:''}],attributes:[{id:'a',name:'属性A',kind:'数值',objectTypes:['o'],enabled:false,description:''}],buffs:[]}
const snapshot=()=>({syncedAt:new Date().toISOString(),library:structuredClone(library)})
const run=()=>spawnSync(process.execPath,['scripts/validate-public-library.mjs',path],{encoding:'utf8'})
const check=async(data,valid)=>{await writeFile(path,typeof data==='string'?data:JSON.stringify(data));const r=run();assert.equal(r.status,valid?0:1,r.stderr);return r}
try{
 await check(snapshot(),true)
 const good=snapshot();good.library.attributes[0].kind='枚举';await check('\uFEFF'+JSON.stringify(good),true)
 const bad=snapshot();bad.library.attributes[0].kind='布尔';bad.library.attributes.push({...bad.library.attributes[0],id:'b',name:'属性B',kind:'JSON'});const error=await check(bad,false);assert.match(error.stderr,/属性A/);assert.match(error.stderr,/属性B/);assert.match(error.stderr,/JSON/)
 const link=snapshot();link.library.attributes[0].objectTypes=['missing'];await check(link,false)
 const duplicate=snapshot();duplicate.library.objects.push({...duplicate.library.objects[0]});await check(duplicate,false)
 await check({...snapshot(),syncedAt:''},false);await check('{bad',false)
 await rm(path);assert.equal(run().status,1)
 const env={...process.env,GITHUB_EVENT_NAME:'push'};for(const key of Object.keys(env))if(key.startsWith('FEISHU_'))delete env[key]
 const missingSecrets=spawnSync(process.execPath,['scripts/export-public-library.mjs'],{encoding:'utf8',env});assert.equal(missingSecrets.status,1);assert.match(missingSecrets.stderr,/配置全部飞书同步参数/)
 console.log('PASS: publishing gate validates snapshot, enum/numeric, disabled invalid types, all invalid rows, references, uniqueness, timestamp, malformed and missing files')
}finally{await rm(dir,{recursive:true,force:true})}
