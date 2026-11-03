# 协作入口

2026-11-03 GitHub分支补充：用户授权将GitLab正式行为图及附属资源同步到GitHub。以 docs/tool/github-complete-version.md 和 docs/content-library/github-restore.md 为恢复入口；resources保存已授权的内容快照与归档，behaviors保存正式JSON。原始飞书表备份和凭据仍仅存本机。新库尚未创建，Pages/Actions尚未启用；下文生产部署规则适用于GitLab，不应覆盖GitHub独立内容配置。

修改本仓库前先读 [工具说明](docs/tool/README.md)；公共库任务另读 [公共库说明](docs/content-library/README.md) 和 [来源](docs/content-library/sources.md)。核对实际源码与当前文件变更，不把历史文档当作实时实现。

可加载项目 [behavior-editor Skill](.agents/skills/behavior-editor/SKILL.md)，按任务读取文档并执行使用指导、功能维护、内容库核对或发布排查。Skill 共享源随本仓库维护。

## 当前产品约束

- 2026-10-26 当前生产入口改为 petpals-behavior-editor.workers.xd-sites.com，平台心动 SSO、公司网络、列表隐藏。优先遵循 deploy/xd-sites-automation.md；下面上海部署说明属保留历史。GitLab master 是唯一代码来源，公共库继续来自云端只读飞书同步；Cindy 检测代码/库变化后按插件流程发布。不得导出 Cindy 令牌或绕过发布门禁。

- 生产入口为 behavior-editor.online，飞书鉴权与 HTTPS 已上线；旧 cloud-preview 不可公开。自动发布采用本机定时任务，见 deploy/automatic-release.md。GitLab master 是唯一发布来源。

- 线上为云服务器鉴权编辑器，行为图本地保存，线上快照只读；旧 GitHub 发布链路停用。公共库由服务器独立定时同步飞书，见 deploy/library-sync.md；代码发布不得覆盖较新的同步快照。旧 Node 后台仅保留兼容。
- 工具表达规则和定性期望，不实现正式工程数值平衡或工程表导出。行为预览使用隔离的模拟数值和运行副本，不能把预览结果当作游戏运行结果，详见 docs/tool/behavior-preview.md。
- 下拉允许非候选文字，并以下划线标识；不能静默清除自定义输入。
- 开始节点唯一、蓝色、不可删除复制；节点面板与画布摘要保持一致。
- 正式文件只手动保存；自动备份更新固定缓存文件，不再生成随机编号磁盘文件。保留多页面浏览器草稿和外部文件冲突保护。
- 公共库 ID 稳定，优先停用而非删除；工程编号和示例编号需有来源依据。

## 工作方式

先明确当前任务涉及的文件、数据与兼容性；保留用户未提交修改。功能或数据格式改动运行相关回归，交付前执行 npm test、npm run build；纯文档修改检查相对链接、命令及事实即可。界面/文件 API 变化另做浏览器验证。

更新功能同时更新对应文档；交付写清实际修改、验证与未完成项。文档来源不可访问时明确标注，不推测设计结论。不要读取或打印 .env/密钥来补充文档，不提交生成快照、内部行为图或内部原始表格。

提交、部署、飞书修改需在当前用户授权范围内进行；本文件不授予额外发布或数据修改权限。只推送当前任务相关文件，发布后核对对应提交的工作流结果。不要删除用户恢复数据或通过覆盖旧行为来验证新功能。
