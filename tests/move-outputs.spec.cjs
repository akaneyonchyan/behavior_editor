const {test,expect}=require('@playwright/test')
test('move has two outputs, preserves legacy success and restricts failure to endings',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'暂用浏览器草稿'}).click()
 const move=page.locator('[data-id=template_move]');await expect(move.locator('.react-flow__handle.source')).toHaveCount(2)
 await expect(move).toContainText('目的地可达');await expect(move).toContainText('目的地不可达')
 await move.click();const select=page.getByLabel('位移不可达结束节点');await expect(select).toHaveValue('template_interrupted')
 await select.selectOption('template_end');await expect(select).toHaveValue('template_end')
 const checks=await page.evaluate(async()=>{
  const {useBehaviorStore:g}=await import('/src/store/behaviorStore.js');const s=()=>g.getState()
  s().undo();const undo=s().edges.find(e=>e.source==='template_move'&&e.sourceHandle==='unreachable').target==='template_interrupted'
  s().redo();const redo=s().edges.find(e=>e.source==='template_move'&&e.sourceHandle==='unreachable').target==='template_end'
  const before=JSON.stringify(s().edges);s().connect({source:'template_move',sourceHandle:'unreachable',target:'template_judge'});const rejected=before===JSON.stringify(s().edges)
  s().addNode({id:'new_move',type:'move',position:{x:0,y:700},data:{}});const reused=s().edges.some(e=>e.source==='new_move'&&e.sourceHandle==='unreachable'&&e.target==='template_end')
  const config=s().exportConfig();s().importConfig(config);const roundtrip=s().edges.some(e=>e.source==='template_move'&&e.sourceHandle==='unreachable'&&e.target==='template_end')
  const legacy=s().exportConfig();legacy.graph.edges=legacy.graph.edges.filter(e=>e.sourceHandle!=='unreachable');s().importConfig(legacy);const oldSuccess=s().edges.some(e=>e.source==='template_move'&&!e.sourceHandle&&e.target==='template_judge')
  const bad=s().exportConfig();bad.graph.edges.push({id:'bad',source:'template_move',sourceHandle:'unreachable',target:'template_judge'});let invalid=false;try{s().importConfig(bad)}catch{invalid=true}
  return {undo,redo,rejected,reused,roundtrip,oldSuccess,invalid}
 });expect(Object.values(checks).every(Boolean)).toBe(true)
 await expect(move.locator('.react-flow__handle.source')).toHaveCount(2)
})
