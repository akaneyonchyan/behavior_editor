import {spawn} from 'node:child_process'
import {readFile,writeFile,mkdir,rename,access,readdir,open,unlink} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {createHash} from 'node:crypto'
import {libraryDigest,releaseKey,needsRelease} from './sites-release-state.mjs'
const [configPath,command='check',...args]=process.argv.slice(2)
const config=JSON.parse(await readFile(configPath,'utf8'))
const root=resolve(config.root),repo=join(root,'checkout'),stateFile=join(root,'state.json'),candidateFile=join(root,'candidate.json')
const source='https://git.xindong.com/petpals/shared/design_behavior_editor.git'
await mkdir(root,{recursive:true});await mkdir(join(root,'logs'),{recursive:true})
const log=await open(join(root,'logs',new Date().toISOString().slice(0,10)+'.log'),'a')
const env={...process.env,GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'never',PW_CHANNEL:'msedge'}
const ssh=['-i',config.sshKey,'-o','UserKnownHostsFile='+config.knownHosts,'-o','StrictHostKeyChecking=yes','-o','BatchMode=yes','-o','ConnectTimeout=15','-o','ServerAliveInterval=15','-o','ServerAliveCountMax=2']
const digest=bytes=>createHash('sha256').update(bytes).digest('hex')
async function json(file,fallback){try{return JSON.parse(await readFile(file,'utf8'))}catch(e){if(e.code==='ENOENT')return fallback;throw e}}
async function save(file,value){await writeFile(file+'.next',JSON.stringify(value,null,2));await rename(file+'.next',file)}
async function run(bin,argv,cwd=repo,extra={}){
 await log.write(new Date().toISOString()+' '+bin+' '+argv.join(' ')+String.fromCharCode(10))
 return new Promise((ok,fail)=>{
  let output='';const child=spawn(bin,argv,{cwd,env:{...env,...extra},windowsHide:true,stdio:['ignore','pipe','pipe'],timeout:1800000})
  for(const stream of [child.stdout,child.stderr])stream.on('data',b=>{output=(output+b).slice(-200000);log.write(b).catch(()=>{})})
  child.on('error',fail);child.on('close',code=>code===0?ok(output.trim()):fail(Error(bin+' exited '+code+'; see deployment log')))
 })
}
const node=(...argv)=>run(process.execPath,argv)
async function bootstrap(){
 let exists=true;try{await access(join(repo,'.git'))}catch{exists=false}
 if(!exists)await run('git',['clone','--single-branch','--branch','master',source,repo],root)
 if(await run('git',['remote','get-url','origin'])!==source)throw Error('Unexpected Git origin')
 if(await run('git',['status','--porcelain']))throw Error('Dedicated checkout has local changes; not overwriting')
}
async function validate(snapshot){
 const {validateLibrary}=await import(pathToFileURL(join(repo,'shared/library-model.mjs')).href+'?v='+Date.now())
 validateLibrary(snapshot.library)
 if(!Number.isFinite(Date.parse(snapshot.syncedAt)))throw Error('Invalid snapshot time')
}
async function latest(){
 await bootstrap();await run('git',['fetch','origin','master'])
 const commit=await run('git',['rev-parse','origin/master'])
 if(!/^[a-f0-9]{40}$/.test(commit))throw Error('Invalid Git revision')
 const file=join(root,'incoming-library-'+process.pid+'.json')
 await run('scp',[...ssh,'ubuntu@124.220.167.210:/home/ubuntu/pps-editor/shared/library.json',file],root)
 const snapshot=await json(file);await validate(snapshot)
 return {commit,libraryHash:libraryDigest(snapshot),syncedAt:snapshot.syncedAt,key:releaseKey(commit,libraryDigest(snapshot))}
}
async function artifactHash(dir){
 const parts=[]
 async function walk(folder,prefix=''){
  for(const f of (await readdir(folder,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
   const relative=prefix+f.name,path=join(folder,f.name)
   if(f.isSymbolicLink())throw Error('Artifact must not contain links')
   if(f.isDirectory())await walk(path,relative+'/');else if(f.isFile())parts.push([relative,digest(await readFile(path))]);else throw Error('Invalid artifact file')
  }
 }
 await walk(dir);return digest(JSON.stringify(parts))
}
let lock
try{
 if(command==='check'){
  const current=await latest(),state=await json(stateFile,{})
  console.log(JSON.stringify({...current,needed:needsRelease(state,current),blockedByPreviousFailure:state.failedKey===current.key}))
 }else if(command==='prepare'){
  try{lock=await open(join(root,'prepare.lock'),'wx')}catch{throw Error('Preparation lock exists; inspect previous process before retrying')}
  await lock.writeFile(String(process.pid))
  const current=await latest(),state=await json(stateFile,{})
  if(!needsRelease(state,current)&&!args.includes('--retry'))console.log(JSON.stringify({skipped:true,...current}))
  else{
   await save(join(root,'attempt.json'),current)
   await run('git',['checkout','--detach',current.commit])
   await validate(await json(join(root,'incoming-library-'+process.pid+'.json')))
   await node(config.npmCli,'ci','--no-audit','--no-fund')
   await node('scripts/reuse-public-library.mjs',join(root,'incoming-library-'+process.pid+'.json'))
   await node('scripts/export-behaviors.mjs')
   await node('scripts/validate-public-library.mjs')
   await save(join(root,'attempt.json'),current)
   if(state.commit!==current.commit)await node(config.npmCli,'test')
   await node('tests/sites-release-state.mjs')
   const worker=config.deploymentMode==='worker'
   if(worker){
    await node(config.npmCli,'run','test:sites-worker')
    await node(config.npmCli,'run','build:sites-worker')
    await node('node_modules/@playwright/test/cli.js','test','--config','playwright.sites-live.config.cjs')
   }else{
    await run(process.execPath,[config.npmCli,'run','build'],repo,{PAGES_BASE:config.basePath,VITE_ONLINE_PROVIDER:'gitlab-static',VITE_LIBRARY_MODE:'published',VITE_AUTH_MODE:''})
    await run(process.execPath,['node_modules/@playwright/test/cli.js','test','--config','playwright.sites.config.cjs'],repo,{PAGES_BASE:config.basePath})
   }
   const artifactDir=join(repo,worker?'release/sites-worker':'dist'),assetDir=worker?join(artifactDir,'assets'):artifactDir
   await writeFile(join(assetDir,'deployment-meta.json'),JSON.stringify({commit:current.commit,libraryHash:current.libraryHash,syncedAt:current.syncedAt}))
   const candidate={...current,preparedAt:new Date().toISOString(),dir:artifactDir,artifactHash:await artifactHash(artifactDir),site:config.site,basePath:worker?'/':config.basePath,...(worker?{workerEntry:'worker.mjs',assets:'assets'}:{})}
   await save(candidateFile,candidate);console.log(JSON.stringify(candidate))
  }
 }else if(command==='verify'){
  const candidate=await json(candidateFile),current=await latest()
  if(!candidate||candidate.key!==current.key)throw Error('Newer source or snapshot; prepare again before publishing')
  if(candidate.artifactHash!==await artifactHash(candidate.dir))throw Error('Artifact changed after validation')
  console.log(JSON.stringify({verified:true,...candidate}))
 }else if(command==='ack'){
  const candidate=await json(candidateFile),deploymentId=args[0]
  if(!candidate||!/^(?:sdep|dep)_[a-z0-9]+$/.test(deploymentId||''))throw Error('Provide successful platform deployment ID')
  if(candidate.artifactHash!==await artifactHash(candidate.dir))throw Error('Artifact changed; cannot acknowledge')
  const previous=await json(stateFile,{})
  await save(stateFile,{...candidate,deploymentId,deployedAt:new Date().toISOString(),previous:{commit:previous.commit,libraryHash:previous.libraryHash,deploymentId:previous.deploymentId}})
  console.log(JSON.stringify({acknowledged:true,deploymentId,key:candidate.key}))
 }else if(command==='fail'){
  const current=await json(join(root,'attempt.json'))||await latest(),state=await json(stateFile,{})
  await save(stateFile,{...state,failedKey:current.key,failedAt:new Date().toISOString()});console.log(JSON.stringify({failedKey:current.key}))
 }else throw Error('Unknown command')
}catch(e){console.error(e.message);process.exitCode=1}
finally{if(lock){await lock.close();await unlink(join(root,'prepare.lock'))}await unlink(join(root,'incoming-library-'+process.pid+'.json')).catch(()=>{});await log.close()}
