import assert from 'node:assert/strict'
import https from 'node:https'
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {createRequire} from 'node:module'
import {chromium} from '@playwright/test'
import {createFeishuAuth} from '../server/feishu-auth.mjs'
import {createPreviewServer} from '../server/cloud-preview.mjs'
import {SnapshotBehaviors} from '../server/snapshot-behaviors.mjs'
const [keyPath,certPath]=process.argv.slice(2)
if(!keyPath||!certPath)throw Error('Provide isolated test TLS key and certificate paths')
const dir=await mkdtemp(join(tmpdir(),'editor-browser-')),origin='https://localhost:5443'
await writeFile(join(dir,'members.json'),JSON.stringify([{open_id:'test-member',enabled:true,role:'viewer',version:'1'}]))
const auth=createFeishuAuth({origin,appId:'test-app',secret:'test-secret',tenant:'test-tenant',membersFile:join(dir,'members.json'),dbPath:join(dir,'auth.sqlite'),fetcher:async url=>new Response(JSON.stringify(url.endsWith('/token')?{code:0,access_token:'test-token'}:{code:0,data:{tenant_key:'test-tenant',open_id:'test-member',name:'Browser test'}}))})
const validator=createRequire(import.meta.url)('../server/generated/behavior-validation.cjs')
const app=createPreviewServer({origin,root:resolve('dist'),service:new SnapshotBehaviors({directory:'dist/data/behaviors',...validator}),libraryPath:'dist/data/library.json',authorize:auth.authorize})
const tls={key:await readFile(keyPath),cert:await readFile(certPath)}
const server=https.createServer(tls,(req,res)=>{const writeHead=res.writeHead;res.writeHead=function(status,headers){if(status===302&&headers?.Location?.startsWith('https://accounts.feishu.cn/')){const target=new URL(headers.Location);headers={...headers,Location:'https://127.0.0.1:5444/?state='+target.searchParams.get('state')}}return writeHead.call(this,status,headers)};app.listeners('request')[0](req,res)})
const provider=https.createServer(tls,(req,res)=>{const state=new URL(req.url,'https://127.0.0.1:5444').searchParams.get('state');res.setHeader('Content-Type','text/html');res.end('<a id="approve" href="'+origin+'/auth/feishu/callback?state='+state+'&amp;code=test-code">Approve test login</a>')})
let browser
try{
 await new Promise(r=>server.listen(5443,r))
 await new Promise(r=>provider.listen(5444,r))
 browser=await chromium.launch({channel:process.env.PW_CHANNEL||(process.platform==='win32'?'msedge':undefined)})
 const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}})
 // Reproduce a stylesheet failing independently while the HTML and JS load.
 await context.route('**/*.css',route=>route.abort('connectionreset'))
 const page=await context.newPage(),assets=[],errors=[]
 page.on('response',r=>{if(new URL(r.url()).pathname.startsWith('/assets/'))assets.push({path:new URL(r.url()).pathname,status:r.status(),type:r.headers()['content-type']})})
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
 await page.goto(origin+'/login')
 await page.locator('a[href="/auth/feishu/start"]').click()
 await page.locator('#approve').click()
 try{await page.waitForSelector('.app',{timeout:10000})}catch(e){console.log(JSON.stringify({assets,errors,path:new URL(page.url()).pathname,text:(await page.locator('body').innerText()).slice(0,700)}));throw e}
 await page.waitForTimeout(2000)
 const appearance=await page.evaluate(()=>({background:getComputedStyle(document.body).backgroundColor,styles:[...document.styleSheets].map(s=>s.href),inline:!!document.querySelector('style[data-cloud-styles]'),width:document.querySelector('.app').getBoundingClientRect().width,canvasHeight:document.querySelector('canvas')?.getBoundingClientRect().height||0}))
 console.log(JSON.stringify({assets,errors,appearance},null,2))
 if(process.env.AUTH_TEST_SCREENSHOT)await page.screenshot({path:process.env.AUTH_TEST_SCREENSHOT})
 await page.getByRole('button',{name:'行为设计',exact:true}).click()
 const firstUse=page.getByRole('button',{name:'暂用浏览器草稿'})
 if(await firstUse.isVisible())await firstUse.click()
 if(process.env.AUTH_TEST_SCREENSHOT)await page.screenshot({path:process.env.AUTH_TEST_SCREENSHOT.replace('.png','-editor.png')})
 await page.getByRole('button',{name:'退出飞书登录',exact:true}).click()
 await page.waitForSelector('a[href="/auth/feishu/start"]')
 assert.ok(appearance.inline,'Production CSS must arrive inside authenticated HTML')
 assert.equal(appearance.background,'rgb(5, 7, 12)','Production stylesheet must actually apply')
 assert.ok(appearance.canvasHeight>100,'Preview canvas must have usable height')
 console.log('PASS: real HTTPS browser OAuth redirect, authenticated production assets and computed page styles')
}finally{await browser?.close();await new Promise(r=>server.close(r));await new Promise(r=>provider.close(r));auth.close();await rm(dir,{recursive:true,force:true})}
