import {mkdir,writeFile,rename} from 'node:fs/promises'
import {validateLibrary} from '../shared/library-model.mjs'

// Code-only releases preserve the last published data and its original sync time.
const response=await fetch('https://akaneyonchyan.github.io/behavior_editor/data/library.json',{cache:'no-store',signal:AbortSignal.timeout(30000)})
if(!response.ok)throw Error('无法读取已发布公共库：HTTP '+response.status)
const text=await response.text(),snapshot=JSON.parse(text.replace(/^﻿/,''))
if(typeof snapshot.syncedAt!=='string'||!Number.isFinite(Date.parse(snapshot.syncedAt)))throw Error('公共库快照缺少有效同步时间')
validateLibrary(snapshot.library)
await mkdir('public/data',{recursive:true})
await writeFile('public/data/library.json.tmp',text,'utf8')
await rename('public/data/library.json.tmp','public/data/library.json')
console.log('复用已发布公共库；原同步时间：'+snapshot.syncedAt)
