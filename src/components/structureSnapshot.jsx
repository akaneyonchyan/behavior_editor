import React from 'react'
import {createRoot} from 'react-dom/client'
import StructuredCanvas from './StructuredCanvas'

// Render an isolated, expanded copy. Never toggle the user's current canvas or store.
export async function structureSnapshot(graph){
 const host=document.createElement('div')
 Object.assign(host.style,{position:'fixed',left:'-100000px',top:'0',width:'1600px',height:'1000px',pointerEvents:'none'})
 host.setAttribute('aria-hidden','true');document.body.append(host)
 const root=createRoot(host),dispose=()=>{root.unmount();host.remove()}
 root.render(<StructuredCanvas graph={graph} readOnly onSelect={()=>{}}/>)
 try{
  let previous='',stable=0
  for(let i=0;i<100;i++){
   await new Promise(resolve=>setTimeout(resolve,50))
   const nodes=[...host.querySelectorAll('.react-flow__node')]
   const signature=nodes.map(n=>[n.dataset.id,n.style.transform,n.offsetWidth,n.offsetHeight,getComputedStyle(n).visibility].join(':')).join('|')
   const ready=nodes.length>=graph.nodes.length&&nodes.every(n=>n.offsetWidth&&n.offsetHeight&&getComputedStyle(n).visibility!=='hidden')
   stable=ready&&signature===previous?stable+1:0;previous=signature
   if(stable>=4)return {source:host.querySelector('.react-flow'),dispose}
  }
  throw new Error('结构图布局尚未稳定，请稍后重试')
 }catch(e){dispose();throw e}
}
