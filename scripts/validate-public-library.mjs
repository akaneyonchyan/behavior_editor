import {readFile} from 'node:fs/promises'
import {validateLibrary} from '../shared/library-model.mjs'

try {
  const snapshot=JSON.parse((await readFile(process.argv[2]||'public/data/library.json','utf8')).replace(/^\uFEFF/,''))
  if(typeof snapshot.syncedAt!=='string'||!Number.isFinite(Date.parse(snapshot.syncedAt)))throw Error('公共库快照缺少有效同步时间')
  validateLibrary(snapshot.library)
  console.log('公共库发布前校验通过：对象 '+snapshot.library.objects.length+'，属性 '+snapshot.library.attributes.length+'，Buff '+snapshot.library.buffs.length+'；包含停用条目。')
} catch(error) {
  const message='公共库校验失败，停止发布：'+error.message
  if(process.env.GITHUB_ACTIONS==='true')console.error('::error::'+message.replace(/%/g,'%25').replace(/\r/g,'%0D').replace(/\n/g,'%0A'))
  else console.error(message)
  process.exitCode=1
}
