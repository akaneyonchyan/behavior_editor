# 飞书登录：应用准备与接口方案

2026-10-26：只读快照的飞书登录代码已实现；真实应用与 HTTPS 尚待联调，当前状态见 [鉴权部署](../../deploy/feishu-auth.md)。下文保留此前设计要求和历史准备记录。

更新：2026-10-22。状态：待程序实现的设计稿。用户已提供登录应用 ID `cli_aa58888782b8dd0b`，并反馈已配置登录权限和测试成员范围；应用发布状态尚未核验，未接收或配置 App Secret。当前服务仍为受限测试站。
本文件规定拟实现的接口，不代表接口已经存在。部署现状见 [受限测试部署](../../deploy/README.md)。

## 1. 现在可以进行的应用准备

推荐创建独立的企业自建应用，名称为「PetPals 行为编辑器」。
登录应用和现有公共库同步应用分别管理凭据、权限、可用范围和发布周期。
若企业管理员要求复用已有应用，需先确认管理权与权限变更影响，不能直接覆盖旧配置。

在 [飞书开放平台开发者后台](https://open.feishu.cn/app) 操作：

1. 选择公司组织，创建企业自建应用；没有创建权限时由飞书管理员创建并添加开发者。
2. 填写名称及说明：供 PetPals 项目成员查看、设计及提交行为文件。
3. 配置网页应用入口能力（若需要从飞书工作台进入），应用首页待正式域名确定后填写。
   普通浏览器 OAuth 登录是第一期目标；飞书内嵌端 JS SDK 登录不在第一期范围。
4. 在凭证页面取得 App ID；App Secret 只在后台/部署密钥系统保存，不发送聊天、不写文档或仓库。
5. 申请“获取登录用户信息”所需的最小授权，按当前控制台及官方接口权限说明确认准确 scope。
   不因本方案申请手机号、邮箱、完整通讯录、消息读写、日历、云文档或多维表格权限。
6. 应用可用范围先设置为本人及少数测试成员，再由管理员扩到项目成员。
7. 安全设置中的重定向 URL 等域名确定后填写；应用版本与相关权限按企业审批流程发布。
   应用可用范围不替代编辑器服务端的项目授权。

不用等待服务器即可完成 1、2、4、5、6 及发布材料准备；如果控制台要求完整地址才能发布，
先保存草稿，不填伪造地址或把当前未鉴权测试端口开放到公网。

| 交付项 | 由谁提供 | 保存位置 |
|---|---|---|
| App ID | 应用管理员 | 服务端配置，可用于识别应用 |
| App Secret | 应用管理员 | 服务端 Secret 文件/公司密钥系统 |
| 公司 tenant_key | 应用管理员核对，或在受控联调中取得并人工确认 | 服务端租户允许列表 |
| 测试成员及角色 | 项目负责人 | 私有成员配置/数据库，不提交个人名单到源码 |
| 正式域名、测试域名 | 运维 | 固定 PUBLIC_ORIGIN，分别配置 |
| 精确登录回调地址 | 根据域名生成 | 飞书安全设置及服务端配置，两边一致 |
| 应用可用范围、发布状态 | 应用管理员 | 飞书后台 |

不要根据第一次成功登录的人自动设定公司 tenant_key 或授予管理员。
不能把 Cindy 插件的飞书授权当作编辑器应用授权。

## 2. 地址约定

已确定的正式配置如下（地址准备不代表服务已开放）：

- 正式首页：`https://behavior-editor.online/`
- 正式回调：`https://behavior-editor.online/auth/feishu/callback`
- `PUBLIC_ORIGIN`：`https://behavior-editor.online`
- `FEISHU_LOGIN_APP_ID`：`cli_aa58888782b8dd0b`
- 独立测试回调尚未配置，不使用不存在的示例域名。

飞书安全设置与服务端的回调必须完整匹配，不用通配符，不携带动态返回地址。
测试/正式最好使用不同应用与凭据；若共用应用，则使用不同会话库和 Cookie 域，分别登记回调。
客户端浏览器必须能访问回调域名，后台必须能访问飞书授权接口。当前外网服务器不能访问公司 GitLab，采用内网本机构建并上传只读快照，不要求云端连接 GitLab；上传和创建 MR 在本部署模式下保持禁用。
内网域名不一定需要公网开放，但必须满足实际使用者网络与企业策略要求。

## 3. 登录与项目授权

流程：

访问首页 → 登录页 → 飞书授权 → 后台校验回调 → 获取可信身份 →
核对公司与项目成员名单 → 建立编辑器会话 → 返回编辑器。

首期只采用服务器维护的显式成员允许列表，不接入部门树、用户组同步或首次登录自动入组。
身份主键为 `(app_id, tenant_key, open_id)`；名称只用于显示，不能用姓名或客户端提交的邮箱授权。
open_id 与应用有关，不能直接复用另一个应用（包括公共库应用）中的 open_id。
应用切换时需要明确成员 ID 映射，不按同名自动合并。

新成员首次登录但尚无名单记录时进入“等待开通”页面；服务端记录最少的待确认身份，
由管理员核对后线下配置角色，不自动放行，也不向浏览器返回访问令牌。

| 编辑器角色 | 权限 |
|---|---|
| viewer | 查看和下载在线文件，在本地编辑 |
| contributor | viewer 权限，以及上传文件创建 Draft MR |
| admin | contributor 权限，以及由运维工具管理成员/撤销会话 |

默认未登记者无权限。第一期不做网页管理后台，私有成员配置变更由部署者负责。
GitLab 合并仍在 GitLab 完成；编辑器 admin 不意味着 GitLab Maintainer。
每次数据请求校验成员仍启用及角色版本，撤销权限后现有会话也立即失效。
无通讯录同步时不能承诺自动感知离职：项目负责人需及时停用成员；后续再评估事件订阅。

## 4. 服务端接口契约（拟定）

| 接口 | 未登录时 | 成功时 |
|---|---|---|
| `GET /login` | 显示轻量登录页 | 可跳回编辑器 |
| `GET /auth/feishu/start?returnTo=/` | 创建登录事务，302 到飞书 | 同左；显式重新登录不丢草稿 |
| `GET /auth/feishu/callback` | 校验事务和 code/state | 设置会话 Cookie，303 到安全返回路径 |
| `GET /api/auth/session` | 401 `AUTH_REQUIRED` | 用户显示信息、角色、到期时间、CSRF token |
| `POST /api/auth/logout` | 幂等清除 Cookie | 撤销服务器会话并返回 204 |
| `GET /`、前端 JS/CSS 等编辑器资源 | 跳转 `/login`，API 不重定向 | 正常加载 |
| `GET /api/behaviors` | 401 JSON | 现有目录结构 `{version,head,branch,files}` |
| `GET /api/behaviors/file?name=…&ref=…&sha=…` | 401 JSON | 现有 `{text}`，仍校验固定提交与 blob SHA |
| `POST /api/behaviors/uploads` | 401 JSON | contributor/admin 可用；保留现有上传结构 |
| `GET /data/library.json` | 401 JSON | 校验后的只读快照 |

公开路由只允许 `/login`、独立登录页静态资源、start/callback 及不包含敏感状态的存活检查。
所有行为数据、公共库快照和编辑器资源均经过鉴权，不额外保留无鉴权 Nginx 静态数据路径。
健康检查仅面向运维网络，不暴露凭据/权限细节。

会话响应示例（虚构值）：

```json
{
  "user": {"id": "internal-user-id", "displayName": "测试成员"},
  "role": "contributor",
  "expiresAt": "2026-10-21T16:00:00Z",
  "csrfToken": "opaque-session-bound-value"
}
```

不向前端返回飞书 user_access_token、refresh_token、App Secret、GitLab Token。

错误统一为 `{"code":"AUTH_REQUIRED","message":"请重新登录","requestId":"…"}`：

- 401 `AUTH_REQUIRED` / `SESSION_EXPIRED`：显示重新登录入口，保留本地草稿。
- 403 `TENANT_NOT_ALLOWED` / `MEMBER_NOT_ALLOWED`：无项目访问权限。
- 403 `ROLE_REQUIRED`：可查看，但无上传权限；不能通过隐藏按钮代替服务器校验。
- 403 `CSRF_INVALID`：刷新会话后由用户重新确认提交。
- 409 `FILE_VERSION_CONFLICT`：重新读取线上版本并核对，不自动覆盖。
- 409 `UPLOAD_REQUEST_CONFLICT`：同一请求 ID 的内容或身份不同。
- 503 `IDENTITY_PROVIDER_UNAVAILABLE`：飞书暂不可用，禁止退回匿名访问。

取消授权、state 缺失/过期/重放等回调错误进入独立错误页，可重新发起登录，不循环重定向。
API 必须返回 JSON 而非登录页面 HTML，防止页面误当作文件解析。

## 5. OAuth 与会话实现要求

采用飞书当前浏览器授权码流程、v2 token 兑换接口及登录用户信息接口。
接口版本/参数/scope 实施时按下方官方资料再次核验，不混用旧版 app_access_token 兑换流程。

1. 由服务器生成至少 32 字节随机 state，并存一次性、5 分钟有效的登录事务。
   state 绑定发起浏览器的短期 HttpOnly Cookie，不只检验值存在。
   returnTo 存服务端，只接受站内允许路径，拒绝协议相对 URL、外域及编码绕过。
2. 回调原子消费事务，校验 state、浏览器绑定、到期时间；拒绝重复 code。
   OAuth 回调是来自飞书的顶级 GET 导航，不能被现有通用 cross-site 拒绝逻辑误拦截。
   仅对此精确路由使用 OAuth 校验，不能放开全部跨站请求。
3. 后台兑换 user_access_token，再调用用户信息接口确认 tenant_key/open_id；
   同时检查 HTTP 与飞书业务错误码，不相信浏览器传来的身份字段。
   使用固定回调 URL，不根据 Host/X-Forwarded-Host 动态拼接。
4. 若选定飞书授权流程支持 PKCE，使用 S256 并把 verifier 绑定同一事务；
   具体支持项由程序按当前官方 API 核验，不能猜测参数后上线。
5. 首期只用用户令牌获取登录身份，不申请长期离线访问；取得身份后不持久化令牌。
   编辑器会话是自己的服务器会话，不等于飞书令牌有效期。
6. 会话采用随机 opaque ID，服务器只存哈希；登录成功轮换 ID。
   正式 Cookie 使用 `__Host-pps_session`、`Secure; HttpOnly; SameSite=Lax; Path=/`，无 Domain。
   Lax 支持飞书顶级 GET 回调，写接口仍验证 CSRF token 与固定 Origin。
7. 建议绝对有效期 8 小时、闲置 2 小时；这是编辑器策略，不是飞书官方固定有效期。
   首期不静默刷新飞书凭据，到期重新登录；角色撤销优先于到期时间。
8. 单实例可用持久化 SQLite 保存会话、登录事务和幂等/审计记录，文件不放 dist；
   多实例改用共享数据库，不能继续依赖进程内 Map。
9. 限制登录和上传频率、请求大小、并发及外部请求超时。只信任明确的反向代理，
   日志不记录 code/state/token、Cookie 或原始请求体，反向代理也需隐藏 callback 查询参数。

App Secret、GitLab 服务凭据和公共库同步凭据相互独立，禁止使用 VITE_ 环境变量传递密钥。
登录应用配置建议为 `FEISHU_LOGIN_APP_ID`、`FEISHU_LOGIN_APP_SECRET_FILE`、
`FEISHU_ALLOWED_TENANT_KEY`、`PUBLIC_ORIGIN`、`AUTH_DB_PATH`，避免覆盖旧同步配置。

## 6. 对现有工程的改造位置

| 当前代码 | 下一阶段需要改造 |
|---|---|
| `server/cloud-preview.mjs` | 独立正式服务入口/共用鉴权中间件；Host 校验之外增加 session/角色，精确豁免 OAuth 回调 |
| `server/gitlab-behaviors.mjs` | 接受服务端可信 actor；MR 记录提交者；不接受客户端自报姓名作为审计身份 |
| `src/utils/onlineProvider.js` | 统一解析 401/403/409；写请求携带 CSRF；不自动重试不确定的写请求 |
| `src/components/OnlineFiles.jsx` | viewer 隐藏上传；过期保留待提交状态，登录后重新确认 |
| `src/store/publishedLibrary.js` | 401 不再当普通离线刷新；按用户隔离在线缓存，退出/禁用时清除共享数据缓存 |
| `src/store/fileView.js` 及在线需求清单 | 退出/过期隐藏在线预览、清理共享文件与需求聚合内存，取消挂起读取 |
| 本地草稿与文件模块 | 不清空个人草稿/不覆盖磁盘文件；只停止在线访问，保留本地保存入口 |
| `compose.yaml` / 代理 | 正式 HTTPS、持久化会话卷、健康检查、无鉴权旁路检查；不得简单开放当前测试端口 |

后台请求取消/登出后，旧请求响应也不能重新填充在线缓存：用会话代数或取消信号阻止旧响应落库。
个人草稿可能包含已下载的内容，退出不会替用户删除本地文件。登录控制服务访问，不等于本地文件加密。
新域名仍需重新授权保存目录；切换前明确提示保存旧域名草稿。

上传幂等必须绑定 `(用户内部 ID, requestId)`，并校验目标仓库/分支及 payload hash。
保存分支名、提交 SHA、MR 编号和状态；重试前复核当前成员与角色。
跨用户不能凭同一请求 ID 恢复他人的上传。MR 注明实际飞书提交人和来源请求 ID，
GitLab 的 commit 作者仍是服务账号；没有 GitLab OAuth 映射时不声称继承个人 GitLab 权限。
第一期仍不提供编辑器内合并按钮。

## 7. 验收与上线前检查

- 已授权成员、未登记成员、其他租户、取消授权均有明确结果。
- 过期/伪造/重放 state、错误浏览器 Cookie、外部 returnTo 均拒绝。
- 登录后直接访问 JS/CSS、行为 API、公共快照与下载均按预期鉴权，绕过首页无法读数据。
- viewer 伪造 POST、跨站 POST、缺少 CSRF、角色被撤销均不能上传。
- 服务重启、会话过期、并发登录、失败上传恢复不会重复创建 MR。
- 登录过期不会丢本地草稿；重新登录不会隐式重发上传或覆盖文件。
- 退出清除在线数据缓存并阻止旧响应写回；本地文件不自动删除。
- 部署产物、浏览器存储、日志和错误响应均无凭据；代理不输出回调查询参数。
- 测试与正式环境各自回调、Cookie、成员配置隔离。
- 程序按团队规范负责正式账号/登录实现与验收后，才开放团队入口。

## 8. 资料与待核对项

2026-10-21 已检索飞书官方资料，确认浏览器授权码 → 用户令牌 → 用户信息的流程，
以及 App ID/App Secret、重定向地址准备要求。尚未进入本项目飞书应用后台，
应用是否已有、精确 scope、管理员权限和租户标识均未实测；实施时再次核对。

- [浏览器网页接入指南](https://open.feishu.cn/document/sso/web-application-end-user-consent/guide)
- [获取授权码](https://open.feishu.cn/document/authentication-management/access-token/obtain-oauth-code)
- [获取 user_access_token v2](https://open.feishu.cn/document/authentication-management/access-token/get-user-access-token)
- [获取登录用户信息](https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/authen-v1/authen/user_info)
- [项目非技术同学代码开发流程规范](https://xd.feishu.cn/wiki/AnUuwSoPciNAOgkkk2NcaHl1nhd)

当前可继续：应用草稿/测试成员准备、程序接口评审、运维域名与网络准备。
本方案不要求现在提供 App Secret，也不授权替用户创建或发布飞书应用。
