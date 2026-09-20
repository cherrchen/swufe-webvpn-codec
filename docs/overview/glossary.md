# 术语表（Glossary）

> Status: TBD ｜ Owner: <OWNER> ｜ Last Reviewed: <DATE>

**用途**：统一项目内术语，避免人与 Agent 对同一名词产生不同理解。
**唯一来源**：本文件是术语定义（One Fact, One Source of Truth）的 Source of Truth；其它文档应引用术语，而不是各自重新定义。

**填写原则**：

- 只收录本项目特有的、容易歧义的、或与通用含义不同的术语；
- 每条包含：术语（中/英）、定义、别名、不要与之混淆的概念、来源；
- 不要收录通用编程名词（如 “function”、“HTTP”）。

---

## 术语

| 术语 | English | 定义 | 别名 / 不混淆 | 来源 |
| ---- | ------- | ---- | ------------- | ---- |
| TBD | TBD | TBD | TBD | TBD |

## 状态值约定

以下状态值在本仓库的文档与 Spec 中使用，含义固定：

| 状态 | 适用对象 | 含义 |
| ---- | -------- | ---- |
| Draft | Spec / 文档 | 尚未评审 |
| Approved | Spec | 已确认可以实现 |
| In Progress | Spec | 实现中 |
| Implemented | Spec | 代码完成，未验证 |
| Verified | Spec | 验证矩阵通过 |
| Archived | Spec / 文档 | 历史资料，不再作为当前事实 |
| Proposed / Accepted / Superseded / Deprecated / Rejected | ADR | 决策记录状态 |

## 新增术语流程

1. 在本表新增一行；
2. 在首次使用该术语的文档中添加指向本表的链接；
3. 若术语变更导致语义变化，检查 [requirements/](../requirements/README.md) 与 [architecture/](../architecture/README.md) 是否需要同步。
