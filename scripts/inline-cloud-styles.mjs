import {readFile,writeFile} from 'node:fs/promises'
import {resolve,sep} from 'node:path'
import {fileURLToPath} from 'node:url'

// Keep the authenticated cloud page usable when a separate stylesheet request fails.
// Only trusted, generated build files are embedded; data routes remain authenticated.
export async function inlineCloudStyles(directory='dist'){
 const root=resolve(directory),entry=resolve(root,'index.html')
 let html=await readFile(entry,'utf8'),count=0
 const links=[...html.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*>/g)]
 for(const [tag] of links){
  const href=/\bhref="([^"]+)"/.exec(tag)?.[1]
  if(!href||!href.startsWith('/assets/')||!href.endsWith('.css'))throw Error('Unexpected cloud stylesheet URL')
  const file=resolve(root,'.'+href)
  if(!file.startsWith(root+sep))throw Error('Invalid stylesheet path')
  const css=await readFile(file,'utf8')
  if(/<\/style/i.test(css)||/url\(\s*['"]?(?!data:|https?:|\/|#)/i.test(css))throw Error('Stylesheet cannot be safely inlined without rewriting')
  html=html.replace(tag,()=>'<style data-cloud-styles>'+css+'</style>');count++
 }
 if(!count&&!html.includes('<style data-cloud-styles>'))throw Error('No cloud stylesheet found')
 await writeFile(entry,html)
 console.log('Cloud styles embedded in authenticated HTML: '+count)
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await inlineCloudStyles(process.argv[2])
