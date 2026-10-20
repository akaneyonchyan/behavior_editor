import {create} from 'zustand'
let initial='structure'
try{initial=localStorage.getItem('pps-canvas-view')||initial}catch{}
export const useCanvasView=create(set=>({
 mode:initial==='graph'?'graph':'structure',
 setMode:mode=>{set({mode});try{localStorage.setItem('pps-canvas-view',mode)}catch{}}
}))
