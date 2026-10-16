// Routes on rectangle boundaries; rounded corners stay outside the real node bounds.
export const PADDING = 24
const EPS = 0.001
export const inside = (p, r) => p.x > r.left + EPS && p.x < r.right - EPS && p.y > r.top + EPS && p.y < r.bottom - EPS
export function segmentBlocked(a, b, rects) {
  return rects.some(r => {
    if (Math.abs(a.y - b.y) < EPS) return a.y > r.top + EPS && a.y < r.bottom - EPS && Math.max(a.x,b.x) > r.left + EPS && Math.min(a.x,b.x) < r.right - EPS
    if (Math.abs(a.x - b.x) < EPS) return a.x > r.left + EPS && a.x < r.right - EPS && Math.max(a.y,b.y) > r.top + EPS && Math.min(a.y,b.y) < r.bottom - EPS
    return true
  })
}
class Heap {
  items = []
  push(v) { const a=this.items; a.push(v); let i=a.length-1; while(i>0){const p=(i-1)>>1;if(a[p].f<=v.f)break;a[i]=a[p];i=p}a[i]=v }
  pop() { const a=this.items, first=a[0], last=a.pop(); if(a.length){let i=0;while(i*2+1<a.length){let c=i*2+1;if(c+1<a.length&&a[c+1].f<a[c].f)c++;if(a[c].f>=last.f)break;a[i]=a[c];i=c}a[i]=last}return first }
}
function search(start, end, obstacles, margin) {
  const area = {left:Math.min(start.x,end.x)-margin,right:Math.max(start.x,end.x)+margin,top:Math.min(start.y,end.y)-margin,bottom:Math.max(start.y,end.y)+margin}
  const rects = obstacles.filter(r=>r.left<area.right&&r.right>area.left&&r.top<area.bottom&&r.bottom>area.top)
  const xs = [...new Set([area.left,area.right,start.x,end.x,...rects.flatMap(r=>[Math.max(area.left,r.left),Math.min(area.right,r.right)])])].sort((a,b)=>a-b)
  const ys = [...new Set([area.top,area.bottom,start.y,end.y,...rects.flatMap(r=>[Math.max(area.top,r.top),Math.min(area.bottom,r.bottom)])])].sort((a,b)=>a-b)
  if(xs.length*ys.length>60000) return null
  const width=xs.length, initial=ys.indexOf(start.y)*width+xs.indexOf(start.x), goal=ys.indexOf(end.y)*width+xs.indexOf(end.x)
  const open=new Heap(), dist=new Map([[initial,0]]), prev=new Map(), checked=new Map()
  const point = id => ({x:xs[id%width],y:ys[Math.floor(id/width)]})
  open.push({id:initial,g:0,f:Math.abs(start.x-end.x)+Math.abs(start.y-end.y)})
  let iterations=0
  while(open.items.length && iterations++<60000){
    const current=open.pop(), id=current.id
    if(current.g!==dist.get(id))continue
    if(id===goal){const path=[];let k=id;while(k!==undefined){path.push(point(k));k=prev.get(k)}return path.reverse()}
    const x=id%width,y=Math.floor(id/width), a=point(id)
    const neighbors=[]
    if(x>0)neighbors.push(id-1);if(x+1<width)neighbors.push(id+1);if(y>0)neighbors.push(id-width);if(y+1<ys.length)neighbors.push(id+width)
    for(const next of neighbors){
      const b=point(next), key=Math.min(id,next)+':'+Math.max(id,next)
      let blocked=checked.get(key)
      if(blocked===undefined){blocked=segmentBlocked(a,b,rects);checked.set(key,blocked)}
      if(blocked)continue
      const g=current.g+Math.abs(a.x-b.x)+Math.abs(a.y-b.y)
      if(g >= (dist.get(next)??Infinity))continue
      dist.set(next,g);prev.set(next,id);open.push({id:next,g,f:g+Math.abs(b.x-end.x)+Math.abs(b.y-end.y)})
    }
  }
  return null
}
function simplify(points){
  const out=[]
  for(const p of points){
    if(out.length&&Math.abs(out.at(-1).x-p.x)<EPS&&Math.abs(out.at(-1).y-p.y)<EPS)continue
    while(out.length>=2){const a=out.at(-2),b=out.at(-1);if((a.x===b.x&&b.x===p.x)||(a.y===b.y&&b.y===p.y))out.pop();else break}
    out.push(p)
  }
  return out
}
export function roundedPath(points, rects) {
  const p=simplify(points), commands=[['M',p[0].x,p[0].y]]
  for(let i=1;i<p.length-1;i++){
    const a=p[i-1], b=p[i], c=p[i+1], before=Math.hypot(b.x-a.x,b.y-a.y), after=Math.hypot(c.x-b.x,c.y-b.y)
    let radius=Math.min(28,before/2,after/2), enter,exit
    for(;;){
      enter={x:b.x+(a.x-b.x)*radius/before,y:b.y+(a.y-b.y)*radius/before}
      exit={x:b.x+(c.x-b.x)*radius/after,y:b.y+(c.y-b.y)*radius/after}
      const box={left:Math.min(enter.x,b.x,exit.x),right:Math.max(enter.x,b.x,exit.x),top:Math.min(enter.y,b.y,exit.y),bottom:Math.max(enter.y,b.y,exit.y)}
      // Quadratic Bezier lies inside its control-point bounding box.
      if(!rects.some(r=>box.right>r.left&&box.left<r.right&&box.bottom>r.top&&box.top<r.bottom)||radius<0.25)break
      radius/=2
    }
    commands.push(['L',enter.x,enter.y],['Q',b.x,b.y,exit.x,exit.y])
  }
  commands.push(['L',p.at(-1).x,p.at(-1).y])
  return { path:commands.map(c=>c.join(' ')).join(' '), commands }
}
export function routeEdge({source,target,sourceId,targetId,rects}) {
  const from=rects.find(r=>r.id===sourceId), to=rects.find(r=>r.id===targetId)
  if(!from||!to)return {error:'等待节点尺寸'}
  // Current editor has fixed right-side sources and left-side targets.
  const start={x:Math.max(source.x,from.right)+PADDING,y:source.y}, end={x:Math.min(target.x,to.left)-PADDING,y:target.y}
  const expanded=rects.map(r=>({...r,left:r.left-PADDING,right:r.right+PADDING,top:r.top-PADDING,bottom:r.bottom+PADDING}))
  if(segmentBlocked(source,start,rects.filter(r=>r.id!==sourceId))||segmentBlocked(end,target,rects.filter(r=>r.id!==targetId))||expanded.some(r=>inside(start,r)||inside(end,r)))return {error:'出口被遮挡，请移开重叠或过近的节点'}
  let points
  for(const margin of [160,640,2400]){points=search(start,end,expanded,margin);if(points)break}
  if(!points)return {error:'无法找到安全路径，请拉开节点间距'}
  return {...roundedPath([source,...points,target],rects),points:[source,...points,target]}
}
