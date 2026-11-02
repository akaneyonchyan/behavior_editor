# GitLab 实时行为图库

2026-10-28。本改动新增 Worker 构建模式；尚需完成站点凭据配置和部署验收，不能把本地验证当作线上生效。

行为图数据源为公司 GitLab 的 petpals/shared/design_workspace 项目、master 分支、β行为图 文件夹直接子级 JSON（2026-11-02 调整）；编辑器代码发布来源仍为 design_behavior_editor。目录每次刷新先解析 master 的提交，再以该提交读取目录及文件；预览新一轮开始重新读目录，运行中持有已加载副本。目录为空明确提示，网络或权限失败不会退回旧快照。公共库仍使用现有飞书同步快照。

切换部署前确认 GITLAB_TOKEN 对新仓库具有读取权限；个人 Token 按新仓库 master 的写权限验证。新来源使用独立凭据标识和协作房间标识，用户需重新验证 Token，旧仓库草稿不自动迁移。无需修改代码自动发布协调器的 Git 仓库。

## 构建与部署

- npm ci；准备有效 public/data/library.json；npm test；npm run test:sites-worker；npm run build:sites-worker。
- 输出 release/sites-worker，Worker 入口 worker.mjs，资源子目录 assets，前端 base 为 /。产物不带 data/behaviors 历史图快照。
- 对原 petpals-behavior-editor 站点，经 XD Sites 插件识别并规划 Worker with assets 更新，保留心动 SSO、公司网络和隐藏列表。静态到 Worker 的变更须按插件当次发布计划确认；不新建另一个站点。
- 通过插件安全输入卡设置 GITLAB_TOKEN；使用仅允许读取目标项目 API 的项目访问令牌。不要在聊天、代码、VITE_ 变量或运行日志中放值。
- Worker 使用 @xd-cell/worker-sdk 的 officeNet.fetch 访问固定 GitLab 项目，getCurrentUser 检查当前登录；平台 router 负责原有访问控制。办公网能力缺失时明确报错，无公网回退。
- 仅开放 GET /api/behaviors 与 GET /api/behaviors/file；上传接口关闭。前端 VITE_ONLINE_PROVIDER=gitlab-live。

## 自动发布切换

现有协调器默认仍为静态模式，不能在首次迁移后继续以静态产物覆盖 Worker。协调器配置须显式增加 deploymentMode=worker，代码中的 scripts/sites-release.mjs 已支持生成 Worker 产物。本机协调器脚本同步须等当前运行完成，按 xd-sites-automation.md 管理；本改动不自动修改运行中的本机任务。

Worker 模式 candidate.dir 指向 release/sites-worker，workerEntry=worker.mjs，assets=assets；自动发布执行方必须据此通过 sites_detect 和 sites_publish_plan 选择 Worker 链路，并核验现网权限。首次迁移和密钥配置未完成前不得启用该模式。

验收：在线列表与预览显示相同目录提交；新增/删除行为图后刷新可见；运行中刷新不替换当前副本；重置后开始读最新提交；空目录无默认图；无凭据/无办公网权限报错；匿名和写请求拒绝。真实 GitLab 网络与令牌只有上线配置后才能完成联调。
