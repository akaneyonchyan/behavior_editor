import { validateLibrary, TABLES } from '../shared/library-model.mjs'
export const DEFAULT_TABLES={objects:'example_objects',attributes:'example_attributes',buffs:'example_buffs'}
const text=value=>typeof value==='string'?value:Array.isArray(value)?value.map(v=>v.text||'').join(''):''
export class FeishuRepository {
  constructor(env,fetcher=fetch) {this.env=env;this.fetcher=fetcher;this.token=null;this.tables={...DEFAULT_TABLES};this.app=env.FEISHU_BASE_TOKEN||'EXAMPLE_BASE_TOKEN'}
  async request(path,method='GET',body) {
    if(!this.token||this.token.until<Date.now()) {
      const response=await this.fetcher('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({app_id:this.env.FEISHU_APP_ID,app_secret:this.env.FEISHU_APP_SECRET}),signal:AbortSignal.timeout(15000)})
      const data=await response.json()
      if(!response.ok||data.code!==0||!data.tenant_access_token)throw new Error('飞书应用授权失败，请检查 App ID、密钥及应用发布状态')
      this.token={value:data.tenant_access_token,until:Date.now()+Math.max(0,(data.expire||7200)-120)*1000}
    }
    const response=await this.fetcher('https://open.feishu.cn/open-apis'+path,{method,headers:{Authorization:'Bearer '+this.token.value,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)})
    const data=await response.json()
    if(!response.ok||data.code!==0){this.token=null;throw new Error('飞书接口调用失败（'+(data.code||response.status)+'），请检查表格协作权限、字段和应用权限')}
    return data.data
  }
  path(table) {return '/bitable/v1/apps/'+encodeURIComponent(this.app)+'/tables/'+encodeURIComponent(this.tables[table])+'/records'}
  async records(table) {
    const result=[];let token='';const seen=new Set()
    do {const data=await this.request(this.path(table)+'?page_size=500'+(token?'&page_token='+encodeURIComponent(token):''));result.push(...(data.items||[]));if(result.length>10000)throw new Error('公共库条目超过同步上限');token=data.has_more?data.page_token:'';if(data.has_more&&(!token||seen.has(token)))throw new Error('飞书分页异常');seen.add(token)}while(token)
    return result
  }
  async read() {
    const raw={};for(const table of TABLES)raw[table]=await this.records(table)
    const objectIds=new Map(raw.objects.map(r=>[r.record_id,text(r.fields['标识'])||r.record_id]))
    const handles={},library={version:1}
    for(const table of TABLES) {
      handles[table]=new Map()
      library[table]=raw[table].map(r=>{
        const f=r.fields,id=text(f['标识'])||r.record_id
        if(handles[table].has(id))throw new Error('飞书表中存在重复标识：'+id)
        handles[table].set(id,r.record_id)
        const links=f['适用对象']||[]
        const refs=(Array.isArray(links)?links:[links]).flatMap(link=>{
          if(typeof link==='string')return [link]
          if(link&&Array.isArray(link.record_ids))return link.record_ids
          if(link?.record_id)return [link.record_id]
          if(link?.record_ids==null&&link?.type==='text'&&!link.text&&Array.isArray(link.text_arr)&&link.text_arr.length===0)return []
          throw new Error('适用对象关联格式无效，请检查飞书字段')
        })
        return {id,name:text(f['名称']),description:text(f['说明']),enabled:f['启用']===true,...(table==='attributes'?{kind:text(f['数据类型'])}:{}),...(table!=='objects'?{objectTypes:[...new Set(refs.map(id=>{const mapped=objectIds.get(id);if(!mapped)throw new Error('适用对象关联已失效，请修复飞书表格');return mapped}))]}:{})}
      })
    }
    validateLibrary(library);return {library,handles}
  }
  async write(change,snapshot) {
    const {table,before,after}=change,fields={}
    const mapping={name:'名称',description:'说明',enabled:'启用',kind:'数据类型'}
    for(const [key,field] of Object.entries(mapping))if(after[key]!==undefined&&(!before||before[key]!==after[key]))fields[field]=after[key]
    if(!before)fields['标识']=after.id
    if(table!=='objects'&&(!before||JSON.stringify(before.objectTypes)!==JSON.stringify(after.objectTypes)))fields['适用对象']=after.objectTypes.map(id=>{const record=snapshot.handles.objects.get(id);if(!record)throw new Error('适用对象尚未同步');return record})
    if(before)await this.request(this.path(table)+'/'+encodeURIComponent(snapshot.handles[table].get(after.id)),'PUT',{fields})
    else await this.request(this.path(table),'POST',{fields})
  }
}
