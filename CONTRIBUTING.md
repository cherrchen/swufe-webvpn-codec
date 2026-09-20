# CONTRIBUTING.md

> 面向人类开发者与 Coding Agent 的贡献入口。中文版本是 Source of Truth；英文版本见 [CONTRIBUTING.en.md](CONTRIBUTING.en.md)。
> Coding Agent 请先读 [AGENTS.md](AGENTS.md)。

完整流程图与分支策略见 [docs/development/development-workflow.md](docs/development/development-workflow.md)。
文档与代码的一致性要求见 [docs/development/documentation-rules.md](docs/development/documentation-rules.md)。

---

## 1. 贡献前

1. 确认变更类型：Feature / Bug / Architecture / API / UI / Documentation。
2. 按 [docs/agent/context-routing.md](docs/agent/context-routing.md) 读取最小充分上下文。
3. 检查是否已有对应的 `specs/<id>-<name>/`：
   - Feature 级变更**必须有 Spec**（见 [specs/README.md](specs/README.md)）；
   - 普通 Bug 可用简化流程（见下）。

## 2. 推荐流程

```text
Feature:  Idea → Issue → Spec → Design → Plan → Tasks → Implementation
          → Verification → Documentation Sync → Review → Complete
Bug:      Bug → Reproduce → Root Cause → Fix → Test → Documentation Impact
```

流程定义（各阶段退出条件、变更分级）只在
[docs/development/development-workflow.md](docs/development/development-workflow.md) 定义，此处不重复。

规则：

- Feature 级变更**必须有 Spec**（见 [specs/README.md](specs/README.md)）；
- Issue 仅用于 Tracking / Discussion，不替代 Spec；
- 影响公共行为、数据模型或安全模型的重大 Bug，应转为 Spec 流程。

## 3. Pull Request 要求

使用 [.github/pull_request_template.md](.github/pull_request_template.md)，必须包含：

- Summary、Related Spec、Changes、Verification；
- Documentation Impact（改了哪些文档，或为什么不需要改）；
- Architecture Impact（是否需要 ADR）；
- Breaking Changes；
- Checklist（测试、Spec、文档、ADR、无无关改动）。

## 4. Definition of Done

合入前必须考虑：Implementation、Tests、Verification、Documentation、Compatibility、Security、Spec Status；
逐项要求与项目覆盖方式见 [docs/verification/verification-strategy.md](docs/verification/verification-strategy.md)（Source of Truth），此处不复制。

## 5. 何时必须写 ADR

触发条件只在 [docs/architecture/adr/README.md](docs/architecture/adr/README.md) 中定义（核心栈、公共接口、数据模型、安全模型、跨模块架构、重要基础设施、难逆决策）；普通小型实现不要滥用 ADR。

## 6. 提交前本地检查

```bash
npm run docs:check
```

分支命名与提交信息约定属于项目本地配置，定义在 [docs/development/development-workflow.md](docs/development/development-workflow.md)。
CI 与本地使用同一组脚本（[.github/workflows/docs-check.yml](.github/workflows/docs-check.yml)）。

## 7. 文档语言

长期文档为中文主文档 + 英文 `*.en.md` 副文档，中文是 Source of Truth；语言规则、例外与单语路径只在
[docs/development/documentation-rules.md](docs/development/documentation-rules.md) 中定义。
