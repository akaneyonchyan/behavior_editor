# GitHub 公共内容库备份与重建

更新日期：2026-11-03。当前仓库自带可运行的规范化快照；新飞书库将在用户准备好后另行创建，本次没有创建或改写任何飞书表。

## 已同步的数据

resources/content-library/library.snapshot.json 包含13类对象、104项属性、56项Buff、98条对象名录，保留启用和停用状态、名称、说明、稳定ID和适用对象。schema.json 保存14张表的字段类型、单选选项和关联表名称，不含登录凭据。

原始备份共14表、215行，另有逐表CSV、完整字段定义、原记录ID、关联值及重建计划。原始备份在本机 D:/PPS/CodeX_Output/data/2026-11-03-github-resource-backup/library/，不随网页发布；原始表的管理字段也在该备份里。

## 重建顺序

1. 新建独立Base，不复用原生产库的密钥和同步配置。参考原始备份中的 restore-plan.json 创建14张表；名称主列为文本，其他字段按字段类型恢复。
2. 先创建对象类型表与所有名录表，记录“旧table_id → 新table_id”。属性和Buff表的“适用对象”重新关联新对象类型表，允许多选。
3. 写入对象类型及其他非关联字段，记录“旧record_id → 新record_id”。**标识列为空的旧记录必须填入旧record_id作为显式标识**，不能让它回退到新record_id。备份中的重建计划已补好这些稳定标识，原始数据不改动。
4. 按映射重建属性/Buff的适用对象关联；原关联值中的record_ids需展开并映射为新记录ID。“对象表ID”改为新名录表ID，buff类型继续指向同一张新Buff表。
5. 保留停用行、字段说明和原有拼写。属性数据类型实际仅支持“数值”“枚举”；原字段选项中留存的其他选项只供追溯，不能用于新增记录。
6. 完整回读新库，用 server/feishu.mjs 转换并经 validateLibrary 校验。按ID比较四类条目，确认与备份一致，再切换GitHub同步来源。

已用全部215行进行新表ID/新记录ID的本地重建演练，转换后的规范化库与原库完全一致。CSV仅便于查看和普通字段导入，**不能独立恢复关联关系**。

## GitHub 切换到新库

在GitHub仓库Actions Secrets设置新库自己的六项参数：FEISHU_APP_ID、FEISHU_APP_SECRET、FEISHU_BASE_TOKEN、FEISHU_OBJECT_TABLE、FEISHU_ATTRIBUTE_TABLE、FEISHU_BUFF_TABLE。应用需具备新Base和所有关联表的只读权限。不要把Secret写入仓库或VITE变量。

确认六项配置属于新库后，将仓库Actions变量 CONTENT_LIBRARY_SOURCE 设置为 feishu。工作流才会读取飞书；读取或校验失败会停止发布，不静默退回旧快照。未设置该变量时，默认只使用仓库快照，计划触发会跳过构建。未来飞书更新不会自动改写仓库备份文件。

重建之后对象/属性/Buff/名录的稳定ID保持不变，因此本次同步的行为图无需批量改ID。备份不包含账户权限、应用Secret、飞书历史版本或云端运行环境，这些需在新环境单独配置。
