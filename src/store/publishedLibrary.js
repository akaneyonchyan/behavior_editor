import { useContentLibrary, validateLibrary } from './contentLibrary'
import { sameLibrary } from '../../shared/library-model.mjs'

export const publishedMode = import.meta.env?.VITE_LIBRARY_MODE === 'published'
const cacheKey = 'pps-published-library-v1'
let pending = null
export function validateSnapshot(data) {
  if (!data || !Number.isFinite(Date.parse(data.syncedAt))) throw new Error('公共库同步时间无效')
  validateLibrary(data.library)
  return data
}
export function refreshPublishedLibrary() {
  if (pending) return pending
  useContentLibrary.setState({ publishedBusy: true })
  pending = (async () => {
    try {
      const base = import.meta.env?.BASE_URL || './'
      const response = await fetch(base + 'data/library.json?t=' + Date.now(), { cache: 'no-store', signal: AbortSignal.timeout(20000) })
      if (!response.ok) throw new Error('尚未发布公共库，或网络暂不可用')
      const data = validateSnapshot(await response.json())
      const state = useContentLibrary.getState()
      if (state.syncedAt && Date.parse(data.syncedAt) < Date.parse(state.syncedAt)) throw new Error('发布版本早于本地缓存，暂时保留较新数据')
      useContentLibrary.setState({
        ...(sameLibrary(state.library, data.library) ? {} : { library: data.library }),
        publishedReady: true, syncedAt: data.syncedAt, checkedAt: Date.now(), error: '',
        publishedStatus: '已获取当前发布版本'
      })
      try { localStorage.setItem(cacheKey, JSON.stringify(data)) }
      catch { useContentLibrary.setState({ publishedStatus: '已刷新；本机缓存写入失败，关闭页面后无法保证离线恢复' }) }
      return true
    } catch (error) {
      useContentLibrary.setState({ error: '刷新失败：' + error.message + '。稍后将自动重试，也可点击刷新数据；当前内容保留。' })
      return false
    } finally { useContentLibrary.setState({ publishedBusy: false }); pending = null }
  })()
  return pending
}
export function startPublishedLibrary() {
  // Separate cache from the former editable/team library. Never overwrite a user's local library.
  useContentLibrary.setState({ readOnly: true, teamMode: false, library: {version:1,objects:[],attributes:[],buffs:[]}, publishedReady: false, syncedAt: null, checkedAt: 0, error: '', publishedStatus: '正在读取已发布的公共库' })
  try {
    const raw = localStorage.getItem(cacheKey)
    if (raw) { const data = validateSnapshot(JSON.parse(raw)); useContentLibrary.setState({ library: data.library, syncedAt: data.syncedAt, publishedReady: true, publishedStatus: '当前显示本机缓存，正在检查更新' }) }
  } catch { /* Invalid cache is ignored; the network request will recover. */ }
  refreshPublishedLibrary()
  const timer = setInterval(refreshPublishedLibrary, 60000)
  const resume = () => { if (document.visibilityState === 'visible') refreshPublishedLibrary() }
  window.addEventListener('online', refreshPublishedLibrary)
  document.addEventListener('visibilitychange', resume)
  return () => { clearInterval(timer); window.removeEventListener('online', refreshPublishedLibrary); document.removeEventListener('visibilitychange', resume) }
}
