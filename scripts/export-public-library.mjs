import { mkdir, writeFile, rename } from 'node:fs/promises'
import { FeishuRepository } from '../server/feishu.mjs'

// Runs on a trusted build host (GitLab CI or GitHub Actions). Never in the browser.
const required = ['FEISHU_APP_ID','FEISHU_APP_SECRET','FEISHU_BASE_TOKEN','FEISHU_OBJECT_TABLE','FEISHU_ATTRIBUTE_TABLE','FEISHU_BUFF_TABLE']
if (required.some(key => !process.env[key])) {
  throw new Error('请在构建环境配置全部飞书同步参数（GitLab CI/CD Variables 或 GitHub Secrets）；本次不覆盖已发布版本');
}
const repo = new FeishuRepository(process.env)
repo.tables = { objects: process.env.FEISHU_OBJECT_TABLE, attributes: process.env.FEISHU_ATTRIBUTE_TABLE, buffs: process.env.FEISHU_BUFF_TABLE }
const { library } = await repo.read()
const snapshot = { syncedAt: new Date().toISOString(), library }
await mkdir('public/data', { recursive: true })
await writeFile('public/data/library.json.tmp', JSON.stringify(snapshot), 'utf8')
await rename('public/data/library.json.tmp', 'public/data/library.json')
console.log('公共库读取并校验完成；仅发布条目数据和同步时间。')
