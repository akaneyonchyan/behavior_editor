import { create } from 'zustand'
import { useBehaviorStore as graph } from './behaviorStore'
import { validateConfig } from './documentValidation'
import { NODE_CONFIG } from '../constants/behaviorTypes'
const PREFIX = 'pps-behavior-v2:'
const draftKey = PREFIX + 'draft:' + crypto.randomUUID()
const empty = () => ({ behavior: { name: '未命名行为', matchTargets: [], preconditions: { interactObject: '', consumables: [], attributes: [] } }, graph: { nodes: [], edges: [] } })
const content = () => graph.getState().exportConfig()
export const fingerprint = c => JSON.stringify({ ...c, graph: { ...c.graph, edges: c.graph.edges.map(({ id, ...e }) => e) } })
let baseline = fingerprint(empty()), fileHandle = null, diskText = null, directory = null
let documentId = crypto.randomUUID(), localFingerprint = '', diskFingerprint = '', initialized = false
let localTimer, writing = false
export const useDocumentSession = create(() => ({ dirty: false, busy: false, fileName: '', directoryName: '', draftTime: '', backupTime: '', error: '', notice: '', firstRun: true, ready: false }))
const status = patch => useDocumentSession.setState(patch)
const time = () => new Date().toLocaleTimeString('zh-CN', { hour12: false })
export const supportsDirectory = () => window.isSecureContext && 'showDirectoryPicker' in window
const parse = text => JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text)
function preferences(mode, value) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('pps-behavior-settings', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('settings')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction('settings', mode === 'get' ? 'readonly' : 'readwrite')
      const op = mode === 'get' ? tx.objectStore('settings').get('directory') : tx.objectStore('settings').put(value, 'directory')
      tx.oncomplete = () => { db.close(); resolve(op.result) }
      tx.onerror = tx.onabort = () => { db.close(); reject(tx.error) }
    }
  })
}
export function flushDraft() {
  if (!useDocumentSession.getState().ready) return
  const config = content(), current = fingerprint(config)
  if (current === localFingerprint) return
  try {
    localStorage.setItem(draftKey, JSON.stringify({ config, baseline, savedAt: Date.now(), fileName: useDocumentSession.getState().fileName }))
    localStorage.setItem(PREFIX + 'latest', draftKey)
    localFingerprint = current; status({ draftTime: time() })
  } catch { status({ error: '浏览器恢复草稿写入失败（空间不足或存储被禁用）。请立即保存 JSON 文件。' }) }
}
export async function chooseDirectory() {
  if (!supportsDirectory()) { status({ error: '当前浏览器不能直接写入目录。请用 Chrome／Edge 通过 HTTPS 或 localhost 打开；当前仍可恢复浏览器草稿并下载 JSON。' }); return }
  if (writing) return
  try {
    const selected = await window.showDirectoryPicker({ mode: 'readwrite', id: 'pps-behavior' })
    directory = selected; diskFingerprint = ''
    status({ directoryName: selected.name, firstRun: false, error: '', backupTime: '' })
    try { await preferences('set', selected); localStorage.setItem(PREFIX + 'setup', 'done') }
    catch { status({ error: '目录已可用，但浏览器未能记住授权；下次打开需重新选择。' }) }
    await backupToDirectory()
  } catch (e) { if (e.name !== 'AbortError') status({ error: '选择目录失败：' + e.message }) }
}
export function skipSetup() {
  status({ firstRun: false })
  try { localStorage.setItem(PREFIX + 'setup', 'done') } catch { /* flushDraft reports storage failures */ }
}
export async function backupToDirectory() {
  if (!directory || writing || !useDocumentSession.getState().ready) return
  const config = content(), current = fingerprint(config)
  if (current === diskFingerprint) return
  const id = documentId
  writing = true
  try {
    if (await directory.queryPermission({ mode: 'readwrite' }) !== 'granted') {
      status({ error: '本地目录写入授权已失效。点击“保存目录”重新授权；浏览器草稿仍继续保存。' }); return
    }
    const target = await directory.getFileHandle('行为恢复-' + id + '.json', { create: true })
    const stream = await target.createWritable()
    try { await stream.write(JSON.stringify(config, null, 2)); await stream.close() }
    catch (e) { await stream.abort().catch(() => {}); throw e }
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
  baseline = saved ? fingerprint(content()) : fingerprint(empty())
  localFingerprint = ''; diskFingerprint = ''
  status({ fileName: name, dirty: fingerprint(content()) !== baseline, backupTime: '', notice: '', error: archiveError })
  flushDraft()
}
export function newDocument() { if (canReplace()) replace(empty()) }
export function loadExample(config) { if (canReplace()) replace(config) }
export async function openDocument(fallbackInput) {
  if (!canReplace()) return
  if (!window.showOpenFilePicker) { fallbackInput.click(); return }
  status({ busy: true })
  try {
    const [handle] = await window.showOpenFilePicker({ types: [{ description: '行为图 JSON', accept: { 'application/json': ['.json'] } }], multiple: false })
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
export async function saveDocument(asNew = false) {
  if (useDocumentSession.getState().busy) return false
  const config = content(), current = fingerprint(config)
  const name = (config.behavior.name || '未命名行为').replace(/[<>:"/\\|?*]/g, '_').slice(0, 80) + '.json'
  const text = JSON.stringify(config, null, 2)
  status({ busy: true, error: '' })
  try {
    let handle = asNew ? null : fileHandle
    if (!handle && window.showSaveFilePicker) handle = await window.showSaveFilePicker({ suggestedName: name, ...(directory ? { startIn: directory } : {}), types: [{ description: '行为图 JSON', accept: { 'application/json': ['.json'] } }] })
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
    flushDraft(); return true
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
export function startPersistence() {
  if (!initialized) {
    initialized = true
    try {
      status({ firstRun: localStorage.getItem(PREFIX + 'setup') !== 'done' })
      const key = localStorage.getItem(PREFIX + 'latest'), raw = key && localStorage.getItem(key)
      if (raw) {
        const draft = JSON.parse(raw); validateConfig(draft.config, NODE_CONFIG)
        graph.getState().importConfig(draft.config); graph.setState({ past: [], future: [] })
        baseline = draft.baseline || fingerprint(empty())
        status({ fileName: draft.fileName || '', dirty: fingerprint(content()) !== baseline, notice: '已恢复上次草稿。重新保存时请选择文件；不会自动覆盖原文件。' })
      }
    } catch { status({ error: '上次草稿无法读取，已保留原始草稿。可通过“恢复草稿”查找其他版本，或打开已有 JSON。' }) }
    status({ ready: true })
    preferences('get').then(handle => { if (handle && !directory) { directory = handle; status({ directoryName: handle.name }) } }).catch(() => {})
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
