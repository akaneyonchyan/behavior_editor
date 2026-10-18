# 开发与协作

更新日期：2026-10-19。运行事实以源码、package.json、工作流为准。

## 本地启动

安装 Node.js 22+，克隆仓库后执行：


```sh
git clone https://github.com/akaneyonchyan/behavior_editor.git
cd behavior_editor
npm ci
npm test
npm run dev
```

要复现线上只读模式，在启动 Vite 前设置 VITE_LIBRARY_MODE=published：


```powershell
$env:VITE_LIBRARY_MODE="published"
npm run dev
```

```sh
VITE_LIBRARY_MODE=published npm run dev
```

公共快照地址是 BASE_URL 下的 data/library.json。本地没有 public/data/library.json 时显示公共库未就绪，这是预期行为；可用脱敏测试快照或在受控环境配置飞书读取，不能把生产密钥放进前端。

不设置模式时保留旧本地/团队库入口，会尝试连接 /api/library；这不等于线上使用了后台。vite.config.js 将本地 /api 代理到127.0.0.1:5110。旧 server/ 和 npm run server 仅用于兼容，不在 GitHub Pages 执行，也不应作为新功能的默认接入方式。

## 代码入口

| 文件或目录 | 职责 |
|---|---|
| src/App.jsx、src/components/Toolbar.jsx | 界面装配、公共库模式入口 |
| src/store/behaviorStore.js | 图状态、选择、复制、撤销重做、导入导出 |
| src/store/documentSession.js | 文件句柄、草稿、初始化、自动缓存、保存冲突 |
| src/store/documentValidation.js | 行为 JSON 结构校验 |
| src/constants/behaviorTypes.js | 节点类型与默认值 |
| src/components/Canvas.jsx、FlowingEdge.jsx | 拖放坐标、画布快捷键、贝塞尔流光 |
| src/components/PropertyPanel.jsx、BehaviorNode.jsx、StartNode.jsx | 属性编辑和节点摘要 |
| src/components/JudgeFields.jsx、ResultFields.jsx、LoopEditor.jsx | 判断、结果、循环编辑 |
| src/components/TextChoice.jsx、DesignInputs.jsx | 自定义下拉与非候选标记 |
| src/utils/behaviorMetadata.js、nodeDesign.js、loopFlow.js | 元数据迁移、节点规则和循环出口 |
| src/utils/blankTemplate.js | 首次空白骨架 |
| src/components/PngExport.jsx、src/utils/pngExport.js | 导出选项、节点及曲线范围、离屏副本、像素限制、PNG下载 |
| src/store/publishedLibrary.js | 已发布公共快照、缓存、刷新 |
| shared/library-model.mjs、server/feishu.mjs | 公共库校验及飞书字段转换 |
| scripts/export-public-library.mjs | Actions 读取并生成公开快照 |

旧 RoutedEdge.jsx、edgeRouting.js、WeightFactors.jsx 和后台相关代码仍可能被测试或兼容路径使用。改动前检索调用，不按文件名推断当前界面采用的方案。

## 数据与兼容约束

行为 JSON 顶层为 behavior（元数据）和 graph；graph.nodes 保存 id/type/data/position，graph.edges 保存端点及端口。具体字段读取默认值、校验器与迁移工具，不把此说明当作完整 JSON Schema。

导入会重新生成连线 ID；测试往返等价时比较端点/端口和业务内容，不依赖旧连线 ID。旧数字权重等兼容数据可能保存在 legacyConfig，不能在未确认转换规则时丢弃。

开发要求：唯一开始节点始终存在；自定义文字保留且非候选下划线；新增字段同时考虑面板、摘要、默认值、导入迁移、撤销和保存。正式文件只允许手动保存；不恢复随机命名磁盘备份。Web Locks 串行化同源页面磁盘快照写入，但磁盘快照只保留最近一次，各页面草稿仍独立。

## 验证

运行 npm test 和 npm run build。按改动补相应回归：

| 范围 | 测试文件（tests/） |
|---|---|
| 文件保存、恢复与初始化 | persistence.cjs、startup-files.cjs |
| 判断、结果与循环 | node-design.cjs、routing-weights.cjs、loop-flow.cjs |
| 元数据和开始节点 | metadata.cjs、start-metadata.cjs |
| 公共库模型、发布与兼容服务 | content-library.cjs、published-library.cjs、team-sync.mjs |
| PNG范围、像素限制与文件名 | png-export.cjs |
| JSON拖入、文件句柄、取消与读取期间修改 | drop-files.cjs |
| 画布文件拖放、错误输入、恢复草稿及节点拖放兼容 | drop-files.spec.cjs（npm run test:browser） |
| 浏览器下载、状态隔离、隐藏元素、超限与失败恢复 | png-export.spec.cjs（npm run test:png） |

PNG浏览器测试首次先运行 `npx playwright install chromium`，然后 `npm run test:png`。测试自动在5192端口启动Vite，使用隔离浏览器与模拟公共快照，不修改用户文件；输出在已忽略的test-results目录。也可设置PW_CHANNEL=chrome使用本机Chrome。CI在push发布时安装Chromium并运行浏览器测试，定时公共库同步只运行原有单元测试流程。

`npm run test:browser` 运行全部浏览器回归（含文件拖入及PNG），push发布流程采用此命令。拖入文件走documentSession.openDroppedFiles：在drop事件内立即请求FileSystemHandle，读取并校验后复用未保存确认、replace归档和文件基线。DataTransfer只在事件中取出所需数据，不能等异步操作后再访问。

导出基于html-to-image，克隆当前已渲染画布，保留SVG marker定义及节点样式。完整图按实际DOM节点和曲线包围盒换算到图坐标再加入48px留白；视口导出保留当前变换。只在副本移除编辑控件和选中样式，结束后释放副本。新增自定义节点或连线效果时，同时检查测量、图外曲线、文字和样式的导出兼容。

自动测试不能代替真实浏览器交互。涉及界面时检查拖放、缩放、下拉、自定义文字、键盘焦点；涉及保存时检查取消选择、授权失效、重开、两标签页和外部修改冲突。使用测试目录，不改用户正式文件。

## 发布与回退

仓库 Pages 设置选择 GitHub Actions。main 推送及约每5分钟定时工作流都会运行测试、读取飞书快照、构建只读站点并发布。PAGES_BASE 使用仓库名，VITE_LIBRARY_MODE 固定 published。定时运行时间不保证准点。

提交前检查 git status / git diff，只提交任务相关源码或文档，不提交 .env、依赖、dist、生成快照、内部行为图。部署后核对工作流对应的提交及站点，不把“推送成功”当“上线成功”。纯文档变更也会触发既有发布流程。

代码回退通过 revert 问题提交后重新发布；这不会回滚飞书数据。内容库回退须修正飞书源，再等工作流发布，见[维护方式](../content-library/maintenance.md)。不得删除用户缓存作为回退步骤。

## 协作交付

提交说明写清问题、最终行为、兼容处理、验证结果和限制；新增能力同步更新本目录。调整公共库字段/映射时同步更新公共库文档和测试。不要宣称未实现的模拟执行、精确数值计算或引擎导出能力。
