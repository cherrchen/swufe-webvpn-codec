# Notes（临时上下文）

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-20

**用途**：存放 Agent Session 交接、调试记录、调研与实验结论等**临时上下文**。
**中文版本是 Source of Truth**；英文版见 [README.en.md](README.en.md)。

> **核心规则：Notes 不是 Source of Truth。**
> Notes 不得作为架构、需求、API 契约或最终决策的依据。长期结论必须迁移到 [docs/](../../docs/README.md)、[specs/](../../specs/README.md) 或 ADR。

---

## 命名

```text
.agents/notes/YYYY-MM-DD-<topic>.md
.agents/notes/2026-09-20-<topic>.md     ← 形式示例
```

多个同日笔记可加后缀：`YYYY-MM-DD-<topic>-2.md`。

## 允许的内容

- Agent Session 交接（[模板](../../docs/agent/session-handoff.md)）；
- 调试过程记录与排查线索；
- 调研与方案比较（未定论）；
- 实验与临时设计思考；
- 临时决策与其理由（标注 `Open`／临时）。

## 不允许的内容

| 不允许 | 原因 |
| ------ | ---- |
| 作为架构 Source of Truth | 未评审、易过期 |
| 作为需求定义 | 需求只在 [requirements/](../../docs/requirements/README.md) |
| 作为 API 契约 | 契约只在 [api/](../../docs/api/README.md) |
| 作为最终决策记录 | 决策属于 ADR 或 [docs/architecture/](../../docs/architecture/README.md) |
| 复制聊天/思维过程作为正式文档 | 污染长期记忆 |
| 存放密钥、令牌、真实个人数据 | 安全风险 |

## 迁移规则

当 note 中出现长期结论时：

1. 写入正确的 Level A/B 文档（docs / specs / ADR）；
2. 在 note 顶部添加：

   ```text
   > Migrated to: <路径>
   > Migrated on: YYYY-MM-DD
   ```

3. 保持 note 原样（不改写历史结论），必要时在文件头标注 `Status: Superseded`。

## 生命周期

| 阶段 | 处理 |
| ---- | ---- |
| 活跃 | 当前 Session 使用 |
| 已迁移 | 标注迁移去向，可保留供回溯 |
| 失效 | 顶部标注 `Status: Obsolete` + 原因；不删除，除非确认无历史价值 |

## 检查

本目录不强制中英双语、不参与 Spec 结构校验；但其中的 Markdown 链接仍会被 `npm run docs:links` 检查。
