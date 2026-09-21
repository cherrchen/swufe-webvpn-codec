# apps —— 应用目录

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-21

**用途**：存放可运行的应用程序，**每个应用一个目录**。

| 目录 | 说明 |
| ---- | ---- |
| [desktop/](desktop/README.md) | Electron 桌面应用（macOS / Windows）：登录 WebView、Session Broker、Proxy Orchestrator、Cert Manager、Allowlist Store、IPC |

当前只有 `desktop/` 一个成员。

目录布局的决策见 [ADR-0009](../docs/architecture/adr/ADR-0009-monorepo-layout.md)。

不放在这里的内容：桥实现 → [bridges/](../bridges/README.md)；长期项目事实 → [docs/](../docs/README.md)；Feature Spec → [specs/](../specs/README.md)。
