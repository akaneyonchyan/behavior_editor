const {test,expect}=require('@playwright/test')

test.beforeEach(async({page})=>{await page.route('**/data/library.json*',r=>r.fulfill({json:{syncedAt:new Date().toISOString(),library:{version:1,objects:[],attributes:[],buffs:[]}}}));await page.goto('/');await page.getByRole('button',{name:'暂用浏览器草稿'}).click()})
test('split ends import, edit playback and roundtrip without loss',async({page})=>{
 const original=await page.evaluate(async()=>{const {useBehaviorStore:g}=await import('/src/store/behaviorStore.js');const c=g.getState().exportConfig();c.graph.nodes.push({id:'template_interrupted',type:'end',position:{x:1900,y:500},data:{}});return c}); for(const suffix of ['A','B']){const config=structuredClone(original);const names={template_end:'end_complete',template_interrupted:'end_interrupted'};for(const n of config.graph.nodes)if(names[n.id]){n.id=names[n.id];n.data.animation='结束动作'+suffix;n.data.playMode='单次'}for(const e of config.graph.edges){e.target=names[e.target]||e.target;e.source=names[e.source]||e.source}
 await page.evaluate(async c=>{const {useBehaviorStore:g}=await import('/src/store/behaviorStore.js');g.getState().importConfig(c);g.getState().selectNode(g.getState().nodes.find(n=>n.id==='end_complete'))},config)
 await expect(page.locator('.react-flow__node-end')).toHaveCount(2)
 await expect(page.getByRole('textbox',{name:'结束表演',exact:true})).toHaveValue(config.graph.nodes.find(n=>n.id==='end_complete').data.animation)
 const mode=page.getByRole('combobox',{name:'结束播放方式'});await mode.fill('计时');await mode.press('Tab')
 const duration=page.getByRole('textbox',{name:'结束播放期望'});await duration.fill('短暂播放');await duration.press('Tab')
 await expect(page.locator('.react-flow__node[data-id="end_complete"]')).toContainText('计时 · 短暂播放')
 await page.evaluate(async()=>{const {useBehaviorStore:g}=await import('/src/store/behaviorStore.js');const c=g.getState().exportConfig();g.getState().importConfig(c);g.getState().selectNode(g.getState().nodes.find(n=>n.id==='end_complete'))})
 await expect(mode).toHaveValue('计时');await expect(duration).toHaveValue('短暂播放')
 }
})
test('legacy dual animations remain visible for splitting and invalid playback is rejected',async({page})=>{
 const result=await page.evaluate(async()=>{const {useBehaviorStore:g}=await import('/src/store/behaviorStore.js');const c=g.getState().exportConfig();const n=c.graph.nodes.find(n=>n.type==='end');n.data={name:'旧结束',successAnimation:'旧成功',failAnimation:'旧失败'};g.getState().importConfig(c);g.getState().selectNode(g.getState().nodes.find(x=>x.id===n.id));const bad=structuredClone(c);bad.graph.nodes.find(x=>x.id===n.id).data.playMode=17;try{g.getState().importConfig(bad);return false}catch{return true}})
 expect(result).toBe(true);await expect(page.locator('.property-panel')).toContainText('完成表演：旧成功');await expect(page.locator('.property-panel')).toContainText('中断表演：旧失败');await expect(page.getByRole('button',{name:'拆分为两个结束节点',exact:true})).toBeVisible()
})


