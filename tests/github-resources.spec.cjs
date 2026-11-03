const {test,expect}=require('@playwright/test')
test('GitHub production build loads the real library and all graphs without a backend',async({page,baseURL})=>{
 test.skip(!baseURL.includes('/behavior_editor/'),'Requires the GitHub production build config')
 const errors=[],backend=[]
 page.on('pageerror',e=>errors.push(e.message))
 page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))backend.push(r.url())})
 await page.goto('?view=preview')
 await page.getByLabel('预览模式').selectOption('single')
 await expect(page.getByLabel('在线行为').locator('option')).toHaveCount(21)
 await page.getByLabel('在线行为').selectOption('钓鱼细分-核心行为.json')
 await expect(page.locator('.preview-issues summary')).toContainText('0 项待处理')
 await page.getByLabel('播放倍速').selectOption('60')
 await page.getByRole('button',{name:'开始',exact:true}).click()
 await expect(page.locator('.preview-toolbar')).toContainText('已结束',{timeout:30000})
 await expect(page.locator('.preview-error')).toHaveCount(0)
 await page.goto('?view=readonly&file='+encodeURIComponent('钓鱼细分-核心行为.json'))
 await expect(page.getByRole('heading',{name:'钓鱼细分-核心行为',exact:true})).toBeVisible()
 const authored=JSON.parse(require('node:fs').readFileSync('behaviors/钓鱼细分-核心行为.json','utf8')).graph.nodes
 // The graph view preserves authored IDs; structure view replaces loops with containers.
 await page.getByRole('tab',{name:'连线视图',exact:true}).click()
 await expect.poll(async()=>page.locator('.react-flow__node').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-id')))).toEqual(expect.arrayContaining(authored.map(n=>n.id)))
 expect(errors).toEqual([])
 expect(backend).toEqual([])
})
