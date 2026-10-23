const {test,expect}=require('@playwright/test')
test('cyclic local retries stay horizontal; re-layout replaces cached vertical coordinates',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('pps-canvas-view','structure'))
 await page.goto('/?view=editor');await page.getByRole('button',{name:'暂用浏览器草稿'}).click()
 await page.evaluate(async()=>{
  const {useBehaviorStore:s}=await import('/src/store/behaviorStore.js')
  const c=s.getState().exportConfig();c.graph.nodes.push({id:'retry',type:'wait',position:{x:0,y:0},data:{}})
  c.graph.layout.scopes[0].members.push('retry')
  c.graph.edges.find(e=>e.source==='template_result_1').target='retry'
  c.graph.edges.push({id:'retryback',source:'retry',target:'template_result_1'})
  c.graph.layout.positions={template_judge:{x:120,y:200},template_result_1:{x:120,y:800},retry:{x:120,y:1200}}
  s.getState().importConfig(c)
 })
 await page.getByRole('button',{name:'重新排布',exact:true}).click()
 await expect.poll(()=>page.evaluate(()=>{
  const x=id=>document.querySelector('[data-id="'+id+'"]').getBoundingClientRect().x
  return x('template_judge')<x('template_result_1')&&x('template_result_1')<x('retry')
 })).toBe(true)
 const data=await page.evaluate(async()=>{const {useBehaviorStore:s}=await import('/src/store/behaviorStore.js');return s.getState().exportConfig()})
 expect(data.graph.edges.some(e=>e.id==='retryback'||e.source==='retry'&&e.target==='template_result_1')).toBe(true)
 expect(data.graph.layout.positions).toEqual({})
})

