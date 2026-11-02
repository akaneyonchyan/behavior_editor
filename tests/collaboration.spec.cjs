const {test,expect}=require('@playwright/test')
const {readFileSync,readdirSync}=require('node:fs')
const name=readdirSync('behaviors').find(n=>n.endsWith('.json')),text=readFileSync('behaviors/'+name,'utf8')
const validation=require('../server/generated/behavior-validation.cjs')
let server,address,config,saves,rooms
test.beforeAll(async()=>{
 const {CollaborationRooms}=await import('../server/collaboration-rooms.mjs'),{collaborationServer}=await import('../server/collaboration-service.mjs')
 config=validation.parseBehavior(text);saves=[];const memory=new Map()
 rooms=new CollaborationRooms({repository:{load:async()=>({config,sha:'base',commit:'base'}),save:async(name,base,next)=>{saves.push(next);return {config:next,sha:'new',commit:'new'}}},storage:{load:async n=>memory.get(n),save:async(n,v)=>memory.set(n,structuredClone(v))},validate:c=>validation.parseBehavior(JSON.stringify(c))})
 const tokenUsers=new Set()
 const auth={handle:async(user,input)=>{
  if(input.action==='authToken'){if(input.token!=='browser-test-only-token')throw Object.assign(new Error('测试 Token 无效'),{status:401});tokenUsers.add(user.id)}
  if(input.action==='authForget')tokenUsers.delete(user.id)
  const authorized=user.id!=='token-user'||tokenUsers.has(user.id)
  return {configured:true,authorized,canEdit:authorized&&user.id!=='readonly',name:user.name,credentialOwner:user.id}
 },authorize:async user=>{if(user.id==='readonly'||(user.id==='token-user'&&!tokenUsers.has(user.id)))throw Object.assign(new Error('无写权限'),{status:403});return {user}}}
 server=collaborationServer({rooms,auth,secret:'test-browser-service-secret-32-characters',validateFileName:validation.validateFileName})
 await new Promise(r=>server.listen(0,'127.0.0.1',r));address='http://127.0.0.1:'+server.address().port+'/rpc'
})
test.afterAll(async()=>{await new Promise(r=>server.close(r))})
// Each browser scenario owns its sessions; closing a browser need not deliver leave.
test.beforeEach(()=>{rooms.rooms.clear()})
async function open(page,user){
 const checks=[]
 await page.route('**/api/behaviors**',route=>route.fulfill({json:route.request().url().includes('/file?')?{text}:{head:'a'.repeat(40),branch:'master',files:[{name,sha:'b'.repeat(40),ref:'a'.repeat(40)}]}}))
 await page.route('**/api/collaboration',async route=>{
  const body=route.request().postDataJSON(),response=await fetch(address,{method:'POST',headers:{Authorization:'Bearer test-browser-service-secret-32-characters','Content-Type':'application/json'},body:JSON.stringify({...body,user})})
  if(['authStatus','authToken'].includes(body.input?.action))checks.push(body.input.action)
  await route.fulfill({status:response.status,body:await response.text(),contentType:'application/json'})
 })
 await page.goto('/?view=editor');await page.getByRole('button',{name:'暂用浏览器草稿'}).click()
 await page.getByRole('tab',{name:'在线',exact:true}).click();await page.locator('.online-files .behavior-file').first().click()
 if(['readonly','token-user'].includes(user.id)){await expect(page.getByRole('button',{name:'共同编辑',exact:true})).toBeDisabled();return checks}
 await expect(page.locator('.collab-header')).toContainText(/已保存到 GitLab|已同步共享草稿/)
 await expect(page.locator('.app-main > .collab-workspace')).toBeVisible()
 await expect(page.locator('.collab-dialog')).toHaveCount(0)
 await expect(page.locator('.app')).not.toHaveAttribute('inert','')
 await expect(page.locator('.behavior-sidebar')).toBeVisible()
 await expect(page.locator('.document-actions').getByRole('button',{name:'保存到 GitLab',exact:true})).toBeEnabled()
}
test('direct mode reads and writes in browser; Worker verifies and backend never receives PAT',async({page})=>{
 const {collaborationProxy}=await import('../server/collaboration-proxy.mjs')
 const {CollaborationRooms}=await import('../server/collaboration-rooms.mjs')
 const {collaborationServer}=await import('../server/collaboration-service.mjs')
 let document=validation.parseBehavior(text),sha='a'.repeat(40),commit='b'.repeat(40),browserWrites=0,workerWrites=0
 const secret='browser-direct-test-service-secret-32-characters',token='direct-browser-test-token',user={id:'direct-browser',name:'SSO'}
 const storage=new Map(),directRooms=new CollaborationRooms({storage:{load:async n=>storage.get(n),save:async(n,s)=>storage.set(n,structuredClone(s))},validate:c=>validation.parseBehavior(JSON.stringify(c))})
 const backend=collaborationServer({rooms:directRooms,direct:true,secret,validateFileName:validation.validateFileName})
 await new Promise(r=>backend.listen(0,'127.0.0.1',r))
 const endpoint='http://127.0.0.1:'+backend.address().port+'/rpc'
 async function gitlab(url,method,headers,body){
  expect(new Headers(headers).get('private-token')).toBe(token)
  if(url.endsWith('/user'))return {id:9,name:'直连同事'}
  if(url.endsWith('/personal_access_tokens/self'))return {active:true,scopes:['api','write_repository']}
  if(url.endsWith('/branches/master'))return {can_push:true,commit:{id:commit}}
  if(url.includes('/repository/tree'))return new URL(url).searchParams.has('path')?[{name,id:sha,type:'blob',mode:'100644'}]:[{name:'β行为图',type:'tree'}]
  if(url.includes('/repository/files/')){
   if(method==='PUT'){expect(body.last_commit_id).toBe(commit);document=JSON.parse(body.content);sha='c'.repeat(40);commit='d'.repeat(40);return {}}
   const value=JSON.stringify(document);return {encoding:'base64',size:Buffer.byteLength(value),content:Buffer.from(value).toString('base64'),blob_id:sha,last_commit_id:commit}
  }
  return {id:1}
 }
 try{
  await page.route('https://git.xindong.com/**',async route=>{const r=route.request();if(r.method()==='PUT')browserWrites++;await route.fulfill({headers:{'Access-Control-Allow-Origin':'*'},json:await gitlab(r.url(),r.method(),r.headers(),r.postData()?r.postDataJSON():null)})})
  await page.route('**/api/behaviors**',route=>route.fulfill({json:route.request().url().includes('/file?')?{text}:{head:commit,branch:'master',files:[{name,sha,ref:commit}]}}))
  let releaseLock
  const lockGate=new Promise(resolve=>{releaseLock=resolve})
  await page.route('**/api/collaboration',async route=>{
   if(route.request().postDataJSON().input?.action==='lock')await lockGate
   const relay=async r=>{
    if(new URL(r.url).host==='git.xindong.com'){if(r.method!=='GET')workerWrites++;return Response.json(await gitlab(r.url,r.method,r.headers,null))}
    const data=await r.text();expect(data).not.toContain(token);return fetch(endpoint,{method:'POST',headers:r.headers,body:data})
   }
   const request=route.request(),r=await collaborationProxy(new Request(request.url(),{method:'POST',headers:{origin:new URL(request.url()).origin},body:request.postData()}),{COLLAB_SERVICE_URL:'https://direct-backend.test/rpc',COLLAB_SERVICE_TOKEN:secret},user,{officeNet:{fetch:relay}},validation,relay)
   await route.fulfill({status:r.status,body:await r.text(),contentType:'application/json'})
  })
  await page.goto('/?view=editor');await page.getByRole('button',{name:'暂用浏览器草稿'}).click()
  await page.getByRole('tab',{name:'在线',exact:true}).click()
  await page.getByLabel('个人 GitLab API Token').fill(token);await page.getByRole('button',{name:'验证',exact:true}).click()
  await expect(page.getByLabel('GitLab 个人权限')).toContainText('已验证 直连同事')
  await page.locator('.online-files .behavior-file').first().click()
  await expect(page.locator('.collab-header')).toContainText('已保存到 GitLab')
  const id=document.graph.nodes.find(n=>n.type!=='start').id
  await page.locator('.collab-canvas .react-flow__node[data-id="'+id+'"]').click()
  await expect(page.locator('.collab-properties')).toContainText('正在获取此节点编辑权')
  await expect(page.locator('.collab-properties input[placeholder$="节点"]').first()).toBeVisible()
  await expect(page.locator('.collab-properties [aria-disabled=true]')).toHaveAttribute('inert','')
  releaseLock()
  await expect(page.locator('.collab-properties')).toContainText('你已获得此节点编辑权')
  await page.locator('.collab-properties input[placeholder$="节点"]').first().fill('浏览器直写验证')
  await expect(page.locator('.collab-header')).toContainText('已同步共享草稿')
  await page.getByRole('button',{name:'保存到 GitLab',exact:true}).click()
  await expect(page.locator('.collab-header')).toContainText('已保存到 GitLab')
  expect(browserWrites).toBe(1);expect(workerWrites).toBe(0)
  expect(document.graph.nodes.find(n=>n.id===id).data.name).toBe('浏览器直写验证')
  await page.getByRole('button',{name:'退出协作'}).click()
  await page.getByRole('button',{name:'进入在线编辑',exact:true}).click()
  await expect(page.locator('.collab-properties')).toBeVisible()
  await page.getByRole('button',{name:'退出协作'}).click()
 }finally{await new Promise(r=>backend.close(r))}
})
test('two users: exclusive nodes, independent changes, visible cursors, shared save and isolated local draft',async({browser})=>{
 const ca=await browser.newContext(),cb=await browser.newContext(),a=await ca.newPage(),b=await cb.newPage(),errors=[]
 a.on('pageerror',e=>errors.push(e.message));b.on('pageerror',e=>errors.push(e.message))
 await open(a,{id:'a',name:'策划甲'});await open(b,{id:'b',name:'策划乙'})
 await expect(a.locator('.collab-people')).toContainText('2 人在线')
 const nodes=config.graph.nodes.filter(n=>n.type!=='start'),first=nodes[0],second=nodes[1]
 const select=async(page,id)=>{await page.locator('.collab-canvas .react-flow__node[data-id="'+id+'"]').click()}
 await select(a,first.id);await expect(a.locator('.collab-properties')).toContainText('你已获得此节点编辑权')
 await select(b,first.id);await expect(b.getByRole('alert')).toContainText('策划甲 正在编辑此节点')
 await b.getByRole('button',{name:'知道了'}).click()
 await select(b,second.id);await expect(b.locator('.collab-properties')).toContainText('你已获得此节点编辑权')
 const input=page=>page.locator('.collab-properties input[placeholder$="节点"]').first()
 await input(a).fill('甲的实时修改');await input(b).fill('乙的实时修改')
 await expect(a.locator('.collab-canvas')).toContainText('乙的实时修改');await expect(b.locator('.collab-canvas')).toContainText('甲的实时修改')
 const remoteNode=b.locator('.collab-canvas .react-flow__node[data-id="'+first.id+'"]'),oldTransform=await remoteNode.evaluate(el=>el.style.transform)
 const box=await a.locator('.collab-canvas .react-flow__node[data-id="'+first.id+'"] .node-header').boundingBox()
 await a.mouse.move(box.x+box.width/2,box.y+box.height/2);await a.mouse.down();await a.mouse.move(box.x+box.width/2+70,box.y+box.height/2+40,{steps:10});await a.mouse.up()
 await expect.poll(()=>remoteNode.evaluate(el=>el.style.transform)).not.toBe(oldTransform)
 await a.locator('.collab-canvas').hover({position:{x:200,y:200}})
 await expect(b.getByTestId('remote-cursor')).toContainText('策划甲')
 await expect(a.locator('.collab-header')).toContainText('已同步共享草稿')
 await a.keyboard.press('Control+s');await expect(b.locator('.collab-header')).toContainText('已保存到 GitLab')
 expect(saves.length).toBe(1);expect(saves[0].graph.nodes.find(n=>n.id===first.id).data.name).toBe('甲的实时修改')
 const nodeCount=await b.locator('.collab-canvas .react-flow__node').count()
 await a.screenshot({path:test.info().outputPath('inline-editor.png')})
 await a.locator('.palette-node').first().click()
 await expect(b.locator('.collab-canvas .react-flow__node')).toHaveCount(nodeCount+1)
 await expect(a.locator('.collab-header')).toContainText('已同步共享草稿')
 await a.getByRole('tab',{name:'本地',exact:true}).click()
 await expect(a.locator('.collab-workspace')).toHaveCount(0)
 await expect(a.locator('.canvas')).not.toContainText('甲的实时修改')
 expect(errors).toEqual([])
 await ca.close();await cb.close()
})
test('keyboard selection switches the execution panel and acquires its visible lock',async({page})=>{
 await open(page,{id:'keyboard-editor',name:'键盘编辑者'})
 const execution=config.graph.nodes.find(n=>n.type==='result')
 const node=page.locator('.collab-canvas .react-flow__node[data-id="'+execution.id+'"]')
 await node.focus();await page.keyboard.press('Enter')
 await expect(page.locator('.collab-properties .panel-title')).toContainText('执行节点')
 await expect(node.locator('.collab-node-owner')).toContainText('我正在编辑')
 await expect(page.locator('.collab-properties')).toContainText('你已获得此节点编辑权')
 const next=config.graph.nodes.find(n=>n.type==='result'&&n.id!==execution.id)
 const nextNode=page.locator('.collab-canvas .react-flow__node[data-id="'+next.id+'"]')
 await nextNode.focus();await page.keyboard.press('Enter')
 await expect(nextNode.locator('.collab-node-owner')).toContainText('我正在编辑')
 await expect(node.locator('.collab-node-owner')).toHaveCount(0)
 await page.locator('.collab-canvas .react-flow__pane').click({position:{x:10,y:10}})
 await expect(page.locator('.collab-node-owner')).toHaveCount(0)
 await page.getByRole('button',{name:'退出协作'}).click()
})

test('online tab rechecks GitLab rights; read-only users cannot bypass the server',async({page})=>{
 const user={id:'readonly',name:'只读同事'},checks=await open(page,user)
 await expect(page.getByLabel('GitLab 个人权限')).toContainText('无 master 写权限')
 await page.getByRole('tab',{name:'本地',exact:true}).click()
 await page.getByRole('tab',{name:'在线',exact:true}).click()
 await expect.poll(()=>checks.length).toBe(2)
 await expect(page.getByRole('button',{name:'共同编辑',exact:true})).toBeDisabled()
 const response=await fetch(address,{method:'POST',headers:{Authorization:'Bearer test-browser-service-secret-32-characters','Content-Type':'application/json'},body:JSON.stringify({name,user,input:{action:'join'}})})
 expect(response.status).toBe(403)
})
test('personal token is encrypted locally, restored after reload and cleared explicitly',async({page})=>{
 const checks=await open(page,{id:'token-user',name:'个人 Token 同事'})
 const gate=page.getByLabel('GitLab 个人权限')
 await expect(gate.locator('.gitlab-access-actions button')).toHaveCount(1)
 await expect(gate.getByRole('button',{name:'验证',exact:true})).toBeVisible()
 await gate.getByRole('button',{name:'收起',exact:true}).click()
 await expect(page.getByLabel('个人 GitLab API Token')).toBeHidden()
 await expect(gate.locator('[role=status]')).toBeHidden()
 await gate.getByRole('button',{name:'展开',exact:true}).click()
 await page.getByLabel('个人 GitLab API Token').fill('browser-test-only-token')
 await page.getByRole('button',{name:'验证',exact:true}).click()
 await expect(page.getByRole('button',{name:'共同编辑',exact:true})).toBeEnabled()
 await expect(page.getByLabel('个人 GitLab API Token')).toHaveValue('')
 await expect(page.getByLabel('个人 GitLab API Token')).toBeHidden()
 await gate.getByRole('button',{name:'展开',exact:true}).click()
 await expect(page.getByLabel('GitLab 个人权限')).toContainText('本浏览器已记住凭据')
 await expect(gate.locator('.gitlab-access-actions button')).toHaveCount(2)
 await expect(gate.getByRole('button',{name:'验证',exact:true})).toHaveCount(0)
 await expect(gate.getByRole('button',{name:'重新验证权限',exact:true})).toBeVisible()
 const record=await page.evaluate(async()=>{
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('pps-gitlab-credentials-v1');r.onsuccess=()=>resolve(r.result);r.onerror=reject})
  const value=await new Promise((resolve,reject)=>{const r=db.transaction('credentials').objectStore('credentials').get('token-user');r.onsuccess=()=>resolve(r.result);r.onerror=reject});db.close()
  return {extractable:value.key.extractable,cipher:value.cipher instanceof ArrayBuffer,plaintext:JSON.stringify(value).includes('browser-test-only-token'),local:JSON.stringify(localStorage).includes('browser-test-only-token'),session:JSON.stringify(sessionStorage).includes('browser-test-only-token')}
 })
 expect(record).toEqual({extractable:false,cipher:true,plaintext:false,local:false,session:false})
 const before=checks.filter(x=>x==='authToken').length
 await page.reload();await page.getByRole('tab',{name:'在线',exact:true}).click()
 await expect.poll(()=>checks.filter(x=>x==='authToken').length).toBe(before+1)
 await page.locator('.online-files .behavior-file').first().click()
 await expect(page.locator('.collab-properties')).toBeVisible()
 await page.getByRole('button',{name:'退出协作'}).click()
 await expect(page.getByRole('button',{name:'共同编辑',exact:true})).toBeEnabled()
 await expect(page.getByLabel('个人 GitLab API Token')).toBeHidden()
 await gate.getByRole('button',{name:'展开',exact:true}).click()
 await page.getByRole('button',{name:'清除本机凭据',exact:true}).click()
 await expect(page.getByRole('button',{name:'共同编辑',exact:true})).toBeDisabled()
 await expect(page.getByText('本浏览器已记住凭据；换设备需重新输入。')).toHaveCount(0)
 await expect(gate.locator('.gitlab-access-actions button')).toHaveCount(1)
 const after=checks.filter(x=>x==='authToken').length
 await page.getByRole('tab',{name:'本地',exact:true}).click();await page.getByRole('tab',{name:'在线',exact:true}).click()
 await expect(page.getByRole('button',{name:'验证',exact:true})).toBeVisible()
 expect(checks.filter(x=>x==='authToken').length).toBe(after)
})
