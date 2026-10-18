const {test,expect}=require('@playwright/test')
async function drop(page,files){
 const dt=await page.evaluateHandle(files=>{const d=new DataTransfer();for(const f of files)d.items.add(new File([f.text],f.name,{type:'application/json'}));return d},files)
 await page.locator('.canvas > .react-flow').dispatchEvent('dragenter',{dataTransfer:dt})
 await expect(page.locator('.canvas-file-drop-hint')).toBeVisible()
 await page.locator('.canvas > .react-flow').dispatchEvent('drop',{dataTransfer:dt});await dt.dispose()
}
async function config(page){return page.evaluate(async()=>{const {useBehaviorStore:g}=await import('/src/store/behaviorStore.js');return JSON.stringify(g.getState().exportConfig())})}
test.beforeEach(async({page})=>{await page.route('**/data/library.json*',r=>r.fulfill({json:{syncedAt:new Date().toISOString(),library:{version:1,objects:[],attributes:[],buffs:[]}}}));await page.goto('/');await page.getByRole('button',{name:'暂用浏览器草稿'}).click();await expect(page.locator('.react-flow__node')).toHaveCount(9);await page.waitForTimeout(400)})
test('drop JSON loads named graph, fits viewport and preserves palette node dragging',async({page})=>{
 const data=JSON.parse(await config(page));data.behavior.name='拖入行为';data.graph.nodes=data.graph.nodes.slice(0,2);data.graph.edges=data.graph.edges.filter(e=>data.graph.nodes.some(n=>n.id===e.source)&&data.graph.nodes.some(n=>n.id===e.target))
 await drop(page,[{name:'test.json',text:JSON.stringify(data)}])
 await expect(page.locator('.react-flow__node')).toHaveCount(2);await expect(page.locator('.save-status')).toContainText('test.json');await expect(page.locator('.canvas-file-drop-hint')).toHaveCount(0)
 await expect.poll(async()=>JSON.parse(await config(page)).behavior.name).toBe('拖入行为')
 await page.waitForTimeout(500)
 const fits=await page.evaluate(()=>{const box=document.querySelector('.canvas').getBoundingClientRect();return [...document.querySelectorAll('.react-flow__node')].every(n=>{const r=n.getBoundingClientRect();return r.left>=box.left&&r.right<=box.right&&r.top>=box.top&&r.bottom<=box.bottom})});expect(fits).toBe(true)
 const dt=await page.evaluateHandle(()=>{const d=new DataTransfer();d.setData('application/reactflow','wait');return d});await page.locator('.canvas > .react-flow').dispatchEvent('drop',{dataTransfer:dt,clientX:650,clientY:350});await dt.dispose()
 await expect(page.locator('.react-flow__node')).toHaveCount(3)
})
test('invalid or multiple dropped files never replace graph',async({page})=>{
 const before=await config(page)
 for(const files of [[{name:'bad.json',text:'{bad'}],[{name:'bad.json',text:'{}'}],[{name:'image.png',text:'bad'}],[{name:'one.json',text:before},{name:'two.json',text:before}]]){
  await drop(page,files);await expect(page.locator('.document-message.error')).toBeVisible();expect(await config(page)).toBe(before)
 }
})
test('dirty graph cancel preserves edits; accept archives and loads',async({page})=>{
 const next=JSON.parse(await config(page));next.behavior.name='新文件'
 await page.evaluate(async()=>{const {useBehaviorStore:g}=await import('/src/store/behaviorStore.js');g.getState().updateBehaviorInfo({name:'未保存编辑'})})
 const before=await config(page);page.once('dialog',d=>d.dismiss());await drop(page,[{name:'new.json',text:JSON.stringify(next)}]);expect(await config(page)).toBe(before)
 page.once('dialog',d=>d.accept());await drop(page,[{name:'new.json',text:JSON.stringify(next)}]);await expect.poll(async()=>JSON.parse(await config(page)).behavior.name).toBe('新文件')
 expect(await page.evaluate(async()=>{const a=await import('/src/store/documentSession.js');return a.recoveryDrafts().some(d=>d.config.behavior.name==='未保存编辑')})).toBe(true)
})
