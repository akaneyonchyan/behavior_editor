# 部署入口与历史受限测试

2026-10-26 正式服务已使用飞书鉴权与 HTTPS。日常操作请读 [自动部署](automatic-release.md)、[飞书登录](feishu-auth.md)、[公共库同步](library-sync.md) 和 [上线验收](domain-launch.md)。旧无鉴权测试容器已停止且禁止自动重启。

**以下为历史受限测试方案，不代表当前生产配置，不要照此重建正式服务。**

**2026-10-22 更新：外部服务器不能访问内网 GitLab，当前云部署采用 [内网打包、外网运行](offline-release.md)。以下直连方式仅留给具备内网访问条件的环境，不能用于当前腾讯云部署。**

飞书应用准备、回调约定与拟定接口见 [飞书登录方案](../docs/tool/feishu-login-plan.md)；
该方案尚未实现，不改变下述测试服务的访问限制。

本部署包用于迁移验证，不是已接入飞书登录的正式站点。默认只发布到服务器
`127.0.0.1:5110`，默认禁用上传。不要将此端口转发到公网或接入无鉴权的反向代理。
同机用户或获准使用 SSH 隧道的人可以访问全部测试数据。

## 服务器准备

需要 Docker Engine + Compose，能够访问 `git.xindong.com`，并能拉取 Node 镜像及 npm 依赖。
公司证书应由运维正确安装，不关闭 TLS 校验。

1. 克隆仓库并检出待验证的迁移分支；记录提交 SHA。
2. 创建 `deploy/secrets/gitlab_token`，在服务器直接填写项目专用 GitLab Token。
   文件仅部署者可读；不要发到聊天、提交 Git 或写进镜像。读取使用只读凭据即可；
   启用上传时凭据需要项目非保护分支写入及 MR 创建权限（API scope）。
3. 创建 `deploy/data`，按需放入校验通过的 `library.json`：
   `{ "syncedAt": "ISO 时间", "library": { ... } }`。
   此目录只读挂载；没有快照时公共库显示未就绪，行为文件仍可读取。
4. 运行 `docker compose build`，再运行 `docker compose up -d`。
5. 在服务器检查 `curl http://localhost:5110/healthz`；
   该接口仅检查进程，不代表 GitLab 凭据有效，应再验证 `/api/behaviors`。
6. 本机通过 `ssh -N -L 5110:127.0.0.1:5110 <服务器>` 建立隧道，
   浏览器访问 `http://localhost:5110`，可使用本地文件选择 API。

环境可通过仓库根目录未提交的 `.env` 配置：

```dotenv
PREVIEW_ORIGIN=http://localhost:5110
GITLAB_BRANCH=master
ENABLE_UPLOADS=false
EDITOR_IMAGE=behavior-editor:preview
```

`GITLAB_BRANCH` 是在线读取和 MR 的目标分支。master 尚未合入时只会显示空目录。
如要测试迁移分支上的文件，将其配置为迁移分支名；相应 MR 也会以该分支为目标。
切换分支后重新创建容器。不要误把测试 MR 合入正式分支。

确认服务仅能通过受控本机/隧道访问后，才可设置 `ENABLE_UPLOADS=true`。
页面不收集 GitLab Token。服务端只向固定项目创建
`feature/proto_behavior_upload_<uuid>` 分支与 Draft MR，不修改目标分支。
实际 GitLab 作者是服务凭据的身份；尚无飞书身份，不能视为个人审计。

## 文件与冲突

刷新直接查询 GitLab，不依赖重新构建页面。目录按提交 SHA 固定版本，
预览从该提交读取 `behaviors/<文件名>`，不自动替换当前正在查看的稿件。
上传前后均校验 JSON；服务端比较同名文件 blob SHA，从核对后的提交原子创建新分支。
目标在提交后继续变化由 MR 的合并审核处理，不自动合并。

失败后保留确认弹窗；再次点击提交复用请求 ID，检查已有分支并恢复 MR。
若关闭弹窗或刷新网页，请先检查提示链接中的分支/MR，避免重复提交。
单服务实例内合并并发重试；多实例部署前需要共享幂等存储及正式权限体系。

## 公共内容库

本次仅提供经过校验的快照挂载入口，没有新增飞书同步任务，也没有读取或迁移现有 Secrets。
公共库仍由飞书维护。后续需接入独立同步任务，在校验成功后原子替换挂载目录中的
`library.json`，失败保留上一份有效快照；页面继续按现有周期刷新。

## CI、回滚与正式上线

`.gitlab-ci.yml` 验证测试、GitLab 适配、行为文件和前端构建，产生测试产物，
不自动部署。需要项目管理员提供匹配的 Runner；本配置未假设某个现有 Runner 标签。

每个验证版本使用提交 SHA 作为镜像标签保存。部署前记录当前标签，
回滚时设置 `EDITOR_IMAGE` 为旧标签并运行 `docker compose up -d --no-build`。
密钥、快照和未来的会话数据单独备份，不打包到镜像。

正式开放前需完成：飞书登录及成员授权、所有页面/API/数据鉴权、上传身份审计、
共享幂等存储（多实例时）、HTTPS/域名、快照同步、运维备份以及程序审核。
现有 `server/index.mjs` 是旧公共库后台，不能替代正式登录网关。
