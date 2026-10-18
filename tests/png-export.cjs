const assert=require('node:assert/strict'),{buildSync}=require('esbuild'),Module=require('node:module'),path=require('node:path')
const code=buildSync({entryPoints:['src/utils/pngExport.js'],bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text
const m=new Module(path.join(process.cwd(),'png-test.cjs'),module);m.paths=module.paths;m._compile(code,m.filename||'png-test.cjs')
const {exportFrame,pngName}=m.exports
const rects=[{x:0,y:0,width:280,height:400},{x:-130,y:-70,width:600,height:150}]
const a=exportFrame(rects,{x:400,y:50,zoom:.15},{width:900,height:600})
assert.equal(a.width,696);assert.equal(a.height,566);assert.equal(a.pixelWidth,1392)
assert.deepEqual(a,exportFrame(rects,{x:-200,y:400,zoom:2},{width:500,height:400}))
const v=exportFrame(rects,{x:80,y:-40,zoom:.5},{width:900,height:600},'visible',1)
assert.equal(v.width,900);assert.equal(v.x,80);assert.equal(v.zoom,.5)
assert.throws(()=>exportFrame([],{zoom:1},{},'all'),/没有/)
assert.throws(()=>exportFrame([{x:0,y:0,width:6000,height:400}],{zoom:1},{},'all',2),/图片过大/)
assert.throws(()=>exportFrame([{x:0,y:0,width:3000,height:3000}],{zoom:1},{},'all',2),/图片过大/)
assert.throws(()=>exportFrame([{x:NaN,y:0,width:3,height:4}],{zoom:1},{},'all',1),/尺寸无效/)
assert.throws(()=>exportFrame(rects,{zoom:0},{},'all',1),/尚未准备/)
assert.throws(()=>exportFrame(rects,{zoom:1},{},'bad',1),/选项无效/)
assert.equal(pngName('a/b\\c:*?"<>|',new Date(2026,9,19,9,3,7)),'a_b_c_______-行为图-20261019-090307.png')
console.log('PASS: complete curve bounds, viewport independence, visible crop, pixel limits, invalid dimensions, safe filenames')
