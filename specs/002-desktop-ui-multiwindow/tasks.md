# Tasks: 桌面界面重构（React + Ant Design 多窗口）

> Spec ID: 002
> Status: Draft
> Owner: cherrchen
> Last Updated: 2026-09-23

> 本文件供 Coding Agent **逐条执行**。任务必须足够小、可独立验证、说明输入输出与依赖。
> **禁止**把「实现整个 Feature」当作一个任务。
> 状态：`- [ ]` 未完成，`- [x]` 已完成。完成后立即更新，不要批量事后补勾。
> 任务编号从 `T201` 起（与 001 的 `T001..T048` 不重叠，便于跨 Spec 引用）。

## Task 格式

```markdown
- [ ] T201 <动作，动词开头> — 输入：… — 输出：… — 依赖：无 — 验证：<命令或检查> — 关联：REQ-012 / AC2-001
```

要求：

| 字段 | 说明 |
| ---- | ---- |
| ID | `T` + 三位序号，单调递增，不复用 |
| 动作 | 一个具体改动（改哪个文件/模块） |
| 输入 | 需要的前置信息或产物 |
| 输出 | 完成后仓库中的可观察结果（文件、行为） |
| 依赖 | 前置任务 ID，无则写 `无` |
| 验证 | 可执行的验证方式（命令、检查或手工步骤） |
| 关联 | 对应的需求/验收标准 ID |

## Phase 1 — 工具链与渲染层骨架

- [ ] T201 引入前端依赖并锁定版本 — 输入：[design.md](design.md) §1 版本表 — 输出：`apps/desktop/package.json` 含 react/react-dom 19.3.0、antd 6.6.5、@ant-design/icons 6.3.4 与 dev 依赖 vite 7.3.6、@vitejs/plugin-react 5.2.0、vitest 3.2.7、jsdom 26.1.0、@testing-library/react 16.3.3、@types/react(-dom) 19.3.0；根 `pnpm-lock.yaml` 更新 — 依赖：无 — 验证：`pnpm install --frozen-lockfile` 通过 — 关联：SC2-007 / REQ-012
- [ ] T202 复核 pnpm 安装脚本审批与依赖记录 — 输入：[dependency-policy.md](../../docs/development/dependency-policy.md) §3.1、T201 的依赖树 — 输出：`pnpm-workspace.yaml` 的 `allowBuilds` 增补（仅当安装报 `ERR_PNPM_IGNORED_BUILDS` 时）；依赖记录条目草稿（Phase 4 落文档） — 依赖：T201 — 验证：`pnpm install` 无 `ERR_PNPM_IGNORED_BUILDS`；`pnpm why electron` 等既有依赖不受影响 — 关联：SC2-007 / R2-005
- [ ] T203 建立 Vite 构建配置 — 输入：[design.md](design.md) §5 — 输出：`apps/desktop/vite.config.ts`（root `src/renderer`、`base: './'`、`build.outDir ../../dist/renderer`、多入口 `main/capture/logs/allowlist.html`、共享 chunk、按模式注入 CSP 的插件、dev server 固定端口）——依赖：T201 — 验证：`pnpm --filter swufe-webvpn-bridge exec vite build` 产出四个 HTML 与共享 chunk；`pnpm --filter swufe-webvpn-bridge exec vite --port <port>` 可启动 dev server — 关联：REQ-012 / R2-002
- [ ] T204 建立四个入口 HTML 与 React 挂载点 — 输入：T203、[ui-ux.md](ui-ux.md) 的窗口清单 — 输出：`src/renderer/{main,capture,logs,allowlist}.html` 与 `src/renderer/entry/{main,capture,logs,allowlist}.tsx`（`createRoot` 挂载窗口根组件，暂为占位内容） — 依赖：T203 — 验证：`vite build` 通过；`dist/renderer/main.html` 存在 — 关联：REQ-012
- [ ] T205 调整渲染层 TypeScript 与脚本 — 输入：T204 — 输出：`tsconfig.renderer.json`（`jsx: react-jsx`、include 扩展 `.tsx`）、`apps/desktop/package.json` 的 `build`（`tsc -p tsconfig.json && vite build && pnpm run build:preload`）、`typecheck`（三 tsconfig 含渲染层）、新增 `test:ui`（`vitest run`） — 依赖：T204 — 验证：`pnpm --filter swufe-webvpn-bridge run typecheck` 无 error；`run build` 通过 — 关联：REQ-012 / AC2-011
- [ ] T206 实现按模式注入 CSP 的 Vite 插件 — 输入：T203、[spec.md](spec.md) SC2-003/SC2-004 — 输出：生产构建注入 `default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:`；开发模式额外允许 dev server 源与 HMR WebSocket（仅开发期） — 依赖：T203 — 验证：`dist/renderer/*.html` 的 CSP meta 与约定一致；开发模式启动后样式与 HMR 可用 — 关联：SC2-004 / AC2-012 / R2-002
- [ ] T207 Main 切换到新主窗口并调整尺寸规则 — 输入：T204、[ui-ux.md](ui-ux.md) §主窗口、[design.md](design.md) §2 — 输出：主窗口加载 `dist/renderer/main.html`（设置 `SWUFE_RENDERER_URL` 时加载该 dev server URL）；基线 720×560、`resizable: false`，尺寸随内容缩放系数（`zoom-changed`）按比例自适应并 clamp 到工作区 — 依赖：T204 — 验证：`pnpm start` 显示新主窗口、不可拖拽缩放；放大内容后窗口按比例变大（旧 `static/index.html` 仍保留在仓库） — 关联：SC2-001 / AC2-001 / Q2-002 / Q2-003
- [ ] T208 建立窗口外壳（AppShell）与错误边界 — 输入：T204 — 输出：`src/renderer/lib/{AppShell.tsx,ErrorBoundary.tsx,theme.ts,bridge-api.ts}`：`ConfigProvider`（`locale` zh_CN、`componentSize="small"`、紧凑 token）+ antd `App` + `ErrorBoundary`（中文错误 + [重新加载窗口]，EC2-008）；`bridge-api.ts` 唯一 IPC 出口 — 依赖：T204 — 验证：四个入口均渲染标题与骨架；人为抛错时显示错误面板而非白屏 — 关联：EC2-008 / SNFR-003

## Phase 2 — Main 侧窗口管理与 IPC 扩展

- [ ] T209 实现窗口策略纯函数 — 输入：[design.md](design.md) §3 — 输出：`src/main/window-policy.ts`：给定「该类窗口是否存在/是否最小化」返回 `create` \| `focus`（无 Electron 依赖） — 依赖：无 — 验证：`pnpm --filter swufe-webvpn-bridge run test:unit` 新增用例全绿（覆盖 4 种窗口类型 × create/focus 分支） — 关联：SNFR-002 / EC2-001
- [ ] T210 实现窗口注册表 — 输入：T209、[design.md](design.md) §2/§3 — 输出：`src/main/window-registry.ts`：`openMain/openCapture/openLog/openAllowlist/closeLog/closeAll/broadcast/count`，四窗口参数（尺寸、`resizable`、标题、preload、入口 HTML）集中一处，二级窗口单实例复用与聚焦，主窗口尺寸随内容缩放系数自适应，主窗口 `closed → app.quit()` — 依赖：T209 — 验证：`test:unit` 新增策略用例 + 实机打开两个不同二级窗口并重复触发入口（窗口数不变） — 关联：REQ-012 / SNFR-002 / EC2-001 / Q2-001 / Q2-003
- [ ] T211 实现调试日志环形缓冲 — 输入：[design.md](design.md) §3 — 输出：`src/main/debug-log-buffer.ts`（`push/snapshot/clear`，≤200 条，最新在前；容量常量 `MAX_DEBUG_LOG_ENTRIES` 入 `constants.ts`） — 依赖：无 — 验证：`test:unit` 新增用例（溢出丢最旧、最新在前、clear 归零、键集合不变） — 关联：REQ-009 / AC2-006 / EC2-007
- [ ] T212 扩展 IPC 命令与广播面 — 输入：T210、T211、[docs/api/electron-ipc.md](../../docs/api/electron-ipc.md) — 输出：`src/main/ipc.ts` 新增 `swufe:openCaptureWindow`/`openLogWindow`/`openAllowlistWindow`/`getDebugLogs`；`broadcast` 改为广播到全部存活窗口；日志事件先写入缓冲再广播；`setDebugLogging(false)` 时清空缓冲并关闭日志窗口 — 依赖：T210、T211 — 验证：`test:unit` 通过（缓冲与副作用顺序用例）+ 实机调用 `getDebugLogs()` 返回 `[]` 与写入后的记录 — 关联：REQ-009 / REQ-012 / AC2-005 / AC2-006 / AC2-010
- [ ] T213 增补 preload 与共享类型 — 输入：T212 — 输出：`src/preload/index.ts` 与 `src/shared/types.ts` 的 `SwufeBridgeApi` 增补 4 个方法；既有 16 个命令与 3 个事件签名不变 — 依赖：T212 — 验证：`typecheck` 无 error；`grep` 确认既有方法名与签名未改 — 关联：SC2-006 / AC2-010
- [ ] T214 实现渲染层状态 hooks 与日志批处理 — 输入：T208、T213 — 输出：`src/renderer/lib/hooks.ts`（`useBridgeStatus` / `useSettings` / `useAllowlist` / `useCaStatus` / `useCapture` / `useDebugLogs`：挂载时幂等拉取 + 订阅事件，卸载时取消订阅）与 `log-batch.ts`（常规 100ms 合并；满 200 行且 > 50 条/秒 时降为 250ms，Q2-004） — 依赖：T208、T213 — 验证：组件测试中事件推送后 hook 状态更新一次；卸载后无事件回调残留；节流阈值切换用例 — 关联：SC2-005 / SNFR-005
- [ ] T215 建立组件测试脚手架 — 输入：T205、T214 — 输出：`apps/desktop/vitest.config.ts`（`environment: 'jsdom'`、include `test/ui/**/*.test.tsx`）、`test/ui/helpers/bridge-fake.ts`（可控的 `window.swufeBridge` 假实现）、一条示例用例 — 依赖：T205、T214 — 验证：`pnpm --filter swufe-webvpn-bridge run test:ui` 通过 — 关联：AC2-011 / R2-008

## Phase 3 — 四窗口功能对齐

- [ ] T216 实现主窗口状态条与主操作 — 输入：[ui-ux.md](ui-ux.md) §状态与文案、`constants.ts` 的 `ERROR_MESSAGES` — 输出：`windows/main/{StatusBar.tsx,PrimaryActions.tsx}`：状态条按状态机呈现五种状态（文字不靠颜色）、[登录/重新登录]、桥接开关（未登录禁用；开桥失败按 `PROXY_CONFLICT` 弹模态、其它码显示消息） — 依赖：T208、T214 — 验证：组件测试覆盖状态映射与禁用规则；实机状态条与状态机一致（复用 TC-H01 口径） — 关联：REQ-001 / AC2-002 / AC2-009
- [ ] T217 实现主窗口捕获方式区 — 输入：[ui-ux.md](ui-ux.md) §捕获窗口（入口部分）、`setCaptureMode` 语义 — 输出：`windows/main/CaptureSection.tsx`：一级单选（系统代理 / 指定应用）、进程捕获状态行（未启用 / 已启用（N 个应用）/ 启用中… / 启用失败 — 原因）、[选择应用…]（调用 `openCaptureWindow()`）、授权引导与 [重试]（失败时） — 依赖：T210、T214 — 验证：组件测试覆盖四种状态行；实机切换方式仍受 `PROXY_CONFLICT` 拒绝（复用 TC-G04 口径） — 关联：REQ-003 / AC2-002 / AC2-003 / EC2-005
- [ ] T218 实现主窗口 allowlist 摘要 — 输入：T214、[ui-ux.md](ui-ux.md) §Allowlist 窗口 — 输出：`windows/main/AllowlistSummary.tsx`（`N 个主机` / `N 个主机（含 *.swufe.edu.cn）` + [管理…] 调 `openAllowlistWindow()`） — 依赖：T210、T214 — 验证：组件测试覆盖两种摘要文案与入口调用 — 关联：REQ-005 / AC2-002 / AC2-007
- [ ] T219 实现主窗口证书区 — 输入：NFR-005 文案、既有 `installCa`/`uninstallCa`/`getCaStatus` — 输出：`windows/main/CertificateSection.tsx`：CA 状态文本（未安装 / 已安装未被信任 / 已安装并被系统信任）、[安装本机 CA]（先弹风险提示模态，取消则无动作）、[卸载本机 CA] — 依赖：T214、T221（模态可用） — 验证：组件测试断言「取消风险提示时不调用 `installCa`」；实机复用 TC-E01..E03 口径 — 关联：REQ-010 / NFR-005 / AC2-002 / AC2-009
- [ ] T220 实现主窗口诊断区 — 输入：[ui-ux.md](ui-ux.md) §主窗口 — 输出：`windows/main/DiagnosticsSection.tsx`：系统代理状态只读一行（由本 App 指向 `127.0.0.1:<port>` / 未占用）、调试日志开关（开：`setDebugLogging(true)` + `openLogWindow()`；关：`setDebugLogging(false)`，窗口由 Main 关闭） — 依赖：T212、T214 — 验证：组件测试覆盖开关调用；实机开关联动窗口出现/消失（TC-J05） — 关联：REQ-009 / AC2-005 / EC2-002
- [ ] T221 迁移三个模态到 Ant Design — 输入：既有文案（`ERROR_MESSAGES` 与 [ui-ux/main-window.md](../../docs/ui-ux/main-window.md) 文案表） — 输出：`windows/main/modals.tsx`：CA 风险提示（confirm/cancel）、代理冲突（info）、会话过期（[去登录] → `login()`），经 `App.useApp().modal`（不使用静态方法） — 依赖：T208 — 验证：组件测试断言三条路径的文案与按钮动作 — 关联：AC2-009 / NFR-005 / EC2-003
- [ ] T222 对齐错误码解析与消息行 — 输入：`electron-ipc.md` §错误模型（`<CODE>：<message>` 前缀约定） — 输出：`windows/main/MessageRow.tsx` + 错误解析（`PROXY_CONFLICT` → 模态；其它 → 消息行文本，保留错误码） — 依赖：T216 — 验证：组件测试覆盖两种错误码路径 — 关联：REQ-004 / AC2-009
- [ ] T223 实现捕获窗口 — 输入：T210、T214、[ui-ux.md](ui-ux.md) §捕获窗口 — 输出：`windows/capture/CaptureWindow.tsx`：状态行与当前捕获方式提示、失败态引导 + [重试]、筛选框、[刷新列表]、应用复选框列表（一行一个应用，内部滚动）、已选计数（≤32） — 依赖：T210、T214 — 验证：组件测试覆盖筛选、空态、失败态与勾选调用；实机打开窗口并核对列表与既有候选归并结果一致 — 关联：REQ-003 / AC2-003 / EC2-006 / EC2-010
- [ ] T224 实现日志窗口 — 输入：T211、T212、T214、[ui-ux.md](ui-ux.md) §日志窗口 — 输出：`windows/logs/LogWindow.tsx`：三列表格（时间｜域名｜结果，最新在前）、计数、[清空]、空态、挂载时用 `getDebugLogs()` 恢复历史 — 依赖：T211、T212、T214 — 验证：组件测试覆盖渲染列、200 条上限、清空、恢复；实机重开窗口仍有历史（TC-J06） — 关联：REQ-009 / AC2-005 / AC2-006 / NFR-003
- [ ] T225 实现 Allowlist 窗口 — 输入：T214、[ui-ux.md](ui-ux.md) §Allowlist 窗口 — 输出：`windows/allowlist/AllowlistWindow.tsx`：添加（校验失败内联提示、不写入）、逐行删除、`*.swufe.edu.cn` 勾选、列表内部滚动 — 依赖：T214 — 验证：组件测试覆盖增删/通配/非法主机；实机重启后设置保留（复用 TC-B05 / TC-H02） — 关联：REQ-005 / AC2-007
- [ ] T226 收敛主窗口零滚动布局 — 输入：T216..T220 的区块、[ui-ux.md](ui-ux.md) 的实测口径 — 输出：主窗口在基线 720×560 与内容缩放系数 1.0/1.25/1.5 下均无页面级与区域级滚动（必要时按 EC2-009 的次序把内容外移到二级窗口，而不是加滚动） — 依赖：T216..T220 — 验证：实机 CDP 断言（TC-J01）在 zoom 1.0 / 1.25 / 1.5 三档通过，且窗口外框随比例变化 — 关联：SC2-002 / AC2-001 / EC2-009 / R2-001
- [ ] T227 组件测试：主窗口 — 输入：T216..T222、T215 — 输出：`test/ui/main-window.test.tsx`：状态映射、未登录禁用开桥、allowlist 摘要文案、CA 风险提示取消不调用安装、日志开关调用、错误码分支 — 依赖：T216..T222、T215 — 验证：`test:ui` 通过 — 关联：AC2-002 / AC2-009 / AC2-011
- [ ] T228 组件测试：捕获窗口 — 输入：T223、T215 — 输出：`test/ui/capture-window.test.tsx`：勾选调用 `setCaptureProcesses`（整体覆盖）、失败态显示引导与 [重试]、筛选过滤、空态、系统代理方式下的提示文案 — 依赖：T223、T215 — 验证：`test:ui` 通过 — 关联：AC2-003 / AC2-004 / EC2-005 / EC2-006
- [ ] T229 组件测试：日志窗口与 Allowlist 窗口 — 输入：T224、T225、T215 — 输出：`test/ui/{log-window,allowlist-window}.test.tsx`：三列渲染与最新在前、200 条上限、清空、挂载恢复；添加/删除/通配调用与非法主机内联错误 — 依赖：T224、T225、T215 — 验证：`test:ui` 通过 — 关联：AC2-005..AC2-007 / AC2-011

## Phase 4 — 清理与文档同步

- [ ] T230 删除旧渲染层 — 输入：T226 通过（新主窗口功能齐备） — 输出：删除 `apps/desktop/static/index.html`、`apps/desktop/static/styles.css`、`apps/desktop/src/renderer/renderer.ts` 及对 `static/` 的引用（构建脚本、`tsconfig.renderer.json` 的旧路径、README 提及） — 依赖：T226 — 验证：`typecheck` / `build` / `start` 通过；`grep` 仓库无 `static/index.html` 引用（历史 Spec 与验收记录中的历史引用除外） — 关联：SC2-008 / REQ-012
- [ ] T231 复核隔离与 CSP 实测 — 输入：T206、T210 — 输出：四个窗口的 `webPreferences` 检查结论（`sandbox: true` + `contextIsolation: true` + 无 `nodeIntegration`）、`dist/renderer/*.html` 的 CSP 与约定一致、渲染层源码无 `require(` / `process.` / `electron` 直接引用 — 依赖：T206、T210 — 验证：`grep` 检查命令 + 实机样式生效（TC-J10） — 关联：AC2-012 / SNFR-004 / SC2-003
- [ ] T232 更新 `apps/desktop/README.md` — 输入：T203..T205、T210 — 输出：构建命令（Vite）、生成物（`dist/renderer/*.html`、共享 chunk）、`test:ui`、四窗口结构说明、开发期 dev server 环境变量（若 Q2-002 落地） — 依赖：T230 — 验证：按 README 从零执行 `pnpm install` → `build` → `start` 可复现 — 关联：REQ-012
- [ ] T233 重写 UI/UX 长期文档 — 输入：[ui-ux.md](ui-ux.md) — 输出：重写 [docs/ui-ux/main-window.md](../../docs/ui-ux/main-window.md)（720×560 零滚动、四窗口信息层级、状态与文案表）；新增 `docs/ui-ux/secondary-windows.md`（捕获 / 日志 / Allowlist，含线框与文案）；同步 `docs/ui-ux/README.md` 索引；三者均补 `.en.md` — 依赖：T226 — 验证：`pnpm run docs:check` 0 error（链接 + 双语配对） — 关联：REQ-012 / NFR-007
- [ ] T234 更新架构文档 — 输入：T210、T211 — 输出：[components.md](../../docs/architecture/components.md)（`Telemetry UI` 改四窗口渲染层；新增窗口注册表与日志缓冲组件及其不变式）、[interfaces.md](../../docs/architecture/interfaces.md)（IF-001 新增方法与广播面、边界图）、[data-flow.md](../../docs/architecture/data-flow.md)（窗口打开与广播路径）；均补 `.en.md` — 依赖：T212 — 验证：`pnpm run docs:check` 通过；文档与实现一致（人工复核） — 关联：REQ-012
- [ ] T235 更新 Electron IPC 文档 — 输入：T212、T213 — 输出：[docs/api/electron-ipc.md](../../docs/api/electron-ipc.md)：新增 4 个方法的用途/输入/输出/幂等性、事件投递范围（全部窗口）、`setDebugLogging(false)` 的副作用、变更记录行；补 `.en.md`；同步 [interfaces.md](../../docs/architecture/interfaces.md) 的 IF-001 契约段（若未在 T234 完成） — 依赖：T212 — 验证：`pnpm run docs:check` 通过；实现与文档逐条对照 — 关联：AC2-010 / SC2-006
- [ ] T236 在 001 加被取代注记 — 输入：本 Spec 的窗口结构结论 — 输出：[001 spec.md](../001-phase1-local-bridge/spec.md) 与 [001 verification.md](../001-phase1-local-bridge/verification.md) 各加一行注记（界面部分：REQ-009 日志面板位置、REQ-005 allowlist 编辑位置、REQ-003 捕获区归属已被 002 取代；历史证据保留，不改结论） — 依赖：无 — 验证：`pnpm run spec:check` 无 error；注记指向本 Spec — 关联：REQ-012
- [ ] T237 更新开发流程文档 — 输入：T201、T215 — 输出：[dependency-policy.md](../../docs/development/dependency-policy.md)（8 个新增依赖的版本/用途/许可证/风险/替代方案 + `allowBuilds` 结论）、[testing-strategy.md](../../docs/development/testing-strategy.md)（新增渲染层组件测试层、`test:ui`、与 CDP 实机断言的职责分工）；补 `.en.md` — 依赖：T201、T215 — 验证：`pnpm run docs:check` 通过 — 关联：SC2-007 / R2-008
- [ ] T238 复核根级文档与 CI 索引 — 输入：T232..T237 — 输出：根 [README.md](../../README.md) / [CONTRIBUTING.md](../../CONTRIBUTING.md) 中与构建、窗口或测试命令相关的段落同步（无变化则记录「无」）；[AGENTS.md](../../AGENTS.md) 的 Source of Truth 表若需增行则同步（+ `.en.md`） — 依赖：T232 — 验证：`pnpm run docs:check` 通过；人工复核无过时命令 — 关联：REQ-012

## Phase 5 — 验证与回归

- [ ] T239 在 CI 增加渲染层组件测试步骤 — 输入：T215、[.github/workflows/app-tests.yml](../../.github/workflows/app-tests.yml) — 输出：工作流在 `test:unit` 后执行 `test:ui`（jsdom，无需浏览器与显示器） — 依赖：T215 — 验证：本地按工作流命令顺序执行通过；工作流文件语法可被 GitHub 解析 — 关联：AC2-011
- [ ] T240 执行全量回归 — 输入：T230..T239 — 输出：[verification.md](verification.md) 的命令结果表：`test:unit`、`test:ui`、`typecheck`、`build`、`pnpm run docs:check`、`pnpm run spec:check`、`uv run --directory bridges/python pytest -q` — 依赖：T230 — 验证：上述命令全部通过并记录实际输出与时间 — 关联：AC2-011 / SG-004
- [ ] T241 macOS 实机 CDP 验收：窗口与布局 — 输入：T226、T240 — 输出：TC-J01（零滚动，三档缩放）、TC-J02（单实例复用）、TC-J03（主窗口内容清单）、TC-J05/TC-J06（日志开关联动与重开恢复）、TC-J07（allowlist 摘要联动）、TC-J08（模态在主窗口）、TC-J10（隔离与 CSP）、TC-J11（窗口打开时延、日志推流下主窗口可交互）结果记入 [verification.md](verification.md) — 依赖：T240 — 验证：CDP 断言输出与观察记录；不含需要真实会话的项 — 关联：AC2-001 / AC2-002 / AC2-005..AC2-009 / AC2-012 / SNFR-005
- [ ] T242 macOS 实机冒烟：桥链路无回归 — 输入：T240、既有环境（CA 已安装 + 真实会话） — 输出：TC-J04（捕获勾选下发与落盘）、TC-J09（中文文案与键盘操作）、TC-J12（IPC 兼容）、TC-J13（登录 → 开桥 → 浏览器访问 allowlist 主机 → 关桥/退出无残留系统代理）结果记入 [verification.md](verification.md) — 依赖：T241 — 验证：实机观察 + `networksetup -getwebproxy` 对照；需要人的动作（管理员密码、CAS/MFA、系统扩展授权）由 cherrchen 完成 — 关联：AC2-003 / AC2-004 / AC2-010 / AC2-011 / AC2-013

## 注意事项

- 同一文件的任务应串行，或先指定集成责任人；
- 需要外部决策的任务先标记阻塞，不要用猜测推进（Q2-001..Q2-004 未定值时用暂定值并在 Result 中标注）；
- 任务完成但验证未通过时，保持未勾选，并在 [verification.md](verification.md) 中记录 `Failed`；
- 发现新任务时追加到对应 Phase，不要扩大既有任务范围。
