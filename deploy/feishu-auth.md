# 飞书登录部署

2026-10-26 公司全员访问：`members.json` 支持 `{"access":"company","tenant":"已确认的公司 tenant_key","members":[]}`。tenant 必须与服务器允许的公司一致；飞书验证属于该公司后，未单独配置的成员自动获得 viewer 权限，可使用编辑器、查看和下载线上文件、本地编辑保存。members 中的显式记录优先，禁用记录仍拒绝访问；切回数组恢复逐人允许名单，已有自动授权会话在下次请求撤销。其他公司始终拒绝，云端上传仍关闭。飞书开放平台中还需将已发布应用的可用范围设为全体成员；网站配置不会改变飞书应用的可用范围。

2026-10-26 账号入口：账号名和退出按钮统一放在行为设计/行为预览功能栏最右侧，以竖线分隔；复用工具栏深色按钮，不再单独占据顶行。账号状态及退出逻辑由鉴权上下文共享，匿名静态模式不显示该入口。

2026-10-26 样式加载修正：鉴权云端包将生成的 CSS 嵌入首页，避免单独样式请求失败后出现白底无布局页面。静态资源保护不变。生产浏览器验证使用独立自签名测试证书和模拟身份服务，不读取生产 Cookie 或密钥：node tests/auth-production-browser.mjs <测试私钥路径> <测试证书路径>。测试真实跨站登录导航，并主动阻断独立 CSS 请求，断言页面配色及场景高度仍正常。打包前手动测试时先以 VITE_AUTH_MODE=feishu、VITE_ONLINE_PROVIDER=gitlab-snapshot、VITE_LIBRARY_MODE=published 构建，再执行 node scripts/inline-cloud-styles.mjs。

2026-10-26 修正：飞书回调的 303 重定向链可能保留 cross-site 请求标记。有效会话的顶层 GET 首页导航允许通过；跨站 API、静态资源、iframe 和写请求仍拒绝，未登录仍跳转登录页。回归测试覆盖该重定向后的请求。

2026-10-26 当前状态：密钥与公司配置已完成，鉴权容器运行于 127.0.0.1:5111，由 Nginx 443 代理。用户已反馈真实登录成功；旧 private-preview 容器已停止并关闭自动重启，保留镜像供历史排查。
网站已允许本公司成员；飞书应用可用范围按用户最后选择保留为指定成员及“预研”部门。实际可登录范围是两者的交集，尚未完成另一位同事的真实登录验收。
服务器本机 HTTPS 登录页 200、首页跳转 303、匿名数据请求 401。当前维护电脑公网 TLS 连接仍被重置，备案状态未核实，详见 [上线状态](domain-launch.md)。
以下密钥步骤供首次安装参考，现有配置不要重复初始化。

## 用户输入 App Secret

1. 打开飞书开放平台的应用 cli_aa58888782b8dd0b，在“凭证与基础信息”复制 App Secret。
2. 在腾讯云控制台打开服务器的登录终端，运行：

   bash /home/ubuntu/pps-editor/setup-login-secret.sh

3. 按提示粘贴并回车。终端不会显示输入；只回复“已保存”，不要把密码发到聊天。

脚本保存到 /home/ubuntu/pps-editor/private/feishu-app-secret，权限 600；不输出、不提交 Git。
已有文件不会覆盖。登录应用的密钥和公共库同步应用的密钥不能混用。

## 部署者配置

- 将 auth.env.example 的值写入服务器 private/auth.env，并填入经管理员确认的 tenant_key。
- 将 members.example.json 复制为 private/members.json，填写本登录应用下的成员 open_id。
- 单个成员格式：{"open_id":"已核对的成员ID","enabled":true,"role":"viewer","version":"1"}。
- 逐人允许名单模式下成员列表为空则拒绝所有账号；company 模式按已确认的公司授权。不能把第一个登录者自动设为管理员。
- 不知道公司或成员 ID 时，可暂设 FEISHU_ALLOWED_TENANT_KEY=PENDING_ADMIN_CONFIRMATION、成员为空。用户完成一次飞书登录后仍被拒绝；部署者通过容器内 node server/pending-logins.mjs 读取待确认的 tenant/member ID，与用户核对后才配置放行。记录只保留七天，不打印或保存飞书令牌。
- 修改角色或 version、停用成员在下一次请求立即撤销原会话。会话绝对 8 小时、闲置 2 小时。
- private 目录及文件归 UID 1000 所有，分别限制为 700/600；auth-data 目录归 UID 1000 所有，700。
- 节点 Node 22.13+；单实例 SQLite 会话库在 auth-data。多实例不能复制运行本配置。

构建：node scripts/package-cloud-release.mjs public/data/library.json --auth。
验证部署包 SHA256 后解压到新版本目录；运行 docker compose -p pps-editor-auth build。
真实配置齐全后运行 docker compose -p pps-editor-auth up -d。

按 nginx-auth.conf 配置 HTTPS。2026-10-26 已取得证书，路径为 /etc/letsencrypt/live/behavior-editor.online/，到期日 2027-01-24。Certbot 使用 standalone 续期，80 端口保留给续期验证；Nginx 只监听 443，并在续期成功后 reload。证书取得不代表备案已完成。
代理完整转发到鉴权服务，不给 dist、行为文件或公共库增加独立静态入口。
不记录 OAuth 查询字符串。上线前确认云服务商要求和实际访问网络；仅供内部人员使用不自动等于私网访问。
飞书精确回调为 https://behavior-editor.online/auth/feishu/callback。

## 实现与验证范围

服务使用飞书授权码、PKCE S256、v2 token 和 user_info 接口；state 绑定浏览器、五分钟有效且原子消费。
会话只存随机 ID 的哈希，Cookie 使用 Secure/HttpOnly/SameSite=Lax；写请求默认禁用。
登出检查固定 Origin 和 CSRF；所有编辑器资源、公共库和行为接口需会话。
飞书故障与配置故障不降级为匿名访问。逐人允许名单模式下，未开通的同租户成员进入等待开通提示；company 模式允许同公司成员，显式禁用记录仍优先。
前端未登录不挂载编辑器；登出/401/403 清除在线内存与公共库缓存，阻止旧请求回填，保留个人草稿。
已下载到本地的文件不自动删除。只读快照部署不提供上传；文件需在内网 GitLab 提交后重新发布。

回归：node tests/feishu-auth.mjs；npx playwright test --config playwright.auth.config.cjs。
服务测试使用模拟飞书接口，不能替代实际应用授权、成员确认及线上 HTTPS 登录验收。
公共库同步和自动发布已独立迁移，分别见 [公共库同步](library-sync.md) 与 [自动部署](automatic-release.md)。
