# GitHub 完整资源版

更新日期：2026-11-03。本页是GitHub分支的恢复入口；旧迁移文档仍用于历史追溯。当前GitLab/XD Sites生产版不受本次同步影响，GitHub Pages和Actions尚未启用。

## 内容清单

| 内容 | 仓库位置 | 来源 |
|---|---|---|
| 编辑器、模拟器、服务端代码、测试、脚本 | src、server、shared、scripts、tests | GitLab代码版本5e45efd完整文件树 |
| 使用、维护、部署手册和维护Skill | docs、deploy、.agents、AGENTS.md | 同上，完整保留；本页补充GitHub差异 |
| 20份正式行为图 | behaviors/*.json | design_workspace的β行为图，版本4c18a6e |
| 20张行为图导出PNG | resources/behavior-source/*.png | 同一GitLab版本，原字节归档 |
| 2份编辑器缓存 | resources/behavior-source/.behavior-editor-cache | 仅归档，不进入在线目录 |
| 公共库快照和表结构 | resources/content-library | 2026-11-03完整回读飞书14表 |
| 来源和逐文件摘要 | resources/sync-manifest.json | 用于核对来源、版本、完整性 |

导出PNG可能早于对应JSON，应以JSON为可编辑原件；缓存不是正式行为。此前仓库的18份同名旧图由GitLab正式文件更新，新增“寻找一个空地散步”和“钓鱼细分-核心行为”。

## 本地运行

使用Node.js 22或更新版本，在仓库根执行：

    npm ci
    node scripts/prepare-github.mjs
    npm test
    npm run dev

正式只读公共库模式启动可设置 VITE_LIBRARY_MODE=published。构建GitHub Pages时设置 PAGES_BASE=/behavior_editor/ 和 VITE_LIBRARY_MODE=published 后执行 npm run build。

GitHub默认浏览器回归仅覆盖静态编辑器环境。飞书登录、XD Sites实时目录和平台产物测试保留在各自的 playwright.auth / sites-live / sites 配置中，需使用对应服务和构建环境运行，不能混入GitHub静态环境。生产包另用 playwright.github.config.cjs 验证真实快照、钓鱼运行及只读分享。

## 以后重新开启 Pages

1. GitHub Settings → Pages → Source选择GitHub Actions。
2. Actions启用 Publish editor and public library，通过新增的Run workflow入口运行。未切换新库时使用仓库内有效快照，不依赖已经迁走的飞书Secrets。
3. 等测试、构建和部署全部成功后验证网站。启用本身不代表已经上线；本次只同步资源和准备发布流程，没有启用网站。
4. 新公共库的重建和切换见[公共库重建](../content-library/github-restore.md)。

## 功能边界

GitHub Pages提供本地编辑、导入导出、公开静态行为目录、公共库查询、已有模拟器能力和只读分享。同步行为文件不等于所有行为都已获得专用模拟适配；缺规则或未实现的行为仍须按预检提示处理，不能自动改原图凑运行。

已知原稿限制：“寻找一个空地散步”的“循环寻找空地”最大次数不是整数，当前模拟器会明确拦截；文件可正常打开编辑和分享。同步时保留该原稿，未擅自补次数或增加新的模拟规则。钓鱼细分图按4轮结束，不保证每次随机结果满足全部产出目标。

心动SSO、公司内网GitLab实时接口、协作编辑后端均需要服务器/Worker和独立账户授权，Pages本身不能执行它们。相关服务端代码、部署模板与维护手册已保留在仓库；新环境需单独部署、配置域名和凭据。这不是遗漏代码，也不代表静态站已具备同等在线服务。

后续同步请同时核对：代码仓库全部跟踪文件、design_workspace/β行为图的正式JSON与附属资源、公共库快照/稳定ID、维护手册与构建配置；不要仅比较编辑器源码。原始Base备份只在本机保存，公开仓库只使用规范化内容和不含凭据的结构说明。
