# Feature Specs

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-24

**用途**：本目录是 **Layer 3 — Feature Specs**：每个 Feature 从需求到实现与验证的完整记录。
Spec-driven Development 的目的：把 `Prompt → Code` 变成
`Idea → Requirement → Spec → Design → Plan → Tasks → Implementation → Verification → Documentation Update → Archive`。

> 中文版本是 Source of Truth；英文版本见 [README.en.md](README.en.md)。

## 目录命名

```text
specs/<id>-<feature-name>/
specs/001-phase1-local-bridge/     ← 本项目第一个 Spec（Phase 1 本机桥与教务浏览器验收）
```

- `<id>` 三位递增（`001`、`002`……），分配后不复用；
- `<feature-name>` 使用小写短横线命名；
- 模板目录 `specs/_template/` 不参与校验，也不占用编号。

## Spec 索引

| Spec | 标题 | 关联 REQ | Status | 链接 |
| ---- | ---- | -------- | ------ | ---- |
| 001-phase1-local-bridge | Phase 1 本机桥与教务浏览器验收 | REQ-001..REQ-011、NFR-001..NFR-007 | Implemented（macOS 与 Windows 真机验收通过；`KI-014` 与 `KI-019` 均暂列 `Accepted`，`KI-019` 根因未定、复现时重开） | [spec.md](001-phase1-local-bridge/spec.md) |
| 002-desktop-ui-multiwindow | 桌面界面重构（React + Ant Design 多窗口） | REQ-001 / REQ-003 / REQ-005 / REQ-009 / REQ-012、NFR-003 / NFR-005 / NFR-007 | Implemented（2026-09-23：实现与可机器执行的验收已完成；仍有 Windows 界面判据及 macOS 进程捕获授权验证项，见 verification.md） | [spec.md](002-desktop-ui-multiwindow/spec.md) |
| 003-ios-proxy-client-plugins | iOS 代理客户端插件（Loon / Stash） | `IOS-REQ-*`（草案）+ 语义对齐 REQ-002 / REQ-005 / REQ-006 / REQ-007、NFR-002 / NFR-003 | Draft（P0：宿主 URL 呈现与 Script 可观察性待真机；见 [README.md](003-ios-proxy-client-plugins/README.md)） | [spec.md](003-ios-proxy-client-plugins/spec.md) |

> 每个 Spec 在此登记一行，并在 [roadmap.md](../docs/planning/roadmap.md) 同步注册；长期事实不属于 Spec。

## 必含文件

| 文件 | 回答的问题 |
| ---- | ---------- |
| [spec.md](_template/spec.md) | What / Why：需求、目标、非目标、验收标准 |
| [design.md](_template/design.md) | How：技术方案、影响面、风险 |
| [plan.md](_template/plan.md) | 实施策略、阶段、回滚、文档更新计划 |
| [tasks.md](_template/tasks.md) | 可逐条执行的原子任务 |
| [verification.md](_template/verification.md) | Requirement → Verification 映射与证据 |

## 可选扩展文件

按需创建，**不必每个 Feature 都建**：

| 文件 | 何时需要 |
| ---- | -------- |
| `research.md` | 需要调研或对比外部方案 |
| `data-model.md` | 涉及实体或不变式变化 |
| `api.md` | 涉及接口契约变化 |
| `ui-ux.md` | 涉及界面与交互 |
| `migration.md` | 涉及数据/配置迁移 |

## 状态流转

```text
Draft → Approved → In Progress → Implemented → Verified → Archived
```

判定条件见 [verification-strategy.md](../docs/verification/verification-strategy.md)。

## 创建新 Spec

1. 复制 `specs/_template/` 为 `specs/<id>-<feature-name>/`；
2. 填写 `spec.md`（信息不足时写入 `Open Questions`，不要虚构）；
3. 评审通过后进入 `design.md` → `plan.md` → `tasks.md`；
4. 在 [roadmap.md](../docs/planning/roadmap.md) 注册一行；
5. 需要接口 → [api/](../docs/api/README.md)、数据模型 → [data-model.md](../docs/architecture/data-model.md)；决策难逆 → ADR；
6. 完成后更新 `verification.md` 并同步长期文档。

## 规则

- `specs/` 存放**当前与历史 Feature**；不存放长期事实（长期事实属于 [docs/](../docs/README.md)）；
- Spec 中的结论若改变长期事实，必须同步回 `docs/` 或 ADR；
- Spec 是「一次交付」的记录，长期事实不在 Spec 中被推翻或重新定义；
- 完成后保留 Spec（不删除），状态置 `Archived`；
- 语言：Spec 属实现记录，默认中文；如需英文，可加 `*.en.md`（不强制成对，见 [documentation-rules.md](../docs/development/documentation-rules.md)）。

## 校验

```bash
pnpm run spec:check   # 结构 + 必需章节
```
