import './validate-behaviors.mjs'
import {readdir,readFile,mkdir,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
const target='public/data/behaviors';await mkdir(target,{recursive:true})
const files=[]
for(const name of await readdir('behaviors')){
 if(!/\.json$/i.test(name))continue
 const bytes=await readFile('behaviors/'+name)
 const sha=createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex')
 await writeFile(target+'/'+sha+'.json',bytes)
 files.push({name,sha,size:bytes.length})
}
await writeFile(target+'/index.json',JSON.stringify({version:1,publishedAt:new Date().toISOString(),files}))
console.log('Published '+files.length+' behavior files')
