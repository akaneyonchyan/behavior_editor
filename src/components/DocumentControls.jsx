import React, { useEffect, useRef, useState } from 'react'
import { useBehaviorStore } from '../store/behaviorStore'
import { useDocumentSession, startPersistence, supportsDirectory, authorizeStoredAccess, chooseDirectory, skipSetup, newDocument, openDocument, openFallback, saveDocument, loadExample, recoveryDrafts, recoverDraft } from '../store/documentSession'
import example from '../../examples/eat-snack.json'

export default function DocumentControls() {
  const s = useDocumentSession(), name = useBehaviorStore(state => state.behaviorInfo.name)
  const input = useRef(null), [drafts, setDrafts] = useState(null)
  useEffect(startPersistence, [])
  useEffect(() => {
    const saveKey = e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (!document.querySelector('.dialog-overlay')) void saveDocument(e.shiftKey)
      }
    }
    window.addEventListener('keydown', saveKey)
    return () => window.removeEventListener('keydown', saveKey)
  }, [])
  useEffect(() => { document.title = (s.dirty ? '● ' : '') + name + ' · PPS 行为编辑器' }, [s.dirty, name])
  return <>
    <div className="document-bar">
      <div className="document-actions">
        <button className="toolbar-btn" disabled={s.busy} onClick={newDocument}>新建</button>
        <button className="toolbar-btn" disabled={s.busy} onClick={() => openDocument(input.current)}>打开</button>
        <button className="toolbar-btn" disabled={s.busy} onClick={() => saveDocument()} title="Ctrl+S">保存</button>
        <button className="toolbar-btn" disabled={s.busy} onClick={() => saveDocument(true)} title="Ctrl+Shift+S">另存为</button>
        <button className="toolbar-btn" disabled={s.busy} onClick={chooseDirectory}>保存目录</button>
        {s.needsAuthorization&&<button className="toolbar-btn" disabled={s.busy} onClick={authorizeStoredAccess}>恢复访问授权</button>}
        <button className="toolbar-btn" disabled={s.busy} onClick={() => setDrafts(recoveryDrafts())}>恢复草稿</button>
        <button className="toolbar-btn" disabled={s.busy} onClick={() => loadExample(example)}>载入示例</button>
        <input ref={input} type="file" accept=".json,application/json" hidden onChange={e => { const file = e.target.files[0]; e.target.value = ''; void openFallback(file) }} />
      </div>
      <div className="save-status" aria-live="polite">
        <strong className={s.dirty ? 'unsaved' : ''}>{s.busy ? '正在保存／打开…' : s.dirty ? '● 有修改，尚未保存到正式文件' : '无未保存修改'}</strong>
        <span>{s.fileName || '仅缓存，尚未保存为正式文件'} · 浏览器草稿 {s.draftTime || '等待保存'}</span>
        <span>{s.directoryName ? '本地目录：' + s.directoryName + ' / .behavior-editor-cache · 每15秒备份 · ' + (s.backupTime || '等待备份／授权') : '未设置本地备份目录 · 当前仅有浏览器草稿'}</span>
      </div>
    </div>
    {(s.error || s.notice) && <div className={'document-message ' + (s.error ? 'error' : '')} role={s.error ? 'alert' : 'status'}>
      {s.error || s.notice}<button onClick={() => useDocumentSession.setState({ error: '', notice: '' })} aria-label="关闭保存提示">×</button>
    </div>}
    {s.ready && s.firstRun && <div className="dialog-overlay"><div className="dialog" role="dialog" aria-modal="true" aria-labelledby="setup-title">
      <div className="dialog-header"><h3 id="setup-title">首次使用：设置本地保存目录</h3></div>
      <div className="dialog-content setup-copy">
        <p>选择保存目录后，首次使用会生成空白行为模板。自动保存每 15 秒更新 .behavior-editor-cache 内同一个“当前行为缓存.json”，不会不断新增文件。</p>
        <p>操作停止约 0.5 秒后保存浏览器草稿，持续操作时每 2 秒补存一次。多页面各自保留浏览器草稿，磁盘缓存保留最近一次备份；正式文件仅在手动保存时写入。</p>
        <p>仅点击“保存／另存为”才写正式文件。下次优先恢复上次文件及未保存草稿；文件找不到时使用空白缓存模板。“打开”和“另存为”默认定位此目录，权限失效时可一键重新授权。</p>
        {!supportsDirectory() && <p className="unsaved">当前浏览器不支持目录写入。可先使用浏览器草稿与 JSON 下载；完整本地备份请使用 Chrome／Edge + HTTPS 或 localhost。</p>}
        {s.error && <p role="alert" className="unsaved">{s.error}</p>}
      </div>
      <div className="dialog-footer"><button className="btn-secondary" disabled={s.busy} onClick={skipSetup}>暂用浏览器草稿</button><button className="btn-primary" disabled={s.busy||!supportsDirectory()} onClick={chooseDirectory}>选择本地目录</button></div>
    </div></div>}
    {drafts && <div className="dialog-overlay"><div className="dialog" role="dialog" aria-modal="true" aria-label="恢复草稿">
      <div className="dialog-header"><h3>恢复草稿（最近20份）</h3><button className="dialog-close" onClick={() => setDrafts(null)}>×</button></div>
      <div className="dialog-content recovery-list">{!drafts.length && <p>还没有其他恢复草稿。</p>}{drafts.map(d => <button key={d.key} className="toolbar-btn" onClick={() => { if (recoverDraft(d)) setDrafts(null) }}><strong>{d.config.behavior?.name || '未命名行为'}</strong><span>{new Date(d.savedAt).toLocaleString('zh-CN')} · {d.config.graph?.nodes?.length || 0} 个节点</span></button>)}</div>
    </div></div>}
  </>
}
