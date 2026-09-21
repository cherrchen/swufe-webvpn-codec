# Session handoff — Monorepo 迁移（`apps/` + `bridges/`）与 pnpm workspace 切换

> 日期：2026-09-21 ｜ Owner：cherrchen ｜ 主题：仓库布局从「`app/` + 仓库根 Python 工程」迁移为路径式 monorepo，随后 Node 工具链切换为 pnpm 11 workspaces
> 长期结论已迁移：[ADR-0009](../../docs/architecture/adr/ADR-0009-monorepo-layout.md)（布局决策）、[ADR-0010](../../docs/architecture/adr/ADR-0010-pnpm-workspaces.md)（pnpm workspaces）、[spec.md](../../specs/001-phase1-local-bridge/spec.md)（迁移说明段落）、根 [README.md](../../README.md) §4 目录结构
> 本文件不是 Source of Truth。

## Current Goal

把 Electron 应用与 Python 桥从扁平布局迁到 monorepo：应用入 `apps/<app>`、桥实现入 `bridges/<bridge>`，为将来的移动端应用与（可能的）Rust 桥实现留出位置；迁移后所有代码、CI、脚本、双语文档与命令示例指向新路径。

## Completed

- **目录迁移**：`app/` → `apps/desktop/`；`swufe_bridge/`、`tests/`、`pyproject.toml`、`uv.lock`、`.python-version` → `bridges/python/`（`git mv`，历史保留）。仓库根不再有 Python 工程文件与根 `.venv`。
- **应用侧代码**：`apps/desktop/src/main/paths.ts` 仓库根改为应用目录**向上两级**；`index.ts` 增加 `bridgeRoot = join(repoRoot, 'bridges', 'python')` 并传给 Cert Manager 与 Sidecar；`python.ts` / `platform/ca-files.ts` / `platform/{darwin,win32}/cert.ts` 的参数由 `repoRoot` 改名为 `bridgeRoot`（解析 `bridges/python/.venv` 与 `uv run --project <repo>/bridges/python`）；`sidecar.ts` 的 `cwd` 改为桥工程根；`test/fixtures/stub-ca-app.js` 同步。
- **仓库级工具**：根 `package.json` 的 `dev` / `build` / `start` 转发到 `apps/desktop`（末尾保留 `--` 以便 `npm start -- --user-data-dir=…` 透传）；`apps/desktop/{scripts,test,src}` 内的路径注释同步。
- **CI**：`app-tests.yml` 用 `--prefix apps/desktop` 并缓存 `apps/desktop/package-lock.json`；`python-tests.yml` 的两步加 `working-directory: bridges/python`，并显式指定 `cache-dependency-glob: bridges/python/uv.lock`。
- **文档**：新增 ADR-0009（中英）与 ADR 索引行；`apps/README.md`、`bridges/README.md`（新）；`README(.en)`、`AGENTS(.en)`、`apps/desktop/README.md`、`docs/**`（除 `archive/` 历史件）、`specs/001-*` 的路径/命令/链接全部改写；`spec.md` 增加迁移说明段落。
- **重复性产物**：仓库根旧的 `.venv`、`.pytest_cache` 已删除（由 `uv sync` 重建于 `bridges/python/.venv`）。

## In Progress

无。

## pnpm workspace 切换（同批完成）

- **配置**：`pnpm-workspace.yaml` 声明 `packages: [apps/*]`，并审阅 `allowBuilds`（`electron: true`、`esbuild: true`）；根 `package.json` 固定 `"packageManager": "pnpm@11.25.0"`，`dev` / `build` / `start` 改为 `pnpm --filter swufe-webvpn-bridge run <script>`（**不带** `--` 分隔符）。
- **锁文件**：删除仓库根与 `apps/desktop/package-lock.json`，只保留仓库根 `pnpm-lock.yaml`（importer `.` 与 `apps/desktop` 一并覆盖）；`apps/desktop/package.json` 中非标准的 `allowScripts` 字段移除（意图由 `allowBuilds` 承接）。
- **CI**：`docs-check.yml` / `app-tests.yml` 改为 `pnpm/action-setup@v4`（版本取自 `packageManager`）+ `setup-node`（`cache: pnpm`）+ `pnpm install --frozen-lockfile`；Python 作业不受影响。
- **文档**：新增 ADR-0010（中英）与索引行；`README(.en)`、`apps/desktop/README.md`、`docs/**`（含 dependency-policy 的版本/锁文件策略与「安装脚本审批」小节）、`specs/001-*`、`.agents/skills/**`、`.github/ISSUE_TEMPLATE/documentation.yml` 的命令与锁文件名全部改为 pnpm 形式；`scripts/{docs-check,acceptance-collect}.ts` 的用法注释同步。
- **踩坑（已实测，写入 ADR-0010 与 operations 文档）**：给 Electron 传参**不能**写 `pnpm run start -- --flag`——pnpm 会再插一个 `--`，Electron 收到字面 `--` 后停止解析 Chromium 开关（`--remote-debugging-port` 静默失效）。正确形式：`pnpm start --user-data-dir=<dir>`。
- **遗留事实**：electron 44.x 自身没有 install 脚本，`pnpm install` 不下载 Electron 二进制；每台机器/每次全新 clone 需跑一次 `node apps/desktop/node_modules/electron/install.js`（已在 `apps/desktop/README.md` 与 `development-run.md` 写明）。

## Remaining

- 未执行：Windows 真机项（`KI-001`）、`KI-013`、`KI-014`（与本次改动无关，状态未变）。
- 既有文档漂移（本轮未处理）：`docs/development/development-workflow.md` 称「CI 现有两个工作流」，实际为三个（漏 `app-tests.yml`），与本轮改动无关。

## Important Decisions

- 布局：`apps/<app>` + `bridges/<bridge>`；Python 工程整体迁入 `bridges/python/`（工程根随之移动，venv/lock 归属明确）。理由与备选见 ADR-0009。
- 有意保持不变：Electron 包名 `swufe-webvpn-bridge`（因此默认 `userData` 不变）、`swufe_bridge` 模块路径、sidecar argv 与 stderr 控制协议、`userData` 文件名、`SWUFE_REPO_ROOT`（仍是仓库根）与 `SWUFE_PYTHON` 语义。
- 历史件不重写：`.agents/notes/**` 与 `specs/001-phase1-local-bridge/evidence/**` 保持原样（其中记录的是迁移前的命令与路径）。
- 本迁移属架构级改动，按仓库规则以 ADR-0009 记录，未新建 Spec（无需求/行为变化）。

## Changed Files

- 迁移与代码：`apps/desktop/**`（含 `src/main/{paths,index,python,sidecar}.ts`、`src/main/platform/**`、`test/fixtures/stub-ca-app.js`）、`bridges/python/**`
- 仓库级：`package.json`、`.github/workflows/{app-tests,python-tests}.yml`
- 文档：`README(.en).md`、`AGENTS(.en).md`、`apps/README.md`、`apps/desktop/README.md`、`bridges/README.md`、`docs/**`（除 `archive/`）、`specs/001-phase1-local-bridge/{spec,tasks,verification,known-issues}.md`、`docs/architecture/adr/ADR-0009-*.md`、ADR-0007/0008 的路径改写、ADR 索引

## Commands Run

| 命令 | 结果 |
| ---- | ---- |
| `uv sync --directory bridges/python` | 通过（生成 `bridges/python/.venv/`） |
| `uv run --directory bridges/python pytest -q` | `198 passed`（L0+L1+L2，与迁移前基线一致） |
| `npm --prefix apps/desktop run typecheck` | 无 error |
| `npm --prefix apps/desktop run test:unit` | `71 passed`（与迁移前基线一致） |
| `npm run build`（根别名 → `apps/desktop`） | 通过（`dist/main` + `dist/renderer` + `dist/preload/index.js`） |
| `npm start -- --user-data-dir=/tmp/monorepo-app-smoke --remote-debugging-port=9335`（隔离 profile） | 应用启动，CDP 页面标题 `SWUFE WebVPN Bridge`、URL 指向 `apps/desktop/static/index.html` |
| 真实 `SidecarProcess` + 真实 sidecar（临时 runtime config，端口 18080） | `resolvePythonCommand` 命中 `bridges/python/.venv/bin/python`；`READY in 366 ms`、`STOPPED`（证明迁移后应用仍能拉起桥） |
| 真实 `ensureCaFiles`（临时 confdir） | `CA OK: …/mitmproxy-ca-cert.pem`（`python -m swufe_bridge.ca` 经桥工程根可用） |
| `npm run docs:check` | `0 error(s), 0 warning(s)`（173 文件；links / i18n / spec 三项） |
| `npm run typecheck`（根检查脚本） | 无 error |
| `pnpm install` → `pnpm install --frozen-lockfile`（先删除两处 `node_modules` 的净安装） | 通过；`pnpm-lock.yaml` 覆盖 importer `.` 与 `apps/desktop`；仅 `esbuild` 的 postinstall 执行 |
| `node apps/desktop/node_modules/electron/install.js` | 通过（`path.txt` = `Electron.app/Contents/MacOS/Electron`） |
| `pnpm run build` / `pnpm --filter swufe-webvpn-bridge run typecheck` / `run test:unit` | 通过 / 无 error / `71 passed` |
| `pnpm start --user-data-dir=/tmp/pnpm-clean-smoke --remote-debugging-port=9344`（净安装后） | 应用启动，CDP 页面标题 `SWUFE WebVPN Bridge`、URL 指向 `apps/desktop/static/index.html` |
| 反例对照：`pnpm --filter swufe-webvpn-bridge run start -- --user-data-dir=… --remote-debugging-port=…` | 失败（Electron 收到字面 `--`，CDP 端口不监听）；对照 `pnpm start --user-data-dir=… --remote-debugging-port=9343` 通过 |
| `pnpm run acceptance:check --out <dir> --user-data-dir <profile>` | 通过（生成脱敏报告，`redaction-self-check` PASS） |
| 真实 `SidecarProcess` + `ensureCaFiles`（pnpm 安装树，端口 18082） | `resolvePythonCommand` → `bridges/python/.venv/bin/python`；`READY in 512 ms`；`CA OK: …/mitmproxy-ca-cert.pem` |
| `pnpm run docs:check` / `pnpm run typecheck`（切换后） | `0 error(s), 0 warning(s)`（176 文件）/ 无 error |
| `uv run --directory bridges/python pytest -q`（切换后） | `198 passed` |

## Known Problems

- 未跟踪文件已收敛：`pnpm-workspace.yaml` 与 `pnpm-lock.yaml` 现在是仓库的正式配置与唯一锁文件（需随本次改动一同提交）。
- `docs/archive/**`、`.agents/notes/2026-09-21-{m2,m4}-*.md` 与 `specs/001-phase1-local-bridge/evidence/**` 内仍能看到旧路径与 npm 命令（历史资料，按规则不重写）。
- 首次全新 clone 需跑一次 `node apps/desktop/node_modules/electron/install.js`（electron 44.x 无 install 脚本），否则 `pnpm start` 起不来。

## Recommended Next Step

提交本次改动：`git add -A`（会包含 `apps/**`、`bridges/python/**` 的重命名、`pnpm-lock.yaml` / `pnpm-workspace.yaml`、两份 `package-lock.json` 的删除与全部文档改写；当次先确认 `node_modules/`、`dist/`、`bridges/python/.venv/`、`.pytest_cache/` 均被 `.gitignore` 覆盖）。之后新增应用时按 `apps/<app>` 落位并在 `pnpm-workspace.yaml` 的 `packages` 下自然纳入；新增带构建脚本的依赖时先在 `allowBuilds` 审阅。
