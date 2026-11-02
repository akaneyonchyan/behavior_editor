import React, { useEffect, useState, lazy, Suspense } from 'react'
import { connectTeamLibrary } from './store/contentLibrary'
import { publishedMode, startPublishedLibrary } from './store/publishedLibrary'
import Toolbar from './components/Toolbar'
import NodePalette from './components/NodePalette'
import Canvas from './components/Canvas'
import OnlinePreview from './components/OnlinePreview'
import CollaborativeEditor from './components/CollaborativeEditor'
import {useFileView} from './store/fileView'
import {liveGitlabMode} from './utils/onlineProvider'
import BehaviorFiles from './components/BehaviorFiles'
import PropertyPanel from './components/PropertyPanel'
import { useBehaviorStore } from './store/behaviorStore'
import { NODE_CONFIG } from './constants/behaviorTypes'
import './App.css'
import './preview/preview.css'
const BehaviorPreview=lazy(()=>import('./preview/Preview'))

export default function App() {
  const [workspace,setWorkspace]=useState(()=>new URLSearchParams(location.search).get('view')==='editor'?'editor':'preview')
  useEffect(()=>{if(publishedMode)return startPublishedLibrary();connectTeamLibrary()},[])
  const { addNode } = useBehaviorStore()
  const {tab,file,selected,onlineAccess,requestOnlineEdit,collaborating,onlineControls,setCollaborating}=useFileView(),readOnly=tab==='online',shared=readOnly&&collaborating&&!!file

  const handleAddNode = (type) => {
    if(readOnly){if(shared&&onlineControls?.canEdit)onlineControls.addNode(type);return}
    const newNode = {
      id: `${type}_${Date.now()}`,
      type,
      position: {
        x: Math.random() * 400 + 200,
        y: Math.random() * 300 + 100
      },
      data: {
        ...structuredClone(NODE_CONFIG[type].defaultData),
        name: `${NODE_CONFIG[type].label}节点`
      }
    }
    addNode(newNode)
  }

  return (
    <div className="app" onKeyDown={e=>{if(workspace==='preview')e.stopPropagation()}}>
      <div className="editor-workspace" hidden={workspace!=='editor'}>
      <Toolbar navigation={<WorkspaceNavigation workspace={workspace} onChange={setWorkspace}/>} />
      <div className="app-main">
        <aside className="behavior-sidebar" aria-label="节点与本地文件">
          <div className="palette-container" inert={readOnly&&!onlineControls?.canEdit?'':undefined} aria-disabled={readOnly&&!onlineControls?.canEdit}><NodePalette onAddNode={handleAddNode} /></div>
          <BehaviorFiles/>
        </aside>
        {shared?<CollaborativeEditor key={file.name} file={file} onClose={()=>setCollaborating(false)}/>:readOnly?(file?<OnlinePreview key={file.sha+file.name} file={file}/>:<div className="online-empty">从左侧选择在线行为文件。<br/>{liveGitlabMode?'验证个人权限后，点击文件直接进入协作编辑。':'下载到本地保存目录后即可编辑。'}</div>):<><Canvas /></>}
        {shared?null:readOnly?<aside className="property-panel online-properties"><div className="panel-header">在线预览 · {selected?(selected.data.name||NODE_CONFIG[selected.type].label):'行为准入数据'}</div><div className="panel-content">{liveGitlabMode&&<div className="online-edit-entry"><strong>{onlineAccess.canEdit?'此文件可以在线编辑':'当前为只读预览'}</strong><p>{onlineAccess.message}</p>{file&&<button className="toolbar-btn" disabled={!onlineAccess.canEdit} onClick={requestOnlineEdit}>进入在线编辑</button>}</div>}{file?<details className="online-json-details"><summary>查看原始 JSON</summary><pre>{JSON.stringify(selected&&selected.type!=='start'?selected.data:file.config.behavior,null,2)}</pre></details>:<p>选择在线文件查看。</p>}</div></aside>:<PropertyPanel/>}
      </div>
      </div>
      {workspace==='preview'&&<Suspense fallback={<p>正在加载行为预览…</p>}><BehaviorPreview navigation={<WorkspaceNavigation workspace={workspace} onChange={setWorkspace}/>}/></Suspense>}
    </div>
  )
}

function WorkspaceNavigation({workspace,onChange}){
  return <nav className="workspace-navigation" aria-label="工作区"><button aria-label="行为设计" aria-current={workspace==='editor'?'page':undefined} onClick={()=>onChange('editor')}>PPS 行为编辑器</button><button aria-current={workspace==='preview'?'page':undefined} onClick={()=>onChange('preview')}>行为预览</button></nav>
}
