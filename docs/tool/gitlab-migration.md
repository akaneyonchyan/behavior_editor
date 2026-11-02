# GitLab 工程迁移交接

日期：2026-10-21。

## 本次范围

将 GitHub `akaneyonchyan/behavior_editor` 的 main 完整历史导入心动 GitLab
`petpals/shared/design_behavior_editor` 的独立原型分支，等待程序审核。

- 来源提交：`7d7f49b8f3d46b98cf476b8e1c681c70e8e6fe97`。
- 目标基准：`master`，初始化提交 `36d9b03d1cbb63629adbf4860c65fe053853b9c3`。
- 分支：`feature/proto_261021_gyx_editor_migration`。
- 保留来源 main 可达的全部 80 个提交及目标初始化历史。
- 初次合并导入后的文件树与来源 main 完全相同；后续适配见下方记录。
- 不导入其他开发分支、未合并 PR、Issues、Secrets 或发布产物。

目标仓库尚无 develop。本次从现有 master 建立隔离分支，不擅自设置新的集成分支或保护规则。
按团队原型流程提交 Draft MR，默认不直接合入；由程序审核并决定正式集成方式。
首次导入应保留合并历史，不使用 squash，以免主线丢失来源提交历史。

## 当前可运行范围

源码、已纳入 Git 的共享行为 JSON、测试、工具及公共库手册、仓库内维护 Skill 均随历史保留。
本地使用 Node.js 22+，执行 `npm ci`、`npm test`、`npm run build`。

初次导入没有改写运行逻辑。后续已在同一原型分支补充受限测试部署：

- 新增 Docker/Compose 与 GitLab CI 验证配置，详见 [部署说明](../../deploy/README.md)。
- 使用 `VITE_ONLINE_PROVIDER=gitlab` 构建时，在线目录、固定版本预览和上传改走同域后台。
- 后台仅为固定 GitLab 项目创建分支及 Draft MR，保留同名文件 SHA 冲突保护与重试恢复。
- 默认构建仍沿用 GitHub，以避免迁移分支中的改动影响旧站运行方式。
- 尚未接入飞书登录，部署端口只绑定本机，上传默认关闭；不得公开服务。

仍需区分：

- 旧 GitHub Pages 网站仍然运行。
- 旧站在线上传仍使用 GitHub；只有明确配置的 GitLab 构建使用新适配。
- 公共库仍由旧 GitHub Actions 同步；Secrets 不在 Git 中，也没有迁移。
- `.github/workflows` 保留作现行部署来源参考，不会在 GitLab 自动执行。
- 本地没有公共库发布快照时，相关候选未就绪属于预期行为。

## 后续上线条件

1. 程序审核工程导入，确定 master/develop 与合并规则。
2. 运维提供云服务器、HTTPS 域名、内部 GitLab 网络、Runner 和部署凭据配置方式。
3. 为已提供的 GitLab CI 配置 Runner，完成容器运行和部署环境验证，再接入公共库同步任务。
4. 在受限测试环境验证已提供的 GitLab 读取及分支/MR 上传适配，保留文件版本冲突保护。
5. 飞书登录、项目成员授权、会话与接口鉴权由程序负责正式实现。
6. 测试站验证后再切换；切换前冻结旧站上传并核对新增提交，防止两边分叉。
7. 正式切换后同步 README、维护及设计 Skill 的生产地址与操作流程，再处理旧站和旧同步任务。

新域名不能继承旧域名的浏览器草稿与本地目录授权；切换前提示保存草稿，新站重新授权保存目录。
工程迁移不代表服务上线，也不代表飞书登录已接入。

## 2026-10-21 验证记录

- 原有 `npm test` 全部通过。
- 新增 GitLab 后台契约测试通过，覆盖分页、固定版本读取、上传校验、
  SHA 冲突、原子建分支、Draft MR 失败恢复、重复提交及受限服务入口。
- GitLab 浏览器回归 1 项通过；原有在线文件及需求清单浏览器回归 5 项通过（本机 Edge）。
- GitHub 默认模式及 GitLab 模式构建通过，17 个行为文件校验通过。
- GitLab API 测试使用模拟响应，不代表已用部署凭据完成真实读写联调。
- 本机无 Docker，尚未验证容器构建/启动；云端 Runner 和服务器验证仍待执行。
