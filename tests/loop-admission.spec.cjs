const {test,expect}=require('@playwright/test')
test('admission and rest are ordinary internal judgments, including disabled-stage preservation',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'暂用浏览器草稿'}).click()
 for(const admission of [false,true])for(const rest of [false,true]){
  await page.evaluate(async({admission,rest})=>{const {useBehaviorStore:g}=await import('/src/store/behaviorStore.js');const {blankTemplate}=await import('/tests/fixtures/legacyTemplate.js');const f=blankTemplate(),d=f.graph.nodes.find(n=>n.type==='loop').data;Object.assign(d,{admissionEnabled:admission,restEnabled:rest,resourceCheck:'自定义准入条件',restCondition:'自定义稍息条件'});g.getState().importConfig(f);g.getState().selectNode(g.getState().nodes.find(n=>n.id==='template_loop'))},{admission,rest})
  await expect(page.locator('.property-panel').getByLabel('结束条件 1 类型',{exact:true})).toBeVisible()
  await expect(page.getByLabel('启用准入检查')).toHaveCount(0)
  await expect(page.getByLabel('启用稍息判定')).toHaveCount(0)
  await expect(page.locator('[data-id=template_loop_admission]')).toHaveCount(admission?1:0)
  await expect(page.locator('[data-id=template_loop_rest]')).toHaveCount(rest?1:0)
  if(admission)await expect(page.locator('[data-id=template_loop_admission]')).toContainText('自定义准入条件')
  if(rest)await expect(page.locator('[data-id=template_loop_rest]')).toContainText('自定义稍息条件')
  const data=await page.evaluate(async()=>{const {useBehaviorStore:g}=await import('/src/store/behaviorStore.js');return g.getState().nodes.find(n=>n.type==='loop').data})
  expect(data.legacyLoopLogic.data.resourceCheck).toBe('自定义准入条件')
 }
})
