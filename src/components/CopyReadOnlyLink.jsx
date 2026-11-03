import React,{useState} from 'react'
import {readOnlyLink} from '../utils/readOnlyLink'
import './ReadOnlyPage.css'

export default function CopyReadOnlyLink({file}){
 const [message,setMessage]=useState(''),[fallback,setFallback]=useState('')
 const copy=async()=>{
  const url=readOnlyLink(file.name)
  try{await navigator.clipboard.writeText(url);setFallback('');setMessage('已复制，只读链接打开最新已保存版本。')}
  catch{setFallback(url);setMessage('无法自动复制，请选中下方链接手动复制。')}
 }
 return <div className="readonly-share"><button className="toolbar-btn" onClick={copy} title="分享在线最新已保存版本，不包含未保存的协作草稿">复制只读链接</button><span role="status">{message}</span>{fallback&&<input aria-label="只读链接" readOnly value={fallback} onFocus={e=>e.target.select()}/>}</div>
}
