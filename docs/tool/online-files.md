# 在线行为文件

## 查看与本地编辑

左侧文件区提供「本地／在线」页签。在线目录读取公开仓库 akaneyonchyan/behavior_editor 的 main 分支、behaviors/ 目录，只显示本层 JSON 文件。首次为空是正常的，不会自动上传本机现有行为。

点击文件打开独立只读预览，可平移、缩放并查看节点原始配置。开始节点、循环出口和结束节点释放占用均来自该线上图；不会加载进本地编辑状态、覆盖本地草稿或成为自动缓存。预览中的删除、拖动节点、连线及编辑快捷键不可修改图。

先通过顶部「保存目录」选择本地文件夹，再点击预览中的「下载到本地编辑」。写入原始 JSON 后按现有文件打开流程切换；若不愿切换当前未保存内容，可取消切换，文件已下载到目录。下载前会确认本地同名覆盖；正在编辑且未保存的同名文件禁止覆盖。浏览器需支持目录访问（Chrome／Edge、HTTPS）。本地编辑仍需手动保存正式文件。

在线列表直接读取 GitHub API，与公共库的飞书快照发布不同。合并后点击「刷新」读取最新 main；正在预览的是打开时的固定版本，不会悄悄替换。无登录浏览次数受 GitHub API 额度限制，遇到限制可稍后重试。

## 上传与授权

1. 在本地完成编辑并手动保存。
2. 打开「在线 → 上传授权」，填写自己的 GitHub Token。Token 只在当前页内存保存，刷新或清除授权后失效，不写 localStorage、sessionStorage、JSON 或仓库。
3. 点击「上传文件」，可选择 1–20 个行为 JSON，单个最多 2 MB、合计最多 10 MB。
4. 确认“新增／替换同名文件”清单及公开范围，再点击「创建分支并提交审核」。
5. 打开返回的 PR 链接，审核文件差异后由有权限者合并。提交 PR 不等于发布到在线目录。

上传者的 GitHub 账号必须有本仓库写入权限，仓库所有者可在仓库 Settings → Collaborators 中添加团队成员。Token 不能赋予账号本来没有的权限，也不要共用仓库所有者的 Token。

若账号允许为该仓库创建 fine-grained Token，选择仅此仓库，授予 Contents 和 Pull requests 的 Read and write；Metadata 保留默认读取权限。GitHub 对外部协作者的 fine-grained Token 支持存在限制，若无法选择此仓库，可使用有期限的 classic Token，公开仓库使用 public_repo 范围（账号仍需协作者权限）。只把 Token 填入编辑器密码输入框，不发到聊天或 PR。

参考：[创建个人访问令牌](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)、[细粒度权限](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens)。

## 覆盖、冲突与恢复

上传是 Git 分支加 PR，不直接覆盖 main。文件名决定新增或替换；不支持仅大小写不同的同名文件。上传前再次核对所涉及文件的 blob SHA；若相对确认清单已有变化则停止，要求重新核对。

通过本页面下载时，浏览器会记住文件名对应的公开版本 SHA。之后上传若发现线上已更新，会要求先下载最新版本并整合修改，或在 GitHub 手动处理分支冲突。此记录不包含 Token 或行为内容；换浏览器、清除存储、从其他途径拿到文件时无法知道原始编辑基线，因此首次上传仍必须人工审阅替换差异。

上传准备期间 main 其他文件的更新可保留到新分支。分支创建后 main 再变化由 GitHub PR 显示差异和可能的合并冲突；编辑器不尝试对行为 JSON 自动做语义合并。请勿把“Git 无文本冲突”等同于“行为设计没有冲突”。

网络或权限错误可能发生在分支已创建但 PR 未成功的阶段。页面会提供分支对比链接，先检查是否已有提交或 PR，再继续创建 PR，避免反复上传。不要在上传处理中刷新页面。

## 审核与校验

Validate shared behaviors 工作流验证 behaviors 目录所有 JSON，拒绝非法格式、路径、文件名和仅大小写不同的重名。它不读取飞书 Secrets，也不部署页面。发布工作流也先验证共享行为文件。

校验通过不代表行为玩法正确，审核者仍需检查文件内容。此功能不自动修改仓库保护规则；如需强制“至少一人审核且校验通过才能合并”，仓库管理员应设置 main 的 Ruleset/Branch protection。当前页面不提供直接合并按钮，审核在 GitHub 完成。

所有上传内容与 Git 历史公开。目录仅存行为文件，不放密钥、公共库快照或未经允许公开的设计资料。
