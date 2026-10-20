import {useEffect,useRef} from 'react'
export default function useModalFocus(){
 const ref=useRef(null)
 useEffect(()=>{
  const previous=document.activeElement,root=ref.current
  const focusable=()=>[...root.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),[tabindex="0"]')].filter(e=>e.getClientRects().length)
  ;(focusable()[0]||root).focus()
  const key=e=>{if((e.ctrlKey||e.metaKey)&&['z','y','d','s'].includes(e.key.toLowerCase())){e.preventDefault();e.stopImmediatePropagation();return}if(e.key!=='Tab')return;const list=focusable(),first=list[0],last=list.at(-1);if(!first){e.preventDefault();root.focus()}else if(e.shiftKey&&(document.activeElement===first||!root.contains(document.activeElement))){e.preventDefault();last.focus()}else if(!e.shiftKey&&(document.activeElement===last||!root.contains(document.activeElement))){e.preventDefault();first.focus()}}
  document.addEventListener('keydown',key,true)
  return()=>{document.removeEventListener('keydown',key,true);previous?.focus()}
 },[])
 return ref
}
