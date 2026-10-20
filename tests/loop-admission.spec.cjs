
const {test,expect}=require('@playwright/test')
test('admission and rest switches retain edges and show exactly one continue output',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'暂用浏览器草稿'}).click()
 await page.evaluate(async()=>{const {useBehaviorStore:g}=await import('/src/store/behaviorStore.js');g.getState().setBranchDestination('template_loop','insufficient','node','template_end');g.getState().selectNode(g.getState().nodes.find(n=>n.id==='template_loop'))})
 const node=page.locator('[data-id=template_loop]')
 const edges=()=>page.evaluate(async()=>{const {useBehaviorStore:g}=await import('/src/store/behaviorStore.js');return g.getState().edges})
 const before=await edges()
 await page.getByLabel('准入条件检查',{exact:true}).fill('自定义准入条件')
 for(const admission of [false,true])for(const rest of [false,true]){
  await page.getByRole('checkbox',{name:'启用准入检查'}).setChecked(admission)
  await page.getByRole('checkbox',{name:'启用稍息判定'}).setChecked(rest)
  await expect(node.locator('[data-handleid=insufficient]')).toHaveCount(admission?1:0)
  await expect(node.locator('[data-handleid=rest]')).toHaveCount(rest?1:0)
  await expect(node.locator('[data-handleid=continue]')).toHaveCount(1)
  expect(await edges()).toEqual(before)
  const failure=before.find(e=>e.source==='template_loop'&&e.sourceHandle==='insufficient')
  await expect(page.getByTestId('rf__edge-'+failure.id)).toHaveCount(admission?1:0)
 }
 await expect(page.getByLabel('准入条件检查',{exact:true})).toHaveValue('自定义准入条件')
})
