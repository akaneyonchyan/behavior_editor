import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {createFeishuAuth} from './feishu-auth.mjs'
import {createPreviewServer} from './cloud-preview.mjs'
import {SnapshotBehaviors} from './snapshot-behaviors.mjs'
const env=process.env
const auth=createFeishuAuth({origin:env.PUBLIC_ORIGIN,appId:env.FEISHU_LOGIN_APP_ID,secret:readFileSync(env.FEISHU_LOGIN_APP_SECRET_FILE,'utf8').trim(),tenant:env.FEISHU_ALLOWED_TENANT_KEY,membersFile:env.AUTH_MEMBERS_FILE,dbPath:env.AUTH_DB_PATH})
const validator=createRequire(import.meta.url)('./generated/behavior-validation.cjs')
const service=new SnapshotBehaviors({directory:'dist/data/behaviors',...validator})
const server=createPreviewServer({service,origin:env.PUBLIC_ORIGIN,libraryPath:'dist/data/library.json',authorize:auth.authorize})
server.on('close',auth.close)
server.listen(Number(env.PORT)||5110,'0.0.0.0',()=>console.log('行为编辑器鉴权服务已启动'))
