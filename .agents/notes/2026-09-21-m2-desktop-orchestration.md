# Session Handoff — 2026-09-21 — M2 桌面编排（Electron 壳 / 系统代理 / CA / 会话过期）

## Current Goal

按已批准的实施计划完成 M2（`docs/planning/milestones/M2-desktop-orchestration.md` 的退出条件），关联 Spec：
[specs/001-phase1-local-bridge/](../../specs/001-phase1-local-bridge/spec.md)。计划副本：`local://m2-desktop-orchestration-plan.md`。

## Completed

- [x] 步骤 1：`swufe_bridge/ca.py`（不启动桥即可生成 mitmproxy CA）+ `tests/l1/test_ca.py`（5 例）+ `tests/l0/test_config.py` 跨语言配置键用例（`uv run pytest -q` → 160 passed）
- [x] 步骤 2：`app/` 包脚手架（`package.json` + 三个 tsconfig + `scripts/run-unit-tests.mjs` + `static/`）；`dist/main`、`dist/renderer`、`dist/preload/index.js` 三份产物
- [x] 步骤 3–13：共享契约类型、AppStore、平台层（exec/parse/darwin/win32）、Cert Manager、Sidecar 监督、Session Broker、桥状态机、Proxy Orchestrator、IPC + preload、渲染层（状态条/开关/证书/模态）、应用入口与退出清理（`app/src/main/shutdown.ts`）
- [x] 步骤 14（代码部分）：`app/test/` 8 个单测文件（55 passed）、`app/test/fixtures/portal-stub.mjs`、`app/test/fixtures/stub-ca-app.js`；`.github/workflows/app-tests.yml`
- [x] 文档同步：README(+en)、roadmap(+en)、milestones/README(+en)、M2 完成记录(+en)、components(+en)、bridge-control-protocol(+en)、electron-ipc(+en)、operations(+en)、testing-strategy(+en)、coding-conventions(+en)、dependency-policy(+en)、spec/tasks/verification
- [x] 实机验证（macOS 15.8 / Electron 44.4.3）：真实应用 UI 流程（登录、CA 风险模态、`CA_MISSING`、单实例锁）+ CA 前置被替换的端到端链路（系统代理三态、curl 经桥改写、debug 事件到渲染层、过期级联、退出清代理、残留自愈、代理冲突）

## In Progress

无：M2 计划内的实现与可自主完成的验证全部完成。

## Remaining

- [ ] TC-E01 / TC-E02：在测试机上输入管理员密码，执行 `security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain <userData>/mitmproxy/mitmproxy-ca-cert.pem` 与 `security delete-certificate -Z <sha1> /Library/Keychains/System.keychain`，核对 `security find-certificate … | wc -c` 与 UI 的 `getCaStatus`（承载任务 T023/T024/T030）
- [ ] Windows 真机验证（TC-C02/C03/C04、TC-E01/E02、TC-G03/G04）→ M4/T038
- [ ] Q-001 剩余失效信号（`Set-Cookie` 清空会话、连续改写后 302 到 CAS）→ M3/M4
- [ ] M3：allowlist 编辑 UI、调试日志面板、进程捕获 UI/接管（T025/T026/T027）

## Important Decisions

已迁移（长期结论，无需从本 note 引用）：

- 实现期决策与偏差表 → [M2 完成记录](../../docs/planning/milestones/M2-desktop-orchestration.md)（Main 侧 `verbatimModuleSyntax` 与 `module: commonjs` 互斥、preload 必须 esbuild 打包、IPC 新增 3 项、会话 Cookie 下发字段、`redirect:'manual'` 的重定向即响应、退出只拦 `before-quit`、端口占用错误码、`--user-data-dir` 自行解析）
- IPC 表面新增项 → [docs/api/electron-ipc.md](../../docs/api/electron-ipc.md)
- CA 生成入口 → [docs/api/bridge-control-protocol.md](../../docs/api/bridge-control-protocol.md)
- 配置落点与 env 覆盖 → [docs/operations/README.md](../../docs/operations/README.md)

临时项（未定，Open）：

- 产品名仍为暂定（Q-003）；`app/package.json` 的 `name`（`swufe-webvpn-bridge`）决定 `userData` 路径与 macOS 证书主体名，改名需同步 README/operations。
- 是否把「CA 安装到登录钥匙串（免管理员）」作为降级路径，未决策（当前只支持系统信任库）。

## Changed Files

| 文件 | 变更 | 关联任务 |
| ---- | ---- | -------- |
| `swufe_bridge/ca.py` | 新增：CA 生成入口（`python -m swufe_bridge.ca --confdir <dir>`） | T022 |
| `tests/l1/test_ca.py` | 新增：CA 入口 5 例 | T022 |
| `tests/l0/test_config.py` | 追加：App 侧 `settings` 兄弟键的跨语言兼容用例 | T006 |
| `app/**` | 新增：Electron 应用（Main/preload/renderer/shared/static/scripts/test/fixtures/README + 三个 tsconfig + package.json/lock） | T014–T024、T028–T030、T032/T033 |
| `.github/workflows/app-tests.yml` | 新增：App 类型检查与单元测试 CI | — |
| `app/README.md` | 新增：开发运行、生成物、env 覆盖与 fixture 说明 | — |
| `docs/**`（12 个文件 + 各自 `.en.md`） | 同步 M2 事实（组件位置、CA 入口、IPC 新增项、配置落点、测试层、依赖、路线图、里程碑） | — |
| `specs/001-phase1-local-bridge/{spec,tasks,verification}.md` | 状态与证据同步（T014–T022、T028、T029、T032、T033 勾选；T023/T024/T030 保留未勾选并写明原因） | — |

## Commands / Tests Run

| 命令 | 结果 | 备注 |
| ---- | ---- | ---- |
| `uv run pytest -q` | `160 passed` | L0 75 / L1 79 / L2 6 |
| `npm --prefix app run typecheck` | 无 error | 三个 tsconfig |
| `npm --prefix app run test:unit` | `55 passed` | 全部 electron-free |
| `npm --prefix app run build` | 通过 | `dist/main` + `dist/renderer` + `dist/preload/index.js` |
| `npm run docs:check` / `npm run typecheck` | 0 error / 0 warning；无 error | 双语配对通过 |
| 真实应用 + CDP（`--user-data-dir=/tmp/m2-e2e`） | 见 [M2 完成记录](../../docs/planning/milestones/M2-desktop-orchestration.md) 的 A 组 | 未登录/已登录/错误三态、CA 风险模态、单实例锁 |
| 验证入口 `app/test/fixtures/stub-ca-app.js` + `portal-stub.mjs` | 见同处的 B 组 | 代理三态、curl 改写链路、过期级联、退出清理、残留自愈、代理冲突 |
| `security add-trusted-cert` / `delete-certificate` | **未执行** | 需要管理员密码（本机 `sudo -n` 不可用） |

## Known Problems

- CA 写入/移除系统信任库未在真机验证；因此「真实应用内把桥开到 running」这条 UI 路径也未验证（被 `CA_MISSING` 前置挡住），本次以 CA 前置被替换的入口替代，替换点仅 `CertManager.getStatus()`。
- `kill -TERM`/`SIGKILL` 不会触发 JS 清理（Electron 浏览器进程直接退出，实测），系统代理会残留到下次启动；已由 `recoverOnLaunch()` 自愈并实测。
- Windows 分支只有实现 + 单测；已知限制：不广播 `WM_SETTINGCHANGE`，已运行浏览器可能需重启才感知代理。
- 本机 npm 镜像不执行 electron 的 install 脚本，`npm ci` 后需手动 `node app/node_modules/electron/install.js` 才能启动应用（已写入 `app/README.md`）。

## Recommended Next Step

1. 在有管理员权限的机器上完成 TC-E01/TC-E02（安装→`security verify-cert` 返回 0→卸载），并把结果补进 [M2 完成记录](../../docs/planning/milestones/M2-desktop-orchestration.md) 与 [verification.md](../../specs/001-phase1-local-bridge/verification.md) 的「未验证 / 无法验证项」。
2. 用真实账号做 L3 登录（TC-D01 真实会话、TC-D04 复验），确认 `classifyProbe` 的真实信号（含 Q-001 的 Cookie 名）。
3. 进入 M3：按 `specs/001-phase1-local-bridge/tasks.md` 的 T025/T026/T027 实现 allowlist 编辑 UI、调试日志面板与进程捕获 UI。
