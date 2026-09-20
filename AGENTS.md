# AGENTS.md

> 本文件是**所有 Coding Agent 进入本项目后的第一入口**。
> 目标：让一个完全不了解项目的 Agent 在 2–5 分钟内建立基础上下文。
> 它是 **Router（路由器），不是 Documentation Dump（文档堆）**：只说明「读什么、做什么、禁止什么」，细节一律指向其它文档。
>
> 中文版本是 Source of Truth；英文版本见 [AGENTS.en.md](AGENTS.en.md)。
> 项目级事实仍以 [docs/](docs/README.md) 与 [specs/](specs/README.md) 为准。

---

## 1. Project Identity

```text
Project:          SWUFE WebVPN Bridge（仓库 swufe-webvpn-codec）
Purpose:          在 macOS / Windows 上以 Electron 桌面应用提供本机桥：用户完成官方网瑞达
                  WebVPN（CAS/MFA）登录后，本机浏览器对 allowlist 内主机自动经 WebVPN 访问
                  （第一期验收：教务 jwxt.swufe.edu.cn 可打开并操作）
Status:           Phase 1 文档已对齐（2026-09-20）；M1 桥核心（Python sidecar + WRD 改写）已实现并通过
                  L0/L1/L2（2026-09-21）；M2（Electron 壳 / 系统代理 / CA）未开始
Primary language: Python 3（bridge sidecar/Addon、WRD codec，见 `swufe_bridge/`）+ TypeScript（Electron 应用，M2 起）；
                  文档（`docs/` + `specs/`）与 Node 文档检查脚本是主体
Repository type:  Documentation-first（docs/ + specs/）+ Python 桥实现（`swufe_bridge/`、`tests/`）
Owner:            cherrchen
```

## 2. Source of Truth

| 信息 | Source of Truth |
| ---- | --------------- |
| 项目目标、范围、术语 | [docs/overview/](docs/overview/glossary.md) |
| 产品 / 功能 / 非功能需求 | [docs/requirements/](docs/requirements/README.md) |
| 架构、组件、数据流、数据模型、接口 | [docs/architecture/](docs/architecture/README.md) |
| 外部 / 内部接口契约 | [docs/api/](docs/api/README.md) |
| UI/UX 规范 | [docs/ui-ux/](docs/ui-ux/README.md) |
| Feature 的 What/Why/How | [specs/](specs/README.md) |
| 第一期 Feature 实现与验证 | [specs/001-phase1-local-bridge/](specs/001-phase1-local-bridge/spec.md) |
| 技术决策（为什么这样设计） | [docs/architecture/adr/](docs/architecture/adr/README.md) |
| 测试策略 | [docs/development/testing-strategy.md](docs/development/testing-strategy.md) |
| 文档规则与语言要求 | [docs/development/documentation-rules.md](docs/development/documentation-rules.md) |
| Agent 规则与工作流 | 本文件 + [docs/agent/](docs/agent/README.md) |
| 验证与完成标准 | [docs/verification/](docs/verification/README.md) |
| 长期计划 | [docs/planning/roadmap.md](docs/planning/roadmap.md) |

**如果一个事实不在上表中，它就不是 Source of Truth。** 不要在没有出处的情况下把它当成项目事实。

## 3. Context Routing（先分类任务，再读文档）

```text
Task
  ↓
AGENTS.md（本文件）
  ↓
Task Classification
  ├─ Feature  ├─ Bug  ├─ Architecture  ├─ API
  ├─ UI       ├─ Database  ├─ Testing  └─ Documentation
  ↓
Minimum sufficient context
```

| 任务类型 | 必读 |
| -------- | ---- |
| 新 Feature / 功能变更 | 本文件、`specs/001-phase1-local-bridge/`（spec/design/plan/tasks）、相关 `docs/requirements/`、相关 `docs/architecture/` |
| Bug 修复 | 本文件、相关 spec 或 [docs/architecture/components.md](docs/architecture/components.md)、[testing-strategy](docs/development/testing-strategy.md) |
| 架构变更 | [docs/architecture/overview.md](docs/architecture/overview.md)、[components](docs/architecture/components.md)、[ADR](docs/architecture/adr/README.md)、相关 spec |
| API 变更 | [docs/api/](docs/api/README.md)、[docs/architecture/interfaces.md](docs/architecture/interfaces.md)、对应 spec |
| 数据库 / 数据模型 | [docs/architecture/data-model.md](docs/architecture/data-model.md)、相关 ADR、migration spec |
| UI / UX | [docs/ui-ux/](docs/ui-ux/README.md)、对应 spec |
| 测试 | [docs/development/testing-strategy.md](docs/development/testing-strategy.md)、[docs/verification/](docs/verification/README.md) |
| 文档 | [docs/development/documentation-rules.md](docs/development/documentation-rules.md)、[docs/development/documentation-rules.en.md](docs/development/documentation-rules.en.md) |
| 安全相关 | [docs/security/](docs/security/README.md)、相关 spec 的 Security Considerations |
| 新 Session / 接手他人工作 | [docs/agent/session-handoff.md](docs/agent/session-handoff.md)、`.agents/notes/` 中最新相关笔记 |

规则原文见 [docs/agent/context-routing.md](docs/agent/context-routing.md)。

**不要默认加载整个 `docs/`。** 目的：降低 context window 消耗、避免无关信息干扰、避免旧信息污染、减少幻觉。

## 4. Agent Mandatory Rules

1. 不得假设缺失需求；需求不明时记录到 `Open Questions` 或标记 `TBD`。
2. 不确定的事实一律写 `TBD` / 占位符，不得编造。
3. 修改代码前先理解相关 Spec；没有 Spec 的功能请求，先建 Spec 或明确记录为 Bug/Chore。
4. 修改架构、公共接口、数据模型、安全模型时，检查是否需要新建 ADR。
5. 修改行为时检查测试与 [verification](docs/verification/README.md) 是否仍成立，并更新验证矩阵。
6. 修改长期事实（需求、架构、API、数据模型）时同步更新对应 `docs/` 文档。
7. 不把 session 临时信息（调试过程、聊天记录、试验结论）写入长期文档。
8. 不删除用途未知的代码或文档来「清理」项目；先确认用途。
9. 不做与任务无关的重构。
10. 不自行扩大 Scope：不做「顺手」加上的校验、埋点、抽象、依赖或格式变动。

## 5. Documentation Hygiene（禁止的文档污染）

Coding Agent 不得：

- 把聊天过程或思维过程复制进正式文档；
- 把猜测写成项目事实；
- 把临时 debug 信息写进 Architecture / Requirements；
- 因为「感觉更好」而修改需求；
- 无理由重写整个文档；
- 自动扩大 Scope；
- 为了让文档「看起来完整」而创造不存在的设计。

## 6. Agent Workflow

完整循环（每一步的要求、任务粒度、阻塞处理、完成判定）定义在 [docs/agent/agent-workflow.md](docs/agent/agent-workflow.md)，本文件不重复。
摘要：**Orient → Classify → Check Spec/ADR → Plan → Implement → Verify → Sync Docs → Handoff**。

技能指令（与具体 AI 平台无关）位于 [.agents/skills/](.agents/README.md)：

| Skill | 用途 |
| ----- | ---- |
| `project-onboarding` | 新 Agent 建立上下文并输出 Context Summary |
| `create-spec` | 从需求创建 spec/design/plan/tasks/verification |
| `implement-spec` | 按 Spec 实现并更新任务状态 |
| `verify-change` | 检查需求覆盖、测试、构建、文档、兼容性、安全 |
| `update-docs` | 代码变更后同步文档 |
| `session-handoff` | 生成 Session 交接记录 |

## 7. Definition of Done

一个变更只有在以下各项都被考虑后才算完成：Implementation、Tests、Verification、Documentation、Compatibility、Security、Spec Status。
详见 [docs/verification/verification-strategy.md](docs/verification/verification-strategy.md)。
**「代码写完了」不等于 Feature 完成**；Feature 状态为 `Draft → Approved → In Progress → Implemented → Verified → Archived`。

## 8. 会话与临时信息

- 临时上下文写入 [.agents/notes/](.agents/notes/README.md)，命名 `YYYY-MM-DD-<topic>.md`；
- Notes **不是** Source of Truth：不得作为架构、需求、API 契约或最终决策的依据；
- 若 Note 中产生了长期结论，必须迁移到 `docs/`、`specs/` 或 ADR。

## 9. 相关入口

- [README.md](README.md) —— 项目整体说明（定位、范围、文档体系）
- [CONTRIBUTING.md](CONTRIBUTING.md) —— 贡献流程与评审要求
- [docs/README.md](docs/README.md) —— 文档索引
- [specs/README.md](specs/README.md) —— Spec 系统说明
- [.agents/README.md](.agents/README.md) —— Skills 与 Notes 说明
