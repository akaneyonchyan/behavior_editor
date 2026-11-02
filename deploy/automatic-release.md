# 自动部署与旧站停用

2026-10-26 后续切换：当前新站由 [XD Sites 自动化](xd-sites-automation.md) 发布，本文的 PPS-BehaviorEditor-AutoDeploy 已暂停保留。云端飞书公共库 timer 继续运行。不要自动恢复上海网站发布任务。

2026-10-26：无可用 Linux Docker Runner，采用本机 Windows 定时任务。已有 Node.js、Python、Git、Edge 和 SSH，可以直接构建，无需 WSL。GitLab master 是唯一发布来源，云端继续只运行构建产物。

## 自动执行

任务名：PPS-BehaviorEditor-AutoDeploy。当前用户登录后及每 5 分钟检查一次 master。独立目录为 D:/PPS/CodeX_Output/prototypes/behavior-editor-deployer，不修改日常开发工作副本。

发现新提交后：拉取私有公共库快照 → npm ci → 全量单元测试及登录/行为浏览器回归 → 鉴权版本打包 → 独立 HTTPS 登录回归 → 校验 master 没有新提交 → SSH 上传 → 校验包 SHA256 → 构建镜像 → 临时端口 5112 检查 → 切换 5111 正式服务 → 验证 HTTPS 和匿名访问拦截。

发布串行执行。已有运行不会重复启动；没有新提交则跳过。服务器在切换后检查失败时恢复上一镜像。保留旧版本、私有成员配置、登录密钥和会话库。不上传本地未提交的行为文件。

电脑必须开机、联网、登录当前 Windows 用户，且能访问公司 GitLab；休眠/关机期间不发布，网站仍由云服务器正常运行。检查周期不包含测试构建时间。当前不依赖 GitLab CI，不能将本机部署状态误称为 GitLab 流水线成功。

## 安装与维护

在可信工作副本运行 deploy/install-local-deployer.ps1。任务以当前用户普通权限隐藏运行，使用已配置的 Git 凭据与既有服务器 SSH 密钥；不复制密钥内容到仓库或配置。SSH 主机指纹严格校验。

- 立即检查：Start-ScheduledTask -TaskName PPS-BehaviorEditor-AutoDeploy
- 查看结果：读取独立目录的 status.json，以及 logs/YYYY-MM-DD.log。
- 失败提交不会每 5 分钟重复部署。修正原因后，等待当前任务结束，再运行独立目录 run.ps1 --retry；新提交自动再试。
- 暂停：Disable-ScheduledTask -TaskName PPS-BehaviorEditor-AutoDeploy
- 恢复：Enable-ScheduledTask -TaskName PPS-BehaviorEditor-AutoDeploy
- 更新协调器：待任务结束后重新运行安装脚本。协调器固定在独立目录，不自动运行日常工作区未提交脚本。

服务器部署状态保存在 /home/ubuntu/pps-editor/deployment.json；current-release 记录最近成功目录。手动回退可进入上个 releases 目录，使用其镜像执行 docker compose -p pps-editor-auth up -d --no-build；应先暂停本机任务，避免被新版本覆盖。

## 公共库与 GitHub

GitHub Pages 停用后不能再作为公共库来源。当前快照保存在服务器 /home/ubuntu/pps-editor/shared/library.json（私有权限），每次构建通过 SSH 读取，保留真实 syncedAt。脚本 reuse-public-library.mjs 接受文件路径或 LIBRARY_SNAPSHOT_FILE，不再访问旧站。

飞书公共库的独立同步凭据已迁入服务器私有配置，服务器约每 5 分钟独立更新 shared/library.json，见 [公共库自动同步](library-sync.md)。网页直接读取最新有效数据，代码发布不覆盖它；电脑关机也不影响公共库同步。

旧 GitHub 停用范围：关闭仓库 Actions、取消尚在执行的发布任务、取消 Pages 发布、README 标记迁移。保留仓库历史，不删除源码或本地草稿；GitLab 与云端不会回写旧仓库。

如以后有公司 Runner，再迁移定时任务到 GitLab CI；现有 CI 模板需显式设置 ENABLE_GITLAB_RUNNER=true 并提供私有快照文件，当前默认关闭，避免排队或读取已停用站点。
