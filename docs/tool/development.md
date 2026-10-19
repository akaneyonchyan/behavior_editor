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
| src/utils/behaviorMetadata.js、nodeDesign.js、loopFlow.js | 行为准入数据迁移、节点规则和循环出口 |
| src/utils/blankTemplate.js | 首次空白骨架 |
| src/components/PngExport.jsx、src/utils/pngExport.js | 导出选项、节点及曲线范围、离屏副本、像素限制、PNG下载 |
| src/store/publishedLibrary.js | 已发布公共快照、缓存、刷新 |
| shared/library-model.mjs、server/feishu.mjs | 公共库校验及飞书字段转换 |
| scripts/export-public-library.mjs | Actions 读取并生成公开快照 |

旧 RoutedEdge.jsx、edgeRouting.js、WeightFactors.jsx 和后台相关代码仍可能被测试或兼容路径使用。改动前检索调用，不按文件名推断当前界面采用的方案。

## 数据与兼容约束

行为 JSON 顶层为 behavior（行为准入数据）和 graph；graph.nodes 保存 id/type/data/position，graph.edges 保存端点及端口。具体字段读取默认值、校验器与迁移工具，不把此说明当作完整 JSON Schema。

导入会重新生成连线 ID；测试往返等价时比较端点/端口和业务内容，不依赖旧连线 ID。旧数字权重等兼容数据可能保存在 legacyConfig，不能在未确认转换规则时丢弃。

开发要求：唯一开始节点始终存在；自定义文字保留且非候选下划线；新增字段同时考虑面板、摘要、默认值、导入迁移、撤销和保存。正式文件只允许手动保存；不恢复随机命名磁盘备份。Web Locks 串行化同源页面磁盘快照写入，但磁盘快照只保留最近一次，各页面草稿仍独立。

## 验证

运行 npm test 和 npm run build。按改动补相应回归：

| 范围 | 测试文件（tests/） |
|---|---|
| 文件保存、恢复与初始化 | persistence.cjs、startup-files.cjs |
| 判断、结果与循环 | node-design.cjs、routing-weights.cjs、loop-flow.cjs |
| 行为准入数据和开始节点 | metadata.cjs、start-metadata.cjs |
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


## 结束表演（2026-10-19修正）

结束只有一种节点、一个工具栏入口。每个实例配置一套表演和播放方式（单次／计次／计时），计次／计时可填写文字期望。“完成”“中断”由设计者通过名称、说明、表演与连线表达，不设结束类型字段或固定规则。默认图的两条结束路径使用相同的普通结束节点。

已有图的表演、名称、连线不变；旧 endReason 仅作为兼容数据保留，不展示、不参与规则，新建节点不生成该字段。旧 successAnimation/failAnimation 仍提供“拆分为两个结束节点”入口：按旧表演分配入线，保留原配置，支持撤销。拆分后的两个节点类型完全相同。正式文件仅手动保存后写回。

规则来源：[行为通用规则](https://xd.feishu.cn/wiki/HpD0wJZg7icrpKkXdkDcAjHDnBg)。结束类型不是编辑器规则，这是2026-10-19用户明确修正的产品约束。相关回归见 tests/endings.cjs、tests/endings.spec.cjs、tests/end-node.spec.cjs。

## 占用资源与行为结束（2026-10-19）

位移／执行节点可声明“占用资源”：对象来源＋属性名，支持公共库选择和自定义下划线输入。含义是该节点执行时产生、由本行为持有至结束的占用；仅移动或普通属性增减不能推断为占用。

结束节点的“释放资源（自动）”引用从开始可达且能通向本节点的前序声明，展示对象、属性、来源节点；修改、删除、断线、撤销及公共库改名均自动反映。各分支引用取并集，不意味着每次全部占用；设计语义是只释放本次实际产生、仍由本行为持有的资源。编辑器不模拟运行时，不凭对象类型猜测具体实例或释放顺序；同类型的不同占用由来源节点与声明ID分别追踪。

实现：occupiedResources=[{id,source,attribute}] 存在来源节点，utils/occupiedResources.js 按有效边遍历，排除禁用稍息路径、孤立节点和结束节点后的边。派生引用只在展示时计算，不复制写入结束节点。旧 releaseResources 原文放在核对区，需整理为前序声明；旧 targetCondition 仅兼容保留、不展示、不执行。

结束节点不再配置或展示目标判定。目标是否达成及后续调度属于行为之外的目标策略流程；开始节点中行为准入数据的满足目标、循环中的循环判定仍保留。回归见 occupied-resources.cjs 与 occupied-resources.spec.cjs。

2026-10-19：界面“结果节点”更名为“执行节点”。JSON 类型继续使用 result，保持旧图、连线及配置兼容；用户填写的节点名称保留。

术语统一：界面和产品说明使用“行为准入数据”“行为设计节点”；内部 BehaviorMetadata、behaviorMetadata.js、behavior/graph 键和既有测试文件名保留，不涉及 JSON 格式迁移。

## 对象名联动（2026-10-19）

ObjectNameInput.jsx 复用 TextChoice，objectChoices/objectName 负责按类型筛选及稳定引用显示。可选 objectName 为 item:<ID> 或自定义字符串，覆盖准入规则、位移、共享判断属性、分支、执行属性/Buff、循环和占用声明；节点摘要同步显示。位移旧 destination 在交互对象模式无 objectName 时兼容展示，坐标模式仍用 destination。未知字符串保留，不根据名称重写引用。

公共库新增可选 items；canonicalLibrary 比较该数组，避免基础三表不变时丢掉名录刷新。FeishuRepository 从对象类型行“对象表ID”读各类型目录、分页拉取并校验整库；保留旧三表无映射兼容。线上只读查询支持目录分表筛选。旧后台不支持名录写入，维护在飞书进行。

新增回归 object-catalog.cjs、catalog-sync.mjs、object-catalog.spec.cjs，覆盖筛选、同名跨类型、停用改名、旧快照、分页与错误阻断、共享属性继承、JSON/撤销及浏览器交互。已有下拉计数增加对象名一栏。


## 需求汇总（2026-10-19）

src/utils/requirements.js 的 collectRequirements 为只读汇总：复用公共库候选筛选、节点规则常量、准入迁移及判断共享属性派生逻辑，返回 attributes/objects/buffs/performances 四组。按分类、字段、原值、原因、上下文去重，locations 保存节点ID和字段位置。判断共享属性只统计一次，分支自定义影响分别保留使用位置；自动释放引用不重复统计。已关闭的稍息配置和兼容存档不参与当前需求统计。

RequirementsPanel.jsx 随节点/准入/库变更重新计算。公开库未就绪时不运行检查，避免空库误报；已有缓存失败时继续显示快照时间和错误。窗口通过 pps-focus-node 事件让 Canvas 定位和选择节点，不创建撤销记录或修改业务数据。导出为本地 Markdown，包含全分类、快照时间及使用位置，不写正式行为文件。

这不是运行时能力校验器：没有资产库时表演仅标记待核对，不猜测已实现/缺失，也不自动拆解自然语言里的资产名。新增字段或规则选项时同步汇总器及 tests/requirements.cjs、requirements.spec.cjs。浏览器测试验证筛选、四页、库更新、定位、下载、缺库状态和原图不变。

PNG 保存目录（2026-10-19）：PngExport 先同步校验画布大小，再在点击事件的用户激活期调用 preparePngDestination，startIn 取 documentSession.getSaveDirectory() 中选择或恢复的目录句柄。选定文件后才异步渲染，成功生成 Blob 后创建 writable 并写入/close；写入失败尝试 abort。取消返回选项窗，不修改图或 JSON 保存状态；无 File System Access API 时保留下载回退。不要把 showSaveFilePicker 移到图片异步生成之后，否则用户激活过期。测试 png-save.cjs 和 png-export.spec.cjs 覆盖目录传递、取消、写失败、标准 PNG 字节及下载回退。

## 保存目录中的行为切换（2026-10-19）

App 中 behavior-sidebar 包含 NodePalette 和 BehaviorFiles，文件区位于左侧节点列表下方，复用原有 240px 侧栏，Canvas 保持完整高度，不改变 .canvas > .react-flow 的 PNG 导出选择器。behaviorFiles.js 遍历目录直接子文件，校验 JSON 后提供名称、节点数及时间；不递归缓存目录。文件身份通过句柄 isSameEntry 比较，不能只按同名高亮。

BehaviorFiles 对异步扫描使用 generation 丢弃过时结果；自动扫描只 queryPermission，主动按钮才请求权限。目录改变、保存结束、文件改变和窗口重新获得焦点时刷新。openDirectoryFile 校验并读取当前磁盘文件，通过 fingerprint 防止读取期间编辑被覆盖；复用 canReplace/replace 的未保存确认、恢复草稿归档、句柄和磁盘文本基线。错误/取消不替换原图。

回归 behavior-files.cjs、behavior-files.spec.cjs 覆盖直接子目录过滤、空目录、BOM、坏文件、权限、身份、取消、过期目录、读取期间修改、原句柄保存、冲突保护，以及列表搜索/刷新/折叠/切换。
