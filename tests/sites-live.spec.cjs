const {test,expect}=require('@playwright/test')
const {readFileSync}=require('node:fs')
const head='a'.repeat(40),nextHead='c'.repeat(40),sha='b'.repeat(40),name='在床上睡觉.json'
const text=readFileSync('behaviors/'+name,'utf8')
async function mock(page){
 const state={head,empty:false,requests:[]}
 await page.route('**/api/behaviors**',async route=>{
  const url=new URL(route.request().url());state.requests.push(url)
  if(url.pathname.endsWith('/file'))return route.fulfill({json:{text}})
  return route.fulfill({json:{version:1,head:state.head,branch:'master',source:'gitlab-live',files:state.empty?[]:[{name,sha,ref:state.head}]}})
 })
 return state
}
test('online list and preview share live directory; running version survives refresh',async({page})=>{
 const state=await mock(page)
 await page.goto('/?view=editor')
 await page.getByRole('button',{name:'暂用浏览器草稿'}).click()
 await page.getByRole('tab',{name:'在线',exact:true}).click()
 await expect(page.locator('.online-files .behavior-file')).toHaveCount(1)
 await expect(page.locator('.online-files')).toContainText('目录版本：aaaaaaaa')
 await expect(page.getByRole('button',{name:'上传文件',exact:true})).toHaveCount(0)
 await page.locator('.online-files .behavior-file').click()
 await expect(page.getByRole('region',{name:'在线行为只读画布'})).toBeVisible()
 await page.goto('/?view=preview')
 await expect(page.getByTestId('behavior-source')).toContainText('aaaaaaaa')
 await expect(page.getByRole('button',{name:'开始',exact:true})).toBeEnabled()
 state.head=nextHead
 await page.getByRole('button',{name:'开始',exact:true}).click()
 await expect(page.getByTestId('behavior-source')).toContainText('当前运行副本 cccccccc')
 state.head=head;state.empty=true
 await page.getByRole('button',{name:'刷新目录',exact:true}).click()
 await expect(page.getByTestId('behavior-source')).toContainText('目录 aaaaaaaa')
 await expect(page.getByTestId('behavior-source')).toContainText('当前运行副本 cccccccc')
 await page.getByRole('button',{name:'重置',exact:true}).click()
 await page.getByRole('button',{name:'刷新目录',exact:true}).click()
 await expect(page.getByRole('button',{name:'开始',exact:true})).toBeDisabled()
 await expect(page.getByText('仓库 behaviors 目录暂无行为图，请在 GitLab 合并行为文件后刷新。')).toBeVisible()
 expect(state.requests.filter(u=>u.pathname.endsWith('/file')).every(u=>[head,nextHead].includes(u.searchParams.get('ref')))).toBe(true)
})
test('initial empty directory does not select an old graph',async({page})=>{
 const state=await mock(page);state.empty=true
 await page.goto('/?view=preview')
 await expect(page.getByRole('button',{name:'开始',exact:true})).toBeDisabled()
 await expect(page.getByText('仓库 behaviors 目录暂无行为图，请在 GitLab 合并行为文件后刷新。')).toBeVisible()
 expect(state.requests.filter(u=>u.pathname.endsWith('/file'))).toHaveLength(0)
 state.empty=false
 await page.getByRole('button',{name:'刷新目录',exact:true}).click()
 await expect(page.getByRole('button',{name:'开始',exact:true})).toBeEnabled()
})
