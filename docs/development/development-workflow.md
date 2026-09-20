# 开发流程

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-20

**用途**：定义从想法到合并的标准流程，人与 Coding Agent 使用同一套流程。
**不写**：具体任务清单（→ 对应 Spec 的 `tasks.md`）、测试实现细节（→ [testing-strategy.md](testing-strategy.md)）。

---

## 1. 总流程

```text
Idea
 ↓
Issue / Discussion
 ↓
Spec
 ↓
Design
 ↓
Plan
 ↓
Tasks
 ↓
Implementation
 ↓
Verification
 ↓
Documentation Sync
 ↓
Review
 ↓
Complete
```

对应文件落在 `specs/<id>-<name>/`：`spec.md → design.md → plan.md → tasks.md → verification.md`
（模板见 [specs/_template/](../../specs/_template/README.md)）。

## 2. 变更分级

| 级别 | 判定 | 必需产物 |
| ---- | ---- | -------- |
| Trivial | 拼写、注释、无行为变化的格式调整 | PR（使用模板） |
| Bug | 修复与既有需求/spec 不符的行为 | 复现记录 + 修复 + 测试 + 文档影响判断 |
| Feature | 新增或改变用户可见行为 | 完整 Spec |
| Architecture | 影响结构、公共接口、数据模型、安全模型 | Spec + ADR |

不确定属于哪一级时，按更高一级处理。

## 3. Bug 简化流程

```text
Bug → Reproduce → Root Cause → Fix → Test → Documentation Impact
```

要求：

1. **先复现**：给出可执行的最小步骤或失败测试；
2. 定位根因，不要只针对表象修补；
3. 修复后确认原复现路径不再触发；
4. 检查是否影响 requirements / architecture / spec / ADR 的描述；
5. 若 Bug 暴露需求或设计缺陷 ⇒ 升级为 Spec，并记录在 `Open Questions`。

## 4. 每个阶段的退出条件

| 阶段 | 退出条件 |
| ---- | -------- |
| Spec | `Goals` / `Non-goals` / `Acceptance Criteria` 明确，`Open Questions` 已收敛或标注阻塞 |
| Design | 方案与备选方案、风险、影响面已写明；需要 ADR 的已建立 |
| Plan | 阶段划分与依赖清晰，包含回滚与文档更新计划 |
| Tasks | 任务足够小、可独立验证、带依赖标记 |
| Implementation | 任务全部完成，`tasks.md` 状态已更新 |
| Verification | [verification.md](../../specs/_template/verification.md) 矩阵无 `Pending`（或已说明原因） |
| Documentation Sync | 受影响的长期文档已更新，或明确说明无需更新 |
| Review | PR Checklist 全项通过 |

## 5. 分支与提交

```text
Default branch: main
Branch naming:  TBD（实现开始前确定）
Commit message: 既有提交为 `chore: <说明>` 形式（2 条，2026-09-20）；正式约定 TBD（实现开始前确定）
```

文档检查 CI 见 [.github/workflows/docs-check.yml](../../.github/workflows/docs-check.yml)（当前 CI 只跑文档检查）。

## 6. 与 Agent 的关系

Coding Agent 遵循同一流程，额外约束见 [AGENTS.md](../../AGENTS.md) 与
[docs/agent/agent-workflow.md](../agent/agent-workflow.md)。Agent 不得跳过 Spec 阶段直接实现 Feature。

## 7. 相关

- 文档同步矩阵：[documentation-rules.md](documentation-rules.md)
- 测试要求：[testing-strategy.md](testing-strategy.md)
- 验证策略：[docs/verification/verification-strategy.md](../verification/verification-strategy.md)
