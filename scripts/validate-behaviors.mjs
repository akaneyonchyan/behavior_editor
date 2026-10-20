import {readdir,readFile} from 'node:fs/promises'
import path from 'node:path'
import {createRequire} from 'node:module'
import {buildSync} from 'esbuild'
const require=createRequire(import.meta.url)
const result=buildSync({stdin:{contents:"export {parseBehavior,validateFileName} from './src/utils/onlineBehaviors.js'",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',write:false,logLevel:'silent'})
const mod={exports:{}};new Function('module','exports','require',result.outputFiles[0].text)(mod,mod.exports,require)
const {parseBehavior,validateFileName}=mod.exports
const entries=await readdir('behaviors',{withFileTypes:true}),names=new Set()
let count=0
for(const file of entries){
 if(file.name==='README.md')continue
 if(!file.isFile())throw new Error('behaviors 仅支持直接存放 JSON 文件：'+file.name)
 validateFileName(file.name)
 const key=file.name.toLowerCase();if(names.has(key))throw new Error('行为文件重名：'+file.name);names.add(key)
 try{parseBehavior(await readFile(path.join('behaviors',file.name),'utf8'))}catch(e){throw new Error(file.name+'：'+e.message)}
 count++
}
console.log('PASS: '+count+' 个在线行为文件格式有效')
