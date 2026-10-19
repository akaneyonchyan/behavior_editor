import assert from 'node:assert/strict'
import {FeishuRepository} from '../server/feishu.mjs'
const env={FEISHU_APP_ID:'test',FEISHU_APP_SECRET:'test',FEISHU_OBJECT_TABLE:'tblObjects',FEISHU_ATTRIBUTE_TABLE:'tblAttributes',FEISHU_BUFF_TABLE:'tblBuffs'}
let map='tblFood',bad=false,pagination=false
const fetcher=async(url)=>{
 if(url.includes('tenant_access_token'))return Response.json({code:0,tenant_access_token:'test',expire:7200})
 let items=[],has_more=false,page_token
 if(url.includes('tblObjects/'))items=[{record_id:'recFood',fields:{名称:'食物',标识:'food',启用:true,对象表ID:map}}]
 if(url.includes('tblFood/')){
   const second=url.includes('page_token=next')
   items=[{record_id:second?'rec2':'rec1',fields:{名称:bad?'':second?'梨':'苹果',标识:second?'pear':'apple',启用:true}}]
   has_more=pagination&&!second;page_token=has_more?'next':undefined
 }
 return Response.json({code:0,data:{items,has_more,page_token}})
}
const read=()=>{const repo=new FeishuRepository(env,fetcher);repo.tables={objects:'tblObjects',attributes:'tblAttributes',buffs:'tblBuffs'};return repo.read()}
assert.deepEqual((await read()).library.items,[{id:'food/apple',objectType:'food',name:'苹果',description:'',enabled:true}])
pagination=true;assert.equal((await read()).library.items.length,2)
map='';assert.deepEqual((await read()).library.items,[])
map='tblObjects';await assert.rejects(read,/对象表ID/)
map='not-a-table';await assert.rejects(read,/对象表ID/)
map='tblFood';bad=true;await assert.rejects(read,/名称/)
console.log('PASS: mapped Feishu catalogs, pagination, old base compatibility, invalid mapping and malformed rows block publication')
