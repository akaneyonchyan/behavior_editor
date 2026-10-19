import { create } from 'zustand'
import { ATTRIBUTES } from '../constants/behaviorTypes'
import { validateLibrary, sameLibrary } from '../../shared/library-model.mjs'
export { validateLibrary } from '../../shared/library-model.mjs'
const KEY = 'pps-content-library-v1'
export const DEFAULT_LIBRARY = {
  version: 1,
  objects: [ ['partner','伙伴'], ['handheld','手持物'], ['food','食物'], ['material','原料'], ['interactPlace','交互场所'], ['interactPoint','交互点位'], ['furniture','家具摆件'], ['collectible','收藏品'], ['container','收藏容器'] ].map(([id,name])=>({id,name,description:'',enabled:true})),
  attributes: ATTRIBUTES.map(a=>({id:a.value,name:a.label,kind:a.value==='emotion'?'枚举':'数值',objectTypes:({satiety:['partner'],energy:['partner'],emotion:['partner'],cleanliness:['partner','handheld','interactPlace','furniture'],durability:['handheld','furniture'],freshness:['food']})[a.value],description:'示例条目，可按项目规则调整',enabled:true})),
  buffs: []
}
function load() {
  if(import.meta.env?.VITE_LIBRARY_MODE==='published')return {library:{version:1,objects:[],attributes:[],buffs:[]},error:''}
  try { const raw=globalThis.localStorage?.getItem(KEY);return {library:raw?validateLibrary(JSON.parse(raw)):structuredClone(DEFAULT_LIBRARY),error:''} }
  catch {return {library:structuredClone(DEFAULT_LIBRARY),error:'本地公共库读取失败，已显示示例库；原始存储未覆盖，请先恢复备份。'}}
}
function loadTeamCache(){if(import.meta.env?.VITE_LIBRARY_MODE==='published')return {};try{if(globalThis.localStorage?.getItem('pps-team-library-active')!=='true')return {};const data=JSON.parse(localStorage.getItem('pps-team-library-cache'));validateLibrary(data.library);return {library:data.library,teamMode:true,teamStatus:'正在连接团队库；当前显示上次同步副本'}}catch{return {}}}
export const useContentLibrary=create((set,get)=>({...load(),teamMode:false,teamStatus:'本机公共库',teamReady:false,teamAuthenticated:false,teamConfigured:false,checkedAt:0,...loadTeamCache(),save:library=>{
  if(get().readOnly){set({error:'公共库只读，请在飞书中修改'});return false}
  if(get().teamMode){set({error:'团队模式请使用同步保存'});return false}
  try {validateLibrary(library);localStorage.setItem(KEY,JSON.stringify(library));set({library:structuredClone(library),error:''});return true}
  catch(error){set({error:'公共库未保存：'+error.message});return false}
}}))
if(typeof window!=='undefined')window.addEventListener('storage',event=>{if(event.key===KEY&&!useContentLibrary.getState().teamMode&&!useContentLibrary.getState().readOnly)useContentLibrary.setState(load())})
let events=null,connecting=null
async function api(path,body) {
  const response=await fetch('/api/library'+path,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(120000),...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})})
  let data;try{data=await response.json()}catch{throw new Error('团队服务暂不可用，请检查服务是否启动')}
  if(!response.ok){const e=new Error(data.message||'团队库同步失败');e.status=response.status;e.data=data;throw e}return data
}
function acceptRemote(data) {
  validateLibrary(data.library)
  const current=useContentLibrary.getState()
  useContentLibrary.setState({...(sameLibrary(current.library,data.library)?{}:{library:data.library}),revision:data.revision,checkedAt:data.checkedAt,teamMode:true,teamReady:true,teamAuthenticated:true,teamStatus:'已连接团队库 · 飞书变更约 5 秒检查一次',error:''})
  try{localStorage.setItem('pps-team-library-cache',JSON.stringify(data));localStorage.setItem('pps-team-library-active','true')}catch{useContentLibrary.setState({teamStatus:'已连接团队库；浏览器缓存写入失败'})}
}
function subscribe() {
  events?.close();events=new EventSource('/api/library/events')
  events.addEventListener('library',event=>{try{acceptRemote(JSON.parse(event.data))}catch(e){useContentLibrary.setState({teamReady:false,teamStatus:'云端数据无效：'+e.message})}})
  events.addEventListener('healthy',event=>{const data=JSON.parse(event.data);useContentLibrary.setState({teamReady:true,checkedAt:data.checkedAt,teamStatus:'已连接团队库 · 飞书变更约 5 秒检查一次'})})
  events.addEventListener('sync-error',event=>useContentLibrary.setState({teamReady:false,teamStatus:'同步暂停：'+JSON.parse(event.data).message}))
  events.addEventListener('auth-expired',()=>{events?.close();useContentLibrary.setState({teamReady:false,teamAuthenticated:false,teamStatus:'团队登录已过期，请重新登录'})})
  events.onerror=()=>useContentLibrary.setState({teamReady:false,teamStatus:'连接中断，正在自动重连；本地编辑内容保留'})
}
export async function connectTeamLibrary() {
  if(connecting)return connecting
  connecting=(async()=>{
    try {
      const status=await api('/status');useContentLibrary.setState({teamConfigured:status.configured,teamAuthenticated:status.authenticated})
      if(!status.configured){useContentLibrary.setState({teamStatus:status.message});return false}
      useContentLibrary.setState({teamMode:true})
      if(!status.authenticated){useContentLibrary.setState({teamReady:false,teamStatus:'团队库已配置，请输入团队访问口令'});return false}
      acceptRemote(await api(''));subscribe();return true
    }catch(e){useContentLibrary.setState({teamReady:false,teamStatus:e.message});return false}
  })().finally(()=>{connecting=null});return connecting
}
export async function loginTeamLibrary(password) {await api('/login',{password});return connectTeamLibrary()}
export async function saveTeamLibrary(base,library) {
  validateLibrary(library)
  try{const data=await api('',{base,library});acceptRemote(data);return data.library}
  catch(e){if(e.status===401)useContentLibrary.setState({teamReady:false,teamAuthenticated:false});throw e}
}
export function sourceChoices(lib) {
  const active=lib.objects.filter(o=>o.enabled)
  return [
    ...active.map(o=>({id:'object:'+o.id,name:o.name,type:o.id}))
  ]
}
const legacyTypes={actor:'partner',partner:'partner',handheld:'handheld','执行伙伴':'partner','互动伙伴':'partner','手持物':'handheld'}
export function sourceType(source) {return source?.startsWith('object:')?source.slice(7):legacyTypes[source]}
export function sourceName(lib,source) {
  return sourceChoices(lib).find(s=>s.id===source)?.name||({actor:'执行伙伴',partner:'互动伙伴',handheld:'手持物',consumable:'消耗品（请选择具体对象类型）',interactObject:'交互对象（请选择具体对象类型）'})[source]||lib.objects.find(o=>'object:'+o.id===source)?.name||source||''
}
export function propertyChoices(lib,source) {
  const type=sourceType(source)
  if(!lib.objects.some(o=>o.id===type&&o.enabled))return []
  return [...lib.attributes.filter(a=>a.enabled&&a.objectTypes.includes(type)).map(a=>({id:a.id,name:a.name})),...lib.buffs.filter(b=>b.enabled&&b.objectTypes.includes(type)).map(b=>({id:'buff:'+b.id,name:'Buff · '+b.name}))]
}
export function propertyName(lib,id) {return id?.startsWith('buff:') ? 'Buff · '+(lib.buffs.find(b=>b.id===id.slice(5))?.name||id.slice(5)) : lib.attributes.find(a=>a.id===id)?.name||id||''}
export function ruleSummary(lib,r) {return [sourceName(lib,r.source)||'待选对象',propertyName(lib,r.attribute)||'待选属性',r.influence||'待说明'].join(' · ')}
