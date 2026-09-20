# 功能需求

> Status: TBD ｜ Owner: <OWNER> ｜ Last Reviewed: <DATE>

**用途**：项目功能需求的完整清单与 Source of Truth。每条需求必须可验证。
**不写**：实现方式、组件设计、接口字段定义（→ [architecture/](../architecture/README.md)、[api/](../api/README.md)）。

---

## 需求模板

复制以下块新增一条需求；ID 递增且永不复用。

```markdown
### REQ-001 <需求名称>

- Status: Proposed
- Priority: Must
- Related: G-001 / <LINK>
- Source: <OWNER> / <LINK>

**描述**
系统应当……

**理由**
……

**验收标准**
1. 当……时，系统应……
2. 当……时，系统应……

**边界与例外**
- ……

**关联 Spec**
- specs/<id>-<name>/
```

## 需求清单

| ID | 名称 | Priority | Status | 关联 Spec |
| -- | ---- | -------- | ------ | --------- |
| REQ-001 | TBD | Must | Proposed | TBD |

（完整条目按上方模板在本文档内展开。）

## 需求 ⇒ 验证映射

每条需求的验证归属在对应 Feature Spec 的 [verification.md](../../specs/_template/verification.md) 中维护，本文件只保留总览：

| REQ | 验证方式 | 状态 |
| --- | -------- | ---- |
| REQ-001 | TBD | Pending |
