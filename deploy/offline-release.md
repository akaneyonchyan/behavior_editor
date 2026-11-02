# 内网构建、外网运行

2026-10-26：日常发布已由 [本机定时任务](automatic-release.md) 接管。云服务器无法直接访问公司 GitLab；本机读取 master、测试构建、经 SSH 上传，云端封装并运行产物。无需 WSL 或 GitLab Runner。

## 生产数据方向

- GitLab master 是唯一代码来源，在线行为文件随通过验证的版本发布。网页可预览下载、本地编辑保存，云端上传关闭。
- 公共库由 [云端定时任务](library-sync.md) 直接只读同步飞书；构建通过 SSH 读取有效快照，发布不覆盖较新的云端数据。
- 正式服务必须使用 --auth 鉴权包和 pps-editor-auth Compose 项目。旧无鉴权预览容器已停止且禁止自动重启。
- GitHub Pages 和 Actions 已停用；历史 workflow 仅供参考。原六项公共库配置已安全迁入服务器 private/library-sync.json，不需要填写 GitLab CI 变量。

## 应急手动发布

优先修复并重试现有定时任务。必须手动操作时，先暂停本机任务，避免并发发布；使用干净工作区，确认 origin 为目标 GitLab 且 HEAD 等于 master。

1. 按 scripts/auto-deploy.mjs 执行依赖安装、公共库与行为导出、单元及浏览器回归。
2. 使用服务器当前有效快照：node scripts/package-cloud-release.mjs <本地快照路径> --auth。不要从旧 GitHub 读取快照。
3. 将生成的归档及当前 deploy/cloud-release.py 上传服务器 releases 目录，核对 SHA256。
4. 运行 python3 <服务器部署脚本路径> <归档文件名> <完整提交SHA> <SHA256>。脚本验证来源、检查临时容器、切换正式服务并在检查失败时恢复上一版本。
5. 核对 deployment.json、生产镜像、HTTPS 登录页及匿名数据拦截；确认后恢复本机任务。

保留私有配置、会话库、shared 快照和旧版本目录。手动回退见 [自动部署](automatic-release.md)。密钥不得放进聊天、仓库、前端环境变量或镜像。
