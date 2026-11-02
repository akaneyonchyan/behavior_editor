# 同事开发入门：GitLab + Cindy

第一次接触行为图或编程，先读 [零基础上手手册](beginner-guide.md)，本篇提供环境和协作命令的详细参考。

更新：2026-10-26。适用于当前 GitLab + XD Sites 方案。

## 1. 入口与所需权限

- 仓库：https://git.xindong.com/petpals/shared/design_behavior_editor
- 网站：https://petpals-behavior-editor.workers.xd-sites.com
- 主分支：`master`。网站使用公司网络、心动 SSO；目前在站点列表隐藏，通过链接访问。
- 网站登录、GitLab 开发、飞书源表维护是三套独立权限。

| 要做的事 | 向谁申请、需要什么 |
|---|---|
| 使用在线编辑器 | 公司网络和员工心动 SSO；遇到拒绝访问请站点维护者核对访问权限 |
| 阅读、克隆代码 | GitLab 项目管理员授予通常为 Reporter 的仓库读取权限 |
| 改代码、推送个人分支、创建 MR | GitLab 项目管理员授予通常为 Developer 的权限；仍受保护分支规则约束 |
| 合并到 master | 由项目设置允许的审核者或维护者执行；Developer 身份不保证能合并保护分支 |
| 使用 Cindy 开发 | 自己的 Cindy、可用模型配置和本地项目目录访问权限 |
| 使用 Cindy 操作 GitLab | 可选：在 Cindy 的「插件 → Cindy GitLab」连接自己的公司 GitLab 账号；不用插件也可通过 Git 命令和网页操作 |
| 编辑飞书公共内容库 | 内容负责人单独授予源表权限；普通代码开发不需要 |
| 发布网站、管理同步服务 | 仅指定维护者持有 XD Sites 发布权限、服务器权限和相关密钥 |

建议管理员保护 master，并要求合并前审核；这是协作建议，不表示本文已修改或核验项目的保护规则。

Git 身份验证使用公司支持的 HTTPS 凭据管理器或 SSH。若使用个人访问令牌，克隆通常需 `read_repository`，推送需 `write_repository`；插件 API 操作通常需要 `api`，按插件和公司要求配置。令牌权限不会提升项目成员角色。使用自己的账号，不共享维护者令牌，不把令牌放进仓库 URL、聊天、截图或提交。证书报错应安装公司认可的证书，不关闭 TLS 校验。

## 2. 首次安装与克隆

安装 Git、Node.js 22.13 或更新的兼容版本（包含 npm）、Cindy，以及 Edge 或 Chrome。Windows 可在 PowerShell 运行以下命令；macOS／Linux 使用终端。

```sh
git clone https://git.xindong.com/petpals/shared/design_behavior_editor.git
cd design_behavior_editor
git switch master
git pull --ff-only origin master
npm ci
```

每人使用独立克隆目录。在 Cindy 中打开这个目录作为项目，不共用同一个工作目录，也不复制维护者的部署配置。首次提交前在本仓库设置自己的 `git config user.name` 和 `git config user.email`。

## 3. 启动本地编辑器

先生成在线行为的本地只读快照：

```sh
node scripts/export-behaviors.mjs
```

公共库快照不随 Git 分发。需要验证对象、属性或 Buff 候选时，请维护者通过获授权的内部渠道提供有效快照，然后执行（替换实际文件路径）：

```sh
node scripts/reuse-public-library.mjs "实际的公共库快照文件路径"
node scripts/validate-public-library.mjs
```

未获得快照时仍可开发基础界面，但公共库显示未就绪，不能据此验收真实候选数据。生成的 `public/data/library.json` 已由 Git 忽略，不提交快照或内部原表。普通本地开发不需要飞书 App Secret、生产 SSH 密钥或发布凭据。

Windows PowerShell：

```powershell
$env:VITE_ONLINE_PROVIDER='gitlab-static'
$env:VITE_LIBRARY_MODE='published'
$env:VITE_AUTH_MODE=''
$env:PAGES_BASE='/'
npm run dev -- --host 127.0.0.1
```

macOS／Linux：

```sh
VITE_ONLINE_PROVIDER=gitlab-static VITE_LIBRARY_MODE=published VITE_AUTH_MODE='' PAGES_BASE=/ npm run dev -- --host 127.0.0.1
```

打开终端打印的本地地址，通常为 `http://127.0.0.1:5173`。首次可选择「暂用浏览器草稿」，测试保存时使用独立测试目录。浏览器草稿不等于正式保存，也不会自动同步到 GitLab。

本地页面没有平台 SSO 保护，只监听本机，不向公网暴露本地服务或内部数据。线上行为当前只读，可以下载后编辑；网页上传入口关闭。

## 4. 让 Cindy 开始协作

先让 Cindy 阅读 [AGENTS.md](../../AGENTS.md)、[工具说明](README.md) 和 [behavior-editor Skill](../../.agents/skills/behavior-editor/SKILL.md)。不同客户端的 Skill 自动发现方式可能不同，可直接要求读取仓库里的文件。

可复制下面这段，把修改需求换成具体功能和验收条件：

> 请先读取 AGENTS.md、docs/tool/README.md 和 .agents/skills/behavior-editor/SKILL.md。基于最新 origin/master，为“这里填写本次修改”创建独立分支。保留我已有的未提交内容，修改后运行相应测试，给出改动和验证结果，再推送分支并创建 Draft MR。不要直接推 master，不要部署站点，也不要修改飞书源表。

开始前核对 Cindy 打开的目录和 `git remote -v`。一次任务聚焦一个改动；多人尽量分工到不同模块。GitLab 协作通过分支和合并完成，不是同一文件的实时协同编辑。

## 5. 分支、测试与提交

先运行 `git status`。有未提交改动时先保存、提交到原任务分支或妥善暂存，不用清空目录或 `reset --hard` 处理。工作区整理好后：

```sh
git fetch origin
git switch -c feature/yourname-short-task origin/master
```

分支名换成自己的名字和任务。功能修改按仓库要求执行：

```sh
npm test
npm run build
```

PowerShell 在第 3 节的同一终端执行即可沿用环境变量。macOS／Linux 的行内变量只对单条命令生效，构建时应使用：

```sh
VITE_ONLINE_PROVIDER=gitlab-static VITE_LIBRARY_MODE=published VITE_AUTH_MODE='' PAGES_BASE=/ npm run build
```

测试可能需要几分钟。涉及 XD Sites 界面、在线快照或登录入口时，在准备有效公共库及行为快照、完成上述构建后执行：

```sh
npx playwright test --config playwright.sites.config.cjs
```

该配置使用本机 Microsoft Edge（`msedge`）；未安装时先安装 Edge。文件打开、保存和覆盖冲突还应使用测试文件手动验证。本地测试不代表真实平台 SSO 已通过。纯文档修改检查事实、路径、链接及 `git diff --check` 即可。

检查并仅提交本次文件（下列路径和提交说明需替换）：

```sh
git diff
git diff --check
git add -- path/to/changed-file
git commit -m "描述本次改动"
git push -u origin feature/yourname-short-task
```

在 GitLab 创建目标为 `master` 的 Draft MR，写明改了什么、验证结果、已知限制；必要时附不含敏感信息的截图，请维护者审核。不要提交密钥、个人配置、构建产物或公共库快照。

如果 master 有新提交，可在自己的任务分支执行 `git fetch origin` 和 `git merge origin/master`，解决冲突并重跑相关检查。遇到不了解的冲突与另一位开发者确认；不要强推共享分支覆盖他人工作。

## 6. 合并后怎样上线

当前由指定维护者电脑上的 Cindy 定时任务检查 GitLab master 和云端有效公共库快照，发现变化后测试、构建并通过 XD Sites 发布。不是 GitLab Runner 流水线，也不要求同事安装 WSL 或 Docker Runner。

合并成功不等于已上线：需等待下一轮检查及测试、构建、发布完成，由维护者核对发布结果。不要在同事电脑上重复安装发布任务，也不要运行旧的 `deploy/install-local-deployer.ps1`。维护细节见 [XD Sites 自动化](../../deploy/xd-sites-automation.md)。

维护者电脑关机或 Cindy 关闭后，新代码和新公共库的站点发布会暂停；已经发布的网站仍由平台提供上一版，不需要这台电脑在线才能访问。云服务器上的飞书读取任务独立运行，但云端读取成功不等于站点已更新。

## 7. 常见问题

| 现象 | 检查与处理 |
|---|---|
| 网站能登录，仓库打不开 | 另外申请 GitLab 项目权限；SSO 登录不授予仓库权限 |
| 仓库能读，推送失败 | 核对 Developer 角色、令牌写权限、公司策略和保护分支；推送个人分支 |
| Cindy 看不到 GitLab 项目 | 核对插件连接的实例和自己的账号；可先用 Git 命令与网页完成协作 |
| 公共库未就绪 | 向维护者获取获授权的有效快照，按第 3 节导入并校验 |
| 本地仍调用旧服务 API | 检查是否使用 gitlab-static 模式，修改环境后重启开发服务或重新构建 |
| 在站点列表找不到编辑器 | 当前为隐藏站点，使用本文直接链接，并确认公司网络与 SSO |
| 合并后页面没有变化 | 由维护者检查定时任务和发布结果；不要恢复旧 GitHub 或上海发布任务 |

首次完成标准：能拉取仓库、启动本地编辑器、验证自己的改动、推送独立分支并创建 MR。上线由指定维护者统一负责。
