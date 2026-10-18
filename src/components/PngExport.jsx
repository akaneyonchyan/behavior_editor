import React,{useState} from 'react'
import {useBehaviorStore} from '../store/behaviorStore'
import {exportCanvasPng} from '../utils/pngExport'

export default function PngExport(){
  const [open,setOpen]=useState(false),[scope,setScope]=useState('all'),[scale,setScale]=useState(2),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
  async function run(){
    if(busy)return
    setBusy(true);setError('');setNotice('')
    try{
      const frame=await exportCanvasPng(document.querySelector('.canvas > .react-flow'),{scope,scale,name:useBehaviorStore.getState().behaviorInfo.name})
      setOpen(false);setNotice('已生成 PNG 并发起下载（'+frame.pixelWidth+'×'+frame.pixelHeight+'）')
    }catch(e){setError('导出失败：'+e.message)}
    finally{setBusy(false)}
  }
  return <>
    <button className="toolbar-btn" onClick={()=>{setOpen(true);setError('');setNotice('')}}>导出 PNG</button>
    {notice&&<span role="status" className="png-export-notice">{notice}</span>}
    {open&&<div className="dialog-overlay"><div className="dialog" role="dialog" aria-modal="true" aria-labelledby="png-export-title">
      <div className="dialog-header"><h3 id="png-export-title">导出行为图 PNG</h3><button className="dialog-close" disabled={busy} aria-label="关闭导出" onClick={()=>setOpen(false)}>×</button></div>
      <div className="dialog-content png-export-options">
        <label>导出范围<select value={scope} disabled={busy} onChange={e=>setScope(e.target.value)}><option value="all">完整行为图</option><option value="visible">当前可见区域</option></select></label>
        <label>清晰度<select value={scale} disabled={busy} onChange={e=>setScale(Number(e.target.value))}><option value={2}>高清 2 倍</option><option value={1}>标准 1 倍</option></select></label>
        <p>保留深色背景、节点与静态曲线箭头，隐藏流光和编辑辅助元素。图片导出不会保存或修改行为 JSON。</p>
        {scope==='visible'&&<p>按当前视口裁切，边缘节点可能不完整。</p>}
        {error&&<p role="alert" className="unsaved">{error}</p>}
      </div>
      <div className="dialog-footer"><button className="btn-secondary" disabled={busy} onClick={()=>setOpen(false)}>取消</button><button className="btn-primary" disabled={busy} onClick={run}>{busy?'正在生成图片…':'下载 PNG'}</button></div>
    </div></div>}
  </>
}
