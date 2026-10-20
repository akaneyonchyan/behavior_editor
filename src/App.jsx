import React, { useEffect } from 'react'
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

export default function App() {
  useEffect(()=>{if(publishedMode)return startPublishedLibrary();connectTeamLibrary()},[])
  const { addNode } = useBehaviorStore()
  const {tab,file}=useFileView(),readOnly=tab==='online'

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
    <div className="app">
      <Toolbar />
      <div className="app-main">
        <aside className="behavior-sidebar" aria-label="节点与本地文件">
          <div className="palette-container" inert={readOnly?'':undefined} aria-disabled={readOnly}><NodePalette onAddNode={handleAddNode} /></div>
          <BehaviorFiles/>
        </aside>
        {readOnly?(file?<OnlinePreview key={file.sha+file.name} file={file}/>:<div className="online-empty">从左侧选择在线行为文件，在这里只读查看。<br/>下载到本地保存目录后即可编辑。</div>):<><Canvas /><PropertyPanel /></>}
      </div>
    </div>
  )
}
