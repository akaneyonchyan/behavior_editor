import {createContext,useContext} from 'react'
import {useBehaviorStore} from './behaviorStore'
export const GraphDisplayContext=createContext(null)
// Only read-only node summaries use this override. Editor actions always use the local store.
export function useDisplayGraph(selector){
 const preview=useContext(GraphDisplayContext)
 const local=useBehaviorStore(selector)
 return preview?selector(preview):local
}
