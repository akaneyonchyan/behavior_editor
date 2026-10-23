// Authored districts use the whole island. Coordinates are simulation positions, not UI offsets.
export const DISTRICTS=[{name:'林间采集',x:38,z:9},{name:'滨水小憩',x:132,z:13},{name:'生活庭院',x:33,z:57},{name:'手作工坊',x:101,z:57},{name:'物资小站',x:78,z:8}]
const SPOTS={乔木:[22,25],矿石:[40,23],灌木:[57,24],花丛:[43,41],钓台:[139,33],鱼竿架:[121,27],搓饵台:[120,45],鱼缸:[139,52],水坑:[128,69],床:[18,73],椅子:[38,69],桌子:[54,73],洗手池:[19,90],冰箱:[39,90],工匠台:[94,72],工具柜:[111,72],工地:[109,91],雕塑:[80,49]}
export function layoutIsland(world){
 const counts={}
 for(const o of world){
  if(o.type==='partner'){const i=counts.partner||0;counts.partner=i+1;[o.x,o.z]=[[65,53],[83,65],[67,82],[101,48],[54,53],[90,31]][i%6];continue}
  const fixed=SPOTS[o.name]
  if(fixed){[o.x,o.z]=fixed;o.zone=o.x<65?(o.z<55?'林间采集':'生活庭院'):o.x>118?'滨水小憩':o.z<55?'中央花园':'手作工坊';continue}
  const zone=o.type==='material'?'stock':o.type==='food'?'food':o.type==='equippedItem'?'tools':o.type==='environmentItem'?'forest':'other'
  const i=counts[zone]||0;counts[zone]=i+1
  const [x,z,columns,space]=({stock:[73,20,3,11],food:[57,88,3,10],tools:[86,86,3,8],forest:[20,43,3,14],other:[131,84,3,10]})[zone]
  o.x=x+(i%columns)*space;o.z=z+Math.floor(i/columns)*10;o.zone=({stock:'物资小站',food:'生活庭院',tools:'手作工坊',forest:'林间采集',other:'场景扩展'})[zone]
 }
 return world
}
