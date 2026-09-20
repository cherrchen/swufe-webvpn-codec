# 目标与非目标

> Status: TBD ｜ Owner: <OWNER> ｜ Last Reviewed: <DATE>

**用途**：明确项目**要做什么**与**明确不做什么**，用来抵抗 Scope Creep。
Agent 在实现任何功能前，应能在这里判断该功能是否属于项目范围。

**填写原则**：

- 目标必须可判断（可验证的终止条件），不要写口号。
- 非目标必须写得足够具体，使 Agent 能据此拒绝实现。
- 不写实现方案（→ [architecture/](../architecture/README.md)）。

---

## 目标（Goals）

| ID | 目标 | 成功判据 | 状态 |
| -- | ---- | -------- | ---- |
| G-001 | TBD | TBD | Open |

## 非目标（Non-goals）

> 非目标不是「以后可能做」，而是「当前明确不做，且不应由 Agent 自行补上」。

| ID | 非目标 | 原因 | 若需要则走 |
| -- | ------ | ---- | ---------- |
| NG-001 | TBD | TBD | 新 Feature Spec / 新 ADR / 明确授权 |

## 与 Roadmap 的关系

目标在本文件中定义；时间与排序在 [planning/roadmap.md](../planning/roadmap.md) 中维护，不在此处重复。

## 变更流程

修改目标或非目标属于需求变更：

1. 更新本文件；
2. 在 [requirements/](../requirements/README.md) 中同步受影响的需求条目；
3. 若涉及架构方向，评估是否需要 ADR；
4. 在 PR 的 Documentation Impact 中说明。
