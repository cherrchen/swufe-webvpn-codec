# 归档（Archive）

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-20

**用途**：保存已失效但仍具历史价值的设计资料、被取代的文档与已完成的 Spec。
**原则**：**不直接删除**重要历史资料；归档内容不再作为当前事实来源。

> 归档目录不强制中英双语（见 [documentation-rules.md](../development/documentation-rules.md)）。

---

## 归档什么

| 对象 | 归档方式 |
| ---- | -------- |
| 已完成且结论已同步到长期文档的 Spec | 保留在 `specs/`，状态置 `Archived`（见 [specs/README.md](../../specs/README.md)） |
| 被取代的 ADR | ADR 状态置 `Superseded` 并指向新 ADR（不移动文件） |
| 被废弃的需求 | 保留条目，状态 `Deprecated` / `Removed`（不移动文件） |
| 被替换的整体设计文档 | 移动到本目录，并在原位置留下指向归档路径的说明 |
| 历史调研报告 | 移动到本目录或保留在 notes 中并说明不再有效 |

## 命名

```text
docs/archive/<YYYY-MM-DD>-<original-name>.md
```

在文件开头添加：

```text
> Archived: <DATE>
> Reason: <为什么归档>
> Superseded by: <新文档路径，如适用>
> No longer a source of truth.
```

## 索引

| 归档对象 | 原位置 | 归档日期 | 原因 | 取代者 |
| -------- | ------ | -------- | ---- | ------ |
| [2026-09-20-swufe-webvpn-bridge-docs-v1.0/](2026-09-20-swufe-webvpn-bridge-docs-v1.0/README.md) | 仓库外文档包 `SWUFE-WebVPN-Bridge-Docs-v1.0.zip` | 2026-09-20 | 原包将需求/设计/测试/项目文档混在一处，未按本仓库分层；内容已重新分配 | [docs/overview/](../overview/project-overview.md)、[docs/requirements/](../requirements/README.md)、[docs/architecture/](../architecture/README.md)、[specs/001-phase1-local-bridge/](../../specs/001-phase1-local-bridge/spec.md) |

## 规则

1. 归档内容**不得**被引用为当前 Source of Truth；
2. 同一事实只能有一个当前 Source of Truth；归档件必须明确标注已失效；
3. 归档目录不参与双语配对检查；
4. 归档不改变历史，不要「顺手」修订归档内容的结论。
