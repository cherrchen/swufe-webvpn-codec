# 需求（Requirements）

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-20

**用途**：本目录是项目**需求事实**的 Source of Truth。
需求描述「做什么、为什么、达到什么标准」，**不描述如何实现**（实现见 [architecture/](../architecture/README.md) 与 [specs/](../../specs/README.md)）。

## 文件

| 文件 | 内容 | 粒度 |
| ---- | ---- | ---- |
| [product-requirements.md](product-requirements.md) | 产品级目标、用户、价值、优先级 | 项目级 |
| [functional-requirements.md](functional-requirements.md) | 功能需求条目（REQ-xxx） | 功能级 |
| [non-functional-requirements.md](non-functional-requirements.md) | 性能、可靠性、安全、可用性、可维护性等约束 | 项目级 |

## 需求 ID 约定

```text
REQ-001  功能需求（functional-requirements.md）
NFR-001  非功能需求（non-functional-requirements.md）
```

- ID 一经分配不得复用、不得重新编号；
- 需求被移除时保留条目并标记 `Status: Removed`，注明原因与替代项；
- Feature Spec 中的 `Functional Requirements` 必须引用这里的 ID（可新增 `REQ-xxx`，但需同步回本目录）。

## 状态

```text
Proposed → Accepted → Implemented → Verified
                    ↘ Deprecated / Removed
```

## 需求变更流程

1. 修改相应需求文档；
2. 检查受影响的 Feature Spec 的 [verification.md](../../specs/_template/verification.md) 矩阵；
3. 检查是否触发 ADR（[docs/architecture/adr/](../architecture/adr/README.md)）；
4. 在 PR 的 Documentation Impact 中说明。

## 不放在这里的内容

- 具体 Feature 的实现计划与任务 → [specs/](../../specs/README.md)
- 接口字段级契约 → [docs/api/](../api/README.md)
- 临时讨论与调研 → [.agents/notes/](../../.agents/notes/README.md)
