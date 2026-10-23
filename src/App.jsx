import React, { useEffect, useState, lazy, Suspense } from 'react'
import { connectTeamLibrary } from './store/contentLibrary'
import { publishedMode, startPublishedLibrary } from './store/publishedLibrary'
import Toolbar from './components/Toolbar'
import NodePalette from './components/NodePalette'
import Canvas from './components/Canvas'
import OnlinePreview from './components/OnlinePreview'
import {useFileView} from './store/fileView'
import BehaviorFiles from './components/BehaviorFiles'
import PropertyPanel from './components/PropertyPanel'
import { useBehaviorStore } from './store/behaviorStore'
import { NODE_CONFIG } from './constants/behaviorTypes'
import './App.css'
import './preview/preview.css'
const BehaviorPreview=lazy(()=>import('./preview/Preview'))

export default function App() {
  const [workspace,setWorkspace]=useState(new URLSearchParams(location.search).get('view')==='preview'?'preview':'editor')
  useEffect(()=>{if(publishedMode)return startPublishedLibrary();connectTeamLibrary()},[])
  const { addNode } = useBehaviorStore()
  const {tab,file,selected}=useFileView(),readOnly=tab==='online'

  const handleAddNode = (type) => {
    if(readOnly)return
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
          <div className="palette-container" inert={readOnly?'':undefined} aria-disabled={readOnly}><NodePalette onAddNode={handleAddNode} /></div>
          <BehaviorFiles/>
        </aside>
        {readOnly?(file?<OnlinePreview key={file.sha+file.name} file={file}/>:<div className="online-empty">从左侧选择在线行为文件，在这里只读查看。<br/>下载到本地保存目录后即可编辑。</div>):<><Canvas /></>}
        {readOnly?<aside className="property-panel online-properties"><div className="panel-header">在线只读 · {selected?(selected.data.name||NODE_CONFIG[selected.type].label):'行为准入数据'}</div><div className="panel-content">{file?<pre>{JSON.stringify(selected&&selected.type!=='start'?selected.data:file.config.behavior,null,2)}</pre>:<p>选择在线文件查看。另存为到本地后可编辑。</p>}</div></aside>:<PropertyPanel/>}
      </div>
      </div>
      {workspace==='preview'&&<Suspense fallback={<p>正在加载行为预览…</p>}><BehaviorPreview navigation={<WorkspaceNavigation workspace={workspace} onChange={setWorkspace}/>}/></Suspense>}
    </div>
  )
}

function WorkspaceNavigation({workspace,onChange}){
  return <nav className="workspace-navigation" aria-label="工作区"><button aria-label="行为设计" aria-current={workspace==='editor'?'page':undefined} onClick={()=>onChange('editor')}>PPS 行为编辑器</button><button aria-current={workspace==='preview'?'page':undefined} onClick={()=>onChange('preview')}>行为预览</button></nav>
}
