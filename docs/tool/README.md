# 工具说明

GitHub恢复与资源范围以[GitHub完整资源版](github-complete-version.md)为准；新公共库重建见[备份与重建](../content-library/github-restore.md)。下文保留GitLab生产使用与历史部署资料。

第一次参与项目，按 [小白上手手册](beginner-guide.md) 找到仓库、克隆项目、使用编辑器，再用 Cindy 修改编辑器。

新同事先读 [开发入门：GitLab + Cindy](team-onboarding.md)，按当前 XD Sites 方案申请权限、启动和提交修改。

当前入口为 https://petpals-behavior-editor.workers.xd-sites.com，使用平台心动 SSO。自动同步和发布见 [XD Sites 自动化](../../deploy/xd-sites-automation.md)；下方自建飞书鉴权和上海服务器记录保留作历史参考。

飞书登录与 HTTPS 已上线，配置见 [鉴权部署](../../deploy/feishu-auth.md)。本机自动发布及旧站停用见 [自动部署](../../deploy/automatic-release.md)。

代码维护使用公司 GitLab master，生产服务已切换到云服务器。历史过程见 [迁移交接](gitlab-migration.md)。

更新日期：2026-10-26。适用于当前云服务器鉴权版本；迁移验收与未关闭事项见 [上线状态](../../deploy/domain-launch.md)。

| 你想做什么 | 阅读文档 |
|---|---|
| 了解工具用途、能力和边界 | [产品说明](product.md) |
| 本地运行小岛行为预览、模拟参数与支持范围 | [行为预览场景](behavior-preview.md) |
| 绘制行为、保存文件、恢复草稿 | [使用方法](usage.md) |
| 在线查看、下载及历史上传方案（当前云端上传关闭） | [在线文件说明](online-files.md) |
| 本地运行、改代码、测试、部署 | [开发与协作](development.md) |
| 维护下拉框中的对象、属性、Buff | [公共内容库说明](../content-library/README.md) |
| 通过 Skill 使用和维护工具 | [behavior-editor Skill](skills/behavior-editor/SKILL.md) |

线上地址：https://behavior-editor.online/

新加入的开发者或 agent：先读仓库根目录 [AGENTS.md](../../AGENTS.md)，再按上述入口阅读。文档描述当前实现，不代表游戏引擎已支持相同配置。修改功能时同步更新对应说明。

## 通过 Skill 使用与维护

本目录提供完整的 [behavior-editor Skill](skills/behavior-editor/SKILL.md)，覆盖使用指导、编辑器修改、公共库维护和发布排查。可直接让 agent 读取，或复制 `skills/behavior-editor/` 文件夹安装。它按任务读取本目录及公共库文档，不另存一套重复手册。

仓库的 [自动发现版本](../../.agents/skills/behavior-editor/SKILL.md) 与此文件内容一致。维护时以 `.agents/skills/behavior-editor/SKILL.md` 为共享源，同时同步至 `docs/tool/skills/behavior-editor/SKILL.md`；两份文件应在同一提交中更新。

在支持项目 `.agents/skills` 的环境中，以本仓库作为工作区，新建或重启 agent 会话即可发现。也可将整个 `behavior-editor` 文件夹安装到自己工作区的 `.agents/skills/`；保留工程文档访问能力，更新时从仓库同步，避免各自维护副本。其他宿主可按自身 Skill 安装方式加载，或显式提供 SKILL.md 路径。

调用示例：

- “使用 behavior-editor Skill，教我创建并保存一张行为图。”
- “使用 behavior-editor Skill，修复执行节点的展示，并验证旧文件兼容。”
- “使用 behavior-editor Skill，核对飞书公共库的属性，先给出修改清单。”
- “使用 behavior-editor Skill，排查公共库更新后网页仍显示旧数据的问题。”

Skill 的调用不额外授予飞书写入或发布权限；按具体任务已有授权执行。仅将文件放进仓库不等于发布到 SkillHub。
