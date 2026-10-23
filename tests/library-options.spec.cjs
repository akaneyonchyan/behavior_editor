const {test,expect}=require('@playwright/test')
test('source and attribute options use published library and refresh names without injecting roles',async({page})=>{
 let name='伙伴角色',attribute='测试活力',time='2026-10-19T01:00:00Z'
 await page.route('**/data/library.json*',r=>r.fulfill({json:{syncedAt:time,library:{version:1,objects:[{id:'partner',name,description:'',enabled:true},{id:'hidden',name:'停用对象',description:'',enabled:false}],attributes:[{id:'energy',name:attribute,description:'',enabled:true,kind:'数值',objectTypes:['partner']}],buffs:[]}}}))
 await page.goto('/?view=editor');await page.getByRole('button',{name:'暂用浏览器草稿'}).click()
 const source=page.getByRole('combobox',{name:'对象大类',exact:true});await expect(source).toHaveValue('');await source.click()
 await expect(page.getByRole('option')).toHaveText(['伙伴角色']);await page.getByRole('option',{name:'伙伴角色',exact:true}).click()
 const property=page.getByRole('combobox',{name:'判断项',exact:true});await property.click();await expect(page.getByRole('option')).toHaveText(['测试活力']);await page.getByRole('option',{name:'测试活力',exact:true}).click()
 name='伙伴新名称';attribute='更新活力';time='2026-10-19T02:00:00Z'
 await page.evaluate(()=>window.dispatchEvent(new Event('online')))
 await expect(source).toHaveValue(name);await expect(property).toHaveValue(attribute)
 await source.click();await expect(page.getByRole('option')).toHaveText([name])
})

