# bridges —— 桥实现目录

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-21

**用途**：存放本机桥的实现，**每个实现一个目录**。桥以子进程运行，由应用按控制协议驱动。

| 目录 | 说明 |
| ---- | ---- |
| [python/](python/pyproject.toml) | Python 桥（uv 项目）：包 [python/swufe_bridge/](python/swufe_bridge/)、测试 [python/tests/](python/tests/)（L0/L1/L2） |

当前只有 `python/` 一个成员。

**应用契约**：应用由仓库根推导出 `<repo>/bridges/python`，在该目录下以 `-m swufe_bridge.sidecar` 启动子进程；接口见 [bridge-control-protocol.md](../docs/api/bridge-control-protocol.md)。

目录布局的决策见 [ADR-0009](../docs/architecture/adr/ADR-0009-monorepo-layout.md)：它把本目录保留给未来的另一种实现（例如 Rust），但该实现目前**并不存在**，这里只有 Python 桥。

不放在这里的内容：应用 → [apps/](../apps/README.md)；长期项目事实 → [docs/](../docs/README.md)。
