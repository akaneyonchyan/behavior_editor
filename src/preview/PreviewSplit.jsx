import React,{useRef,useState} from 'react'
const clamp=n=>Math.max(20,Math.min(80,n))
export default function PreviewSplit({children}){
 const root=useRef(null),[ratio,setRatio]=useState(()=>{try{const n=Number(localStorage.getItem('pps-preview-split'));return n>=20&&n<=80?n:55}catch{return 55}})
 function update(n){n=clamp(n);setRatio(n);try{localStorage.setItem('pps-preview-split',String(n))}catch{}}
 function move(e){const r=root.current.getBoundingClientRect();update((e.clientY-r.top)/(r.height-10)*100)}
 return <main className="preview-center preview-split" ref={root} style={{gridTemplateRows:ratio+'fr 10px '+(100-ratio)+'fr'}}>
  <div className="preview-scene-pane">{children[0]}</div>
  <div className="preview-divider" role="separator" aria-label="调整场景与行为图比例" aria-orientation="horizontal" aria-valuemin={20} aria-valuemax={80} aria-valuenow={Math.round(ratio)} tabIndex={0}
   onPointerDown={e=>{if(e.button!==0)return;e.currentTarget.setPointerCapture(e.pointerId);move(e)}}
   onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))move(e)}}
   onPointerUp={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId)}}
   onKeyDown={e=>{if(['ArrowUp','ArrowDown','Home'].includes(e.key)){e.preventDefault();update(e.key==='Home'?55:ratio+(e.key==='ArrowUp'?-5:5))}}} title="上下拖动调整比例；方向键微调，Home恢复默认"><span/></div>
  {children[1]}
 </main>
}
