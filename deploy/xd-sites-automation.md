# XD Sites 公共库同步与代码自动发布

GitLab 实时行为图库的 Worker 模式及首次切换要求见 [实时图库部署](xd-sites-live-gitlab.md)。默认静态配置不自动切换；迁移后必须同步协调器的 deploymentMode 和发布步骤，防止下一轮以旧静态产物覆盖。

正式使用入口：https://petpals-behavior-editor.workers.xd-sites.com。站点列表隐藏，心动 SSO，公司网络；用户已确认真实登录可用。

## 两条数据链

1. 飞书公共库由既有云服务器 timer 约每 5 分钟只读同步并校验。Cindy 检查云端有效快照内容摘要，变化后构建并发布到 XD Sites；校验失败保留现有网站。无需迁移飞书 Secret 到电脑或站点。
2. GitLab master 为代码及行为图唯一来源。Cindy 发现新提交后运行 npm ci、全量 npm test、静态快照浏览器回归与构建，再通过 XD Sites 插件更新同一站点。

两种变化合并为一次发布。无变化时前置脚本直接跳过，不启动 AI；纯公共库变化仍校验和构建，但不重跑未变化代码的全量模拟测试。失败版本记录 failedKey，不无限重试；修复后可 prepare --retry，或新代码/数据版本自动重试。

检查使用每 5 分钟间隔；构建和平台审核时间额外计算，不承诺 5 分钟内更新。需要此 Windows 电脑、Cindy 和网络在线，并能访问公司 GitLab、SSH 服务器及 XD Sites。电脑关闭时网站仍运行，云端仍读取飞书，但新站发布暂停。

## 本机协调器

独立根目录：D:/PPS/CodeX_Output/prototypes/behavior-editor-sites-deployer。
安装时复制 scripts/sites-release.mjs、sites-release-state.mjs 至根目录，写入无密钥值的 config.json。配置只含 root、npmCli、sshKey 路径、knownHosts 路径、site、basePath。更新协调器须等待当前运行完成后重新复制；不会自动执行日常工作区未提交脚本。

- check：拉取 master 并读取云端快照，校验后输出 needed 和版本摘要；不构建或发布。
- prepare：在 checkout 独立克隆构建待发布产物；输出 candidate.json，只上传 checkout/dist。
- verify：发布前确认 master、公共库与产物哈希仍匹配。
- ack <deploymentId>：仅在插件返回部署 succeeded 后执行，保存成功基线。
- fail：将本轮 attempt 标记为失败；不覆盖成功基线。

记录：state.json 为最近成功发布，candidate.json 为待发版本，logs 为本机日志。prepare.lock 防止并发；进程崩溃遗留锁须先核对 PID 已退出，再清理指定锁文件。不得覆盖手工修改的 checkout。

## Cindy 发布步骤

调度的前置检查通过 schedule_set_pre_run_hook 安装，无变化 exit 2，有变化 exit 0；成功检查输出 CINDY_PRECHECK_OK，网络或校验失败非零阻止发布。检查成功不代表网站已更新。

Agent 每次读当前 XD Sites 手册、站点权限及 build-config，核对隐藏、org、公司网络、固定 siteId、basePath。配置变化时停止并告知用户，不自动改权限。构建后 sites_detect、update_existing/publishNow=true 规划。direct_ready 按要求先完整输出摘要再发布；若计划需要新确认，不绕过确认。部署目录通过 ghost_call 顶层 dir 交付。只在 succeeded 后回读权限并 ack；未知状态先查询已有 deploymentId，不重复部署。

GitLab 和部署不需要向插件传服务器或飞书凭据。禁止导出 Cindy 登录令牌，不使用私有 API 绕过插件发布流程。旧上海代码发布任务切换后暂停并保留，旧服务器公共库 timer 继续运行。
