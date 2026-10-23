const {test,expect}=require('@playwright/test')
async function state(page){return page.evaluate(async()=>{const {useBehaviorStore:g}=await import('/src/store/behaviorStore.js');return {config:g.getState().exportConfig(),history:g.getState().past.length}})}
async function select(page,id){await page.evaluate(async id=>{const {useBehaviorStore:g}=await import('/src/store/behaviorStore.js');g.getState().selectNode(g.getState().nodes.find(n=>n.id===id))},id)}
async function keyboardMove(page,list,index,keys=['ArrowDown'],cancel=false){
 const handle=page.getByLabel(list+'排序',{exact:true}).getByRole('button',{name:/拖动排序/}).nth(index)
 await handle.focus();await page.keyboard.press('Space');await expect(page.locator('.sort-preview')).toBeVisible();await page.waitForTimeout(100);for(const key of keys){await page.keyboard.press(key);await page.waitForTimeout(80)}await page.keyboard.press(cancel?'Escape':'Space')
}
test.beforeEach(async({page})=>{
 await page.route('**/data/library.json*',r=>r.fulfill({json:{syncedAt:new Date().toISOString(),library:{version:1,objects:[],attributes:[],buffs:[]}}}))
 await page.goto('/?view=editor');await page.getByRole('button',{name:'暂用浏览器草稿'}).click()
 await page.evaluate(async()=>{
  const {useBehaviorStore:g}=await import('/src/store/behaviorStore.js');const s=()=>g.getState(),rule=(id,kind='attribute')=>({id,kind,source:'自定义对象',objectName:'对象'+id,attribute:'属性'+id,influence:'自定义规则'+id})
  s().updateBehaviorInfo({preconditions:{...s().behaviorInfo.preconditions,attributeRules:[rule('a'),rule('b'),rule('c')]}})
  s().updateNode('template_judge',{judgeAttributes:[rule('a'),rule('b')],branches:[{id:'branch_1',name:'甲',weightExpectation:'高',weightFactors:[{...rule('fa'),version:2,attributeId:'a',influence:'甲A'},{...rule('fb'),version:2,attributeId:'b',influence:'甲B'}]},{id:'branch_2',name:'乙',weightExpectation:'低',weightFactors:[{...rule('ga'),version:2,attributeId:'a',influence:'乙A'},{...rule('gb'),version:2,attributeId:'b',influence:'乙B'}]}]})
  s().updateNode('template_result_1',{effectRules:[rule('a'),rule('b1','buff'),rule('b'),rule('b2','buff')],outputs:['重复','重复','末项','']})
 })
})
test('rules reorder once, cancel and undo; fields keep custom values',async({page})=>{
 const before=await state(page);await keyboardMove(page,'准入条件',0)
 let after=await state(page);expect(after.config.behavior.preconditions.attributeRules.map(r=>r.id)).toEqual(['b','a','c']);expect(after.history).toBe(before.history+1)
 await keyboardMove(page,'准入条件',0,['ArrowDown'],true);expect(await state(page)).toEqual(after)
 await page.evaluate(async()=>{const {useBehaviorStore:g}=await import('/src/store/behaviorStore.js');g.getState().undo()});expect((await state(page)).config).toEqual(before.config)
 await page.evaluate(async()=>{const {useBehaviorStore:g}=await import('/src/store/behaviorStore.js');g.getState().redo()});expect((await state(page)).config).toEqual(after.config)
 await expect(page.getByLabel('准入条件排序').locator('.custom-choice').first()).toBeVisible()
})
test('branch order preserves edges and shared attributes retain branch effects',async({page})=>{
 await select(page,'template_judge');const before=await state(page);await keyboardMove(page,'判断分支',0)
 let after=await state(page),judge=after.config.graph.nodes.find(n=>n.id==='template_judge')
 expect(judge.data.branches.map(b=>b.id)).toEqual(['branch_2','branch_1']);expect(after.config.graph.edges).toEqual(before.config.graph.edges)
 await expect(page.locator('[data-id=template_judge] .node-branch').first()).toContainText('乙')
 await keyboardMove(page,'判断属性',0);judge=(await state(page)).config.graph.nodes.find(n=>n.id==='template_judge')
 expect(judge.data.judgeAttributes.map(a=>a.id)).toEqual(['b','a'])
 expect(judge.data.branches.map(b=>b.weightFactors.map(f=>f.influence))).toEqual([['乙B','乙A'],['甲B','甲A']])
})
test('execution groups stay separate; duplicate outputs pointer reorder and JSON roundtrip',async({page})=>{
 await select(page,'template_result_1');await keyboardMove(page,'属性',0);await keyboardMove(page,'Buff',0)
 let config=(await state(page)).config,node=config.graph.nodes.find(n=>n.id==='template_result_1')
 expect(node.data.effectRules.map(r=>r.id)).toEqual(['b','b2','a','b1'])
 const list=page.getByLabel('产物排序',{exact:true});await list.scrollIntoViewIfNeeded()
 const handles=list.getByRole('button',{name:/拖动排序/}),from=await handles.nth(2).boundingBox(),to=await handles.nth(0).boundingBox()
 await page.mouse.move(from.x+12,from.y+12);await page.mouse.down();await page.mouse.move(to.x+12,to.y+12,{steps:15});await page.mouse.up()
 config=(await state(page)).config;node=config.graph.nodes.find(n=>n.id==='template_result_1');expect(node.data.outputs).toEqual(['末项','重复','重复',''])
 await list.getByRole('combobox',{name:'产物名'}).nth(1).fill('编辑第二项');node=(await state(page)).config.graph.nodes.find(n=>n.id==='template_result_1');expect(node.data.outputs).toEqual(['末项','编辑第二项','重复',''])
 const before=(await state(page)).config;await page.evaluate(async()=>{const {useBehaviorStore:g}=await import('/src/store/behaviorStore.js');g.getState().importConfig(g.getState().exportConfig())});const after=(await state(page)).config
 expect(after.graph.nodes).toEqual(before.graph.nodes);expect(after.behavior).toEqual(before.behavior)
})
test('pointer preview does not save, outside drop and node switch cancel; long lists scroll',async({page})=>{
 await select(page,'template_result_1')
 await page.evaluate(async()=>{const {useBehaviorStore:g}=await import('/src/store/behaviorStore.js');g.getState().updateNode('template_result_1',{outputs:Array.from({length:20},(_,i)=>'产物'+i)})})
 const handles=page.getByLabel('产物排序',{exact:true}).getByRole('button',{name:/拖动排序/})
 await handles.first().scrollIntoViewIfNeeded();const from=await handles.first().boundingBox(),before=await state(page)
 await page.mouse.move(from.x+12,from.y+12);await page.mouse.down();await page.mouse.move(from.x+12,from.y+30,{steps:5});await expect(page.locator('.sort-preview')).toBeVisible()
 expect(await state(page)).toEqual(before)
 const panel=page.locator('.property-panel .panel-content'),box=await panel.boundingBox(),scroll=await panel.evaluate(e=>e.scrollTop)
 await page.mouse.move(from.x+12,box.y+box.height-10,{steps:10});await expect.poll(()=>panel.evaluate(e=>e.scrollTop)).toBeGreaterThan(scroll)
 await page.mouse.move(300,200,{steps:5});await page.mouse.up();expect(await state(page)).toEqual(before)
 await handles.first().scrollIntoViewIfNeeded();const again=await handles.first().boundingBox();await page.mouse.move(again.x+12,again.y+12);await page.mouse.down();await page.mouse.move(again.x+12,again.y+30,{steps:5});await select(page,'template_judge');await page.mouse.up();expect((await state(page)).config).toEqual(before.config);await expect(page.locator('.sort-preview')).toHaveCount(0)
})
test('touch handle sorts outputs while duplicate text edits keep focus',async({page,context})=>{
 await select(page,'template_result_1');const list=page.getByLabel('产物排序',{exact:true}),inputs=list.getByRole('combobox',{name:'产物名'})
 await inputs.nth(2).fill('重复');await expect(inputs.nth(2)).toBeFocused();await inputs.nth(2).fill('末项')
 await list.scrollIntoViewIfNeeded();const handles=list.getByRole('button',{name:/拖动排序/}),from=await handles.nth(2).boundingBox(),to=await handles.first().boundingBox()
 const cdp=await context.newCDPSession(page),point=(x,y)=>[{x,y,id:1,radiusX:2,radiusY:2}]
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:point(from.x+12,from.y+12)})
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:point(from.x+12,from.y-10)});await expect(page.locator('.sort-preview')).toBeVisible()
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:point(to.x+12,to.y+12)})
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})
 expect((await state(page)).config.graph.nodes.find(n=>n.id==='template_result_1').data.outputs).toEqual(['末项','重复','重复',''])
})
