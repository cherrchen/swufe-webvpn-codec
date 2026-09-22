# Technical Design: 桌面界面重构（React + Ant Design 多窗口）

> Spec ID: 002
> Status: Implemented
> Owner: cherrchen
> Last Updated: 2026-09-23

> 本文件回答 **How**：采用什么方案实现 [spec.md](spec.md) 的需求，影响哪些既有结构，有什么代价与风险。
> 需求定义在 [spec.md](spec.md)，窗口线框在 [ui-ux.md](ui-ux.md)，任务拆解在 [tasks.md](tasks.md)，长期架构事实在 [docs/architecture/](../../docs/architecture/README.md)。
> 难以逆转的决策（渲染层框架、构建方式、多窗口结构、测试栈）已提炼为 [ADR-0012](../../docs/architecture/adr/ADR-0012-react-antd-multiwindow-renderer.md)（Status: Proposed），本文件只引用结论。

## Context

现状（长期事实，不在本文件重新定义）：

- 组件与单向依赖规则：[docs/architecture/components.md](../../docs/architecture/components.md)（`Telemetry UI` 是叶子，只经 preload IPC 调用 `App Shell`）
- 接口清单与 IF-001 契约：[docs/architecture/interfaces.md](../../docs/architecture/interfaces.md)、[docs/api/electron-ipc.md](../../docs/api/electron-ipc.md)
- 界面事实：[docs/ui-ux/main-window.md](../../docs/ui-ux/main-window.md)
- 安全边界（TB-003 Renderer ↔ Main）：[docs/security/README.md](../../docs/security/README.md)
- 测试分层与既有基线：[docs/development/testing-strategy.md](../../docs/development/testing-strategy.md)

既有实现（代码落点）：

| 位置 | 现状 |
| ---- | ---- |
| `apps/desktop/src/renderer/renderer.ts` | 裸 TS 渲染层（约 498 行）：模块级 `status` / `caStatus` / `settings` / `allowlist` / `candidates` / `logRows`，`render()` + `renderAllowlist()` / `renderCapture()` / `renderLog()` 全量重写 DOM，事件经 `addEventListener` 绑定 |
| `apps/desktop/static/index.html`、`static/styles.css` | 单窗口 HTML（CSP `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:`）+ 手写样式 |
| `apps/desktop/src/main/windows.ts` | 只创建唯一主窗口（720×640，`minWidth 560` / `minHeight 520`） |
| `apps/desktop/src/main/ipc.ts` | 注册全部命令方法；`broadcast` 只向主窗口 `webContents.send`；渲染层保留最近 200 条日志 |
| `apps/desktop/src/preload/index.ts` | 暴露 `window.swufeBridge`（命令 + 3 个事件订阅） |
| 构建 | `tsc -p tsconfig.json`（Main）+ `tsc -p tsconfig.renderer.json`（Renderer，ESM）+ esbuild（preload 单文件） |

既有决策：[ADR-0003](../../docs/architecture/adr/ADR-0003-electron-gui-for-phase-1.md)（Phase 1 采用 Electron 而非纯 CLI）仍有效且不被本 Spec 改变；界面结构、捕获方式互斥（[ADR-0006](../../docs/architecture/adr/ADR-0006-local-capture-mode-and-mutual-exclusion.md)）与开桥前冲突拒绝（[ADR-0004](../../docs/architecture/adr/ADR-0004-refuse-start-when-system-proxy-in-use.md)、[ADR-0011](../../docs/architecture/adr/ADR-0011-refuse-start-on-fake-ip-dns.md)）的语义均不变。

被本 Spec 取代的既有界面事实：[001-phase1-local-bridge](../001-phase1-local-bridge/spec.md) 的 AC-009（日志面板在主窗口）、allowlist 编辑位置、捕获区位置——001 的历史验收证据保留，界面结构事实转由本 Spec 与更新后的 [docs/ui-ux/](../../docs/ui-ux/README.md) 承担。

## Proposed Solution

### 1. 渲染层技术栈（决策见 [ADR-0012](../../docs/architecture/adr/ADR-0012-react-antd-multiwindow-renderer.md)）

| 依赖 | 版本（锁定） | 用途 | 许可证 |
| ---- | ------------ | ---- | ------ |
| react / react-dom | 19.3.0 | 组件化渲染层 | MIT |
| @types/react / @types/react-dom | 19.3.0 | 类型（dev） | MIT |
| antd | 6.6.5 | 组件库（表单、开关、单选、表格、弹窗、布局） | MIT |
| @ant-design/icons | 6.3.4 | 图标（随包分发，无外联） | MIT |
| vite + @vitejs/plugin-react | 7.3.6 / 5.2.0 | 渲染层构建与开发期 Fast Refresh（dev） | MIT |
| vitest + jsdom + @testing-library/react | 3.2.7 / 26.1.0 / 16.3.3 | 渲染层组件测试（dev） | MIT |

选型理由：Ant Design 提供与既有界面一致的控件语义（开关、单选、复选框列表、表格、模态），省去手写交互与可访问性；React 19 + antd 6 原生兼容（不需要 v5 时代的 React 19 补丁包）；Vite 7 面向 esbuild + rollup（不引入需要额外原生二进制审批的打包链）；vitest 3 与既有 TypeScript/Node 22 基线兼容。antd 6 的 `config` 能力（`ConfigProvider` 的 `locale` 与 token）用于中文文案与紧凑排版。

Ant Design 6 的样式仍是 `@ant-design/cssinjs` 的**运行期注入**（`<style>` 标签），因此 [spec.md](spec.md) SC2-004 记录 CSP 放宽：每个窗口 HTML 的 `style-src` 为 `'self' 'unsafe-inline'`；`default-src 'none'`、`script-src 'self'`、`img-src 'self' data:` 不变。

React 19 下的弹窗/消息不使用 antd 静态方法（`Modal.confirm` / `message.*`），统一走 `<App>` 上下文 + `App.useApp()`，避免静态方法在 React 19 下的兼容问题，也避免额外引入补丁包。

### 2. 窗口结构（四个窗口，单实例复用）

| 窗口 | 入口 HTML | 尺寸（已定值，Q2-001） | 内容 |
| ---- | --------- | ----------------------------------------- | ---- |
| 主窗口 | `main.html` | 720×560，`resizable: false`，**零滚动** | 状态条、[登录/重新登录] + 桥接开关、捕获方式单选 + 进程捕获状态 + [选择应用…]、allowlist 摘要 + [管理…]、CA 状态 + [安装/卸载本机 CA]、系统代理状态 + 调试日志开关、消息行 |
| 捕获窗口 | `capture.html` | 560×480（可缩放，min = 默认） | 进程捕获状态、授权引导与 [重试]（仅失败时）、筛选 + [刷新列表]、应用复选框列表（内部滚动）、已选计数（≤32） |
| 日志窗口 | `logs.html` | 720×420（可缩放，min = 默认） | [清空] + 计数、三列表格（时间｜域名｜结果，最新在前，≤200 条，内部滚动）、空态文案 |
| Allowlist 窗口 | `allowlist.html` | 480×400（可缩放，min = 默认） | 添加主机（输入 + [添加]）、主机列表（逐行 [删除]，内部滚动）、`*.swufe.edu.cn` 通配勾选、非法主机名内联错误 |

窗口策略：

- **每类最多一个**：Main 侧维护窗口注册表，入口调用先查表——已存在则 `focus()`（必要时 `show()`）后返回，不存在才创建（EC2-001、SNFR-002）。
- **非模态**：二级窗口不阻塞主窗口（用户决定，2026-09-23）；主窗口仍是唯一持有模态的窗口（CA 风险提示、代理冲突、会话过期）。
- **生命周期**：主窗口关闭即 `app.quit()`（现状不变），二级窗口随进程退出；二级窗口被用户关闭只销毁自身，不改变任何持久化状态。
- **加载**：均经 `loadFile('<appRoot>/dist/renderer/<entry>.html')`，`base: './'` 保证 `file://` 下相对资源可用；四个窗口共用同一 preload（`dist/preload/index.js`）。

主窗口零滚动是**布局约束**而非样式建议：根容器 `height: 100vh; overflow: hidden`，内容区用固定行高 + 紧凑间距（`ConfigProvider` 的 `componentSize="small"` 与 token 调整），不出现任何可滚动溢出区域。溢出即视为缺陷（[spec.md](spec.md) EC2-009 给出处置：把内容再收进二级窗口，而不是加滚动）。

主窗口尺寸规则（Q2-003 收敛，2026-09-23）：

- 基线尺寸 720×560（DIP），`resizable: false`（用户不能拖拽缩放）；
- 实际尺寸 = 基线 × 内容缩放系数 `zoomFactor`（默认 1.0），并按当前显示器工作区 clamp（`width ≤ workArea.width - 80`、`height ≤ workArea.height - 120`）；
- 缩放来源是**内容**（Chromium 的 window zoom，用户 Cmd/Ctrl+加减号或后续界面缩放入口），监听 `webContents` 的 `zoom-changed` 事件后重算；**不**使用显示器 `scaleFactor`（macOS Retina 的 `scaleFactor = 2` 会让窗口变成 1440×1120 DIP，超过普通笔记本的逻辑工作区）；
- 缩放后仍要求零滚动：若 clamp 生效后窗口无法容纳全部内容，按 [spec.md](spec.md) EC2-009 的顺序把内容外移到二级窗口，而不是加滚动。

### 3. Main 侧改动

| 模块 | 变更 |
| ---- | ---- |
| `src/main/windows.ts` → `window-registry.ts` + `window-policy.ts` | 由「只建主窗口」扩展为窗口注册表：`openMain()` / `openCapture()` / `openLog()` / `openAllowlist()` / `closeLog()` / `closeAll()` / `broadcast(channel, payload)` / `count(kind)`；窗口创建参数（尺寸、`resizable`、`parent`、preload、标题）集中在一处。**纯策略**（给定已有窗口状态 → `create` \| `focus`）抽为无 Electron 依赖的 `window-policy.ts`，供 App 单测覆盖 |
| `src/main/debug-log-buffer.ts`（新增） | 日志环形缓冲（≤200 条，最新在前）：`push(event)` / `snapshot()` / `clear()`；容量常量 `MAX_DEBUG_LOG_ENTRIES = 200` 移入 `src/main/constants.ts`（取代渲染层的 `MAX_LOG_ROWS`） |
| `src/main/ipc.ts` | 新增 5 个命令：`swufe:openCaptureWindow` / `swufe:openLogWindow` / `swufe:openAllowlistWindow` / `swufe:getDebugLogs` / `swufe:clearDebugLogs`；`broadcast` 改为广播到全部存活窗口；`setDebugLogging(false)` 的副作用改为「清空缓冲 + 关闭日志窗口」；`setAllowlist` 成功后补广播一次当前状态（各窗口重新读取 allowlist 摘要）；调试日志事件在 `broadcast` 之前先写入缓冲 |
| `src/main/index.ts` | 组合根：创建注册表并注入 `ipc.ts`（`broadcast` / 窗口 opener）；`recoverOnLaunch()`、单实例锁、退出清理（`shutdown.ts`）不变 |
| `src/preload/index.ts` | 新增 5 个方法转发（`openCaptureWindow` / `openLogWindow` / `openAllowlistWindow` / `getDebugLogs` / `clearDebugLogs`）；3 个事件订阅签名不变 |
| `src/shared/types.ts` | `SwufeBridgeApi` 增补 5 个方法；其余类型不变 |
| `apps/desktop/static/`、`src/renderer/renderer.ts` | 迁移完成后删除（clean cutover，SC2-008） |

### 4. 渲染层结构

```text
apps/desktop/src/renderer/
├─ main.html / capture.html / logs.html / allowlist.html   # Vite 多入口（各注入 CSP meta）
├─ entry/{main,capture,logs,allowlist}.tsx                 # createRoot(...).render(<AppShell><XWindow/></AppShell>)
├─ lib/
│  ├─ bridge-api.ts        # window.swufeBridge 的类型化封装（唯一 IPC 出口）
│  ├─ AppShell.tsx         # ConfigProvider(zh_CN, 紧凑 token) + App + ErrorBoundary
│  ├─ ErrorBoundary.tsx    # 单窗口错误面板 + [重新加载窗口]（EC2-008）
│  ├─ hooks.ts             # useBridgeStatus / useSettings / useAllowlist / useCaStatus / useCapture / useDebugLogs
│  └─ log-batch.ts         # 高频日志事件的合并推送（Q2-004）
└─ windows/
   ├─ main/MainWindow.tsx        （StatusBar / PrimaryActions / CaptureSection / AllowlistSummary / CertificateSection / DiagnosticsSection / 三个模态）
   ├─ capture/CaptureWindow.tsx
   ├─ logs/LogWindow.tsx
   └─ allowlist/AllowlistWindow.tsx
```

- **状态权威仍在 Main**（SC2-005）：每个窗口挂载时用幂等读拉取初始状态，随后只接受 IPC 事件更新；窗口之间不互相读取。
- **日志事件合并**：`onDebugLog` 事件先进入本地缓冲，按 100ms 合并后一次性 `setState`；当缓冲已满 200 行且推流速率 > 50 条/秒 时降为 250ms 节流，避免满速流量下每事件一次重渲染（SNFR-005；Q2-004 已定值）。
- **模态**：CA 风险提示（confirm/cancel）、代理冲突（info）、会话过期（[去登录]）用 `App.useApp().modal`；`window.swufeBridge` 的错误码前缀解析（`<CODE>：<message>`，见 [electron-ipc.md](../../docs/api/electron-ipc.md)）保持既有逻辑。
- **不可测量量的处理**：主窗口零滚动不变量无法在 jsdom 中测量，作为**实机 CDP 断言**（TC-J01），不作为组件测试项（见 [plan.md](plan.md) §Verification Plan）。

### 5. 构建与运行

| 命令 | 变更 |
| ---- | ---- |
| `build` | `tsc -p tsconfig.json && vite build && pnpm run build:preload`（渲染层由 Vite 构建到 `dist/renderer/`，含四个入口 HTML 与共享 chunk；Main 仍由 tsc 编译；preload 仍由 esbuild 打单文件） |
| `typecheck` | `tsc -p tsconfig.json --noEmit` + `tsc -p tsconfig.renderer.json --noEmit`（`jsx: react-jsx`、include 扩展 `.tsx`）+ `tsc -p tsconfig.preload.json` |
| `test:unit` | 不变（node:test + tsx，覆盖 Main 侧无 Electron 单测） |
| `test:ui`（新增） | `vitest run`（`vitest.config.ts`：`environment: 'jsdom'`，include `test/ui/**/*.test.tsx`） |
| `start` | 不变（`build` + `electron .`）；开发期另加 `dev:renderer`（`vite`，仅开发期）——设置 `SWUFE_RENDERER_URL=http://127.0.0.1:<port>` 时 Main 加载该 URL 并改用开发模式 CSP，否则加载 `dist/renderer/*.html` |

CSP 由 Vite 插件按模式注入 `transformIndexHtml`：生产构建注入严格策略（`script-src 'self'`；`style-src 'self' 'unsafe-inline'`），开发模式额外允许 dev server 源与 HMR WebSocket（仅开发期，不影响产物）。

## Architecture Impact

| 影响对象 | 是否变化 | 说明 | 需同步的文档 |
| -------- | -------- | ---- | ------------ |
| 组件/分层 | 是（组件边界） | `Telemetry UI` 由单窗口裸 DOM 变为「四窗口 React 渲染层 + Main 侧窗口注册表与日志缓冲」；单向依赖规则不变（渲染层仍是叶子） | [components.md](../../docs/architecture/components.md)、[ui-ux/](../../docs/ui-ux/README.md) |
| 数据流 | 是 | IPC 事件由「只发主窗口」变为「广播到全部窗口」；调试日志缓冲从渲染层移到 Main；窗口打开流程新增一条 Renderer → Main 的控制流 | [data-flow.md](../../docs/architecture/data-flow.md) |
| 接口 | 是（只增） | IF-001 新增 5 个命令方法；既有方法与事件不变 | [interfaces.md](../../docs/architecture/interfaces.md)、[api/electron-ipc.md](../../docs/api/electron-ipc.md) |
| 数据模型 | 否 | `userData/config.json`、`bridge-config.json`、会话存储均不变 | [data-model.md](../../docs/architecture/data-model.md)（无需改动） |
| 是否需要 ADR | 是 | 渲染层框架与多窗口结构属「核心技术栈改变」 | [ADR-0012](../../docs/architecture/adr/ADR-0012-react-antd-multiwindow-renderer.md) |
| 依赖策略 | 是 | 新增 8 个运行期/开发期依赖，含第二套测试运行器 | [dependency-policy.md](../../docs/development/dependency-policy.md) |
| 测试策略 | 是 | 新增渲染层组件测试层（vitest + jsdom）与 `test:ui` 脚本、CI 步骤 | [testing-strategy.md](../../docs/development/testing-strategy.md)、[.github/workflows/app-tests.yml](../../.github/workflows/app-tests.yml) |

## Components

| 组件 | 变更类型 | 职责变化 |
| ---- | -------- | -------- |
| Telemetry UI（渲染层） | 修改（重写） | 由「单窗口、裸 DOM、全量重绘」变为「四个 React 窗口、组件库控件、按窗口订阅状态」；职责边界不变（仍只经 preload 访问 Main，不持有 Cookie 明文，不直接调用 OS API） |
| Window Registry（Main，新增） | 新增 | 窗口创建/复用/聚焦/关闭与广播的唯一位置；纯策略函数可单测 |
| Debug Log Buffer（Main，新增） | 新增 | 最近 200 条日志的环形缓冲（最新在前），供日志窗口拉取与重开恢复 |
| App Shell（Main） | 修改 | 组合根注入窗口注册表；`ipc.ts` 广播面与日志开关副作用调整 |
| Proxy Orchestrator / Session Broker / Cert Manager / Allowlist Store | 不变 | 本 Spec 不触及（SNG-005） |
| Bridge Addon / WRD Codec | 不变 | 同上 |
| 构建链（Vite） | 新增 | 渲染层由 Vite 构建（多入口 + 共享 chunk），Main/preload 构建方式不变 |

## Data Flow

1. **启动**：Main 创建窗口注册表 → 创建主窗口（加载 `main.html`）→ 渲染层挂载后拉取 `getStatus` / `getSettings` / `getCaStatus` / `getAllowlist`。
2. **状态变化**：桥状态机变化或调试日志事件 → Main 写入日志缓冲（仅日志）→ `broadcast(channel, payload)` 到全部存活窗口 → 各窗口按需更新（主窗口状态条、捕获窗口状态行、日志窗口追加行）。
3. **打开二级窗口**：渲染层调用 `openCaptureWindow()` 等 → Main 查注册表：存在则 `focus()`，否则按参数创建窗口并 `loadFile` → 新窗口挂载后自行拉取初始状态（`getSettings` / `listCaptureCandidates` / `getDebugLogs` / `getAllowlist`）。
4. **日志开关关闭**：渲染层调用 `setDebugLogging(false)` → Main 持久化开关、清空日志缓冲、关闭日志窗口（若存在）→ 广播最新状态。
5. **失败与重试路径**：捕获枚举失败 → 捕获窗口显示原因与 [刷新列表]；进程捕获失败 → 主窗口与捕获窗口显示 `captureError` 与授权引导 + [重试]（重试即重新下发配置，语义与 001 一致）；渲染层异常 → 该窗口错误面板 + [重新加载窗口]。

## API Changes

| 接口 | 变更 | 兼容性 | 文档位置 |
| ---- | ---- | ------ | -------- |
| `openCaptureWindow(): Promise<void>` | 新增 | 兼容（新增） | [electron-ipc.md](../../docs/api/electron-ipc.md) |
| `openLogWindow(): Promise<void>` | 新增 | 兼容（新增） | 同上 |
| `openAllowlistWindow(): Promise<void>` | 新增 | 兼容（新增） | 同上 |
| `getDebugLogs(): Promise<DebugLogEvent[]>` | 新增（幂等只读；最新在前，≤200） | 兼容（新增） | 同上 |
| `clearDebugLogs(): Promise<void>` | 新增（幂等；清空 Main 环形缓冲，使日志窗口的 [清空] 在窗口重开后仍有效） | 兼容（新增） | 同上 |
| `setAllowlist(cfg)` | 语义补充：成功后 Main 再广播一次当前状态（各窗口据此重新读取 allowlist 摘要） | 兼容（既有「改动立即生效」的延伸） | 同上 |
| `setDebugLogging(enabled)` | 语义补充：`false` 时清空缓冲并关闭日志窗口 | 兼容（既有语义「关闭即清空」的延伸） | 同上 |
| `onStatus` / `onDebugLog` / `onSessionExpired` | 投递范围由主窗口改为**全部窗口** | 兼容（订阅方各自独立，现有主窗口行为不变） | 同上 |
| IF-002（Main ↔ sidecar）、IF-003、IF-004、IF-005、IF-006 | 无变化 | — | [interfaces.md](../../docs/architecture/interfaces.md) |

## Data Model Changes

无。`AllowlistConfig` / `AppSettings` / `SessionState` 的字段与持久化位置不变（[data-model.md](../../docs/architecture/data-model.md)）；调试日志缓冲是内存态，不落盘（NFR-003 不变），因此无迁移与回滚需求。

## UI/UX Changes

窗口清单、线框与文案见 [ui-ux.md](ui-ux.md)（本 Spec 的目标态），长期事实由 [docs/ui-ux/main-window.md](../../docs/ui-ux/main-window.md)（主窗口，需重写）与规划新增的 `docs/ui-ux/secondary-windows.md`（三个二级窗口）承载。要点：

- 主窗口固定 720×560 且零滚动（`resizable: false`）；信息层级仍为「状态 → 主操作 → 配置 → 诊断」，但长内容不再出现在主窗口。
- 三个二级窗口非模态、每类单实例；关闭主窗口即退出应用（现有行为）。
- 文案沿用既有约定（错误文案常量仍在 `src/main/constants.ts` 的 `ERROR_MESSAGES`），新增的捕获状态/空态/授权引导文案在 [ui-ux.md](ui-ux.md) 固定。
- 状态与错误不依赖颜色；关键控件键盘可达（AntD 控件 + 中文 `locale`）。

## Security Considerations

| 维度 | 影响 | 处理 |
| ---- | ---- | ---- |
| 信任边界（TB-003 Renderer ↔ Main） | IPC 面新增 5 个方法（窗口控制 3、日志缓冲 2：只读快照与清空）；事件投递面扩大 | 新方法只做窗口生命周期与只读缓冲读取，不新增数据读取权限（`getDebugLogs` 返回既有 `DebugLogEvent` 键集合）；渲染层仍无 Node 集成 |
| 认证 / 授权 | 无变化 | 登录仍在 Login WebView 内完成；不新增凭据路径 |
| 输入校验 | allowlist 主机名与捕获 pattern 校验仍在 Main（不变） | 渲染层只做入口提示，判定与校验仍在 `store.ts` / `ipc.ts` |
| 密钥 / 敏感数据 | 无新增敏感数据；日志缓冲进 Main 内存（≤200 条，不落盘） | 缓冲写入前仍只保留 `ts/host/rewritten/direction/detail`；`detail` 不含正文与 Cookie（INV-001 不变）；WRD key/IV 仍不跨 IPC |
| CSP / 渲染层攻击面 | antd 运行期注入样式 ⇒ `style-src` 放宽 `'unsafe-inline'` | 只放宽 `style-src`；`script-src 'self'`、`default-src 'none'` 不放宽；无远程资源（SC2-003）；放宽理由与残余风险记录在 [ADR-0012](../../docs/architecture/adr/ADR-0012-react-antd-multiwindow-renderer.md) |
| 依赖风险 | 新增 4 个运行期依赖树（react / react-dom / antd / @ant-design/icons）与 8 个开发期包（vite、@vitejs/plugin-react、vitest、jsdom、@testing-library/react、@testing-library/dom、@types/react、@types/react-dom） | 按 [dependency-policy.md](../../docs/development/dependency-policy.md) 记录版本、许可证（全部 MIT）、传递依赖与维护状态；全部离线打包，无 CDN |
| 错误边界 | 渲染层异常不得白屏或静默 | 每窗口 `ErrorBoundary` 显示中文错误与 [重新加载窗口]；错误信息不回显 Cookie/会话内容 |

相关长期事实见 [docs/security/README.md](../../docs/security/README.md)。

## Performance Considerations

| 项 | 预期 / 目标 | 说明与测量 |
| -- | ---------- | ---------- |
| 主窗口首屏 | 可交互 ≤ 1s（本地） | 四入口共享 chunk，按窗口 code split；测量方式：CDP 计时 `load` → 首次可点击（TC-J11） |
| 二级窗口打开 | ≤ 500ms（本地） | 复用同一 bundle 的共享 chunk；CDP 计时（TC-J11） |
| 日志推流 | 满速流量下主窗口仍可交互 | 事件在窗口侧 100ms 合并后渲染；每行固定高度、最多 200 行；不引入虚拟滚动（行数有上限） |
| 内存 | 4 个 renderer 进程（主 + 3 二级，按需创建） | 二级窗口按需创建且单实例；关闭即释放（TC-J02 顺带观察进程数） |
| bundle 体积 | 记录实际产物大小（无硬门禁） | AntD 6 支持按需引入；构建产物大小记入 [verification.md](verification.md) 的命令结果表 |

## Compatibility

| 维度 | 影响 | 处理 |
| ---- | ---- | ---- |
| 向后兼容（IPC） | 只增不改（SC2-006） | 新方法名不与既有冲突；preload 与 Main 同构建同版本（既有版本策略） |
| 数据兼容 | 无变化 | `config.json` / 会话存储格式不变，无需迁移 |
| 配置兼容 | 无变化 | 环境变量（`SWUFE_*`）与命令行参数（`--user-data-dir`）语义不变 |
| 运行环境 | 新增前端工具链的 Node engines 要求：vite 7 / plugin-react 5.2.0 需 `^20.19 \|\| >=22.12`、vitest 3 需 `>=22`、jsdom 26 需 `>=18` | 仓库 `engines.node >= 22` 与 CI（`node-version: 22`）满足；本机实测 Node 24.18.0。若 CI 固定到更低小版本，需同步调整（见 [plan.md](plan.md) §Dependencies） |
| 界面行为 | 用户可见变化：主窗口 720×640 → 720×560 且不可缩放；allowlist/捕获/日志移入二级窗口 | 明确记录；[docs/ui-ux/](../../docs/ui-ux/README.md) 与 001 的取代注记同步 |
| 平台 | macOS 实机验证；Windows 侧仍延后（001 `KI-001`） | 二级窗口与 antd 在 Windows 上的行为差异 `TBD`（沿既有延期结论） |

## Migration

- **持久化数据**：不适用（无数据模型变化）。
- **代码迁移**：一次性替换渲染层（`static/index.html`、`static/styles.css`、`src/renderer/renderer.ts` 删除），无兼容开关；顺序与可重入性见 [plan.md](plan.md) §Migration（先建新渲染层与窗口入口，再切 Main 加载路径，最后删旧实现）。
- **失败处理**：若 Vite 产物在 `file://` 下加载失败（资源路径问题），回退动作是把 `build.base` 固定为 `'./'` 并复核入口 HTML 的脚本引用；不引入运行时回退分支。

## Alternatives Considered

| 备选方案 | 优点 | 缺点 | 未采纳原因 |
| -------- | ---- | ---- | ---------- |
| 保留裸 TS 渲染层，只调整布局（把长内容挪进二级窗口） | 无新增依赖、迁移成本最低 | 手写 DOM 与全量重绘的维护成本继续累积；交互与可访问性仍需人工保证；不满足 SG-003 | 用户要求全面迁移到 React + Ant Design（2026-09-23） |
| 用 AntD `Modal` / `Drawer` 模拟「二级窗口」 | 实现最简单、无多窗口生命周期问题 | 不是真窗口：不能独立移动/缩放、无法与主窗口并行操作（与「挑选应用时主窗口仍可操作」的 US-202 冲突） | 用户明确要求放到二级窗口 |
| 单入口 + hash 路由（`index.html#/capture`） | 只需一个 HTML，入口更少 | 需自写 hash 分发或引入路由库（违反 SNG-001）；窗口加载同一 HTML，无法按窗口裁剪初始加载 | 多入口更贴合多 `BrowserWindow` 模型且允许按窗口 code split |
| React 18 + AntD 5（+ React 19 补丁包） | 生态更保守 | antd 6 已原生支持 React 19；再引入补丁包是多一个依赖 | 用户改选 Ant Design 6（2026-09-23） |
| antd `zeroRuntime` 静态样式提取，保持 `style-src 'self'` | CSP 更严格 | 多一步样式提取构建；动态主题/运行时 token 调整受限 | 用户已决定解锁 `style-src 'unsafe-inline'`（[spec.md](spec.md) SC2-004）；记录为可回退方向 |
| Playwright for Electron 做界面 E2E | 可自动断言多窗口与零滚动 | 依赖与 CI 成本高（本机 + CI 都需浏览器运行时） | 违反 SNG-006；改用 vitest 组件测试 + 既有 CDP 实机冒烟 |

## Risks

| ID | 风险 | 可能性 | 影响 | 缓解 | 对应任务 |
| -- | ---- | ------ | ---- | ---- | -------- |
| R2-001 | 主窗口在基线 720×560 内溢出（中文字体/内容增长），零滚动不可达 | 中 | 高（SG-001 的判据失效） | 紧凑 token + `componentSize="small"`；尺寸随内容缩放系数自适应；按 zoom 1.0/1.25/1.5 实测（EC2-009）；溢出即把内容再收进二级窗口（不加滚动） | T210、T219、T233 |
| R2-002 | AntD 6 运行期样式注入在严格 CSP 下被拦截（`style-src` 未放宽或与 dev 模式冲突） | 中 | 高（界面样式全丢） | 生产/开发两套 CSP 由 Vite 插件统一注入（本文件 §5）；TC-J10 断言 `script-src` 未放宽且样式生效 | T206、T231 |
| R2-003 | 日志缓冲迁到 Main 后广播频率升高，满速流量下多窗口重渲染造成卡顿 | 中 | 中 | 窗口侧 100ms 合并渲染；缓冲有上限（200）；实机压测（TC-J11） | T208、T214、T235 |
| R2-004 | 多窗口生命周期与既有退出清理（清系统代理）交互出错（例如二级窗口关闭触发 `window-all-closed` 路径） | 低 | 高（NFR-004） | 显式处理 `window-all-closed` 与主窗口 `closed`；`recoverOnLaunch()` 仍是兜底；实机验证关窗/退出三个路径（TC-J13） | T207、T234 |
| R2-005 | Vite/vitest 引入需要 pnpm 安装脚本审批（`allowBuilds`）或原生二进制 | 低 | 中（安装失败） | 选择 esbuild+rollup 路线（不引入 rolldown 系）；安装若报 `ERR_PNPM_IGNORED_BUILDS` 则按 dependency-policy §3.1 评审后显式列入 | T202、T240 |
| R2-006 | 001 的界面相关验收项（TC-H01/H02/B05/F04）在迁移后需重做，旧证据与当前实现不符 | 高（确定发生） | 中 | 本 Spec 重新执行这些用例并登记到 [verification.md](verification.md)；001 只加取代注记、不改历史证据 | T236、T238 |
| R2-007 | 四入口构建产物重复打包 antd，产物体积与内存上涨 | 中 | 低 | 共享 chunk（同一 `build.rollupOptions` 多入口）；二级窗口按需创建；记录产物大小 | T204、T235 |
| R2-008 | 组件测试与既有 node:test 两套运行器的边界失控（例如在 jsdom 中测不可测量的零滚动） | 中 | 低 | 明确分工：组件测试只覆盖可观察 UI 行为；零滚动/多窗口/时延由 CDP 实机断言；写入 [testing-strategy.md](../../docs/development/testing-strategy.md) | T215、T239 |

## Open Questions

| ID | 问题 | 影响 | 状态 |
| -- | ---- | ---- | ---- |
| DQ-001 | 二级窗口默认尺寸最终取值 | 排版与滚动行为 | Resolved（2026-09-23）：560×480 / 720×420 / 480×400 |
| DQ-002 | 开发期 dev server（HMR）是否落地 | 开发体验与开发期 CSP 分支 | Resolved（2026-09-23）：落地，仅开发期（`SWUFE_RENDERER_URL`） |
| DQ-003 | 日志合并窗口取值 | 满速流量下的交互流畅度 | Resolved（2026-09-23）：100ms；满 200 行且 > 50 条/秒 时 250ms |
