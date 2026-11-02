import {execFileSync,execSync} from 'node:child_process'
import {readFile,mkdir,cp,writeFile} from 'node:fs/promises'
import {resolve,basename} from 'node:path'
import {createHash} from 'node:crypto'
import {validateLibrary} from '../shared/library-model.mjs'
import {inlineCloudStyles} from './inline-cloud-styles.mjs'
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim()
const authenticated=process.argv.includes('--auth')
const head=git('rev-parse','HEAD'),remote=git('remote','get-url','origin')
const source='https://git.xindong.com/petpals/shared/design_behavior_editor.git',remoteUrl=new URL(remote)
if(remoteUrl.protocol!=='https:'||remoteUrl.hostname!=='git.xindong.com'||remoteUrl.pathname!=='/petpals/shared/design_behavior_editor.git')throw Error('Build from the intended GitLab origin only')
if(git('status','--porcelain'))throw Error('Commit all changes before packaging')
const published=git('ls-remote','origin','refs/heads/master').split(/\s+/)[0]
if(head!==published)throw Error('HEAD must equal GitLab master before packaging')
if(!process.argv[2])throw Error('Provide a validated library snapshot file')
const libraryBytes=await readFile(resolve(process.argv[2])),snapshot=JSON.parse(libraryBytes.toString('utf8').replace(/^\uFEFF/,''))
validateLibrary(snapshot.library)
if(!Number.isFinite(Date.parse(snapshot.syncedAt)))throw Error('Invalid library snapshot time')
const release=resolve('release','editor-'+head.slice(0,12)+'-'+Date.now())
await mkdir(release,{recursive:true})
execFileSync(process.execPath,['scripts/export-behaviors.mjs'],{stdio:'inherit'})
execFileSync(process.execPath,['scripts/build-server-validator.mjs'],{stdio:'inherit'})
execSync('npm run build',{stdio:'inherit',env:{...process.env,VITE_AUTH_MODE:authenticated?'feishu':'',VITE_ONLINE_PROVIDER:'gitlab-snapshot',VITE_LIBRARY_MODE:'published',PAGES_BASE:'/'}})
if(authenticated)await inlineCloudStyles('dist')
await cp('dist',resolve(release,'dist'),{recursive:true})
await cp('server',resolve(release,'server'),{recursive:true})
await cp('shared',resolve(release,'shared'),{recursive:true})
await mkdir(resolve(release,'dist/data'),{recursive:true})
await writeFile(resolve(release,'dist/data/library.json'),libraryBytes)
await cp('deploy/Dockerfile.release',resolve(release,'Dockerfile'))
await cp(authenticated?'deploy/compose.auth.yaml':'deploy/compose.release.yaml',resolve(release,'compose.yaml'))
await cp('deploy/nginx-auth.conf',resolve(release,'nginx-auth.conf'))
await writeFile(resolve(release,'release.json'),JSON.stringify({source,commit:head,createdAt:new Date().toISOString(),librarySyncedAt:snapshot.syncedAt,mode:'snapshot',loginImplemented:authenticated},null,2))
const archive=release+'.tar.gz'
execFileSync('tar',['-czf',archive,'-C',release,'.'])
const digest=createHash('sha256').update(await readFile(archive)).digest('hex')
await writeFile(archive+'.sha256',digest+'  '+basename(archive)+'\n')
console.log(JSON.stringify({archive,sha256:digest,commit:head,librarySyncedAt:snapshot.syncedAt}))
