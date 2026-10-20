import React,{useState} from 'react'
import {useBehaviorStore} from '../store/behaviorStore'
import {exportCanvasPng,captureCanvas,preparePngDestination} from '../utils/pngExport'
import {getSaveDirectory,useDocumentSession} from '../store/documentSession'
import {useCanvasView} from '../store/canvasView'

export default function PngExport(){
  const directoryName=useDocumentSession(s=>s.directoryName),canChoose=typeof window.showSaveFilePicker==='function'
  const [open,setOpen]=useState(false),[scope,setScope]=useState('all'),[scale,setScale]=useState(2),[busy,setBusy]=useState(false),[error,setError]=useState('')
  async function run(){
    if(busy)return
    setBusy(true);setError('')
    let snapshot
    try{
      let source=document.querySelector('.canvas > .react-flow')
      const state=useBehaviorStore.getState(),options={scope,scale,name:state.behaviorInfo.name}
      captureCanvas(source,options) // Reject invalid/oversized canvases before showing a save dialog.
      const destination=await preparePngDestination(options.name,getSaveDirectory())
      if(destination.cancelled)return
      if(scope==='all'&&useCanvasView.getState().mode==='structure'){
        const {structureSnapshot}=await import('./structureSnapshot')
        snapshot=await structureSnapshot({nodes:structuredClone(state.nodes),edges:structuredClone(state.edges),layout:structuredClone(state.layout),behaviorInfo:structuredClone(state.behaviorInfo)})
        source=snapshot.source
      }
      const frame=await exportCanvasPng(source,options,{download:destination.download})
      setOpen(false);useDocumentSession.setState({notice:(destination.saved?'PNG 已保存：'+destination.name:'已生成 PNG 并发起浏览器下载')+'（'+frame.pixelWidth+'×'+frame.pixelHeight+'）'})
    }catch(e){setError('导出失败：'+e.message)}
    finally{snapshot?.dispose();setBusy(false)}
  }
  return <>
    <button className="toolbar-btn" onClick={()=>{setOpen(true);setError('')}}>导出 PNG</button>
    {open&&<div className="dialog-overlay"><div className="dialog" role="dialog" aria-modal="true" aria-labelledby="png-export-title">
      <div className="dialog-header"><h3 id="png-export-title">导出行为图 PNG</h3><button className="dialog-close" disabled={busy} aria-label="关闭导出" onClick={()=>setOpen(false)}>×</button></div>
      <div className="dialog-content png-export-options">
        <label>导出范围<select value={scope} disabled={busy} onChange={e=>setScope(e.target.value)}><option value="all">完整行为图</option><option value="visible">当前可见区域</option></select></label>
        <label>清晰度<select value={scale} disabled={busy} onChange={e=>setScale(Number(e.target.value))}><option value={2}>高清 2 倍</option><option value={1}>标准 1 倍</option></select></label>
        <p>保留深色背景、节点与静态曲线箭头，隐藏流光和编辑辅助元素。图片导出不会保存或修改行为 JSON。</p>
        <p>{canChoose?(directoryName?'保存弹窗默认打开本地存储目录「'+directoryName+'」，也可以另选位置。':'尚未设置本地存储目录，保存时可自行选择位置。'):'当前浏览器不支持指定保存目录，PNG 将按浏览器下载设置保存。'}</p>
        {scope==='visible'&&<p>按当前视口裁切，边缘节点可能不完整。</p>}
        {error&&<p role="alert" className="unsaved">{error}</p>}
      </div>
      <div className="dialog-footer"><button className="btn-secondary" disabled={busy} onClick={()=>setOpen(false)}>取消</button><button className="btn-primary" disabled={busy} onClick={run}>{busy?'正在生成图片…':'下载 PNG'}</button></div>
    </div></div>}
  </>
}
