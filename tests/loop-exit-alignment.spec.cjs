const {test,expect}=require('@playwright/test')
test('loop exits follow measured branch handles, dragging, nested collapse and expanded PNG',async({page},info)=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message))
 await page.addInitScript(()=>localStorage.setItem('pps-canvas-view','structure'))
 await page.route('**/data/library.json*',r=>r.fulfill({json:{syncedAt:new Date().toISOString(),library:{version:1,objects:[],attributes:[],buffs:[]}}}))
 await page.goto('/?view=editor');await page.getByRole('button',{name:'暂用浏览器草稿'}).click()
 await page.evaluate(async()=>{
  const {useBehaviorStore:s}=await import('/src/store/behaviorStore.js'),{NODE_CONFIG}=await import('/src/constants/behaviorTypes.js')
  const node=(id,type)=>({id,type,position:{x:0,y:0},data:{...structuredClone(NODE_CONFIG[type].defaultData),name:id}})
  const nodes=[node('start','start'),node('outer','loop'),node('inner','loop'),node('judge','judge'),node('result','result'),node('outside','result')]
  nodes.find(n=>n.id==='judge').data.branches=[{id:'one',name:'第一个出口'},{id:'two',name:'第二个出口：较长的说明文本，用于验证分支自身高度变化'}]
  s.getState().importConfig({behavior:{name:'出口对齐回归'},graph:{nodes,edges:[{id:'start-edge',source:'start',target:'outer'},{id:'outer-entry',source:'outer',sourceHandle:'continue',target:'inner'},{id:'inner-entry',source:'inner',sourceHandle:'continue',target:'judge'},{id:'one',source:'judge',sourceHandle:'one',target:'outside'},{id:'two',source:'judge',sourceHandle:'two',target:'outside'},{id:'result-exit',source:'result',target:'outside'}],layout:{version:1,scopes:[{loopId:'outer',entry:'inner',members:['inner','judge','result']},{loopId:'inner',entry:'judge',members:['judge']}],positions:{result:{x:800,y:800}}}}})
 })
 const ids=await page.evaluate(async()=>{const {useBehaviorStore:s}=await import('/src/store/behaviorStore.js');return Object.fromEntries(s.getState().edges.filter(e=>e.target==='outside').map(e=>[e.sourceHandle||'result-exit',e.id]))})
 const center=selector=>page.locator(selector).evaluate(el=>{const r=el.getBoundingClientRect();return r.y+r.height/2})
 const handle=(id,port)=>`[data-id="${id}"] .react-flow__handle.source${port?`[data-handleid="${port.startsWith('exit:')?'exit:'+ids[port.slice(5)]:port}"]`:''}`
 const aligned=async(source,targets)=>{for(const target of targets)await expect.poll(async()=>Math.abs(await center(source)-await center(target))).toBeLessThan(1)}
 const verify=async()=>{
  for(const port of ['one','two'])await aligned(handle('judge',port),[handle('__scope_inner','exit:'+port),handle('__scope_outer','exit:'+port),`[data-id="__scope_inner__exit_${ids[port]}"] .react-flow__handle.target`,`[data-id="__scope_outer__exit_${ids[port]}"] .react-flow__handle.target`])
  await aligned(handle('result'),[handle('__scope_outer','exit:result-exit')])
 }
 await verify()
 const header=await page.locator('[data-id=result] .node-header').boundingBox()
 await page.mouse.move(header.x+35,header.y+10);await page.mouse.down();await page.mouse.move(header.x+35,header.y-10,{steps:12})
 await aligned(handle('result'),[handle('__scope_outer','exit:result-exit')])
 await page.mouse.up();await verify()
 await page.getByRole('button',{name:'撤销',exact:true}).click();await verify()
 await page.getByRole('button',{name:'折叠循环 inner',exact:true}).click()
 for(const port of ['one','two'])await aligned(handle('__scope_inner','exit:'+port),[handle('__scope_outer','exit:'+port)])
 await page.getByRole('button',{name:'展开循环 inner',exact:true}).click();await verify()
 await page.evaluate(async()=>{const {useBehaviorStore:s}=await import('/src/store/behaviorStore.js');s.getState().updateNode('judge',{description:'新增说明，改变节点高度并使分支出口同步移动。'.repeat(10)})})
 await verify()
 await page.screenshot({path:info.outputPath('aligned-loop-exits.png')})
 const snapshotDelta=await page.evaluate(async()=>{
  const {structureSnapshot}=await import('/src/components/structureSnapshot.jsx'),{useBehaviorStore:s}=await import('/src/store/behaviorStore.js')
  const snap=await structureSnapshot(s.getState());try{
   const y=selector=>{const r=snap.source.querySelector(selector).getBoundingClientRect();return r.y+r.height/2}
   const edge=s.getState().edges.find(e=>e.source==='judge'&&e.sourceHandle==='two')
   return Math.abs(y('[data-id=judge] [data-handleid=two]')-y('[data-id=__scope_outer] [data-handleid="exit:'+edge.id+'"]'))
  }finally{snap.dispose()}
 })
 expect(snapshotDelta).toBeLessThan(1);expect(errors).toEqual([])
})
