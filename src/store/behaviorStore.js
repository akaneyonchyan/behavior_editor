import {checkScope,convertToPrecheck} from '../utils/loopStructure'
import {externalExit, exitEnabled, clearExit, portKey, bypassLegacyMove} from '../utils/externalExits'
import { create } from 'zustand'
import { applyNodeChanges, applyEdgeChanges, addEdge } from 'reactflow'
import { NODE_CONFIG } from '../constants/behaviorTypes'
import { validateConfig } from './documentValidation'
import { isLoopOutput, isLoopOutputEnabled } from '../utils/loopFlow'
import {splitLegacyEnd} from '../utils/endings'
import {emptyBehavior,normalizeMetadata,ensureStart} from '../utils/behaviorMetadata'
const clone = value => JSON.parse(JSON.stringify(value))
const snapshot = s => clone({ nodes: s.nodes, edges: s.edges, behaviorInfo: s.behaviorInfo, layout:s.layout })
export const useBehaviorStore = create((set, get) => {
  const commit = patch => { get().checkpoint(); set(patch) }
  const restore = (s, patch) => ({ ...patch, selectedNode: patch.nodes.find(n => n.id === s.selectedNode?.id) || null })
  return {
    behaviorInfo: emptyBehavior().behavior, layout:null,
    nodes: emptyBehavior().graph.nodes, edges: [], selectedNode: null, past: [], future: [], clipboard: null, pasteCount: 0, documentRevision:0,
    checkpoint: () => set(s => ({ past: [...s.past.slice(-99), snapshot(s)], future: [] })),
    undo: () => set(s => s.past.length ? { ...restore(s, s.past.at(-1)), past: s.past.slice(0, -1), future: [snapshot(s), ...s.future] } : {}),
    redo: () => set(s => s.future.length ? { ...restore(s, s.future[0]), past: [...s.past, snapshot(s)], future: s.future.slice(1) } : {}),
    updateBehaviorInfo: updates => commit({ behaviorInfo: normalizeMetadata({ ...get().behaviorInfo, ...updates }) }),
    selectNode: node => set(s=>({ selectedNode: node, ...(!node?{nodes:s.nodes.map(n=>({...n,selected:false}))}: {}) })),
    addNode: node => {
      if(node.type==='start'||node.type==='move')return
      const s=get()
      commit({ nodes: [...s.nodes.map(n => ({ ...n, selected: false })), { ...node, selected: true }], selectedNode: node })
    },
    updateNode: (id, updates) => {
      const nodes = get().nodes.map(n => n.id === id ? { ...n, data: { ...n.data, ...updates, ...(updates.branches?{externalExits:(n.data.externalExits||[]).filter(r=>updates.branches.some(b=>b.id===r.handle))}:{}) } } : n)
      const edges = get().edges.filter(e => e.source !== id || !updates.branches || !e.sourceHandle || updates.branches.some(b => b.id === e.sourceHandle))
      commit({ nodes, edges, selectedNode: nodes.find(n => n.id === get().selectedNode?.id) || null })
    },
    setBranchDestination: (id,handle,mode,target,note) => {
      const s=get(),node=s.nodes.find(n=>n.id===id)
      if(!exitEnabled(node,handle)||!['external','node'].includes(mode))return
      if(mode==='node'&&target&&(!s.nodes.some(n=>n.id===target&&n.type!=='start')||(node.type==='loop'&&target===id)))return
      const data=clearExit(node.data,handle)
      if(mode==='external')data.externalExits.push({handle:portKey(handle),note:note??externalExit(node.data,handle)?.note??''})
      const nodes=s.nodes.map(n=>n.id===id?{...n,data}:n)
      const replacing=mode==='external'||target!==undefined
      const edges=replacing?s.edges.filter(e=>!(e.source===id&&portKey(e.sourceHandle)===portKey(handle))):s.edges
      if(mode==='node'&&target)edges.push({id:crypto.randomUUID(),source:id,target,...(handle?{sourceHandle:handle}:{}),type:'default'})
      commit({nodes,edges,selectedNode:nodes.find(n=>n.id===s.selectedNode?.id)||null})
    },
    removeLegacyMove: id => {
      const s=get(),{nodes,edges,archive}=bypassLegacyMove(s.nodes,s.edges,id)
      const layout=s.layout?{...s.layout,scopes:s.layout.scopes.filter(x=>x.entry!==id).map(x=>({...x,members:x.members.filter(member=>member!==id)})),positions:{}}:null
      commit({layout,nodes,edges,behaviorInfo:{...s.behaviorInfo,legacyMovement:[...(s.behaviorInfo.legacyMovement||[]),clone(archive)]},selectedNode:null,documentRevision:s.documentRevision+1})
    },
    setStructurePositions: positions => commit({layout:{version:1,scopes:get().layout?.scopes||[],positions:clone(positions)}}),
    confirmLoopScope: (scope,precheck=true) => {
      const s=get();checkScope(s.nodes,s.edges,scope)
      const patch=precheck?convertToPrecheck(s.nodes,s.edges,scope):{nodes:s.nodes,edges:s.edges}
      const layout={version:1,scopes:[...(s.layout?.scopes||[]).filter(x=>x.loopId!==scope.loopId),clone(scope)],positions:{}}
      commit({...patch,layout,selectedNode:patch.nodes.find(n=>n.id===scope.loopId)||null,documentRevision:s.documentRevision+1})
    },
    changeNodes: changes => set(s => {
      const nodes = applyNodeChanges(changes.filter(c=>!(c.type==='remove'&&s.nodes.some(n=>n.id===c.id&&n.type==='start'))), s.nodes)
      return { nodes, selectedNode: nodes.find(n => n.id === s.selectedNode?.id) || null }
    }),
    changeEdges: changes => set(s => ({ edges: applyEdgeChanges(changes, s.edges) })),
    connect: params => {
      const source=get().nodes.find(n=>n.id===params.source)
      if(!source||source.type==='end'||get().nodes.some(n=>n.id===params.target&&n.type==='start'))return
      if(source.type==='start'){
        if(params.sourceHandle||!get().nodes.some(n=>n.id===params.target))return
        commit({edges:addEdge({...params,id:crypto.randomUUID(),type:'default'},get().edges.filter(e=>e.source!==source.id))});return
      }
      if(externalExit(source.data,params.sourceHandle))return
      if(['judge','result'].includes(source.type))return get().setBranchDestination(source.id,params.sourceHandle||'','node',params.target)
      if(source?.type==='loop')return get().setLoopTarget(params.source,params.sourceHandle,params.target)
      if(source.type==='move'){
        if(params.sourceHandle&&params.sourceHandle!=='unreachable')return
        if(params.sourceHandle==='unreachable'&&get().nodes.find(n=>n.id===params.target)?.type!=='end')return
        commit({edges:addEdge({...params,id:crypto.randomUUID(),type:'default'},get().edges.filter(e=>!(e.source===source.id&&(e.sourceHandle||'')===(params.sourceHandle||''))))});return
      }
      commit({ edges: addEdge({ ...params, id: crypto.randomUUID(), type: 'default' }, get().edges) })
    },
    setMoveEndTarget: (id,target) => {
      const s=get();if(s.nodes.find(n=>n.id===id)?.type!=='move'||(target&&!s.nodes.some(n=>n.id===target&&n.type==='end')))return
      const edges=s.edges.filter(e=>!(e.source===id&&e.sourceHandle==='unreachable'))
      if(target)edges.push({id:crypto.randomUUID(),source:id,target,sourceHandle:'unreachable',type:'default'})
      commit({edges})
    },
    setLoopTarget: (id,handle,target) => {
      const s=get(),node=s.nodes.find(n=>n.id===id)
      if(node?.type!=='loop'||!isLoopOutputEnabled(node.data,handle)||target===id||(target&&!s.nodes.some(n=>n.id===target&&n.type!=='start')))return
      if(externalExit(node.data,handle))return
      const existing=s.edges.find(e=>e.source===id&&e.sourceHandle===handle)
      if((existing?.target||'')===target)return
      const edges=s.edges.filter(e=>!(e.source===id&&e.sourceHandle===handle))
      if(target)edges.push({id:crypto.randomUUID(),source:id,target,sourceHandle:handle,type:'default'})
      commit({edges})
    },
    assignLoopEdge: (edgeId,handle) => {
      const s=get(),edge=s.edges.find(e=>e.id===edgeId)
      if(!edge||externalExit(s.nodes.find(n=>n.id===edge.source)?.data||{},handle)||edge.sourceHandle||!isLoopOutputEnabled(s.nodes.find(n=>n.id===edge.source)?.data||{},handle)||s.nodes.find(n=>n.id===edge.source)?.type!=='loop'||s.edges.some(e=>e.source===edge.source&&e.sourceHandle===handle))return
      commit({edges:s.edges.map(e=>e.id===edgeId?{...e,sourceHandle:handle}:e)})
    },
    splitEnd: (id,assignments) => {const s=get(),patch=splitLegacyEnd(s.nodes,s.edges,id,assignments);commit({...patch,selectedNode:patch.nodes.find(n=>n.id===id),documentRevision:s.documentRevision+1})},
    deleteNode: id => get().deleteSelection([id]),
    deleteSelection: ids => {
      const s = get(), removed = new Set(ids || s.nodes.filter(n => n.selected).map(n => n.id))
      s.nodes.filter(n=>n.type==='start').forEach(n=>removed.delete(n.id))
      if (!removed.size && !s.edges.some(e => e.selected)) return
      const layout=s.layout?{...s.layout,scopes:s.layout.scopes.filter(x=>!removed.has(x.loopId)&&!removed.has(x.entry)).map(x=>({...x,members:x.members.filter(id=>!removed.has(id))})),positions:{}}:null
      commit({ layout,nodes: s.nodes.filter(n => !removed.has(n.id)), edges: s.edges.filter(e => !e.selected && !removed.has(e.source) && !removed.has(e.target)), selectedNode: removed.has(s.selectedNode?.id) ? null : s.selectedNode })
    },
    copy: () => {
      const s = get(), nodes = s.nodes.filter(n => n.selected&&n.type!=='start'), ids = new Set(nodes.map(n => n.id))
      if(!nodes.length){set({clipboard:null});return}
      if (nodes.length) set({ clipboard: clone({ nodes, layout:s.layout,edges: s.edges.filter(e => ids.has(e.source) && ids.has(e.target)) }), pasteCount: 0 })
    },
    paste: () => {
      const s = get(); if (!s.clipboard) return
      const copied=s.clipboard.nodes.filter(n=>n.type!=='start');if(!copied.length)return
      const count = s.pasteCount + 1, ids = new Map(copied.map(n => [n.id, crypto.randomUUID()]))
      const nodes = clone(copied).map(n => {
        n.id = ids.get(n.id); n.selected = true; n.dragging = false
        n.position = { x: n.position.x + count * 40, y: n.position.y + count * 40 }
        if (n.data.nextNode) n.data.nextNode = ids.get(n.data.nextNode) || ''
        n.data.branches?.forEach(b => { b.nextNode = ids.get(b.nextNode) || '' })
        return n
      })
      const edges = clone(s.clipboard.edges).filter(e=>ids.has(e.source)&&ids.has(e.target)).map(e => ({ ...e, id: crypto.randomUUID(), source: ids.get(e.source), target: ids.get(e.target), selected: false }))
      const scopes=(s.clipboard.layout?.scopes||[]).filter(x=>ids.has(x.loopId)&&ids.has(x.entry)&&x.members.every(id=>ids.has(id))).map(x=>({loopId:ids.get(x.loopId),entry:ids.get(x.entry),members:x.members.map(id=>ids.get(id))}))
      const layout=scopes.length?{version:1,scopes:[...(s.layout?.scopes||[]),...scopes],positions:s.layout?.positions||{}}:s.layout
      commit({ layout,nodes: [...s.nodes.map(n => ({ ...n, selected: false })), ...nodes], edges: [...s.edges.map(e => ({ ...e, selected: false })), ...edges], selectedNode: nodes[0], pasteCount: count })
    },
    exportConfig: () => {
      const s = get()
      return clone({ behavior: s.behaviorInfo, graph: { ...(s.layout?{layout:s.layout}:{}), nodes: s.nodes.map(({ id, type, data, position }) => ({ id, type, data, position })), edges: s.edges.map(({ id, source, target, sourceHandle, targetHandle }) => ({ id, source, target, sourceHandle, targetHandle })) } })
    },
    importConfig: config => {
      validateConfig(config, NODE_CONFIG)
      if (!config?.behavior || !Array.isArray(config?.graph?.nodes) || !Array.isArray(config?.graph?.edges)) throw new Error('缺少行为或行为设计节点数据')
      const ids = new Set()
      const nodes = config.graph.nodes.map((n, i) => {
        if (!n.id || ids.has(n.id) || !NODE_CONFIG[n.type] || !n.data) throw new Error('节点 ID、类型或数据无效')
        ids.add(n.id)
        return { ...clone(n), selected: false, position: n.position || { x: (i % 3) * 380 + 80, y: Math.floor(i / 3) * 360 + 80 } }
      })
      const edges = config.graph.edges.map(e => {
        if (!ids.has(e.source) || !ids.has(e.target)) throw new Error('连线引用了不存在的节点')
        return { ...clone(e), id: crypto.randomUUID(), type: 'default' }
      })
      commit({ layout:config.graph.layout?clone(config.graph.layout):null,behaviorInfo: normalizeMetadata(clone(config.behavior)), ...ensureStart(nodes,edges), selectedNode: null, documentRevision:get().documentRevision+1 })
    }
  }
})
