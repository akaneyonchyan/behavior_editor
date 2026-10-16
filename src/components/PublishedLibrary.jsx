import React, { useState } from 'react'
import { useContentLibrary } from '../store/contentLibrary'
import { refreshPublishedLibrary } from '../store/publishedLibrary'
import './ContentLibrary.css'
const tables = { objects: '对象类型', attributes: '属性类型', buffs: 'Buff 类型' }
const time = value => value ? new Date(value).toLocaleString() : '暂无'
export default function PublishedLibrary({onClose}) {
  const { library, syncedAt, checkedAt, publishedBusy, publishedReady, publishedStatus, error } = useContentLibrary()
  const [tab,setTab] = useState('objects'), [query,setQuery] = useState('')
  const rows = library[tab].filter(row => (row.name + ' ' + row.description).toLowerCase().includes(query.toLowerCase()))
  return <div className="dialog-overlay"><div className="dialog library-dialog" role="dialog" aria-modal="true" aria-label="公共内容库查询">
    <div className="dialog-header"><h3>公共内容库 · 只读查询</h3><button className="dialog-close" aria-label="关闭公共内容库" onClick={onClose}>×</button></div>
    <div className="library-intro">公共库统一在飞书多维表格维护。网页每 60 秒检查已发布的数据；“刷新数据”立即检查发布版本，不会直接触发飞书同步。<br/><strong>数据可能与飞书存在延迟：通常约 5～10 分钟，定时任务排队或失败时可能更久，不保证最大延迟。</strong></div>
    <div className="library-tools library-sync"><span>数据同步时间：{time(syncedAt)}<br/>最近成功检查：{time(checkedAt)}</span><button className="toolbar-btn" disabled={publishedBusy} onClick={refreshPublishedLibrary}>{publishedBusy?'正在刷新…':'刷新数据'}</button></div>
    <div className="library-tools">{Object.entries(tables).map(([key,label])=><button key={key} className={'toolbar-btn '+(tab===key?'active':'')} onClick={()=>setTab(key)}>{label}（{library[key].length}）</button>)}<input aria-label="搜索公共库" placeholder="搜索名称或说明" value={query} onChange={e=>setQuery(e.target.value)}/></div>
    <div className="library-table-wrap"><table className="library-table"><thead><tr><th>名称</th>{tab==='attributes'&&<th>数据类型</th>}{tab!=='objects'&&<th>适用对象</th>}<th>说明</th><th>状态</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td>{row.name}<small title={row.id}>{row.id}</small></td>{tab==='attributes'&&<td>{row.kind}</td>}{tab!=='objects'&&<td>{row.objectTypes.map(id=>library.objects.find(o=>o.id===id)?.name||id).join('、')}</td>}<td>{row.description}</td><td>{row.enabled?'启用':'停用'}</td></tr>)}</tbody></table>{!rows.length&&<p className="library-intro">{publishedReady?'没有匹配的条目':'尚未获取公共库数据，请等待首次同步发布后刷新。'}</p>}</div>
    <div className="dialog-footer"><span role="status">{error||publishedStatus}</span><button className="btn-secondary" onClick={onClose}>关闭</button></div>
  </div></div>
}
