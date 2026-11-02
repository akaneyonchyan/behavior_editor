# 多人协作服务部署

2026-10-29 部署进度：独立协作服务已安装到现有云服务器 /home/ubuntu/pps-collaboration，Node 仅监听 127.0.0.1:5112，经现有证书提供 /collaboration/rpc。原网站路由保留。Worker 的 COLLAB_SERVICE_URL 和安全输入卡密钥已配置，协作前端已发布。线上检查发现办公网通道无法连接公网协作服务，本次改用普通 HTTPS 连接，仍待发布后验证；两个真实账号的完整验收尚未完成。

2026-10-29：使用每位同事的个人 GitLab API Token，无需管理员注册 OAuth 应用。在线页签验证权限，保存使用本人凭据；仍须部署权威协作服务。

同事按 [Token 创建指引](https://xd.feishu.cn/wiki/OIECwWxUviBhIZkqvH8cX2eqn0g) 创建个人 Token，选择 api、write_repository，仅在编辑器密码输入框填写，不通过聊天交付。

勾选记住后，浏览器以 AES-GCM 密文和不可导出 CryptoKey 存于 IndexedDB，按可信 SSO 身份分隔；不能抵御同源恶意脚本。浏览器直接使用 Token 读取和提交 GitLab。Token 同时通过 HTTPS 交给当前站点 Worker 做权限和提交结果复核，仅限请求内存；不传到独立协作服务器，不写磁盘或图文件。目标仓库 petpals/shared/design_behavior_editor 的 master 必须 can_push=true 才允许加入协作。Worker 签发绑定 SSO 的 15 秒权限票据，浏览器约 10 秒更新；加入和保存复核重新查询 GitLab。清除本机凭据不会撤销 GitLab Token，既有票据最多 15 秒失效。

运行 npm run package:collaboration，产物位于 release/collaboration，含已打包服务、Compose、setup-secrets.py 和校验摘要。在目标服务器创建受限的 data/private 目录，按实际系统用户调整 Compose UID/GID；在自己的终端执行 python3 setup-secrets.py 生成服务间密钥，仅用于配对 Worker 安全输入卡。无需配置 OAuth 或共享 GitLab 写入凭据。模板不自动重启，避免绕过单实例崩溃恢复检查。

## 架构与上线条件

文档读写：浏览器 → 公司 GitLab。协作：浏览器 → 现有 XD Sites Worker（心动 SSO、公司网络）→ HTTPS 协作服务。可信复核：Worker → GitLab，只读检查个人权限、初始文件和保存结果。

XD Sites SDK 0.2.0 的 KV 只有 get/put，没有事务或 CAS，不能作为权威节点锁。不得在 Worker 全局变量里维护房间。当前实现需要一个常驻 Node.js 22+ 服务，所有房间只允许一个权威进程。协作服务器不再需要访问 GitLab；现有云服务器的 GitLab IP 拦截不再构成部署前提。Worker 通过普通 HTTPS 访问公网协作服务，officeNet 仅用于 GitLab 可信复核，不提供绕过办公网拒绝的回退。同事电脑需能访问 GitLab，并允许浏览器本地网络访问。实际浏览器核验见 [跨域检查](gitlab-browser-cors-check.md)。

未配置时「共同编辑」会明确显示服务未启用，原有读取、预览与本地编辑保持可用。此变更本身不自动开通服务器或升级 Token 权限。

## 配置

协作服务器（仅服务端环境/秘密管理器，不提交仓库）：

| 名称 | 用途 |
| --- | --- |
| COLLAB_SERVICE_TOKEN | 至少 32 字符的随机服务认证凭据，与 Worker 一致 |
| COLLAB_DATA_DIR | 持久化专用绝对目录，限制系统账号访问并备份 |
| COLLAB_HOST | 默认 127.0.0.1，置于 HTTPS 反向代理后 |
| COLLAB_PORT | 默认 5112 |

Worker：通过 XD Sites 的 Runtime Vars 配置 COLLAB_SERVICE_URL（完整 HTTPS /rpc 地址），通过 Secrets 安全输入卡配置 COLLAB_SERVICE_TOKEN。此服务凭据也用于签发短期权限票据，不能交给浏览器。原有 GITLAB_TOKEN 继续用于尚未输入个人 Token 时的 SSO 只读浏览；每个人的编辑权限由 Worker 独立检查，保存由浏览器个人 Token 执行。服务配置凭据不得放入 VITE_、前端或聊天。

服务器执行 npm ci、node scripts/build-server-validator.mjs，再由进程管理器启动 node server/collaboration-service.mjs。部署用户应只读代码、可写独立数据目录。反向代理仅向 Worker 可达的受控网络开放；请求上限 5 MB，超时至少 45 秒，禁止 HTTP 重定向。服务自身每次请求还会校验 Bearer 凭据。

## 持久化与单实例约束

浏览器保存先以 saveBegin 固定当前 revision，并持久化 saveIntent。保存期间暂停新修改；浏览器使用 last_commit_id 提交，再由 Worker 读取 GitLab 复核，服务端只在内容一致时确认 savedRevision。断线或响应丢失时保留 saveIntent，不自动解锁或当作已保存；重新加入后再次保存会先核对仓库内容，相同则确认，基线变化则拒绝覆盖。未能核实的保存可下载副本，由管理员备份并整合后处理，不删除恢复数据。

启动时在数据目录建立 .authority 排他目录；第二个进程启动失败。每次修改在返回成功前先写临时文件、fsync，再原子替换房间文件。正常 SIGTERM 等待请求结束并释放 authority；崩溃后不按时间抢锁，必须由管理员确认旧进程已彻底停止、备份数据后移除该排他目录，再启动。

禁止两个不同数据目录的服务同时处理同一仓库。暂不支持多副本负载均衡、自动故障切换或无损滚动切换；切换服务时通知用户重新加入，已同步草稿仍保留。主机故障恢复取决于持久磁盘与备份。

房间文件以文件名 SHA-256 命名。冲突草稿不得删除：停服务、备份并移到归档目录，确认所有人已下载/整合后再重开房间。Token 被撤销或 GitLab 拒绝写入时草稿仍保留，不改仓库保护规则。

## 发布与验收

先完成服务主机、网络和安全凭据配置，再通过现有 XD Sites 插件的计划/发布流程部署 Worker 与前端；保持现有 SSO org、公司网络、列表隐藏。不要先推送 master 触发五分钟自动发布而留下未配置服务。

在专用测试行为文件上，用两个真实账号验证：抢同一节点只有一个成功；不同节点同时改动互相保留；光标随缩放对应正确；关页后锁过期；保存产生包含双方修改的提交；外部 GitLab 更新会拒绝覆盖。不要拿正式设计稿测试删除或覆盖。

回退前端不删除协作数据。恢复旧只读 Worker 后共享草稿仍应保留，需再次上线协作服务才能接续。
