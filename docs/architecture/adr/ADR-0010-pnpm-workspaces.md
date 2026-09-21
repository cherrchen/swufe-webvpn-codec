# ADR-0010: Node 工具链切换到 pnpm 11 workspaces

## Status

`Accepted`

## Date

`2026-09-21`

## Decision Owners

`cherrchen`

## Context

仓库已按 [ADR-0009](ADR-0009-monorepo-layout.md) 改为**路径式 monorepo**：应用在 `apps/desktop`，Python 桥在 `bridges/python`。但 Node 侧仍由 **npm** 驱动，同一份依赖图被拆成两份：仓库根 `package-lock.json` 与 `apps/desktop/package-lock.json`。ADR-0009 当初把「迁移到 workspace 包管理布局」列为**未采纳**备选（理由：超出该决策范围），包管理器问题只是被延后，并未解决。

两份锁文件与逐目录安装无法表达一个 workspace：

- 应用目录的依赖是一次独立解析，仓库根那份解析结果里没有它；
- 两个锁文件可以各自演进、互相漂移，安装要在仓库根与应用目录各做一次；
- 仓库根 `package.json` 只有 `dev` / `build` / `start` 三个转发别名，没有按**包名**选择脚本的机制。

约束：布局与启动路径（ADR-0009）不变；Python 侧仍归 uv；Node 版本要求 `>=22` 不变。

## Decision

1. Node 侧统一改为 **pnpm 11 workspaces**：
   - 仓库根 [pnpm-workspace.yaml](../../../pnpm-workspace.yaml) 用 `packages: [apps/*]` 声明成员——**成员资格由该文件定义**，不使用 `package.json` 的 `workspaces` 字段；
   - 同一文件中的 `allowBuilds` **经审阅**只放行两个依赖的构建脚本：`electron: true`、`esbuild: true`；
   - 仓库根 [package.json](../../../package.json) 固定 `"packageManager": "pnpm@11.25.0"`。
2. **单一锁文件**：两个 npm 锁文件（仓库根与 `apps/desktop/package-lock.json`）已删除，只保留仓库根的 `pnpm-lock.yaml`；它同时覆盖两个 workspace 项目（importer `.` 与 `apps/desktop`）。
3. **CI 装包**：`pnpm/action-setup@v4`（版本取自 `packageManager`）→ `actions/setup-node`（`cache: pnpm`）→ `pnpm install --frozen-lockfile`。
4. **脚本入口**：仓库根的 `dev` / `build` / `start` 便捷脚本用 `pnpm --filter swufe-webvpn-bridge run <script>` 转发到应用；应用自身的脚本改用 pnpm 调用，其 `package.json` 中非标准的 `allowScripts` 字段被移除，意图由 `allowBuilds` 承接。
5. 范围与执行：本决策自 `2026-09-21` 起生效；执行责任人 cherrchen。Python 侧不在本决策范围内。

## Alternatives

| 备选方案 | 优点 | 缺点 | 未采纳原因 |
| -------- | ---- | ---- | ---------- |
| 什么都不做（保留 npm 与两个锁文件） | 零改动 | 没有 workspace 解析，安装要在两处各做一次，两份锁文件可以互相漂移 | 布局已按 ADR-0009 收敛，依赖解析却仍是两套，正是本轮要消除的状态 |
| 继续用 npm，只在根 `package.json` 加 `workspaces` 字段 | 不换包管理器、迁移面小 | npm workspaces 仍要自己提供一套「依赖构建脚本白名单」机制，且不会统一仓库根已经配置好的那套设置 | pnpm 已内建 `allowBuilds`（依赖构建脚本审阅），换成 npm workspaces 是等价功能重做 |
| 在 workspace 之上再引入任务编排器（Turbo / Nx 等） | 面向多包的任务图与缓存 | 引入新的配置面与依赖 | 当前只有两个脚本转发，`pnpm --filter` 已经覆盖 |

## Consequences

### Positive

- 一次 `pnpm install` 安装整个 workspace 的所有项目，依赖只有一份解析结果。
- 按**包名**选择脚本（`pnpm --filter swufe-webvpn-bridge run build`），不再依赖「在哪个目录执行」。
- 仓库只有一份 `pnpm-lock.yaml`，CI 用 `--frozen-lockfile` 即可保证锁文件与 manifest 一致。

### Negative

- 依赖的构建脚本默认**不执行**：只有列入 `allowBuilds` 的依赖会跑；未列入的依赖会让 `pnpm install` 以 `ERR_PNPM_IGNORED_BUILDS` 失败——新增这类依赖时必须先审阅并写入白名单。
- 向 Electron 传参时**不能写 `--` 分隔符**：命令里出现 `--` 时 pnpm 会再插一个自己的 `--`，到达 Electron 的是一字面 `--`，Electron 随即停止解析 Chromium 开关（`--remote-debugging-port` 会静默失效）。正确形式是 `pnpm start --user-data-dir=<dir>`。
- electron 44.x 仍然需要一次性的 `node apps/desktop/node_modules/electron/install.js`：`pnpm install` 不会下载 Electron 二进制。

### 有意保持不变

- Electron 包名仍是 `swufe-webvpn-bridge`，因此默认 `userData` 目录不变；
- `swufe_bridge` 的模块路径不变，sidecar 的 argv 与 stderr 控制协议不变；
- Python 侧继续用 uv：`bridges/python/uv.lock`、`uv sync --directory bridges/python`。

### Risks

| 风险 | 可能性 | 影响 | 缓解措施 |
| ---- | ------ | ---- | -------- |
| 新增依赖带构建脚本但未列入 `allowBuilds`，装包直接失败 | 中 | 中 | 失败信息明确给出 `ERR_PNPM_IGNORED_BUILDS`；按 `pnpm-workspace.yaml` 的注释审阅后加入白名单 |
| 文档 / 命令示例仍写 npm 形式，或给 Electron 参数加了 `--` 分隔符 | 中 | 中 | 文档与示例同批更新；`pnpm-workspace.yaml` 的注释与本 ADR 记录正确形式 |
| 给 Electron 误加 `--` 分隔符，Chromium 开关静默失效 | 低 | 中 | 以 `pnpm start --user-data-dir=<dir> --remote-debugging-port=<port>` 复核（实测：带 `--` 时不生效） |
| 残留的 npm 锁文件导致「改了不生效」 | 低 | 中 | 两份 `package-lock.json` 已删除，仓库只保留 `pnpm-lock.yaml`；CI 的 `--frozen-lockfile` 会把锁文件漂移暴露为失败 |
| 某处仍假设 Electron 二进制在仓库根 `node_modules/electron` | 低 | 中 | 路径明确为 `apps/desktop/node_modules/electron/install.js`（pnpm 下不变） |

## References

- 相关 Spec：`specs/001-phase1-local-bridge/`
- 相关 ADR：[ADR-0009](ADR-0009-monorepo-layout.md)。本 ADR 取代 ADR-0009 备选表中「保留 npm / 现有 manifest 与 CI 继续用 npm」那一行的结论；**ADR-0009 的布局决策本身继续有效**，本 ADR 只收尾它当时有意延后的包管理器问题。[ADR-0003](ADR-0003-electron-gui-for-phase-1.md)（Phase 1 采用 Electron）不受影响。
- 相关文件：[pnpm-workspace.yaml](../../../pnpm-workspace.yaml)、[根 package.json](../../../package.json)、[.github/workflows/app-tests.yml](../../../.github/workflows/app-tests.yml)、[apps/desktop/README.md](../../../apps/desktop/README.md)
- 外部资料：<https://pnpm.io/workspaces>
