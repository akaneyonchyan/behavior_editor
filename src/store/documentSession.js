import { create } from 'zustand'
import { useBehaviorStore as graph } from './behaviorStore'
import { validateConfig } from './documentValidation'
import { NODE_CONFIG } from '../constants/behaviorTypes'
import { emptyBehavior } from '../utils/behaviorMetadata'
import { blankTemplate } from '../utils/blankTemplate'
const PREFIX = 'pps-behavior-v2:'
const draftKey = PREFIX + 'draft:' + crypto.randomUUID()
const empty = emptyBehavior
const content = () => graph.getState().exportConfig()
export const fingerprint = c => JSON.stringify({ ...c, graph: { ...(c.graph.layout?{layout:c.graph.layout}:{}), nodes:c.graph.nodes.map(({id,type,data,position})=>({id,type,data,position})), edges: c.graph.edges.map(({ id, ...e }) => e) } })
let baseline = fingerprint(empty()), fileHandle = null, diskText = null, directory = null
let documentId = crypto.randomUUID(), localFingerprint = '', diskFingerprint = '', initialized = false
let localTimer, writing = false
let needsTemplate=true, startup=Promise.resolve(), referenceQueue=Promise.resolve(), pendingRestore=null
export const CACHE_DIRECTORY='.behavior-editor-cache'
export const TEMPLATE_FILE='空白行为模板.json'
export const AUTOSAVE_FILE='当前行为缓存.json'
export const waitForInitialization=()=>startup
export const useDocumentSession = create(() => ({ dirty: false, busy: false, fileName: '', directoryName: '', draftTime: '', backupTime: '', error: '', notice: '', firstRun: true, ready: false, needsAuthorization:false }))
const status = patch => useDocumentSession.setState(patch)
const time = () => new Date().toLocaleTimeString('zh-CN', { hour12: false })
export const supportsDirectory = () => window.isSecureContext && 'showDirectoryPicker' in window
const parse = text => JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text)
function preferences(mode, value, key='directory') {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('pps-behavior-settings', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('settings')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction('settings', mode === 'get' ? 'readonly' : 'readwrite')
      const op = mode === 'get' ? tx.objectStore('settings').get(key) : tx.objectStore('settings').put(value, key)
      tx.oncomplete = () => { db.close(); resolve(op.result) }
      tx.onerror = tx.onabort = () => { db.close(); reject(tx.error) }
    }
  })
}
function rememberReference(){
  const ref={documentId,handle:fileHandle,diskText}
  referenceQueue=referenceQueue.then(async()=>{
    await preferences('set',ref,'document:'+ref.documentId)
    await preferences('set',{documentId:ref.documentId},'last-document')
  }).catch(()=>status({notice:'浏览器未能记住文件授权；编辑草稿仍会缓存，下次可通过“打开”选择文件。'}))
  return referenceQueue
}
function adopt(config,{saved=false,draft=null,id=null,name='',handle=null,text=null}={}){
  graph.getState().importConfig(config)
  graph.setState({past:[],future:[],selectedNode:null,clipboard:null})
  documentId=id||crypto.randomUUID();fileHandle=handle;diskText=text;needsTemplate=false
  baseline=draft?.baseline||(saved?fingerprint(content()):fingerprint(config))
  localFingerprint='';diskFingerprint=''
  status({fileName:name,dirty:fingerprint(content())!==baseline})
}
async function cachedTemplate(){
  if(directory){
    try{
      const cache=await directory.getDirectoryHandle(CACHE_DIRECTORY)
      const file=await (await cache.getFileHandle(TEMPLATE_FILE)).getFile()
      const config=parse(await file.text());validateConfig(config,NODE_CONFIG);return config.behavior.templateVersion===3?config:blankTemplate()
    }catch{ /* A missing or inaccessible cache is recreated from the built-in template. */ }
  }
  return blankTemplate()
}
async function ensureTemplateCache(){
  const cache=await directory.getDirectoryHandle(CACHE_DIRECTORY,{create:true})
  try{await cache.getFileHandle(TEMPLATE_FILE);return cache}catch(e){if(e.name!=='NotFoundError')throw e}
  const target=await cache.getFileHandle(TEMPLATE_FILE,{create:true}),stream=await target.createWritable()
  try{await stream.write(JSON.stringify(blankTemplate(),null,2));await stream.close()}catch(e){await stream.abort().catch(()=>{});throw e}
  return cache
}
async function restoreFile(ref,draft){
  const capture=fingerprint(content())
  if(await ref.handle.queryPermission({mode:'read'})!=='granted'){
    pendingRestore={ref,draft,capture};status({needsAuthorization:true,notice:'上次文件需要重新授权。点击“恢复访问授权”即可，无需重新选择路径。'});return
  }
  try{
    const file=await ref.handle.getFile(),text=await file.text(),config=parse(text);validateConfig(config,NODE_CONFIG)
    if(fingerprint(content())!==capture)return
    const dirtyDraft=draft&&fingerprint(draft.config)!==draft.baseline
    if(dirtyDraft){
      // Preserve the last observed disk text so external changes still trigger conflict protection.
      fileHandle=typeof ref.diskText==='string'?ref.handle:null;diskText=ref.diskText??null
      status({notice:fileHandle?'已恢复上次文件及未保存的编辑草稿；正式文件仍需手动保存。':'已恢复未保存草稿；原文件版本无法核对，请另存为。'})
    }else{
      adopt(config,{saved:true,id:ref.documentId,name:file.name,handle:ref.handle,text})
      status({notice:'已加载上次编辑的文件：'+file.name})
    }
  }catch(e){
    if(e.name==='NotAllowedError'||e.name==='SecurityError'){pendingRestore={ref,draft,capture};status({needsAuthorization:true,notice:'文件访问授权已失效，点击“恢复访问授权”重试。'});return}
    const template=await cachedTemplate()
    if(fingerprint(content())!==capture)return
    adopt(template)
    status({notice:e.name==='NotFoundError'?'上次文件已找不到，已加载空白缓存模板；原编辑草稿仍可在“恢复草稿”中找回。':'上次文件无法读取，已加载空白缓存模板；原文件和编辑草稿均保留。'})
  }
}
export async function authorizeStoredAccess(){
  if(useDocumentSession.getState().busy)return
  status({busy:true,error:''})
  try{
    // Request permission directly from this button click; do not reopen a picker.
    const filePermission=pendingRestore?pendingRestore.ref.handle.requestPermission({mode:'read'}):null
    const dirPermission=directory?directory.requestPermission({mode:'readwrite'}):null
    const [fileResult,dirResult]=await Promise.all([filePermission,dirPermission])
    if(pendingRestore&&fileResult==='granted'){
      const pending=pendingRestore;pendingRestore=null
      if(fingerprint(content())===pending.capture)await restoreFile(pending.ref,pending.draft)
      else status({notice:'当前已有新的编辑，已保留；如需切换上次文件，请使用“打开”。'})
    }
    status({needsAuthorization:!!pendingRestore||!!directory&&dirResult!=='granted'})
    if(fileResult==='denied'||dirResult==='denied')status({error:'访问授权未获允许；当前草稿保留，可稍后再次授权。'})
    flushDraft();if(!pendingRestore)await rememberReference();await backupToDirectory()
  }catch(e){status({error:'恢复访问授权失败：'+e.message+'。草稿已保留，可稍后重试。'})}
  finally{status({busy:false})}
}
export function flushDraft() {
  if (!useDocumentSession.getState().ready || needsTemplate) return
  const config = content(), current = fingerprint(config)
  if (current === localFingerprint) return
  try {
    localStorage.setItem(draftKey, JSON.stringify({ config, baseline, documentId, savedAt: Date.now(), fileName: useDocumentSession.getState().fileName }))
    localStorage.setItem(PREFIX + 'latest', draftKey)
    localFingerprint = current; status({ draftTime: time() })
  } catch { status({ error: '浏览器恢复草稿写入失败（空间不足或存储被禁用）。请立即保存 JSON 文件。' }) }
}
export function getSaveDirectory(){return directory}
export function getCurrentFileHandle(){return fileHandle}
export async function chooseDirectory() {
  if (!supportsDirectory()) { status({ error: '当前浏览器不能直接写入目录。请用 Chrome／Edge 通过 HTTPS 或 localhost 打开；当前仍可恢复浏览器草稿并下载 JSON。' }); return }
  if (writing || useDocumentSession.getState().busy) return
  status({busy:true})
  try {
    const selected = await window.showDirectoryPicker({ mode: 'readwrite', id: 'pps-behavior',...(directory?{startIn:directory}:{}) })
    directory = selected; diskFingerprint = ''
    status({ directoryName: selected.name, error: '', backupTime: '',needsAuthorization:!!pendingRestore })
    try { await preferences('set', selected); localStorage.setItem(PREFIX + 'setup', 'done') }
    catch { status({ error: '目录已可用，但浏览器未能记住授权；下次打开需重新选择。' }) }
    if(needsTemplate)adopt(await cachedTemplate())
    status({firstRun:false})
    flushDraft();if(!pendingRestore)await rememberReference();await backupToDirectory()
  } catch (e) { if (e.name !== 'AbortError') status({ error: '选择目录失败：' + e.message }) }
  finally { status({busy:false}) }
}
export function skipSetup() {
  if(useDocumentSession.getState().busy)return
  if(needsTemplate)adopt(blankTemplate())
  status({ firstRun: false })
  try { localStorage.setItem(PREFIX + 'setup', 'done') } catch { /* flushDraft reports storage failures */ }
  flushDraft();void rememberReference()
}
export async function backupToDirectory() {
  if (!directory || writing || !useDocumentSession.getState().ready || needsTemplate) return
  const config = content(), current = fingerprint(config)
  if (current === diskFingerprint) return
  const id = documentId
  writing = true
  try {
    if (await directory.queryPermission({ mode: 'readwrite' }) !== 'granted') {
      status({ needsAuthorization:true,error: '本地目录写入授权已失效。点击“恢复访问授权”继续备份；浏览器草稿仍继续保存。' }); return
    }
    // Disk holds the latest snapshot only. Independent tab drafts stay in browser storage.
    // Never create a new disk file for a page reload or a document switch.
    flushDraft()
    const writeSnapshot=async()=>{
      const cache=await ensureTemplateCache()
      const target=await cache.getFileHandle(AUTOSAVE_FILE,{create:true})
      const text=JSON.stringify(config,null,2)
      const previous=await (await target.getFile()).text()
      try{if(previous&&fingerprint(parse(previous))===current)return}catch{ /* Replace an incomplete cache snapshot. */ }
      const stream=await target.createWritable()
      try{await stream.write(text);await stream.close()}
      catch(e){await stream.abort().catch(()=>{});throw e}
    }
    // Serialize same-origin tabs so concurrent writers cannot race on the shared cache.
    if(globalThis.navigator?.locks)await navigator.locks.request('pps-behavior-disk-cache',writeSnapshot)
    else await writeSnapshot()
    if (id === documentId) {
      diskFingerprint = current
      const error = useDocumentSession.getState().error
      status({ backupTime: time(), ...(error.startsWith('本地自动备份失败') || error.startsWith('本地目录写入授权') ? { error: '' } : {}) })
    }
  } catch (e) { status({ error: '本地自动备份失败：' + e.message + '。请检查目录权限或磁盘空间，然后重新选择保存目录。' }) }
  finally { writing = false }
}
function canReplace() {
  if (useDocumentSession.getState().busy || writing) { status({ notice: '正在保存，请稍后再切换行为。' }); return false }
  return !useDocumentSession.getState().dirty || window.confirm('当前行为有尚未保存到正式文件的修改。继续切换？浏览器恢复草稿会保留。点击“取消”可先保存或另存为。')
}
function replace(config, { name = '', handle = null, text = null, saved = false } = {}) {
  validateConfig(config, NODE_CONFIG)
  flushDraft()
  let archiveError = ''
  try { const previous = localStorage.getItem(draftKey); if (previous) localStorage.setItem(PREFIX + 'archive:' + crypto.randomUUID(), previous) }
  catch { archiveError = '历史恢复草稿归档失败，请及时另存为文件。' }
  graph.getState().importConfig(config)
  graph.setState({ past: [], future: [], selectedNode: null, clipboard: null })
  documentId = crypto.randomUUID(); fileHandle = handle; diskText = text
  needsTemplate=false;pendingRestore=null
  baseline = saved ? fingerprint(content()) : fingerprint(empty())
  localFingerprint = ''; diskFingerprint = ''
  status({ fileName: name, dirty: fingerprint(content()) !== baseline, backupTime: '', notice: '', error: archiveError })
  flushDraft()
  void rememberReference()
}
export function newDocument() { if (canReplace()) replace(blankTemplate(), { saved: true }) }
export function loadExample(config) { if (canReplace()) replace(config) }
export async function openDocument(fallbackInput) {
  if (!canReplace()) return
  if (!window.showOpenFilePicker) { fallbackInput.click(); return }
  status({ busy: true })
  try {
    const [handle] = await window.showOpenFilePicker({ id:'pps-behavior-files',...(directory?{startIn:directory}:{}),types: [{ description: '行为图 JSON', accept: { 'application/json': ['.json'] } }], multiple: false })
    const file = await handle.getFile(), text = await file.text()
    replace(parse(text), { name: file.name, handle, text, saved: true })
  } catch (e) { if (e.name !== 'AbortError') status({ error: '打开失败：' + e.message + '。原行为未替换，请检查 JSON 格式。' }) }
  finally { status({ busy: false }) }
}
export async function openFallback(file) {
  if (!file || !canReplace()) return
  status({ busy: true })
  try { replace(parse(await file.text()), { name: file.name, saved: true }) }
  catch (e) { status({ error: '打开失败：' + e.message + '。原行为未替换。' }) }
  finally { status({ busy: false }) }
}
export async function openDirectoryFile(handle,expectedDirectory){
  const state=useDocumentSession.getState()
  if(!state.ready||state.busy||writing){status({notice:'正在加载或保存，请稍后再切换文件。'});return false}
  if(!expectedDirectory||expectedDirectory!==directory){status({notice:'保存目录已变化，请刷新文件列表后再打开。'});return false}
  const capture=fingerprint(content())
  status({busy:true,error:'',notice:''})
  try{
    const file=await handle.getFile(),text=await file.text(),config=parse(text)
    validateConfig(config,NODE_CONFIG)
    if(expectedDirectory!==directory||fingerprint(content())!==capture){status({notice:'读取期间目录或当前行为发生变化，已保留当前内容，请重新打开。'});return false}
    status({busy:false})
    if(!canReplace())return false
    replace(config,{name:file.name,handle,text,saved:true})
    status({notice:'已载入：'+file.name})
    return true
  }catch(e){status({error:'打开目录文件失败：'+e.message+'。原行为未替换，请刷新列表或恢复目录授权。'});return false}
  finally{status({busy:false})}
}
export async function openDroppedFiles(transfer) {
  const state=useDocumentSession.getState()
  if(!state.ready || state.busy || writing){status({notice:'正在加载或保存，请稍后再拖入文件。'});return false}
  const files=Array.from(transfer?.files||[]),items=Array.from(transfer?.items||[]).filter(i=>i.kind==='file')
  if(items.some(i=>i.webkitGetAsEntry?.()?.isDirectory)){status({error:'请拖入行为图 JSON 文件，不支持拖入文件夹。'});return false}
  if(files.length!==1 || items.length>1){status({error:'请每次只拖入一个行为图 JSON 文件。'});return false}
  const file=files[0]
  if(!/\.json$/i.test(file.name)){status({error:'仅支持拖入 .json 格式的行为图文件。'});return false}
  // Request the handle synchronously while the drop event is still active.
  let handlePromise=Promise.resolve(null)
  try{if(items[0]?.getAsFileSystemHandle)handlePromise=Promise.resolve(items[0].getAsFileSystemHandle()).catch(()=>null)}catch{ /* File fallback. */ }
  const capture=fingerprint(content())
  status({busy:true,error:'',notice:''})
  try{
    const [text,handle]=await Promise.all([file.text(),handlePromise])
    const config=parse(text);validateConfig(config,NODE_CONFIG)
    if(fingerprint(content())!==capture){status({notice:'读取文件期间当前行为发生了修改，已保留当前内容；请重新拖入。'});return false}
    status({busy:false})
    if(!canReplace())return false
    const fileRef=handle?.kind==='file'?handle:null
    replace(config,{name:file.name,handle:fileRef,text:fileRef?text:null,saved:true})
    status({notice:'已载入：'+file.name+(fileRef?'':'。浏览器未提供原文件句柄，首次保存需选择文件位置。')})
    return true
  }catch(e){status({error:'拖入文件失败：'+e.message+'。原行为未替换，请检查行为图 JSON。'});return false}
  finally{status({busy:false})}
}
export async function saveDocument(asNew = false) {
  if (useDocumentSession.getState().busy) return false
  const config = content(), current = fingerprint(config)
  const name = (config.behavior.name || '未命名行为').replace(/[<>:"/\\|?*]/g, '_').slice(0, 80) + '.json'
  const text = JSON.stringify(config, null, 2)
  status({ busy: true, error: '' })
  try {
    let handle = asNew ? null : fileHandle
    if (!handle && window.showSaveFilePicker) handle = await window.showSaveFilePicker({ id:'pps-behavior-files',suggestedName: name, ...(directory ? { startIn: directory } : {}), types: [{ description: '行为图 JSON', accept: { 'application/json': ['.json'] } }] })
    if (!handle) {
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
      const a = document.createElement('a'); a.href = url; a.download = name; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 30000)
      status({ notice: '已发起 JSON 下载，请确认文件已落盘。浏览器无法确认下载完成，因此保留未保存提示。' })
      return false
    }
    if (await handle.queryPermission({ mode: 'readwrite' }) !== 'granted' && await handle.requestPermission({ mode: 'readwrite' }) !== 'granted') throw new Error('未获得写入权限，请重新授权或另存为')
    if (!asNew && fileHandle && diskText !== null && await (await handle.getFile()).text() !== diskText) throw new Error('文件已被其他窗口或程序修改，请另存为，避免覆盖他人修改')
    const stream = await handle.createWritable()
    try { await stream.write(text); await stream.close() }
    catch (e) { await stream.abort().catch(() => {}); throw e }
    fileHandle = handle; diskText = text; baseline = current; localFingerprint = ''
    status({ fileName: handle.name, dirty: fingerprint(content()) !== baseline, notice: '已保存到文件：' + handle.name })
    flushDraft();await rememberReference(); return true
  } catch (e) { if (e.name !== 'AbortError') status({ error: '保存失败：' + e.message }); return false }
  finally { status({ busy: false }) }
}
export function recoveryDrafts() {
  try {
    return Object.keys(localStorage).filter(k => k.startsWith(PREFIX + 'draft:') || k.startsWith(PREFIX + 'archive:')).map(key => {
      try { return { key, ...JSON.parse(localStorage.getItem(key)) } } catch { return null }
    }).filter(d => d?.config && d.key !== draftKey).sort((a,b) => b.savedAt - a.savedAt).slice(0, 20)
  } catch { return [] }
}
export function recoverDraft(draft) {
  if (!canReplace()) return false
  try { replace(draft.config); status({ notice: '已恢复草稿，请另存为正式文件。' }); return true }
  catch (e) { status({ error: '草稿恢复失败：' + e.message }); return false }
}
async function initializeSession(){
  status({busy:true,ready:false})
  let draft=null,setupDone=false
  try{
    setupDone=localStorage.getItem(PREFIX+'setup')==='done'
    status({firstRun:!setupDone})
    const key=localStorage.getItem(PREFIX+'latest'),raw=key&&localStorage.getItem(key)
    if(raw){
      draft=JSON.parse(raw);validateConfig(draft.config,NODE_CONFIG)
      adopt(draft.config,{draft,id:draft.documentId,name:draft.fileName||''})
      status({notice:'已恢复上次编辑草稿，正在检查本地文件。'})
    }
  }catch{draft=null;status({error:'上次草稿无法读取，原始数据已保留；将使用空白模板，可从“恢复草稿”查找其他版本。'})}
  const capture=fingerprint(content())
  try{
    const rememberedDirectory=await preferences('get').catch(()=>null)
    if(rememberedDirectory&&!directory){directory=rememberedDirectory;status({directoryName:directory.name,firstRun:false})}
    let ref=null
    if(draft?.documentId)ref=await preferences('get',null,'document:'+draft.documentId).catch(()=>null)
    else if(!draft){
      const last=await preferences('get',null,'last-document').catch(()=>null)
      if(last?.documentId)ref=await preferences('get',null,'document:'+last.documentId).catch(()=>null)
    }
    // Upgrade old drafts only when the remembered directory contains the exact saved version.
    // A matching filename alone is not enough to attach an unrelated file for future writes.
    if(!ref?.handle&&draft?.fileName&&directory){
      try{
        const handle=await directory.getFileHandle(draft.fileName),file=await handle.getFile(),text=await file.text()
        const config=parse(text);validateConfig(config,NODE_CONFIG)
        if(fingerprint(config)===draft.baseline)ref={documentId,handle,diskText:text}
      }catch{ /* Keep the old draft when its original file cannot be identified safely. */ }
    }
    if(fingerprint(content())!==capture){needsTemplate=false;status({notice:'已保留当前新编辑，未用启动恢复数据覆盖。'})}
    else if(ref?.handle){
      if(!draft){const template=await cachedTemplate();if(fingerprint(content())!==capture){needsTemplate=false;return}adopt(template,{id:ref.documentId})}
      await restoreFile(ref,draft)
    }else if(!draft&&(directory||setupDone)){const template=await cachedTemplate();if(fingerprint(content())===capture)adopt(template);else needsTemplate=false}
    else if(draft)status({notice:draft.fileName?'已恢复编辑草稿；未能确认原文件授权，请打开或保存一次，之后可自动重开原文件。':'已恢复上次未保存的缓存行为。'})
    if(directory&&await directory.queryPermission({mode:'readwrite'})!=='granted')status({needsAuthorization:true})
  }catch(e){status({notice:'本地文件暂不可访问，当前缓存保留。可点击“恢复访问授权”或“打开”重试。',needsAuthorization:!!directory})}
  finally{
    status({ready:true,busy:false,dirty:fingerprint(content())!==baseline})
    if(!needsTemplate){flushDraft();if(!pendingRestore)await rememberReference();await backupToDirectory()}
  }
}
export function startPersistence() {
  if (!initialized) {
    initialized = true
    startup=initializeSession()
  }
  const unsubscribe = graph.subscribe(() => {
    status({ dirty: fingerprint(content()) !== baseline })
    clearTimeout(localTimer); localTimer = setTimeout(flushDraft, 500)
  })
  const draftInterval = setInterval(flushDraft, 2000), diskInterval = setInterval(backupToDirectory, 15000)
  const leave = e => { flushDraft(); if (useDocumentSession.getState().dirty || useDocumentSession.getState().busy) { e.preventDefault(); e.returnValue = '' } }
  const hidden = () => { if (document.visibilityState === 'hidden') { flushDraft(); void backupToDirectory() } }
  window.addEventListener('beforeunload', leave); window.addEventListener('pagehide', flushDraft); document.addEventListener('visibilitychange', hidden)
  flushDraft()
  return () => { unsubscribe(); clearTimeout(localTimer); clearInterval(draftInterval); clearInterval(diskInterval); window.removeEventListener('beforeunload', leave); window.removeEventListener('pagehide', flushDraft); document.removeEventListener('visibilitychange', hidden) }
}
