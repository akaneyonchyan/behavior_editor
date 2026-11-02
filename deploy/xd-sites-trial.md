# Cindy XD Sites 试用部署

2026-10-26 用户已验收登录并要求接通同步和自动部署，当前维护流程见 [XD Sites 自动化](xd-sites-automation.md)。以下为首次试用记录。

独立 trial/xd-sites 分支试用，不切换上海生产域名和自动部署任务。

使用 VITE_ONLINE_PROVIDER=gitlab-static、VITE_LIBRARY_MODE=published、VITE_AUTH_MODE 留空构建。静态内容必须由 XD Sites 公司网络和心动 SSO 保护，禁止匿名发布内部行为图及公共库；该构建没有自己的登录网关，不能直接公开托管。

在线行为读取 data/behaviors 快照，隐藏上传，保留 GitLab 项目身份；同源数据请求携带平台会话 Cookie。当前公共库为从服务器取得的有效快照，持续同步尚未接入。先验收同事能否访问，再决定正式迁移和自动发布方案。

站点 basePath 按 sites_static_create/build-config 的实际返回重新构建。只上传 dist，不上传源码、服务器配置、密钥或会话数据库。
