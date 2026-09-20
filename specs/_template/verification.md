# Verification: <feature-name>

> Spec ID: <id>
> Status: Draft
> Owner: <OWNER>
> Last Updated: <DATE>

> 本文件建立 **Requirement → Verification** 映射，是「Feature 是否完成」的判定依据。
> 规则见 [verification-strategy.md](../../docs/verification/verification-strategy.md)。
> Feature **不因为「代码写完了」被视为完成**；状态必须推进到 `Verified`。

## 映射表

| Requirement | Verification | Status |
| ----------- | ------------ | ------ |
| REQ-001 | TBD（单元测试 / 集成测试 / 手工步骤 / 检查） | Pending |
| REQ-002 | TBD | Pending |
| NFR-001 | TBD | Pending |

Status 取值：`Pending` / `Passed` / `Failed` / `N/A`（`N/A` 必须写明理由）。

## 验收标准覆盖

| Acceptance Criteria | 对应验证项 | Status |
| ------------------- | ---------- | ------ |
| AC-001 | TBD | Pending |
| AC-002 | TBD | Pending |

## 执行的命令与结果

| 命令 | 结果 | 时间 | 备注 |
| ---- | ---- | ---- | ---- |
| TBD | TBD | <DATE> | TBD |

> 只记录**实际执行过**的命令；未执行时写明原因，不得写「应该没问题」。

## 手工验证步骤

```text
前置条件：
1. …
2. …
预期结果：
实际结果：
```

> 无手工验证时写 `不适用` 并说明理由。

## 边界与异常场景

| 场景 | 期望行为 | 实际结果 | Status |
| ---- | -------- | -------- | ------ |
| EC-001 | TBD | TBD | Pending |

## 兼容性

| 维度 | 结论 | 依据 |
| ---- | ---- | ---- |
| 接口兼容 | TBD | TBD |
| 数据兼容 | TBD | TBD |
| 行为兼容 | TBD | TBD |

## 安全

| 检查项 | 结论 | 依据 |
| ------ | ---- | ---- |
| 输入校验 | TBD | TBD |
| 权限 | TBD | TBD |
| 敏感数据 | TBD | TBD |

## 文档同步

| 文档 | 是否需要更新 | 状态 |
| ---- | ------------ | ---- |
| [docs/requirements/](../../docs/requirements/README.md) | TBD | TBD |
| [docs/architecture/](../../docs/architecture/README.md) | TBD | TBD |
| [docs/api/](../../docs/api/README.md) | TBD | TBD |
| ADR | TBD | TBD |
| `.en.md` 配对 | TBD | TBD |

## 未验证 / 无法验证项

| 项 | 原因 | 已尝试 | 需要谁决策 |
| -- | ---- | ------ | ---------- |
| TBD | TBD | TBD | TBD |

## 结论

- [ ] 映射表无 `Pending`
- [ ] 执行的命令与结果已记录
- [ ] 文档影响已处理
- [ ] Spec 状态可推进到 `Verified`
