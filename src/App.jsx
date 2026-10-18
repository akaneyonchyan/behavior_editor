import React, { useEffect } from 'react'
import { connectTeamLibrary } from './store/contentLibrary'
import { publishedMode, startPublishedLibrary } from './store/publishedLibrary'
import Toolbar from './components/Toolbar'
import NodePalette from './components/NodePalette'
import Canvas from './components/Canvas'
import PropertyPanel from './components/PropertyPanel'
import { useBehaviorStore } from './store/behaviorStore'
import { NODE_CONFIG } from './constants/behaviorTypes'
import './App.css'

export default function App() {
  useEffect(()=>{if(publishedMode)return startPublishedLibrary();connectTeamLibrary()},[])
  const { addNode } = useBehaviorStore()

  const handleAddNode = (type) => {
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
        <NodePalette onAddNode={handleAddNode} />
        <Canvas />
        <PropertyPanel />
      </div>
    </div>
  )
}
