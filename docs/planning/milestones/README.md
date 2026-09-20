# 里程碑（Milestones）

> Status: Draft ｜ Owner: <OWNER> ｜ Last Reviewed: <DATE>

**用途**：定义「到达某个节点」的判定标准，使进度可被外部复核。
**不写**：需求、设计、任务拆解（分别见 [requirements/](../../requirements/README.md)、[architecture/](../../architecture/README.md)、`specs/<id>/tasks.md`）。

## 何时建立里程碑

- 存在多个 Feature Spec 需要一次性交付；
- 需要对外承诺一个可验证的时间点或版本；
- 需要一组共同的退出条件（例如：验证通过 + 文档同步 + 无已知阻塞缺陷）。

## 文件命名

```text
docs/planning/milestones/<MILESTONE_ID>-<short-name>.md
```

例如：`M1-<short-name>.md` 或 `<DATE>-<short-name>.md`（按项目习惯二选一，保持统一）。

> 目前没有里程碑文件；第一个里程碑确定后再创建，并同步更新 [roadmap.md](../roadmap.md)。

## 里程碑模板

```markdown
# <里程碑 ID>: <名称>

> Status: Candidate | Planned | In Progress | Done | Dropped
> Owner: <OWNER>
> Target: <DATE>

## 目标

（该里程碑要达成的可验证结果）

## 包含的 Specs

| Spec | 状态 | 依赖 |
| ---- | ---- | ---- |

## 退出条件

- [ ] 所有包含的 Spec 状态为 `Verified`
- [ ] 相关文档已同步（含双语配对）
- [ ] 无阻塞类缺陷
- [ ] 相关验证命令通过
- [ ] 兼容性与安全影响已确认

## 风险

| 风险 | 影响 | 应对 |
| ---- | ---- | ---- |

## 完成记录

（完成时间、证据、遗留问题）
```

## 规则

1. 里程碑的退出条件必须可验证，避免「基本完成」；
2. 里程碑不定义新需求；缺需求时先补 Spec；
3. 未达成即延期时要记录原因，不要静默修改历史里程碑定义。
