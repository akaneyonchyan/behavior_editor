import {spawn} from 'node:child_process'
import {createHash} from 'node:crypto'
import {mkdir,readFile,writeFile,rename,open,unlink,readdir,access} from 'node:fs/promises'
import {resolve,join,basename} from 'node:path'

// The scheduler runs a private copy of this coordinator, outside the working checkout.
const config=JSON.parse(await readFile(process.argv[2],'utf8'))
const root=resolve(config.root),repo=join(root,'checkout'),statePath=join(root,'status.json')
const source='https://git.xindong.com/petpals/shared/design_behavior_editor.git'
const remoteRoot='/home/ubuntu/pps-editor',remote='ubuntu@124.220.167.210'
await mkdir(root,{recursive:true});await mkdir(join(root,'logs'),{recursive:true})
const log=await open(join(root,'logs',new Date().toISOString().slice(0,10)+'.log'),'a')
const stamp=()=>new Date().toISOString()
const note=async text=>{await log.write(stamp()+' '+text+'\n');console.log(text)}
const sshArgs=['-i',config.sshKey,'-o','UserKnownHostsFile='+config.knownHosts,'-o','StrictHostKeyChecking=yes','-o','BatchMode=yes','-o','ConnectTimeout=15','-o','ServerAliveInterval=15','-o','ServerAliveCountMax=3']
const env={...process.env,GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'never',PW_CHANNEL:'msedge'}
async function run(command,args,{cwd=repo,extraEnv={},timeout=30*60*1000}={}){
 await note('RUN '+basename(command)+' '+args.map(x=>x.includes('PRIVATE')?'[redacted]':x).join(' '))
 return new Promise((ok,fail)=>{
  let output=''
  const child=spawn(command,args,{cwd,env:{...env,...extraEnv},windowsHide:true,stdio:['ignore','pipe','pipe'],timeout})
  for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{log.write(chunk).catch(()=>{});output=(output+chunk).slice(-2000000)})
  child.on('error',fail);child.on('close',code=>code===0?ok(output.trim()):fail(Error(basename(command)+' failed with exit '+code)))
 })
}
async function save(value){await writeFile(statePath+'.next',JSON.stringify(value,null,2)+'\n');await rename(statePath+'.next',statePath)}
let lock,sha,phase='initializing',state={}
try{
 try{state=JSON.parse(await readFile(statePath,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
 try{lock=await open(join(root,'worker.lock'),'wx')}catch(e){
  if(e.code!=='EEXIST')throw e
  const pid=Number(await readFile(join(root,'worker.lock'),'utf8'))
  if(!Number.isInteger(pid)||pid<=0)throw Error('Invalid lock; inspect before retrying')
  let active=true;try{process.kill(pid,0)}catch(error){if(error.code==='ESRCH')active=false;else throw error}
  if(active){await note('Another deployment is running.');process.exit(0)}
  await unlink(join(root,'worker.lock'));lock=await open(join(root,'worker.lock'),'wx')
 }
 await lock.writeFile(String(process.pid))
 let exists=true;try{await access(join(repo,'.git'))}catch{exists=false}
 if(!exists)await run('git',['clone','--single-branch','--branch','master',source,repo],{cwd:root})
 if(await run('git',['remote','get-url','origin'])!==source)throw Error('Unexpected checkout origin')
 if(await run('git',['status','--porcelain']))throw Error('Automatic checkout has local changes; not overwriting')
 await run('git',['fetch','origin','master'])
 sha=await run('git',['rev-parse','origin/master'])
 if(!/^[0-9a-f]{40}$/.test(sha))throw Error('Invalid commit')
 if(state.deployedCommit===sha&&!process.argv.includes('--retry')){await note('No new commit.');await save({...state,checkedAt:stamp()});process.exitCode=0}
 else if(state.failedCommit===sha&&!process.argv.includes('--retry')){await note('This commit failed previously; use --retry after fixing the cause.');process.exitCode=1}
 else{
  await run('git',['checkout','--detach',sha]);await save({...state,status:'running',commit:sha,startedAt:stamp()})
  phase='snapshot';await mkdir(join(root,'data'),{recursive:true})
  await run('scp',[...sshArgs,remote+':'+remoteRoot+'/shared/library.json',join(root,'data/library.json')])
  phase='tests'
  await run(process.execPath,[config.npmCli,'ci','--no-audit','--no-fund'])
  const node=async(...args)=>run(process.execPath,args)
  await node('scripts/reuse-public-library.mjs',join(root,'data/library.json'))
  await node('scripts/export-behaviors.mjs')
  await run(process.execPath,[config.npmCli,'test'])
  for(const test of ['gitlab-behaviors','snapshot-behaviors','feishu-auth','deployment','library-sync'])await node('tests/'+test+'.mjs')
  await run(config.python,['tests/cloud-release.py'])
  await node('scripts/validate-public-library.mjs')
  await node('node_modules/@playwright/test/cli.js','test','--config','playwright.gitlab.config.cjs')
  await run(process.execPath,['node_modules/@playwright/test/cli.js','test','--config','playwright.gitlab.config.cjs'],{extraEnv:{SNAPSHOT_BROWSER_TEST:'1'}})
  await node('node_modules/@playwright/test/cli.js','test','--config','playwright.auth.config.cjs')
  phase='package'
  if((await run('git',['ls-remote','origin','refs/heads/master'])).split(/\s+/)[0]!==sha){await note('Newer commit found; defer to next scheduled check.');await save({...state,status:'superseded',checkedAt:stamp()})}
  else{
   await node('scripts/package-cloud-release.mjs','public/data/library.json','--auth')
   const candidates=(await readdir(join(repo,'release'))).filter(x=>x.startsWith('editor-'+sha.slice(0,12)+'-')&&x.endsWith('.tar.gz')).sort()
   const archive=candidates.at(-1);if(!archive)throw Error('Package not found')
   await mkdir(join(root,'test-tls'),{recursive:true})
   await run(config.openssl,['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(root,'test-tls/key.pem'),'-out',join(root,'test-tls/cert.pem'),'-days','1','-subj','/CN=localhost'])
   await node('tests/auth-production-browser.mjs',join(root,'test-tls/key.pem'),join(root,'test-tls/cert.pem'))
   if((await run('git',['ls-remote','origin','refs/heads/master'])).split(/\s+/)[0]!==sha)throw Error('Newer master arrived before upload; next check will build it')
   phase='deploy'
   const digest=createHash('sha256').update(await readFile(join(repo,'release',archive))).digest('hex')
   await run('scp',[...sshArgs,join(repo,'release',archive),remote+':'+remoteRoot+'/releases/'+archive])
   const helper='deploy-'+sha.slice(0,12)+'.py'
   await run('scp',[...sshArgs,join(repo,'deploy/cloud-release.py'),remote+':'+remoteRoot+'/releases/'+helper])
   await run('ssh',[...sshArgs,remote,'python3 '+remoteRoot+'/releases/'+helper+' '+archive+' '+sha+' '+digest])
   await save({status:'deployed',deployedCommit:sha,deployedAt:stamp(),checkedAt:stamp()})
   await note('Deployment verified: '+sha)
  }
 }
}catch(error){
 await note('FAILED '+phase+': '+error.message)
 await save({...state,status:'failed',failedCommit:sha||null,phase,error:error.message,checkedAt:stamp()})
 process.exitCode=1
}finally{
 if(lock){await lock.close();await unlink(join(root,'worker.lock'))}
 await log.close()
}
