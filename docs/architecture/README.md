# 架构（Architecture）

> Status: Draft ｜ Owner: <OWNER> ｜ Last Reviewed: <DATE>

**用途**：本目录是系统**结构与技术事实**的 Source of Truth：系统由什么组成、如何协作、数据如何流动、接口边界在哪里、为什么这样决策。
**不写**：需求（→ [requirements/](../requirements/README.md)）、单个 Feature 的实现计划（→ [specs/](../../specs/README.md)）、临时调研（→ [.agents/notes/](../../.agents/notes/README.md)）。

## 文件

| 文件 | 回答的问题 |
| ---- | ---------- |
| [overview.md](overview.md) | 系统的整体形态、边界、关键约束 |
| [components.md](components.md) | 有哪些组件，各自职责与依赖 |
| [data-flow.md](data-flow.md) | 数据从哪里来、经过什么、到哪里去 |
| [data-model.md](data-model.md) | 核心实体、关系、不变式 |
| [interfaces.md](interfaces.md) | 模块/服务之间的接口边界 |
| [adr/](adr/README.md) | 关键技术决策及其后果 |

## 维护规则

- 架构文档必须反映**当前已确认**的设计；未确认的方案放在对应 Feature Spec 的 `design.md` 或 `Alternatives Considered` 中。
- 每张图都要有文字说明；图只是补充（Mermaid 使用原则见 [documentation-rules.md](../development/documentation-rules.md)）。
- 架构变更必须检查是否需要 ADR（触发条件见 [adr/README.md](adr/README.md)）。
- 架构文档中不重复需求原文，使用链接引用。

## 何时更新

| 触发 | 需要更新 |
| ---- | -------- |
| 新增/删除组件 | [components.md](components.md)、必要时 [overview.md](overview.md) |
| 数据流改变 | [data-flow.md](data-flow.md) |
| 实体或不变式改变 | [data-model.md](data-model.md) |
| 模块接口改变 | [interfaces.md](interfaces.md)、[docs/api/](../api/README.md) |
| 难以逆转的技术选择 | 新增 ADR |
