// Keep geometry independent of the browser so limits and framing can be tested.
export const PNG_LIMITS = { edge: 8192, pixels: 24000000 }
export function exportFrame(rects, viewport, size, scope = 'all', scale = 2) {
  if (!['all', 'visible'].includes(scope) || ![1, 2].includes(scale)) throw new Error('导出选项无效')
  if (!Number.isFinite(viewport.zoom) || viewport.zoom <= 0) throw new Error('画布尚未准备好，请稍后重试')
  let width = size.width, height = size.height, x = viewport.x, y = viewport.y, zoom = viewport.zoom
  if (scope === 'all') {
    if (!rects.length) throw new Error('没有可导出的节点')
    const left = Math.min(...rects.map(r => r.x)), top = Math.min(...rects.map(r => r.y))
    const right = Math.max(...rects.map(r => r.x + r.width)), bottom = Math.max(...rects.map(r => r.y + r.height))
    width = Math.ceil(right - left + 96); height = Math.ceil(bottom - top + 96)
    x = 48 - left; y = 48 - top; zoom = 1
  }
  width=Math.ceil(width);height=Math.ceil(height)
  const pixelWidth = width * scale, pixelHeight = height * scale
  if (![width,height,x,y,zoom,pixelWidth,pixelHeight].every(Number.isFinite) || width <= 0 || height <= 0) throw new Error('画布尺寸无效，请等待节点加载完成')
  if (pixelWidth > PNG_LIMITS.edge || pixelHeight > PNG_LIMITS.edge || pixelWidth * pixelHeight > PNG_LIMITS.pixels) {
    throw new Error('图片过大（' + pixelWidth + '×' + pixelHeight + '），请降低到标准 1 倍或改为当前可见区域')
  }
  return {width,height,x,y,zoom,pixelWidth,pixelHeight,scale}
}
export function pngName(name, date = new Date()) {
  const pad = n => String(n).padStart(2,'0')
  const stamp = date.getFullYear() + pad(date.getMonth()+1) + pad(date.getDate()) + '-' + pad(date.getHours()) + pad(date.getMinutes()) + pad(date.getSeconds())
  return (name || '未命名行为').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0,80) + '-行为图-' + stamp + '.png'
}
let exporting = false
const auxiliary = '.react-flow__background,.react-flow__panel,.react-flow__minimap,.react-flow__controls,.react-flow__attribution,.react-flow__handle,.react-flow__selection,.react-flow__nodesselection,.react-flow__connection,.edge-flow-trail,.edge-flow-head,.react-flow__edge-interaction'

export function captureCanvas(source, {scope='all', scale=2}={}) {
  const viewport = source?.querySelector('.react-flow__viewport')
  if (!viewport || !source.querySelector('.react-flow__node')) throw new Error('画布尚未准备好，请稍后重试')
  const bounds = source.getBoundingClientRect(), matrix = new DOMMatrix(getComputedStyle(viewport).transform)
  const view = {x:matrix.m41,y:matrix.m42,zoom:matrix.a}
  const nodes = [...source.querySelectorAll('.react-flow__node')]
  if (nodes.some(n => getComputedStyle(n).visibility === 'hidden' || !n.getBoundingClientRect().width)) throw new Error('节点正在布局，请稍后重试')
  // DOM path bounds include the actual Bezier extrema, including backwards loops.
  const rects = [...nodes,...source.querySelectorAll('.react-flow__edge-path')].map(el => {
    const r=el.getBoundingClientRect()
    return {x:(r.left-bounds.left-view.x)/view.zoom,y:(r.top-bounds.top-view.y)/view.zoom,width:r.width/view.zoom,height:r.height/view.zoom}
  })
  const frame=exportFrame(rects,view,{width:bounds.width,height:bounds.height},scope,scale)
  const clone=source.cloneNode(true)
  clone.setAttribute('aria-hidden','true'); clone.classList.add('png-export-snapshot')
  clone.querySelectorAll(auxiliary).forEach(el=>el.remove())
  clone.querySelectorAll('.selected').forEach(el=>el.classList.remove('selected'))
  clone.querySelectorAll('.react-flow__edge-path').forEach(el=>{el.style.stroke='#83909f'})
  const cv=clone.querySelector('.react-flow__viewport')
  cv.style.transform='translate('+frame.x+'px, '+frame.y+'px) scale('+frame.zoom+')'
  cv.style.transition='none'
  // IDs must stay intact: SVG arrows refer to marker definitions in this snapshot.
  Object.assign(clone.style,{width:frame.width+'px',height:frame.height+'px',position:'relative',overflow:'hidden',backgroundColor:'#05070c',pointerEvents:'none'})
  return {clone,frame}
}
function download(blob,name) {
  const url=URL.createObjectURL(blob), a=document.createElement('a')
  a.href=url;a.download=name;document.body.append(a);a.click();a.remove()
  setTimeout(()=>URL.revokeObjectURL(url),1000)
}
// Called during the export button gesture, before asynchronous rendering loses user activation.
export async function preparePngDestination(name,directory,picker=globalThis.showSaveFilePicker?.bind(globalThis)){
  if(!picker)return {saved:false}
  let handle
  try{handle=await picker({id:'pps-behavior-png',suggestedName:pngName(name),...(directory?{startIn:directory}:{}),types:[{description:'PNG 图片',accept:{'image/png':['.png']}}],excludeAcceptAllOption:true})}
  catch(e){if(e.name==='AbortError')return {cancelled:true};throw e}
  return {saved:true,name:handle.name,download:async blob=>{
    const stream=await handle.createWritable()
    try{await stream.write(blob);await stream.close()}
    catch(e){try{await stream.abort()}catch{}throw e}
  }}
}
export async function exportCanvasPng(source, options={}, services={}) {
  if(exporting)throw new Error('正在导出，请等待当前图片完成')
  exporting=true
  let host
  try {
    if(document.fonts)await document.fonts.ready
    const {clone,frame}=captureCanvas(source,options)
    host=document.createElement('div')
    Object.assign(host.style,{position:'fixed',left:'-100000px',top:'0',pointerEvents:'none'})
    host.setAttribute('aria-hidden','true');host.append(clone);document.body.append(host)
    const render=services.render || (await import('html-to-image')).toBlob
    const blob=await render(clone,{width:frame.width,height:frame.height,pixelRatio:frame.scale,backgroundColor:'#05070c',skipAutoScale:true,fontEmbedCSS:''})
    if(!blob || !blob.size)throw new Error('图片生成失败，请降低清晰度后重试')
    await (services.download || download)(blob,pngName(options.name))
    return frame
  } finally {host?.remove();exporting=false}
}
