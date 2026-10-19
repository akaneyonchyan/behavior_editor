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

const rows={objects:[{record_id:'recBuffObject',fields:{名称:'Buff',标识:'buff',启用:true,对象表ID:'tblBuffs'}},{record_id:'recEquipment',fields:{名称:'装备物',标识:'equippedItem',启用:true}}],attributes:[],buffs:[{record_id:'recStuck',fields:{名称:'卡住',启用:true,适用对象:['recEquipment']}},{record_id:'recHidden',fields:{名称:'隐藏效果',标识:'hidden',启用:false}}]}
const sharedRead=async()=>{
 const repo=new FeishuRepository(env);repo.tables={objects:'tblObjects',attributes:'tblAttributes',buffs:'tblBuffs'}
 const calls=[];repo.records=async table=>{calls.push(table);assert.ok(rows[table],'must reuse already-read Buff rows');return rows[table]}
 const result=await repo.read();assert.deepEqual(calls,['objects','attributes','buffs']);return result.library
}
let shared=await sharedRead()
assert.deepEqual(shared.items[0],{id:'buff/recStuck',objectType:'buff',name:'卡住',description:'',enabled:true})
assert.deepEqual(shared.buffs[0].objectTypes,['equippedItem'])
assert.equal(shared.items[1].enabled,false)
rows.buffs[0].fields.名称='卡住改名';rows.buffs[0].fields.启用=false
shared=await sharedRead();assert.equal(shared.items[0].id,'buff/recStuck');assert.equal(shared.items[0].name,'卡住改名');assert.equal(shared.items[0].enabled,false)
rows.objects[0].fields.标识='food';await assert.rejects(sharedRead,/对象表ID/)
rows.objects[0].fields.标识='buff'
for(const table of ['tblObjects','tblAttributes']){rows.objects[0].fields.对象表ID=table;await assert.rejects(sharedRead,/对象表ID/)}
rows.objects[0].fields.对象表ID='tblBuffs';rows.objects[1].fields.对象表ID='tblBuffs';await assert.rejects(sharedRead,/对象表ID/)
delete rows.objects[1].fields.对象表ID
rows.buffs[0].fields.适用对象=['missing'];await assert.rejects(sharedRead,/关联已失效/)
console.log('PASS: Buff catalog reuse, single-read consistency, record-id fallback, rename/disable, applicability preservation and restricted base-table mappings')
