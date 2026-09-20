# 归档：SWUFE-WebVPN-Bridge 文档包 v1.0

> Archived: 2026-09-20
> Reason: 原始需求/设计/测试/项目文档包（单一来源，未分层），内容已按本仓库文档体系重新分配到 `docs/` 与 `specs/`，此处保留原文作为历史与出处证据。
> Superseded by: [docs/overview/project-overview.md](../../overview/project-overview.md)、[docs/requirements/](../../requirements/README.md)、[docs/architecture/](../../architecture/README.md)、[docs/api/](../../api/README.md)、[docs/ui-ux/main-window.md](../../ui-ux/main-window.md)、[docs/verification/](../../verification/README.md)、[specs/001-phase1-local-bridge/](../../../specs/001-phase1-local-bridge/spec.md)
> No longer a source of truth.

## 说明

- 本目录内容**逐字保留**自 `SWUFE-WebVPN-Bridge-Docs-v1.0.zip`（16 个文件，2026-09-20），未作任何修改；
- 归档内容**不得**被引用为当前 Source of Truth；当前事实见上方 `Superseded by` 中的路径；
- `99-appendix/wrd_codec.py` 是已用真实地址栏 URL 校验的编解码原型脚本（AES-128-CFB，`key=iv=wrdvpnisthebest!`）；其算法结论已固化在 [docs/architecture/components.md](../../architecture/components.md)，实现必须以该结论（而非归档脚本本身）为准。
- 本目录按 [docs/archive/README.md](../README.md) 的规则豁免中英双语配对。

## 原包文件与去向

| 原文件 | 内容去向 |
| ------ | -------- |
| `01-requirements/01-PRD.md` | [docs/requirements/product-requirements.md](../../requirements/product-requirements.md)、[docs/overview/goals-and-non-goals.md](../../overview/goals-and-non-goals.md) |
| `01-requirements/02-UI-UX.md` | [docs/ui-ux/main-window.md](../../ui-ux/main-window.md) |
| `01-requirements/03-technical-design.md` | [docs/architecture/components.md](../../architecture/components.md)、[docs/architecture/data-flow.md](../../architecture/data-flow.md)、[docs/security/](../../security/README.md) |
| `01-requirements/04-architecture-and-tech-selection.md` | [docs/architecture/overview.md](../../architecture/overview.md)、[docs/architecture/adr/](../../architecture/adr/README.md) |
| `01-requirements/05-api-interfaces.md` | [docs/api/](../../api/README.md) |
| `01-requirements/06-data-model.md` | [docs/architecture/data-model.md](../../architecture/data-model.md) |
| `02-testing/01-test-plan.md` | [docs/development/testing-strategy.md](../../development/testing-strategy.md) |
| `02-testing/02-test-cases.md` | [specs/001-phase1-local-bridge/verification.md](../../../specs/001-phase1-local-bridge/verification.md) |
| `03-project-management/01-project-charter-and-plan.md` | [docs/planning/roadmap.md](../../planning/roadmap.md)、[specs/001-phase1-local-bridge/plan.md](../../../specs/001-phase1-local-bridge/plan.md) |
| `03-project-management/02-wbs-milestones-risks.md` | [specs/001-phase1-local-bridge/tasks.md](../../../specs/001-phase1-local-bridge/tasks.md)、[specs/001-phase1-local-bridge/design.md](../../../specs/001-phase1-local-bridge/design.md) |
| `03-project-management/03-delivery-checklist.md` | 本表（去向索引） |
| `99-appendix/requirements-onepager-v1.0.md` | [docs/requirements/functional-requirements.md](../../requirements/functional-requirements.md)、[docs/requirements/non-functional-requirements.md](../../requirements/non-functional-requirements.md) |
| `99-appendix/wrd_codec.py` / `-README.md` / `-requirements.txt` | 原型保留在此；算法结论见 [docs/architecture/components.md](../../architecture/components.md) |
