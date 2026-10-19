const assert=require('node:assert/strict'),{buildSync}=require('esbuild'),Module=require('node:module'),path=require('node:path')
const filename=path.join(process.cwd(),'png-save-test.cjs'),m=new Module(filename,module);m.filename=filename;m.paths=module.paths
m._compile(buildSync({entryPoints:['src/utils/pngExport.js'],bundle:true,platform:'node',format:'cjs',write:false,logLevel:'silent'}).outputFiles[0].text,filename)
const {preparePngDestination}=m.exports
;(async()=>{
 const directory={name:'团队目录'},blob=new Blob(['png']),events=[];let called=false,options
 const promise=preparePngDestination('测试',directory,o=>{called=true;options=o;return Promise.resolve({name:'测试.png',createWritable:async()=>({write:async b=>events.push(b),close:async()=>events.push('close')})})})
 assert.equal(called,true,'Picker must start synchronously in the click gesture');assert.equal(options.startIn,directory);assert.deepEqual(options.types[0].accept,{'image/png':['.png']})
 assert.match(options.suggestedName,/\.png$/);const target=await promise;assert.deepEqual(events,[]);await target.download(blob);assert.deepEqual(events,[blob,'close'])
 assert.deepEqual(await preparePngDestination('x',null,null),{saved:false})
 assert.deepEqual(await preparePngDestination('x',directory,async()=>{throw Object.assign(new Error('cancel'),{name:'AbortError'})}),{cancelled:true})
 await assert.rejects(()=>preparePngDestination('x',directory,async()=>{throw Error('permission')}),/permission/)
 let aborted=false;const bad=await preparePngDestination('x',null,async o=>{assert.ok(!('startIn' in o));return {createWritable:async()=>({write:async()=>{throw Error('disk full')},abort:async()=>{aborted=true}})}})
 await assert.rejects(()=>bad.download(blob),/disk full/);assert.equal(aborted,true)
 console.log('PASS: PNG save directory, gesture timing, no-directory fallback, cancel, permissions and write abort')
})().catch(e=>{console.error(e);process.exitCode=1})
