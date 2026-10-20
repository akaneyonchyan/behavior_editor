const {test,expect}=require('@playwright/test')
const fs=require('node:fs/promises')
async function snapshot(page){return page.evaluate(async()=>{
 const {useBehaviorStore:g}=await import('/src/store/behaviorStore.js'),{useDocumentSession:d}=await import('/src/store/documentSession.js')
 const s=g.getState();return JSON.stringify({config:s.exportConfig(),past:s.past,future:s.future,selected:s.selectedNode,dirty:d.getState().dirty,file:d.getState().fileName,transform:document.querySelector('.react-flow__viewport').style.transform})
})}
test.beforeEach(async({page})=>{
 await page.route('**/data/library.json*',route=>route.fulfill({json:{syncedAt:new Date().toISOString(),library:{version:1,objects:[],attributes:[],buffs:[]}}}))
 await page.addInitScript(()=>{window.showSaveFilePicker=undefined})
 await page.goto('/')
 await page.getByRole('button',{name:'暂用浏览器草稿'}).click()
 await expect(page.locator('.react-flow__node')).toHaveCount(7)
 await expect(page.locator('.react-flow__edge-path')).toHaveCount(8)
 await page.waitForTimeout(500)
})
test('full and visible PNG downloads preserve graph, selection, viewport and save state',async({page},info)=>{
 await page.locator('.react-flow__node').nth(2).click()
 const before=await snapshot(page)
 const barBefore=await page.locator('.document-bar').boundingBox()
 const buttonsBefore=await page.locator('.document-actions .toolbar-btn').evaluateAll(nodes=>nodes.map(n=>{const b=n.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height}}))
 await page.getByRole('button',{name:'导出 PNG',exact:true}).click()
 const pending=page.waitForEvent('download')
 await page.getByRole('button',{name:'下载 PNG',exact:true}).click()
 const download=await pending
 await expect(page.locator('.document-message')).toContainText('已生成 PNG')
 await expect(page.locator('.document-actions [role=status]')).toHaveCount(0)
 expect(await page.locator('.document-bar').boundingBox()).toEqual(barBefore)
 expect(await page.locator('.document-actions .toolbar-btn').evaluateAll(nodes=>nodes.map(n=>{const b=n.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height}}))).toEqual(buttonsBefore)
 expect(download.suggestedFilename()).toMatch(/行为图-\d{8}-\d{6}\.png$/)
 const file=info.outputPath('full.png');await download.saveAs(file)
 const bytes=await fs.readFile(file)
 expect(bytes.subarray(1,4).toString()).toBe('PNG')
 expect(bytes.readUInt32BE(16)).toBeGreaterThan(1000)
 expect(bytes.readUInt32BE(20)).toBeGreaterThan(500)
 await expect(page.getByRole('dialog')).toHaveCount(0)
 expect(await snapshot(page)).toBe(before)
 const ink=await page.evaluate(async data=>{
  const img=new Image();img.src='data:image/png;base64,'+data;await img.decode()
  const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0)
  const p=ctx.getImageData(0,0,c.width,c.height).data;let count=0
  for(let i=0;i<p.length;i+=4)if(p[i]>50&&p[i+1]>50&&p[i+2]>50)count++
  return count
 },bytes.toString('base64'))
 expect(ink).toBeGreaterThan(10000)
 await page.getByRole('button',{name:'导出 PNG',exact:true}).click()
 await page.getByLabel('导出范围').selectOption('visible');await page.getByLabel('清晰度').selectOption('1')
 const size=await page.locator('.canvas > .react-flow').boundingBox(),next=page.waitForEvent('download')
 await page.getByRole('button',{name:'下载 PNG',exact:true}).click()
 const visible=await next;await visible.saveAs(info.outputPath('visible.png'))
 const cropped=await fs.readFile(info.outputPath('visible.png'))
 expect(cropped.readUInt32BE(16)).toBe(Math.ceil(size.width));expect(cropped.readUInt32BE(20)).toBe(Math.ceil(size.height))
 expect(await snapshot(page)).toBe(before)
})
test('snapshot strips editing UI, preserves arrows and custom text, honors disabled rest, includes curve bounds',async({page})=>{
 await page.evaluate(async()=>{const {useBehaviorStore:g}=await import('/src/store/behaviorStore.js');g.getState().updateNode('template_loop',{restEnabled:false});g.getState().updateNode('template_result_1',{description:'中文长说明与自定义规则',outputs:['自定义产物']})})
 await page.waitForTimeout(350)
 const result=await page.evaluate(async()=>{
  const {captureCanvas}=await import('/src/utils/pngExport.js'),source=document.querySelector('.canvas > .react-flow')
  const first=captureCanvas(source),clone=first.clone
  const old=source.querySelector('.react-flow__viewport').style.transform
  source.querySelector('.react-flow__viewport').style.transform='translate(-100px, 100px) scale(0.3)'
  const second=captureCanvas(source)
  source.querySelector('.react-flow__viewport').style.transform=old
  const vb=clone.querySelector('.react-flow__viewport');const host=document.createElement('div');host.append(clone);document.body.append(host)
  const root=clone.getBoundingClientRect();const fits=[...clone.querySelectorAll('.react-flow__node,.react-flow__edge-path')].every(n=>{const r=n.getBoundingClientRect();return r.left>=root.left+20&&r.top>=root.top+20&&r.right<=root.right-20&&r.bottom<=root.bottom-20})
  const result={removed:clone.querySelectorAll('.selected,.react-flow__handle,.edge-flow-trail,.edge-flow-head,.react-flow__background,.react-flow__panel').length,arrows:clone.querySelectorAll('marker').length,edges:clone.querySelectorAll('.react-flow__edge-path').length,custom:clone.querySelectorAll('.custom-choice').length,text:clone.textContent,fits,w1:first.frame.width,w2:second.frame.width,h1:first.frame.height,h2:second.frame.height}
  host.remove();return result
 })
 expect(result.removed).toBe(0);expect(result.arrows).toBeGreaterThan(0);expect(result.custom).toBeGreaterThan(0)
 expect(result.edges).toBe(8);expect(result.text).toContain('中文长说明');expect(result.text).not.toContain('第三步')
 expect(result.fits).toBe(true);expect(Math.abs(result.w1-result.w2)).toBeLessThanOrEqual(1);expect(Math.abs(result.h1-result.h2)).toBeLessThanOrEqual(1)
})
test('oversized graph is rejected without download; cancellation changes nothing',async({page})=>{
 const before=await snapshot(page)
 await page.getByRole('button',{name:'导出 PNG',exact:true}).click();await page.getByRole('button',{name:'取消',exact:true}).click()
 expect(await snapshot(page)).toBe(before)
 await page.evaluate(async()=>{const {useBehaviorStore:g}=await import('/src/store/behaviorStore.js');g.setState({nodes:g.getState().nodes.map((n,i)=>i===1?{...n,position:{x:12000,y:100}}:n)})})
 await page.waitForTimeout(300)
 await page.getByRole('button',{name:'导出 PNG',exact:true}).click();await page.getByRole('button',{name:'下载 PNG',exact:true}).click()
 await expect(page.getByRole('alert')).toContainText('图片过大')
 await expect(page.getByRole('button',{name:'下载 PNG',exact:true})).toBeEnabled()
 expect(await page.locator('.png-export-snapshot').count()).toBe(0)
})
test('render failure and concurrent requests release lock and remove detached snapshot',async({page})=>{
 const before=await snapshot(page)
 const result=await page.evaluate(async()=>{
  const {exportCanvasPng}=await import('/src/utils/pngExport.js'),source=document.querySelector('.canvas > .react-flow')
  let release,started;const entered=new Promise(r=>started=r)
  const first=exportCanvasPng(source,{}, {render:()=>{started();return new Promise(r=>release=r)},download:()=>{}})
  await entered
  let concurrent;try{await exportCanvasPng(source)}catch(e){concurrent=e.message}
  release(new Blob(['png']));await first
  let error;try{await exportCanvasPng(source,{}, {render:()=>{throw Error('render failed')}})}catch(e){error=e.message}
  await exportCanvasPng(source,{}, {render:()=>Promise.resolve(new Blob(['png'])),download:()=>{}})
  return {concurrent,error,remaining:document.querySelectorAll('.png-export-snapshot').length}
 })
 expect(result.concurrent).toContain('正在导出');expect(result.error).toBe('render failed');expect(result.remaining).toBe(0)
 expect(await snapshot(page)).toBe(before)
})


test('PNG save picker starts in the chosen directory and cancellation preserves the graph',async({page})=>{
 await page.evaluate(async()=>{
  const session=await import('/src/store/documentSession.js');
  const dir={name:'测试保存目录',queryPermission:async()=> 'denied'};
  window.showDirectoryPicker=async()=>dir;const open=indexedDB.open.bind(indexedDB);indexedDB.open=()=>{const request={error:Error('test: handle persistence unavailable')};setTimeout(()=>request.onerror?.(),0);return request};try{await session.chooseDirectory()}finally{indexedDB.open=open};
  window.pngTest={calls:0,closed:0,bytes:[],cancel:true};
  window.showSaveFilePicker=async options=>{
   window.pngTest.calls++;window.pngTest.sameDirectory=options.startIn===session.getSaveDirectory();window.pngTest.active=navigator.userActivation.isActive;
   if(window.pngTest.cancel)throw new DOMException('cancel','AbortError');
   return {name:'测试导出.png',createWritable:async()=>({write:async blob=>{window.pngTest.bytes=Array.from(new Uint8Array(await blob.arrayBuffer())).slice(0,8)},close:async()=>{window.pngTest.closed++}})};
  };
 })
 const before=await snapshot(page)
 await page.getByRole('button',{name:'导出 PNG',exact:true}).click();await expect(page.getByRole('dialog',{name:'导出行为图 PNG'})).toContainText('测试保存目录')
 await page.getByRole('button',{name:'下载 PNG',exact:true}).click();await expect(page.getByRole('button',{name:'下载 PNG',exact:true})).toBeEnabled();expect(await page.evaluate(()=>window.pngTest.closed)).toBe(0);expect(await snapshot(page)).toBe(before)
 await page.evaluate(()=>{window.pngTest.cancel=false});await page.getByRole('button',{name:'下载 PNG',exact:true}).click();await expect(page.getByRole('dialog',{name:'导出行为图 PNG'})).toHaveCount(0)
 const result=await page.evaluate(()=>window.pngTest);expect(result.sameDirectory).toBe(true);expect(result.active).toBe(true);expect(result.closed).toBe(1);expect(result.bytes).toEqual([137,80,78,71,13,10,26,10]);expect(await snapshot(page)).toBe(before)
 await expect(page.locator('.document-message')).toContainText('PNG 已保存：测试导出.png')
})
