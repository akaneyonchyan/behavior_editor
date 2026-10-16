import { mkdir, writeFile, rename } from 'node:fs/promises'
import { FeishuRepository } from '../server/feishu.mjs'

// This script runs in GitHub Actions only. No credentials enter the browser build.
const required = ['FEISHU_APP_ID','FEISHU_APP_SECRET','FEISHU_BASE_TOKEN','FEISHU_OBJECT_TABLE','FEISHU_ATTRIBUTE_TABLE','FEISHU_BUFF_TABLE']
if (required.some(key => !process.env[key])) {
  if (process.env.GITHUB_EVENT_NAME === 'push' && required.every(key => !process.env[key])) {
    console.log('尚未配置飞书 Secrets：首次仅发布编辑器，公共库显示未就绪。');
    process.exit(0);
  }
  throw new Error('请在 GitHub Actions Secrets 中配置全部飞书同步参数；本次不覆盖已发布版本');
}
const repo = new FeishuRepository(process.env)
repo.tables = { objects: process.env.FEISHU_OBJECT_TABLE, attributes: process.env.FEISHU_ATTRIBUTE_TABLE, buffs: process.env.FEISHU_BUFF_TABLE }
const { library } = await repo.read()
const snapshot = { syncedAt: new Date().toISOString(), library }
await mkdir('public/data', { recursive: true })
await writeFile('public/data/library.json.tmp', JSON.stringify(snapshot), 'utf8')
await rename('public/data/library.json.tmp', 'public/data/library.json')
console.log('公共库读取并校验完成；仅发布条目数据和同步时间。')
