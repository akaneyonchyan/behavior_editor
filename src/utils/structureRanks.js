// Back edges remain in the behavior; only the layout's ordering graph omits them.
export function structureRanks(items,links,preferred){
 const successors=new Map(items.map(id=>[id,[]])),incoming=new Map(items.map(id=>[id,0]))
 for(const [from,to] of links){successors.get(from).push(to);incoming.set(to,incoming.get(to)+1)}
 const state=new Map(),forward=[]
 const visit=id=>{
  if(state.has(id))return
  state.set(id,1)
  for(const to of successors.get(id)){
   if(state.get(to)===1)continue
   forward.push([id,to]);visit(to)
  }
  state.set(id,2)
 }
 for(const id of [...(items.includes(preferred)?[preferred]:[]),...items.filter(id=>!incoming.get(id)),...items])visit(id)
 const degree=new Map(items.map(id=>[id,0])),rank=new Map(items.map(id=>[id,0]))
 for(const [,to] of forward)degree.set(to,degree.get(to)+1)
 const pending=items.filter(id=>!degree.get(id))
 while(pending.length){
  const id=pending.shift()
  for(const [,to] of forward.filter(([from])=>from===id)){
   rank.set(to,Math.max(rank.get(to),rank.get(id)+1));degree.set(to,degree.get(to)-1)
   if(!degree.get(to))pending.push(to)
  }
 }
 return rank
}

