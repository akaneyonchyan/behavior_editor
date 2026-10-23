import React,{useEffect,useRef,useState} from 'react'
import * as THREE from 'three'
import {OrbitControls} from 'three/addons/controls/OrbitControls.js'

export default function Island({world,actor,current,running=false,progress=0,onSelect}){
 const host=useRef(),data=useRef({world,actor,current,running,progress,onSelect}),[failed,setFailed]=useState('');data.current={world,actor,current,running,progress,onSelect}
 useEffect(()=>{
  const root=host.current;let renderer,raf;const objects=new Map(),labels=[]
  try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false})}catch{setFailed('此设备无法启用 WebGL，仍可在侧栏查看与单步执行。');return}
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.setClearColor('#82becb');renderer.shadowMap.enabled=true;root.appendChild(renderer.domElement)
  const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-65,65,55,-55,.1,500);camera.position.set(50,145,150)
  const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(50,0,45);controls.enableDamping=true;controls.enableRotate=false;controls.screenSpacePanning=true;controls.minZoom=.5;controls.maxZoom=5;controls.mouseButtons={LEFT:THREE.MOUSE.PAN,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:null};controls.touches={ONE:THREE.TOUCH.PAN,TWO:THREE.TOUCH.DOLLY_PAN}
  scene.add(new THREE.HemisphereLight('#fffbe8','#71949d',2.4));const sun=new THREE.DirectionalLight('#fff3cf',3);sun.position.set(40,100,30);sun.castShadow=true;scene.add(sun)
  const material=color=>new THREE.MeshStandardMaterial({color,roughness:1})
  function mesh(geo,color,x,y,z,parent=scene){const m=new THREE.Mesh(geo,material(color));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
  function land(points,y,color){const shape=new THREE.Shape();points.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));shape.closePath();const m=mesh(new THREE.ShapeGeometry(shape),color,0,y,0);m.rotation.x=-Math.PI/2;return m}
  land([[-8,-6],[25,-10],[70,-8],[106,-3],[112,28],[108,64],[114,96],[80,99],[53,94],[25,100],[-10,94],[-7,63],[-12,34]],-1,'#d9c391')
  land([[0,0],[27,-2],[67,0],[100,2],[103,30],[98,60],[103,89],[72,91],[48,87],[18,93],[-2,87],[2,58],[-3,27]],0,'#98b779')
  land([[1,0],[99,2],[98,15],[82,18],[67,14],[48,18],[30,14],[12,18],[2,13]],3,'#866640')
  land([[1,0],[99,2],[98,13],[82,16],[67,12],[48,16],[30,12],[12,16],[2,11]],4,'#a3bd7e')
  land([[16,15],[22,15],[21,31],[29,39],[46,31],[61,33],[76,43],[84,35],[83,18],[89,18],[90,37],[84,49],[92,66],[88,97],[82,98],[86,67],[78,49],[61,40],[47,38],[30,47],[21,44],[18,62],[13,99],[7,99],[12,61],[15,40],[13,29]],.12,'#83bdc5')
  for(const [x,z] of [[18,28],[86,29],[16,58],[85,67]])mesh(new THREE.BoxGeometry(12,.4,4),'#b79567',x,.65,z)
  mesh(new THREE.BoxGeometry(16,.6,5),'#aa8059',0,.1,94)
  for(const [x,z]of [[0,25],[106,50],[-4,74],[68,96]])mesh(new THREE.DodecahedronGeometry(3.5,0),'#737970',x,.5,z)
  const marker=mesh(new THREE.RingGeometry(2.1,2.4,48),'#ffe89a',0,.8,0);marker.rotation.x=-Math.PI/2
  const arc=mesh(new THREE.RingGeometry(2.5,2.8,60),'#3a916e',0,.85,0);arc.rotation.x=-Math.PI/2
  let phase=0
  for(let i=0;i<48;i++){const x=5+(i*17)%92,z=i<22?3+(i%3)*3:20+(i*13)%12;mesh(new THREE.CylinderGeometry(.3,.5,3,5),'#92735b',x,(z<12?4:0)+1.5,z);mesh(new THREE.ConeGeometry(1.8,5,6),'#638b61',x,(z<12?4:0)+5,z)}
  for(let i=0;i<9;i++)mesh(new THREE.BoxGeometry(5,.15,3),'#cbbb92',28+i*6,.2,59)
  const updateObjects=()=>{
   for(const o of data.current.world){if(o.inactive||objects.has(o.id))continue
    const group=new THREE.Group();scene.add(group);group.position.set(o.x,1,o.z);group.userData.id=o.id
    if(o.type==='partner'){
     mesh(new THREE.CapsuleGeometry(1.25,1.4,4,8),o.color,0,2,0,group);mesh(new THREE.SphereGeometry(1.3,12,8),'#f5e5cc',0,4,0,group)
     const ears=o.species.includes('兔')?2.6:o.species==='猫'?.5:1
     for(const x of [-.7,.7]){const ear=mesh(o.species==='仓鼠'?new THREE.SphereGeometry(.55,8,6):o.species==='猫'?new THREE.ConeGeometry(.55,1.2,4):new THREE.CapsuleGeometry(.35,ears,3,6),o.color,x,5,0,group);if(o.species==='垂耳兔'){ear.rotation.z=x<0?-1.2:1.2;ear.position.y=4.4}}
     if(o.species==='鹿')for(const x of [-.65,.65]){mesh(new THREE.CylinderGeometry(.13,.18,2,5),'#a28b66',x,6.5,0,group);const twig=mesh(new THREE.CylinderGeometry(.1,.13,1,5),'#a28b66',x*1.5,6.5,0,group);twig.rotation.z=x<0?-.8:.8}
     if(o.species==='马')mesh(new THREE.BoxGeometry(1.3,1,1.7),'#b3a1b3',0,3.8,1.1,group)
     for(const x of [-.45,.45])mesh(new THREE.SphereGeometry(.13,8,6),'#3b3c42',x,4.2,1.2,group)
    }else if(/树|木/.test(o.name)){
     mesh(new THREE.CylinderGeometry(.8,1,5,6),'#8b7156',0,2,0,group);mesh(new THREE.IcosahedronGeometry(3,0),'#80a36a',0,6,0,group)
    }else if(/床/.test(o.name)){mesh(new THREE.BoxGeometry(3.5,1,6),'#d7bf9d',0,.7,0,group);mesh(new THREE.BoxGeometry(3.2,.5,4),'#d7b8b8',0,1.5,1,group);mesh(new THREE.BoxGeometry(3,.5,1.3),'#fcf1d9',0,1.5,-1.7,group)}
    else if(/椅|凳/.test(o.name)){mesh(new THREE.BoxGeometry(2.5,.4,2.5),'#b99b79',0,1.5,0,group);mesh(new THREE.BoxGeometry(2.5,2,.4),'#b99b79',0,2.3,-1,group);for(const x of [-1,1])for(const z of [-1,1])mesh(new THREE.BoxGeometry(.25,1.5,.25),'#8e795c',x,.7,z,group)}
    else mesh(new THREE.BoxGeometry(3,1.8,2.5),o.color,0,1,0,group)
    group.traverse(m=>{if(m.isMesh)m.userData.id=o.id});objects.set(o.id,group)
    const label=document.createElement('button');label.className='island-label';label.textContent=o.name;label.onclick=()=>data.current.onSelect(o.id);root.appendChild(label);labels.push({id:o.id,label})
   }
   for(const [id,g] of objects)if(!data.current.world.some(o=>o.id===id&&!o.inactive)){scene.remove(g);g.traverse(m=>{m.geometry?.dispose();m.material?.dispose()});objects.delete(id);const i=labels.findIndex(l=>l.id===id);if(i>=0){labels[i].label.remove();labels.splice(i,1)}}
  }
  const size=()=>{const {width,height}=root.getBoundingClientRect();renderer.setSize(width,height);const aspect=width/Math.max(height,1);camera.left=-58*aspect;camera.right=58*aspect;camera.top=58;camera.bottom=-58;camera.updateProjectionMatrix()};const observer=new ResizeObserver(size);observer.observe(root);size()
  const clock=new THREE.Clock(),vector=new THREE.Vector3()
  const animate=()=>{
   updateObjects();const dt=Math.min(clock.getDelta(),.1)
   if(data.current.running)phase+=dt
   for(const o of data.current.world){const group=objects.get(o.id);if(!group)continue;const dx=o.x-group.position.x,dz=o.z-group.position.z;group.position.x+=dx*Math.min(1,dt*3);group.position.z+=dz*Math.min(1,dt*3);if(o.type==='partner'){if(Math.hypot(dx,dz)>.05)group.rotation.y=Math.atan2(dx,dz);group.position.y=1+(data.current.running&&(o.activity||o.id===data.current.actor)?Math.sin(phase*4)*.08:0)}}
   root.dataset.cameraKind="orthographic";root.dataset.cameraRotation=camera.quaternion.toArray().map(v=>v.toFixed(6)).join(",");root.dataset.cameraPosition=camera.position.toArray().join(",");root.dataset.cameraZoom=String(camera.zoom);const active=objects.get(data.current.actor);marker.visible=!!active;arc.visible=!!active;if(active){marker.position.set(active.position.x,.8,active.position.z);arc.position.set(active.position.x,.85,active.position.z);marker.scale.setScalar(data.current.running?1+Math.sin(phase*3)*.12:1);arc.geometry.setDrawRange(0,Math.floor(arc.geometry.index.count*Math.max(0,Math.min(1,data.current.progress))/6)*6)}
   controls.update();renderer.render(scene,camera)
   for(const {id,label} of labels){const group=objects.get(id),o=data.current.world.find(o=>o.id===id);label.dataset.worldX=o.x.toFixed(2);label.dataset.worldZ=o.z.toFixed(2);vector.copy(group.position);vector.y+=o.type==='partner'?9:5;vector.project(camera);label.style.left=((vector.x+1)*root.clientWidth/2)+'px';label.style.top=((-vector.y+1)*root.clientHeight/2)+'px';label.style.display=Math.abs(vector.x)>1||Math.abs(vector.y)>1?'none':'';label.classList.toggle('active',id===data.current.actor);label.textContent=o.name+(o.previewOnly?'（预览占位）':'')+((o.activity||id===data.current.actor&&data.current.current)?' · '+(data.current.running?'▶ ':'')+(o.activity||data.current.current)+(data.current.running?' '+Math.round((o.activityProgress??data.current.progress)*100)+'%':''):'')}
   raf=requestAnimationFrame(animate)
  };animate()
  return()=>{cancelAnimationFrame(raf);observer.disconnect();controls.dispose();scene.traverse(m=>{m.geometry?.dispose();if(Array.isArray(m.material))m.material.forEach(x=>x.dispose());else m.material?.dispose()});renderer.dispose();renderer.domElement.remove();labels.forEach(x=>x.label.remove())}
 },[])
 return <div className="island" onContextMenu={e=>e.preventDefault()} ref={host} aria-label="行为预览小岛"><div className="island-hint">固定正交视角 · 滚轮缩放 · 左键拖拽平移 · 点击伙伴查看</div>{failed&&<p className="scene-error">{failed}</p>}</div>
}
