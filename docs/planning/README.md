# 计划（Planning）

> Status: Draft ｜ Owner: <OWNER> ｜ Last Reviewed: <DATE>

**用途**：记录长期计划与里程碑，回答「先做什么、什么时候算到达某个节点」。
**不写**：目标本身（→ [goals-and-non-goals.md](../overview/goals-and-non-goals.md)）、需求内容（→ [requirements/](../requirements/README.md)）、单个 Feature 的详细计划（→ `specs/<id>/plan.md`）。

## 文件

| 文件 | 内容 |
| ---- | ---- |
| [roadmap.md](roadmap.md) | 分阶段的长期方向与 Spec 索引 |
| [milestones/](milestones/README.md) | 具体里程碑定义与退出条件 |

## 规则

1. Roadmap 不定义需求；需求只在 [requirements/](../requirements/README.md) 中定义。Roadmap 引用需求 ID。
2. Roadmap 中不得出现未经确认的功能承诺；未确认项标 `TBD` 或列入 `Candidate`。
3. 一个 Feature 的详细拆解属于 `specs/<id>/plan.md`，Roadmap 只保留一行索引。
4. 计划变更不需要 ADR；但「放弃某个已承诺方向」应在对应 Spec 或 Roadmap 中记录原因。

## 状态词汇

| 状态 | 含义 |
| ---- | ---- |
| Candidate | 候选，未确认 |
| Planned | 已排期，尚未开始 |
| In Progress | 进行中 |
| Done | 已完成并验证 |
| Dropped | 放弃（必须写原因） |
