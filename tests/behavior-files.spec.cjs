const {test,expect}=require('@playwright/test')
test('directory strip lists, searches, refreshes and safely switches local graphs',async({page})=>{
 await page.route('**/data/library.json*',r=>r.fulfill({json:{syncedAt:new Date().toISOString(),library:{version:1,objects:[],attributes:[],buffs:[]}}}))
 await page.goto('/');await page.getByRole('button',{name:'暂用浏览器草稿'}).click()
 const panel=page.getByRole('region',{name:'本地行为文件'});await expect(panel).toContainText('未选择保存目录')
 await page.evaluate(async()=>{
  const {blankTemplate}=await import('/src/utils/blankTemplate.js'),template=blankTemplate()
  const make=(name,title)=>{const c=structuredClone(template);c.behavior.name=title;return {kind:'file',name,async getFile(){return {name,text:async()=>JSON.stringify(c)}},async isSameEntry(other){return other===this}}}
  window.testFiles=[make('甲.json','行为甲'),make('乙.json','行为乙'),{kind:'directory',name:'.behavior-editor-cache'},{kind:'file',name:'坏文件.json',getFile:async()=>({text:async()=> 'invalid'})}]
  window.testRead=true;window.testDir={name:'测试行为目录',queryPermission:async({mode})=>mode==='read'&&window.testRead?'granted':'denied',requestPermission:async()=>{window.testRead=true;return 'granted'},async *values(){yield* window.testFiles}}
  window.showDirectoryPicker=async()=>window.testDir
  indexedDB.open=()=>{const req={error:Error('mock directory persistence')};setTimeout(()=>req.onerror?.(),0);return req}
 })
 await panel.getByRole('button',{name:'选择目录',exact:true}).click();await expect(panel.locator('.behavior-file')).toHaveCount(3);await expect(panel.getByRole('button',{name:/坏文件/})).toBeDisabled()
 await panel.getByLabel('搜索本地行为文件').fill('行为乙');await expect(panel.locator('.behavior-file')).toHaveCount(1);await panel.getByLabel('搜索本地行为文件').fill('')
 await panel.getByRole('button',{name:/行为甲/}).click();await expect(panel.locator('.current')).toContainText('甲.json');await expect(page.getByLabel('行为名称',{exact:true})).toHaveValue('行为甲')
 await page.getByLabel('行为名称',{exact:true}).fill('尚未保存');page.once('dialog',d=>d.dismiss());await panel.getByRole('button',{name:/行为乙/}).click();await expect(page.getByLabel('行为名称',{exact:true})).toHaveValue('尚未保存')
 page.once('dialog',d=>d.accept());await panel.getByRole('button',{name:/行为乙/}).click();await expect(page.getByLabel('行为名称',{exact:true})).toHaveValue('行为乙');await expect(panel.locator('.current')).toContainText('乙.json')
 await page.evaluate(()=>{window.testFiles=window.testFiles.filter(f=>f.name!=='甲.json')});await panel.getByRole('button',{name:'刷新文件',exact:true}).click();await expect(panel.locator('.behavior-file')).toHaveCount(2)
 await page.evaluate(()=>{window.testRead=false});await panel.getByRole('button',{name:'刷新文件',exact:true}).click();await panel.getByRole('button',{name:'授权读取目录'}).click();await expect(panel.locator('.behavior-file')).toHaveCount(2)
 await panel.getByRole('button',{name:/本地行为文件/}).click();await expect(panel.locator('.behavior-files-list')).toHaveCount(0)
})
