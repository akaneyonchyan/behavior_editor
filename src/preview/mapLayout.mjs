// Shared positions: southern living area, central plaza, eastern work area and riverside.
export function layoutIsland(world){
 const counts={}
 for(const o of world){
  if(o.type==='partner'){const i=counts.partner||0;counts.partner=i+1;o.x=40+i*4;o.z=67;continue}
  let zone=/树|木材|矿|石头/.test(o.name)?'forest':/鱼|钓|水坑/.test(o.name)?'water':/工具|斧|镐|锤|扳手|抹布/.test(o.name)?'storage':/床|椅|凳|食|饼|冰箱|洗手|桌/.test(o.name)?'living':'work'
  const i=counts[zone]||0;counts[zone]=i+1
  const [x,z]=({forest:[31,23],water:[65,45],storage:[28,65],living:[37,73],work:[65,66]})[zone]
  o.x=x+(i%4)*5;o.z=z+Math.floor(i/4)*5
 }
 return world
}
