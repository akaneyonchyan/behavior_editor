import {isLoopOutput, isLoopOutputEnabled} from './loopFlow'

export const portKey = handle => handle || ''
export const externalExit = (data, handle) => (data.externalExits || []).find(r => r.handle === portKey(handle))
export function supportsExit(node, handle) {
  if (!node) return false
  if (node.type === 'result') return !handle
  if (node.type === 'judge') return node.data.branches?.some(b => b.id === handle) || false
  return node.type === 'loop' && isLoopOutput(handle)
}
export const exitEnabled = (node, handle) => supportsExit(node, handle) && (node.type !== 'loop' || isLoopOutputEnabled(node.data, handle))
export const clearExit = (data, handle) => ({...data, externalExits:(data.externalExits || []).filter(r => r.handle !== portKey(handle))})

// Explicit, reversible migration. Never guess a missing/ambiguous continuation.
export function bypassLegacyMove(nodes, edges, id) {
  const node = nodes.find(n => n.id === id)
  const next = edges.filter(e => e.source === id && !e.sourceHandle)
  if (node?.type !== 'move' || next.length !== 1 || next[0].target === id)
    throw new Error('旧位移需要唯一的正常后续节点，才能移除并接续。请先核对连线。')
  const target = next[0].target
  if (edges.some(e => e.target === id && e.source === target))
    throw new Error('接续会产生节点自身循环，请先核对连线。')
  return {
    nodes:nodes.filter(n => n.id !== id),
    edges:edges.filter(e => e.source !== id).map(e => e.target === id ? {...e, target, targetHandle:next[0].targetHandle} : e),
    archive:{node, edges:edges.filter(e => e.source === id || e.target === id)}
  }
}
