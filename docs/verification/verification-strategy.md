# 验证策略

> Status: Draft ｜ Owner: <OWNER> ｜ Last Reviewed: <DATE>

**用途**：定义验证的层次、证据要求、Feature 生命周期与完成标准（Definition of Done）。
这是「完成」定义的 Source of Truth；具体项目的覆盖方式见本文件第 6 节。

---

## 1. 验证层次

| 层次 | 手段 | 典型证据 |
| ---- | ---- | -------- |
| 需求覆盖 | 逐条对照 Acceptance Criteria | `verification.md` 矩阵 |
| 自动化测试 | 单元 / 集成 / 端到端 | 命令 + 输出摘要 |
| 手工验证 | 可复现步骤 | 步骤 + 实际结果 |
| 静态检查 | 构建、类型、lint、格式 | 命令 + 结果 |
| 文档一致性 | `npm run docs:check`、Documentation Update Matrix | 命令 + 结果 |
| 兼容性 | 接口/数据/行为兼容性检查 | 结论 + 风险说明 |
| 安全 | 输入、权限、密钥、依赖风险 | 结论 + 缓解措施 |
| 评审 | PR Checklist | PR 记录 |

## 2. 需求 → 验证映射（强制）

每个 Feature 必须在 `specs/<id>-<name>/verification.md` 中提供映射表：

| Requirement | Verification | Status |
| ----------- | ------------ | ------ |
| REQ-001 | 单元测试 … | Pending |
| REQ-002 | 集成测试 … | Pending |
| REQ-003 | 手工验证 … | Pending |

状态取值：`Pending` / `Passed` / `Failed` / `N/A`（N/A 必须写明理由）。

## 3. 证据要求

| 断言 | 需要的证据 |
| ---- | ---------- |
| 「测试通过」 | 命令 + 结果摘要 |
| 「行为符合需求」 | 对应验收标准的验证步骤与结果 |
| 「无兼容性影响」 | 兼容性检查结论（或说明为何不适用） |
| 「无文档影响」 | 对照 Documentation Update Matrix 的逐项判断 |
| 「无法验证」 | 明确说明缺少什么、已尝试什么 |

禁止把「应该没问题」「看起来正确」作为验证证据。

## 4. Feature 生命周期

```text
Draft
 → Approved
 → In Progress
 → Implemented
 → Verified
 → Archived
```

| 状态 | 进入条件 |
| ---- | -------- |
| Draft | spec.md 建立 |
| Approved | 验收标准明确，Open Questions 收敛或标注阻塞 |
| In Progress | 开始实现 |
| Implemented | 代码与任务完成，**验证未完成** |
| Verified | verification.md 矩阵无 `Pending`（或已说明） |
| Archived | 结论已同步到长期文档，Spec 保留为历史 |

## 5. Definition of Done（默认）

Feature 至少需要考虑：

| 维度 | 要求 |
| ---- | ---- |
| Implementation | 仅实现 Spec 范围 |
| Tests | 相关测试存在且通过 |
| Verification | 矩阵完成，状态非 Pending |
| Documentation | 长期文档已同步（含双语配对） |
| Compatibility | 兼容性影响已说明 |
| Security | 安全影响已说明 |
| Spec Status | 更新到 `Implemented` / `Verified` |

## 6. 项目覆盖（Project Override）

```text
Additional checks:     TBD
Exemptions:            TBD
Required reviewers:    TBD
Release gate:          TBD
```

> 使用本模板的项目在此补充或收紧要求；**覆盖必须写在这里**，而不是散落在各 Spec 中。

## 7. 何时重新验证

| 触发 | 动作 |
| ---- | ---- |
| 相关代码变更 | 重跑相关验证项，更新矩阵状态 |
| 依赖升级 | 重跑测试 + 兼容性判断 |
| 需求变更 | 更新矩阵条目本身 |
| 验证失败 | 状态置 `Failed`，问题记录到 spec 的 `Open Questions` / `Risks` |
