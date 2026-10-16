import React, { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './TextChoice.css'

export default function TextChoice({ label, value, options, onChange, placeholder }) {
  const id=useId(), input=useRef(null), menu=useRef(null)
  const [open,setOpen]=useState(false), [position,setPosition]=useState(null), [query,setQuery]=useState(''), [active,setActive]=useState(-1)
  const choices=options.filter(option=>!query||option.includes(query))
  useEffect(()=>{
    if(!open)return
    const place=()=>{
      const r=input.current.getBoundingClientRect(), width=Math.min(Math.max(r.width,220),window.innerWidth-16)
      const below=window.innerHeight-r.bottom-12, above=r.top-12, height=Math.min(220,Math.max(below,above))
      setPosition({left:Math.max(8,Math.min(r.left,window.innerWidth-width-8)),width,maxHeight:height,...(below>=Math.min(220,choices.length*36+8)||below>=above?{top:r.bottom+4}:{bottom:window.innerHeight-r.top+4})})
    }
    const scroll=e=>{
      if(menu.current?.contains(e.target))return
      const r=input.current.getBoundingClientRect()
      let parent=input.current.parentElement
      while(parent){
        if(/auto|scroll|hidden/.test(getComputedStyle(parent).overflowY)){
          const bounds=parent.getBoundingClientRect()
          if(r.bottom<=bounds.top||r.top>=bounds.bottom){setOpen(false);return}
        }
        parent=parent.parentElement
      }
      place()
    }
    const outside=e=>{if(!input.current?.parentElement.contains(e.target)&&!menu.current?.contains(e.target))setOpen(false)}
    place();window.addEventListener('resize',place);window.addEventListener('scroll',scroll,true);document.addEventListener('pointerdown',outside)
    return()=>{window.removeEventListener('resize',place);window.removeEventListener('scroll',scroll,true);document.removeEventListener('pointerdown',outside)}
  },[open,choices.length])
  const choose=option=>{onChange(option);setOpen(false);setActive(-1)}
  return <div className="text-choice">
    <input ref={input} aria-label={label} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={open?id:undefined} aria-activedescendant={open&&active>=0?id+'-'+active:undefined}
      value={value} placeholder={placeholder} autoComplete="off"
      onFocus={()=>{setQuery('');setOpen(true);setActive(-1)}} onClick={()=>setOpen(true)} onBlur={()=>setOpen(false)}
      onChange={e=>{onChange(e.target.value);setQuery(e.target.value);setActive(-1);setOpen(true)}}
      onKeyDown={e=>{
        if(e.nativeEvent.isComposing)return
        if(e.key==='Escape'){e.preventDefault();setOpen(false)}
        if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();setOpen(true);setActive(n=>choices.length?(n+(e.key==='ArrowDown'?1:-1)+choices.length)%choices.length:-1)}
        if(e.key==='Enter'&&open&&active>=0&&choices[active]){e.preventDefault();choose(choices[active])}
      }}/>
    <button type="button" className="text-choice-toggle" aria-label={'展开'+label} tabIndex={-1} onMouseDown={e=>e.preventDefault()} onClick={()=>{input.current.focus();setQuery('');setOpen(!open)}}>▾</button>
    {open&&position&&createPortal(<div ref={menu} id={id} role="listbox" aria-label={label+'选项'} className="text-choice-menu" style={position}>
      {choices.map((option,i)=><div key={option} id={id+'-'+i} role="option" aria-selected={active===i} className={active===i?'active':''} onMouseDown={e=>e.preventDefault()} onClick={()=>choose(option)}>{option}</div>)}
      {!choices.length&&<div className="text-choice-empty">可直接填写自己的描述</div>}
    </div>,document.body)}
  </div>
}
