# ADR-0009: 仓库采用路径式 monorepo（`apps/<app>` + `bridges/<bridge>`）

## Status

`Accepted`

## Date

`2026-09-21`

## Decision Owners

`cherrchen`

## Context

Phase 1 交付的是一个**两段式**仓库：

- Electron 应用独占 `app/` 目录；
- Python 桥工程直接摊在仓库根：根 `pyproject.toml`、根 `swufe_bridge/` 包、根 `tests/`、根 `uv.lock` 与根 `.python-version`。

接下来的两件事都落不进这个布局：

- 计划增加**移动端应用**，它需要一个与 Electron 应用并列的位置；
- 桥本体以后可能用**另一种语言重实现**（例如 Rust），届时需要与 Python 实现并存的第二个桥工程。

在扁平布局下，这两件事都只能通过重构仓库来容纳。因此趁现在顶层实体只有两个、引用面还小，先把布局定下来。

## Decision

仓库改为**按路径划分的 monorepo**：应用位于 `apps/<app>`，桥实现位于 `bridges/<bridge>`。本次已落地：

1. 应用：`app/` → `apps/desktop/`。
2. 桥：仓库根部的 Python 桥工程 → `bridges/python/`。该工程的 `pyproject.toml`、`uv.lock`、`.python-version`、`swufe_bridge/` 包与 `tests/` 一并迁入，虚拟环境随之变为 `bridges/python/.venv`。
3. 仓库根只保留**仓库级**工具链：`scripts/` 下的 Node 文档 / 规格 / 验收检查，以及根 `package.json` 的 `dev` / `build` / `start` 别名（转发到 `apps/desktop`）。

范围与执行：本决策自 `2026-09-21` 起生效；执行责任人 cherrchen。

## Alternatives

| 备选方案 | 优点 | 缺点 | 未采纳原因 |
| -------- | ---- | ---- | ---------- |
| 什么都不做（保持扁平布局） | 零迁移成本 | 顶层没有「应用」与「桥」的分类，两类实体的落点混在一起 | 移动端应用与第二种桥实现都必须先重构仓库才能加入 |
| 只把包挪到 `bridges/python/swufe_bridge/`，工程根仍留在仓库根 | 顶层目录变清楚，改动面小 | 一个工程根同时承载两种语言 | venv 与 lock 的归属含糊：根 `pyproject.toml` / `uv.lock` 该由谁拥有说不清 |
| 迁移到 npm / pnpm workspace 包管理布局 | 统一的 workspace 命令与依赖管理 | 需要改 manifest 与 CI，并在 workspace 语义下重新验证启动路径 | 超出本决策范围；现有 manifest 与 CI 继续用 npm |

## Consequences

### Positive

- 应用把仓库根解析为**应用目录向上两级**，把桥工程解析为 `<repo>/bridges/python`（Main 入口里的一次 `join`）：不再依赖「应用就摊在仓库根下」这一假设。
- 后续新增应用或新增桥实现是**加一个目录**，不是重构：`apps/<app>` 与 `bridges/<bridge>` 各自自洽。
- 顶层目录即分类：`apps/` 放应用、`bridges/` 放桥实现、`scripts/` 放仓库级检查。
- sidecar 的工作目录改为桥工程根，与它实际需要的 `swufe_bridge` 包、venv、lock 同处一棵子树。

### Negative

- 本次迁移产生一次性的路径改动面：应用入口的根解析、sidecar 的工作目录、CI 的 Python 作业（`working-directory: bridges/python`）都要同步修改。
- 引用旧路径的文档、脚本与命令示例都要跟着改，漏改就会指向不存在的路径。

### 有意保持不变

- Electron 包名仍是 `swufe-webvpn-bridge`，因此默认 `userData` 目录不变；
- `swufe_bridge` 的模块路径不变；
- sidecar 的 argv 与 stderr 控制协议不变；
- `userData` 下的文件名不变（`config.json` / `bridge-config.json` / `mitmproxy/`）；
- `SWUFE_REPO_ROOT` 仍表示**仓库根**，`SWUFE_PYTHON` 语义不变。

### Risks

| 风险 | 可能性 | 影响 | 缓解措施 |
| ---- | ------ | ---- | -------- |
| 文档 / 脚本里残留旧路径，命令在旧位置执行失败 | 中 | 中 | 迁移一次性完成：文档、README、CI 与命令示例同批更新；本 ADR 记录新旧对应关系 |
| 某处隐含依赖「sidecar 工作目录 = 仓库根」 | 低 | 中 | sidecar argv 不变，工作目录明确为桥工程根；需要定位仓库根时仍可用 `SWUFE_REPO_ROOT` |
| 旧根目录的 venv / lock 残留，导致「改了不生效」 | 低 | 中 | 仓库根不再保留 `pyproject.toml` / `uv.lock` / `.python-version` / `.venv`；解释器解析顺序为 `SWUFE_PYTHON` → `bridges/python/.venv` → `uv run --project <repo>/bridges/python` |

## References

- 相关 Spec：`specs/001-phase1-local-bridge/`
- 相关 ADR：[ADR-0002](ADR-0002-reuse-mitmproxy-for-tls.md)（复用 mitmproxy，Python 侧由此成为独立工程）、[ADR-0003](ADR-0003-electron-gui-for-phase-1.md)（Phase 1 采用 Electron，即今天的 `apps/desktop`）
- 相关文档：[apps/desktop/README.md](../../../apps/desktop/README.md)、[仓库根 README](../../../README.md)
