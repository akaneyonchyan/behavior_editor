import React,{useEffect,useRef,useState} from 'react'
import {createPortal} from 'react-dom'
import {DndContext,DragOverlay,PointerSensor,KeyboardSensor,useSensor,useSensors,pointerWithin,closestCorners} from '@dnd-kit/core'
import {SortableContext,useSortable,verticalListSortingStrategy,arrayMove} from '@dnd-kit/sortable'
import {CSS} from '@dnd-kit/utilities'
import {useBehaviorStore} from '../store/behaviorStore'
import './SortableList.css'

// Transient UI identities keep duplicate strings/legacy objects distinct without changing JSON.
function reconcile(previous,items){
 if(previous.length===items.length&&!items.some(value=>value?.id))return items.map((value,i)=>({...previous[i],value}))
 const used=new Set(),next=items.map(value=>{
  const match=previous.findIndex((entry,i)=>!used.has(i)&&(value?.id?entry.value?.id===value.id:entry.value===value))
  if(match<0)return null
  used.add(match);return {...previous[match],value}
 })
 return next.map((entry,i)=>{
  if(entry)return entry
  const fallback=previous[i]&&!used.has(i)?previous[i]:null
  if(fallback)used.add(i)
  return {id:fallback?.id||crypto.randomUUID(),value:items[i]}
 })
}
function SortableRow({entry,index,disabled,label,children}){
 const {attributes,listeners,setNodeRef,setActivatorNodeRef,transform,transition,isDragging,isOver}=useSortable({id:entry.id,disabled})
 const handle=<button type="button" className="sort-handle" ref={setActivatorNodeRef} {...attributes} {...listeners} aria-label={'拖动排序：'+label} title="拖动排序；空格抓取，方向键移动，空格确认，Esc取消" disabled={disabled}>⠿</button>
 return <div ref={setNodeRef} data-sortable-row data-sortable-id={entry.id} className={'sortable-row'+(isDragging?' sorting':'')+(isOver&&!isDragging?' sort-over':'')} style={{transform:CSS.Transform.toString(transform),transition}}>{children(entry.value,index,handle)}</div>
}
export default function SortableList({items,onChange,label,children,itemLabel}){
 const scope=useBehaviorStore(s=>(s.selectedNode?.id||'metadata')+':'+s.documentRevision)
 const keyboardTarget=useRef(null),refs=useRef([]),capture=useRef(null),[active,setActive]=useState(null),[epoch,setEpoch]=useState(0)
 refs.current=reconcile(refs.current,items)
 const entries=refs.current,signature=JSON.stringify(items),latest=useRef(null)
 latest.current={items,signature,scope,onChange}
 const coordinates=(event,{currentCoordinates})=>{
  if(!['ArrowDown','ArrowUp'].includes(event.code))return
  event.preventDefault()
  const ids=refs.current.map(e=>e.id),index=ids.indexOf(keyboardTarget.current),next=Math.max(0,Math.min(ids.length-1,index+(event.code==='ArrowDown'?1:-1)))
  keyboardTarget.current=ids[next]
  document.querySelector('[data-sortable-id="'+ids[next]+'"]')?.scrollIntoView({block:'nearest'})
  return {...currentCoordinates,y:currentCoordinates.y+(next-index)*10}
 }
 const sensors=useSensors(useSensor(PointerSensor,{activationConstraint:{distance:6}}),useSensor(KeyboardSensor,{coordinateGetter:coordinates}))
 const reset=()=>{capture.current=null;keyboardTarget.current=null;setActive(null)}
 useEffect(()=>{if(capture.current&&(capture.current.signature!==signature||capture.current.scope!==scope)){reset();setEpoch(n=>n+1)}},[signature,scope])
 const name=(value,i)=>itemLabel?.(value,i)||label+' '+(i+1)
 return <DndContext key={scope+':'+epoch} sensors={sensors} collisionDetection={args=>keyboardTarget.current?[{id:keyboardTarget.current}]:args.pointerCoordinates?pointerWithin(args):closestCorners(args)}
  accessibility={{screenReaderInstructions:{draggable:'按空格抓取，使用上下方向键排序，空格确认，Escape取消。'},announcements:{onDragStart:()=> '开始排序',onDragOver:({over})=>over?'已选中插入位置':'已离开列表',onDragEnd:()=> '排序结束',onDragCancel:()=> '已取消排序'}}}
  onDragStart={({active,activatorEvent})=>{keyboardTarget.current=activatorEvent.type==='keydown'?active.id:null;capture.current={signature,scope,ids:entries.map(e=>e.id)};setActive(active.id)}}
  onDragCancel={reset}
  onDragEnd={({active,over})=>{
   const saved=capture.current,current=latest.current;reset()
   if(!saved||!over||saved.scope!==current.scope||saved.signature!==current.signature)return
   const from=saved.ids.indexOf(active.id),to=saved.ids.indexOf(over.id)
   if(from<0||to<0||from===to)return
   refs.current=arrayMove(refs.current,from,to)
   current.onChange(arrayMove(current.items,from,to))
  }}>
  <SortableContext items={entries.map(e=>e.id)} strategy={verticalListSortingStrategy}>
   <div className="sortable-list" aria-label={label+'排序'}>{entries.map((entry,i)=><SortableRow key={entry.id} entry={entry} index={i} disabled={items.length<2} label={name(entry.value,i)}>{children}</SortableRow>)}</div>
  </SortableContext>
  {typeof document!=="undefined"&&document.body&&createPortal(<DragOverlay dropAnimation={null}>{active&&<div className="sort-preview">⠿ {name(entries.find(e=>e.id===active)?.value,entries.findIndex(e=>e.id===active))}</div>}</DragOverlay>,document.body)}
 </DndContext>
}
