import { createHash } from 'node:crypto'
import { canonicalLibrary, planChanges, sameRow } from '../shared/library-model.mjs'
export class LibraryService {
  constructor(repository){this.repository=repository;this.tail=Promise.resolve();this.snapshot=null;this.listeners=new Set();this.error='';this.checkedAt=0;this.timer=null}
  serialize(work){const task=this.tail.then(work);this.tail=task.catch(()=>{});return task}
  view(){return this.snapshot?{library:this.snapshot.library,revision:this.snapshot.revision,checkedAt:this.checkedAt}:null}
  emit(event,data){for(const listener of this.listeners)listener(event,data)}
  async refresh(){
    try {const snapshot=await this.repository.read();const revision=createHash('sha256').update(JSON.stringify(canonicalLibrary(snapshot.library))).digest('hex');const changed=revision!==this.snapshot?.revision;this.snapshot={...snapshot,revision};this.checkedAt=Date.now();this.error='';if(changed)this.emit('library',this.view());else this.emit('healthy',{checkedAt:this.checkedAt});return this.view()}
    catch(e){this.error=e.message;this.emit('sync-error',{message:e.message});throw e}
  }
  read(){return this.serialize(()=>this.refresh())}
  save(base,desired){return this.serialize(async()=>{
    await this.refresh()
    let plan
    try{plan=planChanges(base,desired,this.snapshot.library)}catch(e){e.status=400;throw e}
    if(plan.conflicts.length){const error=new Error('这些条目已被其他人修改，请核对后再保存');error.status=409;error.conflicts=plan.conflicts;throw error}
    let written=0
    try {
      for(const change of plan.changes){
        await this.refresh() // Re-read before each write to detect direct edits in Feishu.
        const live=this.snapshot.library[change.table].find(r=>r.id===change.after.id)
        if(sameRow(live,change.after))continue
        if(!sameRow(live,change.before)){const e=new Error('保存期间条目已变化，请刷新核对');e.status=409;throw e}
        await this.repository.write(change,this.snapshot);written++
        await this.refresh()
        if(!sameRow(this.snapshot.library[change.table].find(r=>r.id===change.after.id),change.after)){const e=new Error('写入后检测到并发修改，请核对云端与本地内容');e.status=409;throw e}
      }
      return this.view()
    } catch(e){e.message+=(written?'；已有 '+written+' 条写入，请保留本地草稿后核对，未自动回滚':'');throw e}
  })}
  start(){if(!this.timer)this.timer=setInterval(()=>{if(this.listeners.size)this.read().catch(()=>{})},5000)}
  stop(){clearInterval(this.timer);this.timer=null}
}
