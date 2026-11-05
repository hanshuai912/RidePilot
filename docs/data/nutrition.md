# 饮食数据模型

营养领域与训练计划分开版本化，用户档案、正式计划和修改提案分别承担不同职责。

## 模型

- `NutritionProfile`：用户长期饮食偏好、过敏原、禁忌、常见食物和用餐时间；通过 `version` 做乐观锁。
- `NutritionPlan`：用户的营养计划聚合，只保留当前生效版本引用。
- `NutritionPlanVersion`：不可变营养计划版本，记录来源、饮食档案版本和可选的训练计划版本。
- `NutritionItem`：某个版本中的单个餐次或训练补给，记录本地日期、时间、食材、营养值来源和置信度。
- `NutritionProposal`：待确认草稿，保存原始版本、当前草稿、校验结果和应用幂等键。

## 一致性

应用提案时服务端会锁定用户行，重新读取当前营养档案和正式版本，执行过敏原、成分完整性和日期校验，然后在一个事务中创建新版本并切换 `activeVersionId`。历史版本不修改。

实际进食记录尚未纳入本次迁移。后续应作为独立实体保存，不直接覆盖营养计划。

## 训练联动快照（无需迁移）

沿用已有 JSON 字段，不新增表或列：

- `nutrition_proposals.metadata.trainingContext`：训练正式版本 ID / 版本号、按日期的训练内容 SHA-256；指定训练提案时额外记录其 ID。摘要排除课程 ID（发布新训练版本时课程 ID 会重建），比较日期、目的、时长、距离、结构等实际内容，覆盖休息日以识别课程删除。
- `nutrition_proposals.original`：AI 生成范围内原有餐次，供逐日预览。
- `nutrition_plan_versions.snapshot.trainingDateSignatures`：最近已确认训练联动的逐日摘要。仅覆盖本次联动日期，范围外沿用旧记录。
- `snapshot.dailyTargets`：按日期记录营养目标，单日查询优先读取，兼容历史 `dailyTarget`。
- `snapshot.affectedDates`：本次实际替换范围，重放幂等应用响应时使用。

应用时锁用户行和营养提案行，检查当前训练 ID、营养基础版本及当前过敏原；范围外餐次复制到新版本。草稿更新采用 proposalVersion 乐观锁并重置校验。没有训练核对摘要的历史版本按“待核对”展示，不自动迁移或生成新方案。
