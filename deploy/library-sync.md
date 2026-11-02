# 云服务器自动同步飞书公共内容库

2026-10-26：同步由云服务器 systemd timer 执行，不依赖 GitHub、GitLab Runner 或本机电脑在线。使用独立公共库同步应用的原六项配置，不使用登录应用密钥。

## 运行方式

pps-editor-library-sync.timer 在启动后及每轮完成约 5 分钟后运行一次。服务使用最近成功部署的 behavior-editor 镜像，在独立只读容器内运行 server/library-sync.mjs；只能通过挂载目录写入快照与状态，不修改飞书源表。

完整读取对象/属性/Buff 三表及对象表ID关联的具体名录，沿用原 FeishuRepository 转换与 validateLibrary 校验。成功且内容变化时原子更新 library.json，并保留 library.previous.json；无变化时只更新检查状态，保留真实 syncedAt。读取、权限或校验失败时不覆盖最后有效快照。

网页在飞书鉴权后读取实时快照，约 60 秒检查一次；无需重新构建或重启网站。代码发布只在快照不存在时初始化，不能把镜像内旧数据覆盖到新快照。

## 私有配置与状态

- 配置：/home/ubuntu/pps-editor/private/library-sync.json，六项 FEISHU_* 配置，权限 600。
- 数据目录：/home/ubuntu/pps-editor/shared，权限 700；容器内挂载为 /app/library-data。不要使用 /app/shared，该路径是程序模块。
- 同步状态：shared/library-sync-status.json，记录 checkedAt、syncedAt、变化标记、内容摘要及条目数量，无密钥。
- 当前镜像：deployment.json；服务每次运行读取最近成功部署镜像。
- 服务脚本：/usr/local/lib/pps-editor/run-library-sync.py；systemd 单元来自 deploy/pps-editor-library-sync.*。

检查：sudo systemctl status pps-editor-library-sync.timer；sudo journalctl -u pps-editor-library-sync.service -n 20 --no-pager。
立即同步：sudo systemctl start pps-editor-library-sync.service。
暂停/恢复：sudo systemctl stop/start pps-editor-library-sync.timer。

首次安装：将运行脚本安装至上述 /usr/local/lib 路径（root 所有），将 service/timer 安装到 /etc/systemd/system，daemon-reload 后 enable --now timer。先确认生产镜像包含同步脚本，并完成一次 service 运行验收。修改服务包装脚本或 systemd 单元后需重新安装；公共库读取与校验代码随普通自动部署更新。

## 凭据迁移记录

旧 GitHub Secrets 不能经读取接口导出。2026-10-26 使用一次性手动任务，将六项配置在运行内存中加密给云服务器生成的接收证书，仅下载密文，由服务器私钥解密至私有文件。明文未进入日志、仓库或构建产物。任务完成后删除临时工作流和加密产物，仓库 Actions 恢复关闭；旧 Pages 与旧同步工作流保持停用。

后续维护直接在服务器私有配置更新对应值，不在聊天、前端 VITE_ 变量或 Git 中传递密钥。
