import {createContext,useContext} from 'react'
import {useStore} from 'zustand'
import {useBehaviorStore} from './behaviorStore'
// Online rooms own an isolated store: never subscribe the local draft writer.
export const EditorStoreContext=createContext(null)
export function useEditorStore(selector){return useStore(useContext(EditorStoreContext)||useBehaviorStore,selector)}
