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

结束只有一种节点、一个工具栏入口。每个实例配置一套表演和播放方式（单次／计次／计时），计次／计时可填写文字期望。结束节点用于行为内明确设计的收尾，不设结束类型字段。通用意外中断和监听跳出交给行为外规则，默认模板只有一个正常结束节点。

已有图的表演、名称、连线不变；旧 endReason 仅作为兼容数据保留，不展示、不参与规则，新建节点不生成该字段。旧 successAnimation/failAnimation 仍提供“拆分为两个结束节点”入口：按旧表演分配入线，保留原配置，支持撤销。拆分后的两个节点类型完全相同。正式文件仅手动保存后写回。

规则来源：[行为通用规则](https://xd.feishu.cn/wiki/HpD0wJZg7icrpKkXdkDcAjHDnBg)。结束类型不是编辑器规则，这是2026-10-19用户明确修正的产品约束。相关回归见 tests/endings.cjs、tests/endings.spec.cjs、tests/end-node.spec.cjs。

## 占用资源与行为结束（2026-10-19）

执行节点可声明“占用资源”（旧文件中的位移声明兼容保留）：对象来源＋属性名，支持公共库选择和自定义下划线输入。含义是该节点执行时产生、由本行为持有至结束的占用；仅移动或普通属性增减不能推断为占用。

结束节点的“释放资源（自动）”引用从开始可达且能通向本节点的前序声明，展示对象、属性、来源节点；修改、删除、断线、撤销及公共库改名均自动反映。各分支引用取并集，不意味着每次全部占用；设计语义是只释放本次实际产生、仍由本行为持有的资源。编辑器不模拟运行时，不凭对象类型猜测具体实例或释放顺序；同类型的不同占用由来源节点与声明ID分别追踪。

实现：occupiedResources=[{id,source,attribute}] 存在来源节点，utils/occupiedResources.js 按有效边遍历，排除禁用稍息路径、孤立节点和结束节点后的边。派生引用只在展示时计算，不复制写入结束节点。旧 releaseResources 原文放在核对区，需整理为前序声明；旧 targetCondition 仅兼容保留、不展示、不执行。

结束节点不再配置或展示目标判定。目标是否达成及后续调度属于行为之外的目标策略流程；开始节点中行为准入数据的满足目标、循环中的循环判定仍保留。回归见 occupied-resources.cjs 与 occupied-resources.spec.cjs。

2026-10-19：界面“结果节点”更名为“执行节点”。JSON 类型继续使用 result，保持旧图、连线及配置兼容；用户填写的节点名称保留。

术语统一：界面和产品说明使用“行为准入数据”“行为设计节点”；内部 BehaviorMetadata、behaviorMetadata.js、behavior/graph 键和既有测试文件名保留，不涉及 JSON 格式迁移。

## 对象名联动（2026-10-19）

ObjectNameInput.jsx 复用 TextChoice，objectChoices/objectName 负责按类型筛选及稳定引用显示。可选 objectName 为 item:<ID> 或自定义字符串，覆盖准入规则、共享判断属性、分支、执行属性/Buff、循环和占用声明；节点摘要同步显示。位移旧 destination 在交互对象模式无 objectName 时兼容展示，坐标模式仍用 destination。未知字符串保留，不根据名称重写引用。

公共库新增可选 items；canonicalLibrary 比较该数组，避免基础三表不变时丢掉名录刷新。FeishuRepository 从对象类型行“对象表ID”读各类型目录、分页拉取并校验整库；保留旧三表无映射兼容。线上只读查询支持目录分表筛选。旧后台不支持名录写入，维护在飞书进行。

新增回归 object-catalog.cjs、catalog-sync.mjs、object-catalog.spec.cjs，覆盖筛选、同名跨类型、停用改名、旧快照、分页与错误阻断、共享属性继承、JSON/撤销及浏览器交互。已有下拉计数增加对象名一栏。


## 需求汇总（2026-10-19）

src/utils/requirements.js 的 collectRequirements 为只读汇总：复用公共库候选筛选、节点规则常量、准入迁移及判断共享属性派生逻辑，返回 attributes/objects/buffs/performances 四组。按分类、字段、原值、原因、上下文去重，locations 保存节点ID和字段位置。判断共享属性只统计一次，分支自定义影响分别保留使用位置；自动释放引用不重复统计。已关闭的稍息配置和兼容存档不参与当前需求统计。

RequirementsPanel.jsx 随节点/准入/库变更重新计算。公开库未就绪时不运行检查，避免空库误报；已有缓存失败时继续显示快照时间和错误。窗口通过 pps-focus-node 事件让 Canvas 定位和选择节点，不创建撤销记录或修改业务数据。导出为本地 Markdown，包含全分类、快照时间及使用位置，不写正式行为文件。

这不是运行时能力校验器：没有资产库时表演仅标记待核对，不猜测已实现/缺失，也不自动拆解自然语言里的资产名。新增字段或规则选项时同步汇总器及 tests/requirements.cjs、requirements.spec.cjs。浏览器测试验证筛选、四页、库更新、定位、下载、缺库状态和原图不变。

PNG 保存目录（2026-10-19）：PngExport 先同步校验画布大小，再在点击事件的用户激活期调用 preparePngDestination，startIn 取 documentSession.getSaveDirectory() 中选择或恢复的目录句柄。选定文件后才异步渲染，成功生成 Blob 后创建 writable 并写入/close；写入失败尝试 abort。取消返回选项窗，不修改图或 JSON 保存状态；无 File System Access API 时保留下载回退。不要把 showSaveFilePicker 移到图片异步生成之后，否则用户激活过期。测试 png-save.cjs 和 png-export.spec.cjs 覆盖目录传递、取消、写失败、标准 PNG 字节及下载回退。

## 保存目录中的行为切换（2026-10-19）

App 中 behavior-sidebar 包含 NodePalette 和 BehaviorFiles，文件区位于左侧节点列表下方，复用原有 240px 侧栏，Canvas 保持完整高度，不改变 .canvas > .react-flow 的 PNG 导出选择器。behaviorFiles.js 遍历目录直接子文件，校验 JSON 后提供文件信息，界面仅展示文件名；目录选择统一使用顶部“保存目录”，侧栏只保留路径及同行刷新按钮；不递归缓存目录。文件身份通过句柄 isSameEntry 比较，不能只按同名高亮。

BehaviorFiles 对异步扫描使用 generation 丢弃过时结果；自动扫描只 queryPermission，主动按钮才请求权限。目录改变、保存结束、文件改变和窗口重新获得焦点时刷新。openDirectoryFile 校验并读取当前磁盘文件，通过 fingerprint 防止读取期间编辑被覆盖；复用 canReplace/replace 的未保存确认、恢复草稿归档、句柄和磁盘文本基线。错误/取消不替换原图。

回归 behavior-files.cjs、behavior-files.spec.cjs 覆盖直接子目录过滤、空目录、BOM、坏文件、权限、身份、取消、过期目录、读取期间修改、原句柄保存、冲突保护，以及列表搜索/刷新/切换及紧凑单行布局。


## 配置排序组件

SortableList 使用 dnd-kit PointerSensor/KeyboardSensor，仅 handle 启动拖动；同列表内碰撞检测，紧凑 DragOverlay，滚动面板边缘自动滚动。键盘按当前索引选择相邻条目，避免长卡片几何和紧凑预览的高度差导致跳项。输入期间不提交状态，onDragEnd 校验节点/文档作用域与列表内容快照后一次提交，空落点/未改变位置不记录历史。节点、文档或列表变化时取消拖动。

规则与分支保留持久ID；旧产物使用临时UI身份而不修改JSON格式。同长度纯文字编辑沿用当前位置身份，拖动提交前先同步临时身份顺序，避免同名产物编辑串焦点。执行分组排序只替换 effectRules 中该组所占位置，保留另一组和兼容字段。判断共享属性沿用 setJudgeAttributes，分支排序保留分支ID和原边。

第一批接入 LibraryRules、JudgeFields、ResultFields。tests/sorting.spec.cjs 覆盖键盘/鼠标/触摸、取消、单次撤销、分支边、属性影响、分组隔离、重复/空产物、JSON往返、节点切换和长列表滚动。后续接入其他列表时复用组件，不另建排序或自动保存逻辑。


## GitHub 在线行为文件（2026-10-20）

onlineBehaviors.js 使用固定仓库与 behaviors 路径。列表沿 ref→commit→tree 读取一致快照，文件按 blob SHA 获取，拒绝截断树、符号链接及超限文件。上传先校验所有文件并显示新增/替换清单；提交前复核 SHA，以最新一致 main 快照创建 tree、commit、新 ref，再创建 PR。绝不 PATCH main，不自动合并。分支/PR中途失败提供固定仓库 compare 链接，避免重试导致重复提交；Token 仅组件内存，所有 API 请求发往固定 api.github.com 主机。

OnlinePreview 用独立 React Flow 状态，GraphDisplayContext 只覆盖 StartNode、LoopNodeStages、ReleaseSummary 的只读查询；不 importConfig 到主编辑 store。没有写入处理器，过滤位置/删除更新，阻断编辑快捷键。fileView 管理本地／在线页签与在线文件，App 按页签切换主画布，保留本地 store 和持久化；在线时 Toolbar/DocumentControls 禁用本地写入入口，节点面板 inert。只有上传确认弹窗使用焦点陷阱。保留普通画布与本地缓存。组件的 display hook 不能用于编辑写入。

downloadBehavior.js 写原始文件文本至已授权目录，检查同名确认、原文件外部变化及当前未保存状态。写完调用 openDirectoryFile 复用草稿保护、句柄和冲突基线；拒绝切换不撤销成功的下载。localStorage 的 pps-online-base:<name> 只保存已下载公开 blob SHA，帮助识别已知旧基线，不能替代 GitHub 合并审核。

tests/online-behaviors.cjs、download-behavior.cjs 和 online-files.spec.cjs 以隔离数据模拟 API 与目录权限，覆盖读写分离、Unicode、冲突、失败恢复、只读草稿隔离和令牌不落盘。不使用真实用户 Token 或行为文件来测试写入。scripts/validate-behaviors.mjs 用相同校验器检查整个目录；PR 工作流不使用 pull_request_target，不读取 Secrets。

2026-10-20 更新：publishedBehaviors.js 从 BASE_URL/data/behaviors/index.json 和 blob SHA 命名的静态 JSON 读取公开行为，不传 Token。export-behaviors.mjs 在校验后生成发布目录，使用 Git blob SHA1（含 blob 长度头）保持下载基线与上传 Git API SHA 一致。只提交脚本，不提交生成快照。在线右侧面板固定 360px，与本地相同；状态区在同一 document-bar，PNG 等按钮保留原位。


## 跳出行为与旧位移迁移（2026-10-20）

判断分支、执行节点后续、循环各已启用出口，都可选择“连接节点”或“跳出行为”。后者显示节点色的“↗ 跳出行为”标记，可填可选说明，不配置外部流程，也不隐含结束表演、目标判定或资源释放。需要失败表演时，先连执行节点，再跳出。监听随时触发的通用中断无需逐节点配置。

切换为跳出会移除该出口的连线，保留原目标节点及其表演，支持撤销；切回连接节点时处于未连接状态。循环内部判断分支可独立配置跳出标记。在线只读预览、PNG、保存恢复及复制排序均保留标记。通用跳出的资源清理由行为外规则负责；正常结束仅展示可追溯的占用，无占用时隐藏。

新建不再提供位移节点，默认模板不含位移和中断结束。旧文件不自动改写：选中旧位移，点击“移除旧位移并接续”，仅在正常出口唯一且接续不会生成自身循环时执行，前序出口身份保持不变。原位移数据及涉及连线存入 behavior.legacyMovement，支持撤销；原结束节点不会自动删除。请核对原占用与自定义说明，外部占用不自动搬到执行节点。旧中断连线可逐条切换为跳出，不按节点名猜测。

缓存模板有独立版本；回退到旧缓存模板时采用新版内置模板。现有正式文件和编辑草稿继续恢复，不清空缓存，不批量迁移线上文件。examples/eat-snack.json 保留为旧格式兼容示例；新格式示例见 examples/external-exits.json。

数据：节点 data.externalExits=[{handle,note}]，执行节点 handle 为空字符串，判断使用稳定分支ID，循环使用 complete/insufficient/rest/continue。此列表与同出口 graph.edges 互斥，documentValidation 同时覆盖本地、在线、上传及发布校验。支持关闭的循环出口保留记录；分支删除清理对应记录，排序不改ID。旧 move 类型仍被校验器接受，但创建入口停用。实现入口：externalExits.js、BranchDestination.jsx、behaviorStore.setBranchDestination；回归：tests/external-exits.cjs、external-exits.spec.cjs、move-outputs.spec.cjs。


## 在线需求清单（2026-10-20）

RequirementsPanel 根据页签选择当前图或全部在线文件。onlineRequirements.loadRequirementFiles 读取单次 manifest，再按 SHA 读取对应公开快照，最多4个并发，使用 AbortSignal 取消，逐文件记录失败且保持目录顺序。collectOnlineRequirements 复用单图 collectRequirements 的上下文键，附加 files 与 locations.fileName/fileSha/behaviorName；同节点ID来自不同文件不能互相覆盖。不调用 importConfig，不更改本地状态。文件链接使用隔离的 fileView.openOnline；Markdown 导出注明范围、来源和未完成文件。

回归：tests/online-requirements.cjs（归并、来源、不同上下文、公共库变化、导出、并发/取消/部分失败），tests/online-requirements.spec.cjs（全目录不受过滤、匿名读取、来源跳转、刷新重试、草稿隔离、公共库未就绪）。


## 循环容器与父子结构视图（2026-10-20）

循环使用可添加、删除和拖拽排序的结束条件列表。每轮执行前从上到下检查，满足任一条立即结束；全部不满足才执行内部节点。新建默认先判断目标条件，再判断最大次数。最大次数允许填写设计期望；每条目标条件可配置公共库属性规则，同一条内全部满足才成立，不填时引用行为准入数据中的满足目标。

循环容器顶部仅展示条件顺序和只读摘要；点击容器或标题后，统一在右侧调整类型、次数、排序和完整配置，包含添加属性规则与自定义下划线输入。在线为只读。容器内不重复绘制循环卡片。内部左侧的圆形开始图形连接本轮首个节点，执行顺序从左向右；判断分支上下排列，共同后续只展示一份。准入由内部判断节点表达，个性待机由内部待机节点表达。

外部前序连接容器左侧入口，循环结束从右侧出口连接后续节点。内部某分支提前离开时，经独立的分支出口连接容器外目标；不同分支的去向不会合并。嵌套循环逐层经过容器边界。折叠只隐藏内部流程，保留外部连线。内部末尾无需连接回起点，本轮结束后自动重新判定。

打开本地文件、恢复草稿、拖入文件和在线查阅都使用同一套循环规则。已有的准入／稍息设置自动成为内部判断／待机节点，保留属性、自定义文字和各分支去向，不需要点击转换按钮。正式文件仍仅在手动保存时写回；在线浏览不会替换本地编辑内容。

选中循环可在右侧“循环范围”选择本轮起点和内部节点、识别候选范围并确认。末尾无后续的执行／待机节点自动补齐返回关系，判断空分支则需明确配置。外部连接到内部节点的操作会接到相应循环入口，避免从半途开始执行。

顶部页签依次为“连线视图／结构视图”，默认结构视图。结构视图支持普通节点与容器拖动、属性编辑、折叠和重排；复杂连线编辑可切换连线视图。完整 PNG 使用独立展开副本，包含条件、内部起点和边界连线，不改变当前折叠或保存状态。

### 实现与读取兼容

normalizeBehavior 是纯函数，在 store.importConfig、onlineBehaviors.parseBehavior 及隔离预览入口共用。读取三阶段循环时，loopMigration 自动拆出已启用阶段为内部节点；停用阶段仅归档，legacyLoopLogic 保存原始配置和相关连线。loopCondition/loopRules 以继续条件的文字语义保留，不猜测数值公式。无法区分出口的无端口连线会报连接不完整，导入失败不能替换当前图。不要把转换过程做成用户可选的两套规则，也不要批量覆写原文件。

当前 loopVersion=3，loopConditions 为有序列表，每项有稳定 id、kind=goal|count，目标项使用 condition/rules，次数项使用 maxIterations 文字。列表按顺序 OR 短路；空列表表示尚未配置，不猜测退出时机。旧 loopMode/completionRules/maxIterations 仅作为读取回退，读取只保留原来已启用的一种模式，不擅自激活历史闲置配置。循环自身仅 continue/complete 两个端口。底层返回连线保留占用追溯与保存兼容，结构图隐藏这些线。containerTarget 将跨入成员的连接指向最外层跨越容器；确认范围、画布连线和侧栏设置共用该约束。

structureLayout 生成纯视觉 loopScope 与 loopPortal，域节点仍不新增类型。内部 continue 由左侧起点图形发出；成员跨出范围时按原连线标识逐层拆成内部出口与容器边界段。分支出口互不合并，折叠仍保留对应出口。只保存 graph.layout 的成员和位置，不把视觉辅助节点／边写入文件。头部测量决定内部排布和出口位置。

回归：loop-boundaries.cjs 覆盖纯转换、重复读取、规则保留、直接中途入口、嵌套／折叠边界和在线隔离；loop-container.spec.cjs、structure.spec.cjs 覆盖实际端口、起点位置、条件编辑、PNG和恢复。legacyTemplate 是固定历史测试数据，不是第二套用户规则。

### 拖动节点调整循环归属（2026-10-20）

空循环只移动自身，不锁定画布其他节点，也不会把静止节点自动收进来。拖动普通节点，在容器内部正文区域松开（以节点中心判定），即可加入该循环；从内部拖到外部则解除归属。折叠容器不接收拖入，开始节点始终在循环外。

从一个范围转移到另一个范围时，清除被移动节点与旧范围关联的入线、出线，以新归属为准，支持一次撤销／重做。目标容器为空时，该节点成为首个内部节点；原容器起点移走后自动选取剩余起点，无成员时恢复空容器。执行／待机末尾补齐新循环的内部返回关系，结构画布不显示回线；不会替原判断分支猜测新去向。

整体移动嵌套循环会携带它的内部节点与内部连线，只清理与外部的连线；不能把循环放进自己或自己的子循环。位置和父子关系随 JSON 与草稿保存，重排只调整位置，不改变成员关系。

实现：structureEditing.moveStructureNode 是归属变化的纯转换，store 以一次 checkpoint 提交节点、边与 layout。StructuredCanvas 使用绝对坐标命中容器正文，写入相对新父容器坐标，保留其他节点位置；普通点击不生成拖动记录。structureLayout 依据手动位置扩展容器边界。loopConditions.js 共用读取回退与有序短路语义；LoopConditionsEditor 复用 SortableList 和 LibraryRules。校验、需求清单、在线摘要与 PNG 都读取同一列表。回归见 loop-editing.cjs/spec.cjs。

## 属性判断与影响规则（2026-10-20）

属性选择的三个字段统一显示为「对象大类／对象子类／判断项」，对应原 source／objectName／attribute，公共库引用和 ID 不变。Buff 输出仍显示 Buff 名，执行输出增减和准入条件保持各自含义。

分支属性影响拆成两个可自定义输入的选项：影响类型（数值高／数值低／具体值），影响规则（概率越高／概率越低／允许选中／排除选中／不影响）。非标准输入继续以下划线展示并纳入需求清单；只表达设计规则，不进行概率运算。具体值的比较内容尚无独立标准值字段，可通过自定义文字表达并列为需求。

文件中的 influenceType 和 influenceRule 为当前生效字段；influence 保留兼容描述，编辑时同步更新。读取历史文件时按明确的标准文字映射，未知描述原样留在影响规则，影响类型留空，不推断其含义。读取转换不直接覆盖磁盘文件。画布、在线只读、PNG 和需求清单均使用拆分后的字段。

