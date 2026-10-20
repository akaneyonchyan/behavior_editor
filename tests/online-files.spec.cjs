
const {test,expect}=require('@playwright/test')
let config
test.beforeEach(async({page})=>{
 await page.route('**/data/library.json*',r=>r.fulfill({json:{syncedAt:new Date().toISOString(),library:{version:1,objects:[],attributes:[],buffs:[]}}}))
 await page.goto('/');await page.getByRole('button',{name:'暂用浏览器草稿'}).click()
 config=await page.evaluate(async()=>{const {blankTemplate}=await import('/src/utils/blankTemplate.js');const c=blankTemplate();c.behavior.name='线上独立行为';c.graph.nodes.find(n=>n.type==='result').data.animation='仅线上表演';return c})
 await page.route('https://api.github.com/repos/akaneyonchyan/behavior_editor/**',async r=>{
  const route=r.request().url().split('/behavior_editor')[1]
  let json
  if(route==='/git/ref/heads/main')json={object:{sha:'head'}}
  else if(route==='/git/commits/head')json={tree:{sha:'root'}}
  else if(route==='/git/trees/root')json={tree:[{path:'behaviors',type:'tree',sha:'folder'}]}
  else if(route==='/git/trees/folder')json={tree:[{path:'线上行为.json',type:'blob',mode:'100644',sha:'blob123456',size:100}]}
  else if(route==='/git/blobs/blob123456')json={encoding:'base64',content:Buffer.from(JSON.stringify(config)).toString('base64')}
  else if(route==='/git/trees')json={sha:'newtree'}
  else if(route==='/git/commits')json={sha:'newcommit'}
  else if(route==='/git/refs')json={}
  else if(route==='/pulls')json={number:123}
  else throw Error(route)
  await r.fulfill({json})
 })
})
async function online(page){await page.getByRole('tab',{name:'在线',exact:true}).click();return page.getByRole('region',{name:'在线行为文件'})}
async function localState(page){return page.evaluate(async()=>{const {useBehaviorStore:g}=await import('/src/store/behaviorStore.js');return {config:g.getState().exportConfig(),past:g.getState().past}})}
test('online preview is isolated and read-only, including keyboard, drag and start metadata',async({page})=>{
 await page.getByLabel('行为名称',{exact:true}).fill('本地未保存行为')
 const before=await localState(page),panel=await online(page)
 await expect(page.getByText('行为图文件',{exact:true})).toBeVisible()
 expect(await page.getByRole('tab',{name:'在线',exact:true}).evaluate(e=>getComputedStyle(e).borderRadius)).toBe('0px')
 await expect(page.getByRole('button',{name:'保存',exact:true})).toBeDisabled()
 await expect(page.getByRole('button',{name:'撤销',exact:true})).toBeDisabled()
 await panel.getByRole('button',{name:'线上行为.json',exact:true}).click()
 const modal=page.getByRole('region',{name:'在线行为只读画布'})
 await expect(page.locator('.online-preview-overlay')).toHaveCount(0)
 await expect(modal.locator('header')).toHaveCount(0)
 await expect(modal).not.toContainText('在线版本')
 expect(await modal.evaluate(e=>[...e.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim())).toBe('')
 const colors=await modal.locator('.react-flow__minimap-node').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('fill')))
 expect(new Set(colors).size).toBeGreaterThan(3)
 const side=await page.locator('.behavior-sidebar').boundingBox(),canvas=await modal.boundingBox()
 expect(canvas.x).toBeGreaterThanOrEqual(side.x+side.width-1)
 expect(Math.abs(canvas.y-side.y)).toBeLessThan(2)
 await expect(modal.locator('[data-id=behavior_start]')).toContainText('线上独立行为')
 await expect(modal.locator('[data-id=template_result_1]')).toContainText('仅线上表演')
 await modal.locator('[data-id=template_result_1]').click();await page.keyboard.press('Delete');await page.keyboard.press('Control+z');await page.keyboard.press('Control+d')
 await expect(modal.locator('.react-flow__node')).toHaveCount(9)
 expect(await localState(page)).toEqual(before)
 await page.getByRole('button',{name:'另存为',exact:true}).click();await expect(page.getByRole('alert').first()).toContainText('保存目录')
 await page.getByRole('tab',{name:'本地',exact:true}).click();expect(await localState(page)).toEqual(before)
})
test('upload explicit confirmation creates branch and PR without writing main; token never persisted',async({page})=>{
 const writes=[];page.on('request',r=>{if(r.url().startsWith('https://api.github.com/')&&r.method()==='POST')writes.push({url:r.url(),body:r.postDataJSON()})})
 const panel=await online(page)
 await panel.getByRole('button',{name:'上传授权',exact:true}).click();await panel.getByLabel('GitHub Token',{exact:true}).fill('fake-test-token')
 await panel.getByLabel('选择上传行为文件').setInputFiles({name:'线上行为.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(config))})
 const confirm=page.getByRole('dialog',{name:'确认提交行为文件'})
 await expect(confirm).toContainText('替换同名文件');expect(writes).toHaveLength(0)
 await confirm.getByRole('button',{name:'创建分支并提交审核'}).click()
 await expect(panel.getByRole('link',{name:'查看并审核 PR #123'})).toBeVisible()
 expect(writes).toHaveLength(4);expect(writes[2].body.ref).toMatch(/^refs\/heads\/behavior-upload\//);expect(writes[3].body.base).toBe('main')
 expect(await page.evaluate(()=>JSON.stringify({...localStorage})+JSON.stringify({...sessionStorage}))).not.toContain('fake-test-token')
 await page.reload();await page.getByRole('tab',{name:'在线',exact:true}).click();await page.getByRole('button',{name:'上传授权',exact:true}).click();await expect(page.getByLabel('GitHub Token',{exact:true})).toHaveValue('')
})
test('download writes original JSON to selected folder and opens local editable copy',async({page})=>{
 await page.evaluate(()=>{
  window.downloaded={}
  window.testDir={name:'下载测试',queryPermission:async({mode})=>mode==='read'?'granted':'denied',requestPermission:async()=> 'granted',async *values(){yield* Object.values(window.downloaded)},async getFileHandle(name,options){
   if(!window.downloaded[name]){if(!options?.create)throw new DOMException('missing','NotFoundError')
    const h={kind:'file',name,text:'',queryPermission:async()=> 'granted',isSameEntry:async other=>other===h,getFile:async()=>({name,text:async()=>h.text}),createWritable:async()=>({write:async text=>{h.text=text},close:async()=>{},abort:async()=>{}})};window.downloaded[name]=h}
   return window.downloaded[name]
  }}
  window.showDirectoryPicker=async()=>window.testDir
  indexedDB.open=()=>{const req={error:Error('test handles')};setTimeout(()=>req.onerror?.(),0);return req}
 })
 await page.getByRole('button',{name:'保存目录',exact:true}).click()
 const panel=await online(page);await panel.getByRole('button',{name:'线上行为.json',exact:true}).click()
 await page.getByRole('button',{name:'另存为',exact:true}).click()
 await expect(page.getByRole('region',{name:'在线行为只读画布'})).toHaveCount(0)
 await expect(page.getByRole('tab',{name:'本地',exact:true})).toHaveAttribute('aria-selected','true')
 await expect(page.getByLabel('行为名称',{exact:true})).toHaveValue('线上独立行为')
 expect(await page.evaluate(()=>JSON.parse(window.downloaded['线上行为.json'].text))).toEqual(config)
 await page.getByLabel('行为名称',{exact:true}).fill('下载后的修改')
 expect((await localState(page)).config.behavior.name).toBe('下载后的修改')
})
