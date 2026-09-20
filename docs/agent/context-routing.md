# 上下文路由（Context Routing）

> Status: Draft ｜ Owner: <OWNER> ｜ Last Reviewed: <DATE>

**用途**：定义「什么任务读什么文档」，替代「每次读取整个 docs」。
本文件是 Agent 上下文加载策略的 Source of Truth；[AGENTS.md](../../AGENTS.md) 中的路由表是本文件的摘要版本。

---

## 1. 原则

```text
Read the minimum sufficient context,
not the entire repository documentation.
```

目的：

- 降低 Context Window 消耗；
- 减少无关信息干扰；
- 避免旧信息污染当前判断；
- 降低 Agent hallucination 概率。

**不要默认加载整个 `docs/`。** 先分类，再按需读取。

## 2. 路由流程

```text
Task
 ↓
AGENTS.md
 ↓
Task Classification
 ├─ Feature
 ├─ Bug
 ├─ Architecture
 ├─ API
 ├─ UI
 ├─ Database
 ├─ Testing
 └─ Documentation
 ↓
Relevant Context
 ↓
（不足时）Escalation
```

## 3. 分类与最小上下文

| 分类 | 判定信号 | 最小必读 | 按需追加 |
| ---- | -------- | -------- | -------- |
| Feature | 新增/改变用户可见行为 | `specs/<id>-<name>/spec.md`、`design.md`、`tasks.md` | 相关 requirements、architecture、api |
| Bug | 行为与预期/spec 不符 | 相关 spec 或 [components.md](../architecture/components.md) | [testing-strategy.md](../development/testing-strategy.md)、[data-flow.md](../architecture/data-flow.md) |
| Architecture | 结构、组件边界、公共接口、数据模型、安全模型变化 | [architecture/overview.md](../architecture/overview.md)、[components.md](../architecture/components.md) | [adr/](../architecture/adr/README.md)、相关 spec |
| API | 接口签名、字段、错误、版本变化 | [api/](../api/README.md)、[interfaces.md](../architecture/interfaces.md) | 对应 spec、契约测试 |
| UI | 用户界面/交互变化 | [ui-ux/](../ui-ux/README.md) | 相关 requirements、对应 spec 的 `ui-ux.md` |
| Database | 实体、不变式、迁移 | [data-model.md](../architecture/data-model.md) | 相关 ADR、spec 的 `migration.md` |
| Testing | 测试策略或测试实现变化 | [testing-strategy.md](../development/testing-strategy.md)、[verification/](../verification/README.md) | 对应 spec 的 `verification.md` |
| Documentation | 文档结构/规则变化 | [documentation-rules.md](../development/documentation-rules.md)、[docs/README.md](../README.md) | 受影响文档 |

## 4. 加载顺序

```text
1. AGENTS.md                       （始终）
2. 对应 specs/<id>-<name>/          （Feature / Bug 相关时）
3. 分类对应的 docs/ 文件            （上表「最小必读」）
4. 按需追加                          （上表「按需追加」）
5. .agents/notes/ 中最新相关 note   （仅在接手他人工作时）
```

每一步都应能回答：**我现在做的判断，依据来自哪个文件？** 找不到依据时进入 Escalation。

## 5. Escalation（升级条件）

出现以下情况时，扩大读取范围，并在输出中说明原因：

| 情况 | 动作 |
| ---- | ---- |
| 找不到对应 Spec | 读取相关 requirements，并向用户/负责人确认是否需要建 Spec |
| 分类无法判断 | 读取 [docs/README.md](../README.md) 索引后重新分类 |
| 文档之间冲突 | 记录冲突，按 [documentation-rules.md](../development/documentation-rules.md) 的优先级处理并升级决策 |
| 修改影响多个模块 | 读取 [components.md](../architecture/components.md) 与相关 ADR |
| 代码与文档不一致 | 以代码现状为事实记录差异，并在交付中明确提出，不擅自改文档或代码 |

## 6. 交付时的上下文声明

Agent 在交付说明中应简要给出：

```text
Task type:        <分类>
Context read:     <文件列表>
Uncertainties:    <未确认信息 / Open Questions>
Scope excluded:   <明确未做的部分>
```

这不是仪式：它的作用是让人类复核「分类是否正确、是否漏读关键文档」。

## 7. 反模式

| 反模式 | 后果 |
| ------ | ---- |
| 每次读取整个 `docs/` | Context 浪费、旧信息污染 |
| 只读代码不读文档 | 违反既有设计决策 |
| 只读 spec 不读 architecture | 破坏分层与依赖方向 |
| 读取 notes 当作事实来源 | 引入未经确认的结论 |
| 读了但不引用来源 | 无法复核判断依据 |
