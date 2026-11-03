const {test,expect}=require('@playwright/test')
test('downstream loops follow source exits after reflow, collapse and reload',async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.addInitScript(()=>localStorage.setItem('pps-canvas-view','structure'))
 await page.route('**/data/library.json*',r=>r.fulfill({json:{syncedAt:new Date().toISOString(),library:{version:1,objects:[],attributes:[],buffs:[]}}}))
 await page.goto('/?view=editor');await page.getByRole('button',{name:'暂用浏览器草稿'}).click()
 await page.evaluate(async()=>{
  const {useBehaviorStore:s}=await import('/src/store/behaviorStore.js'),{NODE_CONFIG}=await import('/src/constants/behaviorTypes.js')
  const node=(id,type)=>({id,type,position:{x:0,y:0},data:{...structuredClone(NODE_CONFIG[type].defaultData),name:id}})
  const nodes=[node('start','start'),node('source','loop'),node('judge','judge'),node('low','result'),node('mid','result'),node('high','result'),node('c','loop'),node('b','loop'),node('a','loop')]
  nodes.find(n=>n.id==='judge').data.branches=[{id:'high',name:'上方分支'},{id:'mid',name:'中间分支'},{id:'low',name:'下方分支'}]
  const edges=[{source:'start',target:'source'},{source:'source',sourceHandle:'continue',target:'judge'},...['low','mid','high'].map(id=>({source:'judge',sourceHandle:id,target:id})),...['low','mid','high'].map((id,i)=>({source:id,target:['c','b','a'][i]}))].map((e,i)=>({...e,id:'edge-'+i}))
  s.getState().importConfig({behavior:{name:'循环出口排序回归'},graph:{nodes,edges,layout:{version:1,scopes:[{loopId:'source',entry:'judge',members:['judge','low','mid','high']},...['a','b','c'].map(loopId=>({loopId,entry:'',members:[]}))],positions:{__scope_c:{x:1600,y:0},__scope_b:{x:1600,y:450},__scope_a:{x:1600,y:900}}}}})
 })
 const order=()=>page.evaluate(()=>['a','b','c'].map(id=>({id,y:document.querySelector('[data-id=__scope_'+id+']').getBoundingClientRect().y})).sort((a,b)=>a.y-b.y).map(n=>n.id))
 await expect.poll(order).toEqual(['c','b','a'])
 await page.getByRole('button',{name:'重新排布',exact:true}).click()
 await expect.poll(order).toEqual(['a','b','c'])
 // Compare actual rendered source/boundary and target order, not just arrays.
 const crossings=()=>page.evaluate(async()=>{
  const {useBehaviorStore:s}=await import('/src/store/behaviorStore.js')
  const pairs=s.getState().edges.filter(e=>['a','b','c'].includes(e.target)).map(e=>{
   const source=document.querySelector('[data-id=__scope_source] [data-handleid="exit:'+e.id+'"]'),target=document.querySelector('[data-id=__scope_'+e.target+'] [data-handleid=in]')
   return {source:source.getBoundingClientRect().y,target:target.getBoundingClientRect().y}
  })
  return pairs.some((a,i)=>pairs.slice(i+1).some(b=>(a.source-b.source)*(a.target-b.target)<0))
 })
 await expect.poll(crossings).toBe(false)
 await page.screenshot({path:info.outputPath('ordered-loop-targets.png')})
 await page.getByRole('button',{name:'折叠循环 source',exact:true}).click()
 await expect.poll(crossings).toBe(false)
 await page.getByRole('button',{name:'展开循环 source',exact:true}).click()
 await expect.poll(order).toEqual(['a','b','c']);await expect.poll(crossings).toBe(false)
 await page.evaluate(async()=>{const {flushDraft}=await import('/src/store/documentSession.js');flushDraft()})
 await page.reload();await expect(page.locator('[data-id=__scope_a]')).toBeVisible();await expect.poll(order).toEqual(['a','b','c']);await expect.poll(crossings).toBe(false)
 expect(errors).toEqual([])
})
