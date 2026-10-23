import React,{useEffect,useRef,useState} from 'react'
import * as THREE from 'three'
import {OrbitControls} from 'three/addons/controls/OrbitControls.js'
import {scenery,objectModel} from './islandScenery.mjs'
import {DISTRICTS} from './mapLayout.mjs'
import {objectStates,visualPosition} from './sceneStatus.mjs'

export default function Island({world,actor,selected,library,current,running=false,progress=0,onSelect}){
 const host=useRef(),focus=useRef(),data=useRef(),[failed,setFailed]=useState('')
 data.current={world,actor,selected,library,current,running,progress,onSelect}
 const objectsInScene=world.filter(o=>!o.inactive&&o.type!=='partner'),issues=objectsInScene.map(o=>({o,states:objectStates(o,world,library)})).filter(x=>x.states.length)
 useEffect(()=>{
  const root=host.current;let renderer,raf;const objects=new Map(),labels=[],zoneLabels=[]
  try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false})}catch{setFailed('此设备无法启用 WebGL，仍可在侧栏查看与单步执行。');return}
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));renderer.setClearColor('#87bfc3');renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;root.appendChild(renderer.domElement)
  const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-95,95,58,-58,.1,500);camera.position.set(80,160,170)
  const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(80,0,50);controls.enableDamping=false;controls.enableRotate=false;controls.screenSpacePanning=true;controls.minZoom=.5;controls.maxZoom=5;controls.mouseButtons={LEFT:THREE.MOUSE.PAN,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:null};controls.touches={ONE:THREE.TOUCH.PAN,TWO:THREE.TOUCH.DOLLY_PAN}
  scene.add(new THREE.HemisphereLight('#fff8e5','#83a39a',2.2));const sun=new THREE.DirectionalLight('#fff1ce',2.4);sun.position.set(30,130,20);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-110;sun.shadow.camera.right=110;sun.shadow.camera.top=100;sun.shadow.camera.bottom=-100;sun.shadow.bias=-.001;sun.target.position.set(80,0,50);scene.add(sun,sun.target)
  const kit=scenery(scene),{mesh}=kit
  const marker=mesh(new THREE.RingGeometry(2.7,3,48),'#ffe7a6',0,.8,0);marker.rotation.x=-Math.PI/2
  const arc=mesh(new THREE.RingGeometry(3.2,3.5,60),'#3a916e',0,.85,0);arc.rotation.x=-Math.PI/2
  const selectRing=mesh(new THREE.RingGeometry(3.5,3.8,48),'#fff1b8',0,.5,0);selectRing.rotation.x=-Math.PI/2
  let phase=0,hovered=null
  focus.current=id=>{const o=data.current.world.find(o=>o.id===id);if(!o)return;const p=visualPosition(o,data.current.world),offset=new THREE.Vector3(p.x,0,p.z).sub(controls.target);controls.target.add(offset);camera.position.add(offset);controls.update()}
  for(const zone of DISTRICTS){const el=document.createElement('span');el.className='island-zone';el.textContent=zone.name;root.appendChild(el);zoneLabels.push({el,...zone})}
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();let down=null
  function hit(e){const b=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-b.left)/b.width*2-1,-(e.clientY-b.top)/b.height*2+1);ray.setFromCamera(pointer,camera);return ray.intersectObjects([...objects.values()],true).find(h=>h.object.userData.id)?.object.userData.id}
  const pointerDown=e=>{down={x:e.clientX,y:e.clientY,button:e.button}}
  const pointerMove=e=>{if(!e.buttons)hovered=hit(e)||null}
  const pointerUp=e=>{if(down?.button===0&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<5){const id=hit(e);if(id)data.current.onSelect(id)}down=null}
  const pointerLeave=()=>{hovered=null}
  renderer.domElement.addEventListener('pointerdown',pointerDown);renderer.domElement.addEventListener('pointermove',pointerMove);renderer.domElement.addEventListener('pointerup',pointerUp);renderer.domElement.addEventListener('pointerleave',pointerLeave)
  const updateObjects=()=>{
   for(const o of data.current.world){if(o.inactive||objects.has(o.id))continue
    const group=new THREE.Group(),p=visualPosition(o,data.current.world);scene.add(group);group.position.set(p.x,0,p.z)
    if(o.type==='partner'){
     mesh(new THREE.CapsuleGeometry(1.25,1.4,4,8),o.color,0,2,0,group);mesh(new THREE.SphereGeometry(1.3,12,8),'#f5e5cc',0,4,0,group)
     const ears=o.species.includes('兔')?2.6:o.species==='猫'?.5:1
     for(const x of [-.7,.7]){const ear=mesh(o.species==='仓鼠'?new THREE.SphereGeometry(.55,8,6):o.species==='猫'?new THREE.ConeGeometry(.55,1.2,4):new THREE.CapsuleGeometry(.35,ears,3,6),o.color,x,5,0,group);if(o.species==='垂耳兔'){ear.rotation.z=x<0?-1.2:1.2;ear.position.y=4.4}}
     if(o.species==='鹿')for(const x of [-.65,.65])mesh(new THREE.CylinderGeometry(.13,.18,2,5),'#a28b66',x,6.5,0,group)
     if(o.species==='马')mesh(new THREE.BoxGeometry(1.3,1,1.7),'#b3a1b3',0,3.8,1.1,group)
     for(const x of [-.45,.45])mesh(new THREE.SphereGeometry(.13,8,6),'#3b3c42',x,4.2,1.2,group)
    }else objectModel(o,group,kit)
    group.traverse(m=>{if(m.isMesh)m.userData.id=o.id});objects.set(o.id,group)
    const label=document.createElement('button'),name=document.createElement('span'),badges=document.createElement('span');label.className='island-label';name.className='island-object-name';badges.className='island-object-badges';label.append(name,badges);label.onclick=()=>data.current.onSelect(o.id);root.appendChild(label);labels.push({id:o.id,label,name,badges,signature:''})
   }
   for(const [id,g]of objects)if(!data.current.world.some(o=>o.id===id&&!o.inactive)){scene.remove(g);g.traverse(m=>m.geometry?.dispose());objects.delete(id);const i=labels.findIndex(l=>l.id===id);if(i>=0){labels[i].label.remove();labels.splice(i,1)}}
  }
  const size=()=>{const {width,height}=root.getBoundingClientRect();renderer.setSize(width,height);const aspect=width/Math.max(height,1),half=Math.max(58,91/aspect);camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix()};const observer=new ResizeObserver(size);observer.observe(root);size()
  const clock=new THREE.Clock(),vector=new THREE.Vector3()
  const project=(x,y,z)=>{vector.set(x,y,z).project(camera);return {x:(vector.x+1)*root.clientWidth/2,y:(1-vector.y)*root.clientHeight/2,visible:Math.abs(vector.x)<1&&Math.abs(vector.y)<1}}
  const animate=()=>{
   updateObjects();const dt=Math.min(clock.getDelta(),.1),d=data.current
   if(d.running)phase+=dt
   for(const o of d.world){const g=objects.get(o.id);if(!g)continue;const p=visualPosition(o,d.world),dx=p.x-g.position.x,dz=p.z-g.position.z;g.position.x+=dx*Math.min(1,dt*5);g.position.z+=dz*Math.min(1,dt*5);if(o.type==='partner'){if(Math.hypot(dx,dz)>.05)g.rotation.y=Math.atan2(dx,dz);g.position.y=d.running&&(o.activity||o.id===d.actor)?Math.sin(phase*4)*.08:0}}
   controls.update();root.dataset.cameraKind='orthographic';root.dataset.cameraRotation=camera.quaternion.toArray().map(v=>v.toFixed(6)).join(',');root.dataset.cameraPosition=camera.position.toArray().join(',');root.dataset.cameraZoom=String(camera.zoom)
   const active=objects.get(d.actor),chosen=objects.get(d.selected);marker.visible=!!active;arc.visible=!!active;selectRing.visible=!!chosen&&d.selected!==d.actor
   if(active){marker.position.set(active.position.x,.8,active.position.z);arc.position.set(active.position.x,.85,active.position.z);arc.geometry.setDrawRange(0,Math.floor(arc.geometry.index.count*Math.max(0,Math.min(1,d.progress))/6)*6)}
   if(chosen)selectRing.position.set(chosen.position.x,.5,chosen.position.z)
   renderer.render(scene,camera)
   for(const zone of zoneLabels){const p=project(zone.x,0,zone.z);zone.el.style.left=p.x+'px';zone.el.style.top=p.y+'px';zone.el.style.display=p.visible?'':'none'}
   const occupied=[]
   const entries=labels.map(l=>{const o=d.world.find(o=>o.id===l.id),states=objectStates(o,d.world,d.library);return {...l,ref:l,o,states,priority:(l.id===d.selected||l.id===d.actor||l.id===hovered?100:0)+(states.length?50:0)+(o.type==='partner'?20:0)}}).sort((a,b)=>b.priority-a.priority)
   for(const {id,label,name,badges,ref,o,states,priority}of entries){
    const g=objects.get(id),p=project(g.position.x,o.type==='partner'||o.type==='environmentItem'?9:5.5,g.position.z),activity=o.activity||(id===d.actor?d.current:'')
    name.textContent=o.name+(activity?' · '+(d.running?'▶ ':'')+activity:'');label.title=[o.name,o.zone,o.previewOnly?'预览占位':'',...states.map(s=>s.detail)].filter(Boolean).join(' · ');label.setAttribute('aria-label',[o.name,...states.map(s=>s.label)].join(' · '))
    label.dataset.objectId=id;label.dataset.worldX=o.x.toFixed(2);label.dataset.worldZ=o.z.toFixed(2);label.dataset.states=states.map(s=>s.id).join(' ');label.classList.toggle('active',id===d.actor);label.classList.toggle('is-selected',id===d.selected);label.classList.toggle('has-state',!!states.length)
    const signature=states.map(s=>s.id+s.label).join('|');if(ref.signature!==signature){ref.signature=signature;badges.replaceChildren(...states.map(s=>{const b=document.createElement('span');b.className='scene-badge '+s.tone;b.textContent=(s.tone==='danger'?'! ':s.id==='occupied'?'● ':'◆ ')+s.label;return b}))}
    label.style.display=p.visible?'':'none';if(!p.visible)continue
    const w=Math.min(164,label.offsetWidth||80),h=label.offsetHeight||22,x=Math.max(4,Math.min(root.clientWidth-w-4,p.x-w/2));let y=p.y-h,found=false
    for(const offset of priority>=20?[0,-h-4,h+4,-2*h-8]:[0]){const yy=y+offset;if(yy<40||yy+h>root.clientHeight-36)continue;if(occupied.some(r=>x<r.x+r.w+4&&x+w+4>r.x&&yy<r.y+r.h+3&&yy+h+3>r.y))continue;y=yy;found=true;break}
    if(!found&&priority<50){label.style.display='none';continue}
    y=Math.max(40,Math.min(root.clientHeight-h-36,y));label.style.left=x+'px';label.style.top=y+'px';label.style.zIndex=String(priority+2);occupied.push({x,y,w,h})
   }
   raf=requestAnimationFrame(animate)
  };animate()
  return()=>{cancelAnimationFrame(raf);focus.current=null;observer.disconnect();controls.dispose();renderer.domElement.removeEventListener('pointerdown',pointerDown);renderer.domElement.removeEventListener('pointermove',pointerMove);renderer.domElement.removeEventListener('pointerup',pointerUp);renderer.domElement.removeEventListener('pointerleave',pointerLeave);const materials=new Set();scene.traverse(m=>{m.geometry?.dispose();if(m.material)for(const v of Array.isArray(m.material)?m.material:[m.material])materials.add(v)});materials.forEach(m=>m.dispose());renderer.dispose();renderer.domElement.remove();labels.forEach(x=>x.label.remove());zoneLabels.forEach(x=>x.el.remove())}
 },[])
 const select=id=>{onSelect(id);focus.current?.(id)}
 return <div className='island' onContextMenu={e=>e.preventDefault()} ref={host} aria-label='行为预览小岛'>
  <div className='island-heading'><strong>伙伴的小岛</strong><span>生活 · 采集 · 手作 · 滨水</span></div>
  <details className='scene-overview'><summary>场景状况 <b>{issues.length}</b></summary><div className='scene-overview-list'>{issues.length?issues.map(({o,states})=><button key={o.id} onClick={()=>select(o.id)}><strong>{o.name}</strong>{states.map(s=><span key={s.id} className={'scene-badge '+s.tone}>{s.label}</span>)}</button>):<p>当前没有异常或占用。</p>}</div><details><summary>全部场景对象（{objectsInScene.length}）</summary><div className='scene-overview-list'>{objectsInScene.map(o=><button key={o.id} onClick={()=>select(o.id)}>{o.name}<small>{o.zone}</small></button>)}</div></details></details>
  <div className='island-hint'>固定正交视角 · 滚轮缩放 · 左键拖拽平移 · 点击对象查看</div>{failed&&<p className='scene-error'>{failed}</p>}
 </div>
}
