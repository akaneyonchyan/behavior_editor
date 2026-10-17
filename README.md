# 行为编辑器

基于 React Flow 的行为图编辑器，支持节点摘要、三步循环判定、曲线流光、撤销复制、本地 JSON 文件和定时备份。

## 文档入口

- [工具说明](docs/tool/README.md)：产品定位、使用方法、开发与协作。
- [公共内容库说明](docs/content-library/README.md)：字段与使用规则、飞书维护、同步排查、规则来源与待核对事项。
- [Agent 协作入口](AGENTS.md)：当前产品约束、验证要求和修改边界。

文档更新日期：2026-10-17。自动保存更新缓存目录内固定文件，不再新增随机编号恢复文件；完整保存与恢复规则见[使用方法](docs/tool/usage.md)。

## 使用

发布地址：https://akaneyonchyan.github.io/behavior_editor/

建议使用桌面 Chrome 或 Edge，首次使用选择本地保存目录。行为文件保存在自己的电脑，通过团队内部 Git 仓库同步；本网站不上传行为文件。

公共库仅在飞书维护。页面每 60 秒检查发布数据，也可点击“刷新数据”。数据同步通常有 5～10 分钟延迟，排队或失败时可能更久，不保证上限。尚未配置数据源时，编辑器可打开本地文件，但公共库显示未就绪。

## 部署配置

Settings → Pages → Source 选择 GitHub Actions。工作流尝试自动启用 Pages；权限不足时需管理员在设置中启用。

Settings → Secrets and variables → Actions 中配置以下 Repository Secrets：

- FEISHU_APP_ID
- FEISHU_APP_SECRET
- FEISHU_BASE_TOKEN
- FEISHU_OBJECT_TABLE
- FEISHU_ATTRIBUTE_TABLE
- FEISHU_BUFF_TABLE

分别为飞书应用 ID、密钥、多维表格 app token，以及对象、属性、Buff 三张表的 ID。应用必须有表格读取权限。表字段为：标识、名称、说明、启用；属性另含数据类型（数值/枚举）；属性和 Buff 的适用对象为关联对象表的字段。

公共库 JSON 会公开发布。不要将不应公开的内容放进该数据源。密钥只放 Secrets，不写进源码或网页。

main 推送及每 5 分钟定时任务触发发布。GitHub 不保证定时准确，长期无仓库活动可能停用计划任务。飞书读取失败时不覆盖当前站点。首次未配置任何飞书 Secrets 时，推送仅发布编辑器。

## 本地开发

Node.js 22+，执行 npm ci、npm test、npm run dev。Pages 构建使用 VITE_LIBRARY_MODE=published 和 PAGES_BASE=/behavior_editor/。旧 Node 后台模式作为兼容代码保留，不在 Pages 运行。

examples/eat-snack.json 是通用流程演示，不是项目正式行为配置。
