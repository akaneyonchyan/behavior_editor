const numeric=(o,key)=>typeof o?.attrs?.[key]==='number'&&Number.isFinite(o.attrs[key])?o.attrs[key]:null
const active=v=>v===true||v===1||v==='1'
export function objectStates(o,world=[],library={}){
 const out=[],add=(id,label,tone,detail)=>out.push({id,label,tone,detail})
 if(o.inactive)return out
 const durability=numeric(o,'durability'),clean=numeric(o,'cleanliness'),fresh=numeric(o,'freshness')
 if(durability!==null&&durability<=0)add('broken','坏了','danger','耐久为0，需要修理')
 else if(durability!==null&&durability<=30)add('worn','待修理','warning','耐久 '+durability.toFixed(1))
 if(clean!==null&&clean<30)add('dirty','脏了','warning','清洁度 '+clean.toFixed(1)+'（预览提示线：30）')
 const yieldKey=library.attributes?.find(a=>a.enabled&&a.name==='产量')?.id||'reczz28PBhFkUjct'
 if(o.type==='environmentItem'&&numeric(o,yieldKey)===0)add('empty','采空了','secondary','当前产量为0')
 if(o.type==='food'&&fresh!==null&&fresh<=0)add('spoiled','变质了','danger','新鲜度为0')
 const stuckKey=library.attributes?.find(a=>a.enabled&&a.name==='被卡住')?.id||'reczz28PBpzFKg4B'
 if(o.stuckTool||active(o.attrs?.[stuckKey])||o.buffs?.buff_stuck>0||o.buffs?.buff_be_stuck>0)add('stuck','卡住了','danger','需要解卡')
 if(o.reachable===false)add('unreachable','不可达','warning','场景可达性标记为否')
 for(const [id,count]of Object.entries(o.buffs||{}))if(count>0&&!['buff_stuck','buff_be_stuck'].includes(id)){
  const b=library.buffs?.find(b=>b.id===id&&b.enabled)
  if(b)add('buff:'+id,b.name,'warning',b.name+' ×'+count)
 }
 if(o.occupied)add('occupied','使用中','success',(world.find(a=>a.id===o.occupied)?.name||'伙伴')+' 正在占用')
 return out
}
export function visualPosition(o,world){
 if(o.type!=='equippedItem')return {x:o.x,z:o.z}
 const target=world.find(e=>e.id===o.location?.replace(/^stuck:/,''))
 if(!target)return {x:o.x,z:o.z}
 if(target.type==='partner')return {x:target.x+2.5,z:target.z+1.5,carried:true}
 if(o.location.startsWith('stuck:'))return {x:target.x+3,z:target.z,stuck:true}
 const siblings=world.filter(e=>e.type==='equippedItem'&&e.location===o.location),i=siblings.findIndex(e=>e.id===o.id)
 return {x:target.x-5+(i%3)*5,z:target.z+8+Math.floor(i/3)*5,stored:true}
}
