# 测试策略

> Status: Draft ｜ Owner: <OWNER> ｜ Last Reviewed: <DATE>

**用途**：定义测试分层、覆盖要求与运行方式，是「什么算已验证」的判断依据之一。
**唯一来源**：测试策略在本文件定义；单个 Feature 的验证项登记在 `specs/<id>/verification.md`，不要在本文件复制具体用例。

---

## 1. 测试分层

| 层 | 目标 | 范围 | 运行成本 | 何时必须写 |
| -- | ---- | ---- | -------- | ---------- |
| 单元测试 | 单个函数/模块的行为与边界 | 无外部依赖 | 低 | 存在分支逻辑、边界、错误路径时 |
| 集成测试 | 模块协作、接口契约 | 多模块 | 中 | 跨模块行为、数据流、契约变化时 |
| 端到端测试 | 用户可见流程 | 完整系统 | 高 | 关键用户路径，且成本可接受时 |
| 手工验证 | 无法自动化的场景 | — | — | UI/环境/外部系统相关 |

> 未使用的层在下方 `TBD` 中说明原因，而不是删除本表。

## 2. 覆盖要求

```text
Coverage target: TBD
Coverage tool:   TBD
Exceptions:      TBD
```

原则：覆盖率是参考指标，不是目标本身。**必须覆盖**：需求验收标准、已修复 Bug 的复现路径、边界与错误路径、幂等性与并发敏感逻辑（如有）。

## 3. 测试命名与组织

```text
Location:  TBD
Naming:    TBD
Structure: TBD   （Arrange / Act / Assert 或项目惯例）
```

## 4. 何时必须补测试

| 变更类型 | 要求 |
| -------- | ---- |
| 新增行为 | 必须有可复现的验证（自动化或明确的手工步骤） |
| 修复 Bug | 先有复现（失败测试或最小步骤），修复后可验证不再触发 |
| 重构 | 不改变行为的重构依赖既有测试保护；若缺失，先补关键路径 |
| 仅文档 | 不需要测试 |

## 5. 运行方式

```text
Run all:        TBD
Run one file:   TBD
Run with watch: TBD
CI test job:    TBD   （若 CI 仅做文档检查，请明确说明）
```

## 6. 测试数据与环境

| 项 | 约定 |
| -- | ---- |
| 测试数据 | TBD（禁止使用真实用户数据） |
| 外部依赖 | TBD（打桩 / 沙箱 / 契约测试） |
| 环境隔离 | TBD |
| 敏感性 | 测试中不得出现真实密钥、令牌、个人数据 |

## 7. 与验证的关系

测试通过 ≠ Feature 完成。完成标准见 [docs/verification/verification-strategy.md](../verification/verification-strategy.md)，
逐需求映射见 `specs/<id>/verification.md`。
