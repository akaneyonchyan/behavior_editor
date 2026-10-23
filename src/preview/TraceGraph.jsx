import React,{useEffect,useId,useMemo,useRef,useState} from 'react'
const colors={start:'#38bdf8',judge:'#d4ae39',result:'#61a789',wait:'#a78bfa',loop:'#d77caa',end:'#94a3b8'}
const names={start:'开始',judge:'判断',result:'执行',wait:'待机',loop:'循环',end:'结束'}
function wrap(text){const lines=[];let line='',width=0;for(const ch of String(text)){const w=ch.charCodeAt(0)>255?14:8;if(width+w>184){lines.push(line);line='';width=0}line+=ch;width+=w}lines.push(line);return lines}
export default function TraceGraph({config,simulation}){
 const host=useRef(null),drag=useRef(null),marker=useId().replace(/:/g,''),[size,setSize]=useState({w:1,h:1}),[camera,setCamera]=useState({x:0,y:0,k:1,fit:true})
 const geometry=useMemo(()=>{
  const nodes=(config?.graph.nodes||[]).map((n,i)=>{const lines=wrap(n.data.name||n.id);return {...n,x:n.position?.x??i*260,y:n.position?.y??0,lines,h:Math.max(70,lines.length*20+32)}})
  const left=(nodes.length?Math.min(...nodes.map(n=>n.x)):0)-60,right=(nodes.length?Math.max(...nodes.map(n=>n.x+260)):260)
  const top=(nodes.length?Math.min(...nodes.map(n=>n.y)):0)-30,bottom=(nodes.length?Math.max(...nodes.map(n=>n.y+n.h)):70)+30
  return {nodes,positions:new Map(nodes.map(n=>[n.id,n])),left,right,top,bottom}
 },[config])
 useEffect(()=>{const el=host.current;const observer=new ResizeObserver(()=>{const r=el.getBoundingClientRect();setSize({w:Math.max(1,r.width),h:Math.max(1,r.height)})});observer.observe(el);return()=>observer.disconnect()},[])
 useEffect(()=>setCamera(c=>({...c,fit:true})),[geometry])
 const fitScale=Math.min(size.w/(geometry.right-geometry.left),size.h/(geometry.bottom-geometry.top),1.5)
 const view=camera.fit?{k:fitScale,x:(size.w-(geometry.left+geometry.right)*fitScale)/2,y:(size.h-(geometry.top+geometry.bottom)*fitScale)/2}:camera
 const latest=useRef(view);latest.current=view
 function zoom(factor,x=size.w/2,y=size.h/2){const c=latest.current,k=Math.max(.001,Math.min(4,c.k*factor));setCamera({k,x:x-(x-c.x)*k/c.k,y:y-(y-c.y)*k/c.k,fit:false})}
 useEffect(()=>{const el=host.current;const wheel=e=>{e.preventDefault();const r=el.getBoundingClientRect(),c=latest.current,k=Math.max(.001,Math.min(4,c.k*Math.exp(-Math.max(-200,Math.min(200,e.deltaY))*.002))),x=e.clientX-r.left,y=e.clientY-r.top;setCamera({k,x:x-(x-c.x)*k/c.k,y:y-(y-c.y)*k/c.k,fit:false})};el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel)},[])
 function focusCurrent(){const n=geometry.positions.get(simulation?.current);if(n)setCamera({k:1,x:size.w/2-(n.x+100),y:size.h/2-(n.y+n.h/2),fit:false})}
 return <div className="trace-viewer">
  <div className="trace-controls"><button onClick={()=>setCamera(c=>({...c,fit:true}))}>适应全图</button><button onClick={()=>zoom(1/view.k)}>100%</button><button aria-label="缩小行为图" onClick={()=>zoom(1/1.25)}>−</button><span>{Math.round(view.k*100)}%</span><button aria-label="放大行为图" onClick={()=>zoom(1.25)}>＋</button><button disabled={!simulation?.current} onClick={focusCurrent}>定位当前节点</button><small>滚轮缩放 · 拖动平移</small></div>
  <div className="trace-viewport" ref={host}>
   <svg className="trace-graph" aria-label="行为图执行连线" viewBox={'0 0 '+size.w+' '+size.h}
    onPointerDown={e=>{if(e.button!==0&&e.button!==1)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,view:latest.current}}}
    onPointerMove={e=>{const d=drag.current;if(d?.id===e.pointerId)setCamera({...d.view,x:d.view.x+e.clientX-d.x,y:d.view.y+e.clientY-d.y,fit:false})}}
    onPointerUp={()=>{drag.current=null}} onPointerCancel={()=>{drag.current=null}} onLostPointerCapture={()=>{drag.current=null}}>
    <defs><marker id={marker} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--text-tertiary)"/></marker></defs>
    <g data-testid="trace-camera" transform={'translate('+view.x+','+view.y+') scale('+view.k+')'}>
     {(config?.graph.edges||[]).map((e,i)=>{const a=geometry.positions.get(e.source),b=geometry.positions.get(e.target);if(!a||!b)return null;return <path key={e.id||i} d={'M '+(a.x+200)+' '+(a.y+a.h/2)+' C '+(a.x+250)+' '+(a.y+a.h/2)+', '+(b.x-50)+' '+(b.y+b.h/2)+', '+b.x+' '+(b.y+b.h/2)} fill="none" stroke={simulation?.edges.includes(e.id)?'var(--accent)':'var(--text-tertiary)'} strokeWidth={simulation?.edges.includes(e.id)?3:1.5} markerEnd={'url(#'+marker+')'}/>})}
     {geometry.nodes.map(n=><g key={n.id} data-node-id={n.id} transform={'translate('+n.x+','+n.y+')'}><title>{n.data.name}{'\n'}{n.data.animation}</title><rect width="200" height={n.h} rx="6" fill={simulation?.current===n.id?'var(--surface-3)':'var(--surface-2)'} stroke={colors[n.type]} strokeWidth={simulation?.current===n.id?3:1.5}/><text x="8" y="22" fontSize="14" fill="var(--text-primary)">{n.lines.map((line,i)=><tspan key={i} x="8" dy={i?20:0}>{line}</tspan>)}</text><text x="8" y={n.h-10} fontSize="11" fill="var(--text-secondary)">{names[n.type]||n.type}{simulation?.visited.includes(n.id)?' · 已执行':''}</text></g>)}
    </g>
   </svg>
   {!config&&<span className="trace-empty">开始预览后显示当前行为图</span>}
  </div>
 </div>
}
