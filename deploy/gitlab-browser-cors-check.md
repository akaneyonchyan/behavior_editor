# 浏览器直连 GitLab：跨域核验

2026-10-29，本机网络；未使用真实个人 Token，未创建或修改 GitLab 文件。

## GitLab CORS 响应通过

以 https://petpals-behavior-editor.workers.xd-sites.com 为 Origin，向 https://git.xindong.com 发出 OPTIONS，验证 /api/v4/user、目标项目、Repository Files API。目标项目为 petpals/shared/design_behavior_editor，文件接口使用不存在的探测路径。

- GET + private-token：HTTP 200。
- PUT + content-type,private-token：HTTP 200（仅预检，未发送 PUT）。
- Access-Control-Allow-Origin: *。
- Access-Control-Allow-Methods: GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS。
- Access-Control-Allow-Headers 包含各次申请的请求头。

浏览器直连应使用 credentials: omit，以 PRIVATE-TOKEN 验证，不依赖 GitLab 登录 Cookie。预检通过不代表真实 Token 拥有仓库写权限。

## 隔离浏览器测试

本机 DNS 将 git.xindong.com 解析为 172.19.186.1。隔离 Edge 156.0.4314.50 上，用编辑器 origin 的测试页发送无效探测 Token 的只读请求，浏览器报告：

Permission was denied for this request to access the `local` address space.

使用 Playwright 的 local-network-access 权限授权后仍报相同错误；未关闭浏览器安全策略。测试页由本地路由提供，并非已登录生产页面，不能据此认定所有同事的浏览器都失败。尝试进入真实生产页面时跳转到心动 SSO，未获取已登录生产页结果。

## 真实编辑器页面复核通过

2026-10-29 在 Cindy 内置浏览器（rsb-webview）已有的正式编辑器页面复核。页面已登录，origin 为 https://petpals-behavior-editor.workers.xd-sites.com，isSecureContext=true，local-network-access 权限为 granted。

从页面执行 credentials: omit 的跨域 GET /api/v4/user，携带无效测试 Token，得到可读取的 HTTP 401、Response.type=cors、message=401 Unauthorized。这是预期鉴权失败，证明真实页面的网络权限与跨域通路通过；未发送真实 Token 或写请求。此结论不等于所有 Chrome/Edge 配置都自动获得本地网络权限。

## 后续验收

浏览器个人 Token 直读直写代码已接入本地分支；浏览器回归以模拟 GitLab 验证直写和 Worker 只读复核。尚需部署后让用户在页面输入自己的 Token，先验证只读权限，再在专用测试文件核验真实保存。没有切换生产读写路径。
