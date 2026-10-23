import * as T from 'three'

export function scenery(scene){
 const materials=new Map()
 const mat=c=>{if(!materials.has(c))materials.set(c,new T.MeshStandardMaterial({color:c,roughness:1}));return materials.get(c)}
 const mesh=(geo,c,x,y,z,parent=scene)=>{const m=new T.Mesh(geo,mat(c));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
 const box=(x,y,z,w,h,d,c,parent)=>mesh(new T.BoxGeometry(w,h,d),c,x,y,z,parent)
 const disk=(x,z,r,c,y=.15)=>{const m=mesh(new T.CircleGeometry(r,48),c,x,y,z);m.rotation.x=-Math.PI/2;return m}
 const land=(points,y,c)=>{const s=new T.Shape();points.forEach(([x,z],i)=>i?s.lineTo(x,-z):s.moveTo(x,-z));s.closePath();const m=mesh(new T.ShapeGeometry(s),c,0,y,0);m.rotation.x=-Math.PI/2;return m}
 const path=(points,width,c,y=.22)=>{for(let i=1;i<points.length;i++){const [x,z]=points[i-1],[xx,zz]=points[i];const p=box((x+xx)/2,y,(z+zz)/2,width,.12,Math.hypot(xx-x,zz-z),c);p.rotation.y=Math.atan2(xx-x,zz-z)}for(const [x,z]of points)disk(x,z,width/2,c,y+.07)}
 land([[-5,6],[16,-5],[67,-3],[97,-5],[135,1],[157,14],[164,46],[157,73],[164,99],[126,109],[87,106],[46,111],[5,102],[-8,75]],-1,'#dec48e')
 land([[0,10],[19,0],[65,2],[98,0],[132,6],[150,17],[156,46],[149,73],[156,95],[124,102],[87,99],[46,104],[10,97],[-1,73]],0,'#9fbd7c')
 // Shoreline inlet with working pier, rather than a river cutting through every activity area.
 land([[144,19],[158,22],[162,59],[150,70],[131,64],[128,50],[135,41]],.13,'#83c8c7')
 path([[11,53],[78,53],[112,53],[128,42]],4.5,'#e2d2a7')
 path([[68,12],[68,94]],4,'#e2d2a7');path([[12,81],[118,81]],3.5,'#e2d2a7')
 path([[31,16],[31,47]],3,'#d2c69c');path([[87,15],[87,41],[78,53]],3,'#e2d2a7')
 disk(80,51,13,'#d9cda9');disk(80,51,10.5,'#e9ddbd',.3)
 box(35,.22,78,52,.3,39,'#c9b690');box(103,.24,81,37,.35,35,'#c4ad89')
 // Open floor rooms leave the actual furniture visible and clickable.
 box(18,.6,74,13,.7,15,'#bfa083');box(18,1,74,11,.15,13,'#e2cbb6')
 box(18,3,66,14,5,.7,'#e8d9bc');box(11,2,74,.6,3,16,'#e8d9bc')
 box(18,4,65.5,16,1,2,'#b27664');box(14,3.1,65.8,3,2.3,.3,'#81a9ae')
 for(const x of [10,61])for(const z of [61,98])box(x,2,z,.55,4,.55,'#a28a66')
 // Workshop awning and supply shelves.
 for(const x of [85,117])box(x,3,61,.6,6,.6,'#9b7959')
 box(101,6,61,34,.5,5,'#c28a64');box(101,3.5,60,33,.4,.7,'#cdb397')
 box(84,.25,26,34,.4,25,'#c1ac86')
 for(const z of [17,29])box(84,.6,z,31,.5,1,'#a88968')
 for(let i=0;i<9;i++)box(140,.55,26+i*1.8,15,.7,1.5,'#ba9570')
 for(const x of [132,148])for(const z of [25,41])box(x,1.6,z,.5,3,.5,'#927253')
 // Boundary planting: decoration stays away from usable objects and path crossings.
 for(let i=0;i<28;i++){
  const x=8+i*5.1,z=5+Math.sin(i*1.7)*2;mesh(new T.CylinderGeometry(.35,.6,3,6),'#947957',x,1.5,z)
  mesh(new T.IcosahedronGeometry(2.7+(i%3)*.3,1),i%2?'#719665':'#7ea571',x,5,z)
 }
 for(const [x,z]of [[5,28],[7,41],[5,62],[6,87],[150,85],[140,96],[121,97],[52,99]]){
  mesh(new T.IcosahedronGeometry(2.4,1),'#779c6b',x,1.2,z)
  for(let i=0;i<4;i++)mesh(new T.SphereGeometry(.55,6,4),i%2?'#ecd9a5':'#d7a0a0',x+Math.cos(i*2)*2,1.6,z+Math.sin(i*2)*2)
 }
 for(const [x,z]of [[12,12],[152,16],[153,75],[9,94]])mesh(new T.DodecahedronGeometry(2.3),'#93998b',x,1,z)
 for(const [x,z]of [[61,47],[98,48],[61,88],[121,79]]){box(x,2,z,.35,4,.35,'#8b7a60');mesh(new T.SphereGeometry(.75,8,6),'#ffedb7',x,4.3,z)}
 for(let i=0;i<11;i++){const ripple=mesh(new T.RingGeometry(2.4,2.55,40),'#b1e2d8',153+(i%3)*3,.2,16+i*7);ripple.rotation.x=-Math.PI/2}
 return {mesh,box,disk,land}
}

export function objectModel(o,g,{mesh,box}){
 const name=o.name,c=o.color||'#c7b28c'
 if(o.type==='environmentItem'){
  if(/矿|石/.test(name)){for(let i=0;i<3;i++)mesh(new T.DodecahedronGeometry(2.4-i*.3),i%2?'#9fa8a4':'#84928d',i*1.7-2,1.5,i%2,g)}
  else if(/花/.test(name)){for(let i=0;i<7;i++){const x=Math.sin(i*2)*3,z=Math.cos(i*2)*2;mesh(new T.CylinderGeometry(.1,.1,1.3,4),'#739165',x,.7,z,g);mesh(new T.IcosahedronGeometry(.9,0),i%2?'#edc681':'#cf9da7',x,1.5,z,g)}}
  else if(/灌/.test(name)){for(let i=0;i<3;i++)mesh(new T.IcosahedronGeometry(2,1),'#7fa15f',i*1.6-1.6,1.5,0,g)}
  else {mesh(new T.CylinderGeometry(.6,1.1,5,7),'#997853',0,2.5,0,g);for(const [x,y,z,r]of [[0,6,0,3.8],[-2.2,4.5,1,2.8],[2.2,5.4,1,2.8]])mesh(new T.IcosahedronGeometry(r,1),'#769e68',x,y,z,g)}
 }else if(o.type==='equippedItem'){
  box(0,1.7,0,.35,3.4,.35,'#a88662',g)
  if(/鱼竿/.test(name))box(0,4.5,0,.18,3,.18,'#6e826c',g)
  else box(.5,3.1,0,1.6,.8,.7,/抹布/.test(name)?'#cad4b6':'#9ba9ab',g)
 }else if(o.type==='material'||o.type==='food'){
  box(0,.8,0,4,1.6,3,'#b89770',g);box(0,1.7,0,3.5,.3,2.5,o.type==='food'?'#e6c589':'#c8c0a5',g)
  for(let i=0;i<3;i++)mesh(new T.IcosahedronGeometry(.7,0),o.type==='food'?'#cc9c6c':'#929b8a',i-1,2,0,g)
 }else if(/床/.test(name)){
  box(0,.7,0,5,1,8,'#b68d73',g);box(0,1.5,1,4.6,.7,5.5,'#b7cad2',g);box(0,1.8,-2.5,4,.6,1.8,'#f4e8d0',g)
 }else if(/椅|凳/.test(name)){
  box(0,1.8,0,3.5,.5,3.5,'#bb9373',g);box(0,3,-1.6,3.5,2.5,.5,'#bb9373',g);for(const x of [-1.3,1.3])for(const z of [-1.3,1.3])box(x,.8,z,.4,1.6,.4,'#927458',g)
 }else if(/水坑/.test(name)){const m=mesh(new T.CircleGeometry(4,32),'#83bcc0',0,.1,0,g);m.rotation.x=-Math.PI/2}
 else if(/雕塑/.test(name)){box(0,.6,0,4,1.2,4,'#c2bfad',g);mesh(new T.IcosahedronGeometry(2.2,0),'#b5c3ba',0,3,0,g)}
 else if(/冰箱|工具柜|鱼竿架/.test(name)){
  box(0,2.5,0,5,5,2.5,/冰/.test(name)?'#c5d5cb':'#aa8c69',g);for(const y of [1,2.8,4.5])box(0,y,1.4,4.5,.25,.5,'#e1cda7',g)
 }else if(/鱼缸/.test(name)){box(0,.5,0,5,1,3,'#c2b293',g);box(0,2,0,4.6,2,2.7,'#99c9c7',g)}
 else if(/工地/.test(name)){box(0,.1,0,9,.2,7,'#b4a385',g);for(const x of [-4,4])for(const z of [-3,3])box(x,1.4,z,.4,2.8,.4,'#ba8864',g)}
 else {
  box(0,2.3,0,6,.6,4,'#bc9a78',g);for(const x of [-2.5,2.5])for(const z of [-1.5,1.5])box(x,1,z,.45,2,.45,'#8c775e',g)
  if(/洗手/.test(name)){box(0,2.7,0,3,.3,2.4,'#d9e4da',g);box(0,3.3,-1,.25,1.2,.25,'#9bafb0',g)}
  else if(!/桌|钓台/.test(name))mesh(new T.CylinderGeometry(1.2,.9,.7,10),'#dfcba3',0,2.9,0,g)
 }
}
