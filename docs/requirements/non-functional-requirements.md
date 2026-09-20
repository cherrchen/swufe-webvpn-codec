# 非功能需求

> Status: TBD ｜ Owner: <OWNER> ｜ Last Reviewed: <DATE>

**用途**：定义质量属性与约束。非功能需求同样需要可验证的判据，否则只是口号。
**不写**：具体实现手段（例如「使用 Redis」属于设计，应写入 Spec 或 ADR）。

---

## 模板

```markdown
### NFR-001 <名称>

- Category: performance | reliability | security | usability | maintainability | portability | observability | compliance
- Status: Proposed
- Priority: Must

**要求**
……

**验证方式**
……（测量方法、阈值、运行环境）

**不达标时的后果**
……
```

## 清单

| ID | 类别 | 要求摘要 | 验证方式 | Status |
| -- | ---- | -------- | -------- | ------ |
| NFR-001 | TBD | TBD | TBD | Proposed |

## 各类别提示

| 类别 | 需要明确的内容 |
| ---- | -------------- |
| performance | 延迟、吞吐、并发、数据规模、测量环境 |
| reliability | 可用性目标、故障恢复、幂等性、数据一致性 |
| security | 信任边界、认证、授权、输入校验、密钥管理（→ [security/](../security/README.md)） |
| usability | 可学习性、错误提示、可访问性 |
| maintainability | 模块化、可测试性、文档义务 |
| portability | 支持平台、运行时版本、依赖约束（→ [dependency-policy.md](../development/dependency-policy.md)） |
| observability | 日志、指标、追踪要求 |
| compliance | 法规、许可证、数据保留 |

## 与 ADR 的关系

若某条非功能需求导致难以逆转的技术选择，应额外建立 ADR，并在本条目的 `Related` 中引用。
