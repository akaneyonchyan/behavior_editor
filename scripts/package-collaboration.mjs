import {build} from 'esbuild'
import {mkdir,copyFile,readFile,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
const destination='release/collaboration'
await mkdir(destination,{recursive:true})
await build({entryPoints:['server/collaboration-service.mjs'],bundle:true,platform:'node',format:'esm',target:'node22',outfile:destination+'/service.mjs',define:{'import.meta.env':'{}'},logLevel:'warning'})
await copyFile('deploy/collaboration-compose.yml',destination+'/compose.yml')
await copyFile('deploy/setup-collaboration-secrets.py',destination+'/setup-secrets.py')
const hashes={}
for(const file of ['service.mjs','compose.yml','setup-secrets.py'])hashes[file]=createHash('sha256').update(await readFile(destination+'/'+file)).digest('hex')
await writeFile(destination+'/checksums.json',JSON.stringify(hashes,null,2))
console.log(JSON.stringify({directory:destination,hashes}))
