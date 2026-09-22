# Feature: 桌面界面重构（React + Ant Design 多窗口）

> Spec ID: 002
> Status: Implemented
> Owner: cherrchen
> Created: 2026-09-23
> Related: REQ-001 / REQ-003 / REQ-005 / REQ-009 / REQ-012 / NFR-003 / NFR-007 / [ADR-0003](../../docs/architecture/adr/ADR-0003-electron-gui-for-phase-1.md) / [ADR-0012](../../docs/architecture/adr/ADR-0012-react-antd-multiwindow-renderer.md)（Accepted）

> 本文件回答 **What / Why**：要解决什么问题、达成什么结果、如何判断达成。
> **不写**技术方案（→ [design.md](design.md)）、窗口线框（→ [ui-ux.md](ui-ux.md)）、任务拆解（→ [tasks.md](tasks.md)）。
> 本文中的 `SG-*` / `SNG-*` / `SNFR-*` / `SC2-*` / `EC2-*` / `Q2-*` / `AC2-*` 编号是**本 Spec 局部编号**；项目级目标（G-*）、非目标（NG-*）、需求（REQ-*、NFR-*）的定义仍在 [docs/overview/](../../docs/overview/goals-and-non-goals.md) 与 [docs/requirements/](../../docs/requirements/README.md)，本 Spec 只引用。

## Status

`Draft | Approved | In Progress | Implemented | Verified | Archived`

当前为 `Implemented`（2026-09-23）：[ADR-0012](../../docs/architecture/adr/ADR-0012-react-antd-multiwindow-renderer.md) 通过（`Accepted`）后实现开始并完成——渲染层迁移到 React 19 + Ant Design 6（Vite 多入口，四个入口 HTML + 共享 chunk），主窗口固定 720×560、`resizable: false`、严格零滚动，进程捕获应用选择 / 调试日志 / Allowlist 编辑进入非模态二级窗口（每类单实例），调试日志的最近 200 条环形缓冲移到 Main（`getDebugLogs` / `clearDebugLogs`）；IPC 面只增 5 个命令方法，既有 16 个命令与 3 个事件签名不变（事件改为广播到全部存活窗口）。[tasks.md](tasks.md) 的 T201..T242 全部完成，[verification.md](verification.md) 记录了全量回归与 macOS 实机验收结果（可机器执行部分全部通过）。

未推进到 `Verified` 的原因（与 001 的遗留一致，登记在 [verification.md](verification.md) 的「未验证 / 无法验证项」）：Windows 真机（`KI-001`）、真实 CAS/MFA 会话下的教务页面操作、进程捕获的系统扩展授权后的真实范围。本 Spec 的范围是**渲染层与窗口结构**：桥（`bridges/python/`）、sidecar、系统代理、CA、会话与改写语义均不变；界面之外的行为回归由既有 L0/L1/L2 与 App 单测保护。

## Background

Phase 1（[001-phase1-local-bridge](../001-phase1-local-bridge/spec.md)）已交付到 `Implemented`：Electron 外壳、登录 WebView、Session Broker、Proxy Orchestrator、Cert Manager、Allowlist Store 与侧车桥均已实机可用。界面部分（`Telemetry UI`）自 M2 起是**裸 TypeScript 直接操作 DOM** 的实现：`apps/desktop/src/renderer/renderer.ts` + `apps/desktop/static/index.html` + `apps/desktop/static/styles.css`，由 `tsc` 编译、`index.html` 以 `<script type="module">` 加载；渲染层无任何运行时依赖、无组件库、无打包器。

M3 加入「捕获方式 / 候选应用列表 / 调试日志面板」后，主窗口（当前 720×640，`minWidth 560` / `minHeight 520`，内容可滚动）同时承载了四类不同节奏的内容：状态与主操作（秒级交互）、配置（allowlist、捕获方式）、长列表（候选应用动辄数百行、日志 200 条）与诊断信息。长期事实与界面约定见 [docs/ui-ux/main-window.md](../../docs/ui-ux/main-window.md)；相关决策见 [ADR-0003](../../docs/architecture/adr/ADR-0003-electron-gui-for-phase-1.md)（Electron 外壳）、[ADR-0006](../../docs/architecture/adr/ADR-0006-local-capture-mode-and-mutual-exclusion.md)（进程捕获与系统代理互斥）。

本 Spec 记录一次**全面前端迁移**：渲染层改为 React + Ant Design（[ADR-0012](../../docs/architecture/adr/ADR-0012-react-antd-multiwindow-renderer.md)），主窗口固定为 720×560 且**不出现滚动**，把三类长内容（进程捕获的应用选择、调试日志、Allowlist 编辑）移入各自的二级窗口。

## Problem

1. **主窗口被长列表淹没**：候选应用列表与日志面板都在主窗口内，用户开桥/看状态（高频动作）必须滚动才能到达，信息层级（状态 → 主操作 → 配置 → 诊断）被内容长度破坏（REQ-001、REQ-009）。
2. **裸 DOM 渲染层已接近维护上限**：`renderer.ts` 约 498 行，状态分散在 `status` / `caStatus` / `settings` / `allowlist` / `candidates` / `logRows` 六个模块级变量，靠 `render()` + `renderXxx()` 全量重写 DOM 与手动 `refresh()` 收敛；新增一个控件要同时改 HTML、CSS、事件绑定与渲染函数，漏渲染无法被类型系统发现。
3. **无组件与交互约定**：每个控件（复选框列表、开关、模态、表格）都手写 DOM 与样式，可访问性属性（`role` / `aria-live` / 键盘可达）靠人工保证，新增控件无法复用既有行为（NFR-007 的中文文案与状态一致性要求只能靠人工核对）。
4. **不做的影响**：后续任何界面需求（暗色主题、托盘、更多设置项）都要在同样的手写路径上叠加，界面越改越难回归；同时「状态可见」这一体验目标（[G-002](../../docs/overview/goals-and-non-goals.md)）会继续被滚动与信息密度削弱。

## Goals

> 本 Spec 的局部目标（`SG-*`）。项目级目标 G-001..G-004 的定义与成功判据在 [goals-and-non-goals.md](../../docs/overview/goals-and-non-goals.md)，本表只映射关系。

| ID | 目标 | 映射 | 成功判据 |
| -- | ---- | ---- | -------- |
| SG-001 | 主窗口在固定小窗口内**一屏承载全部高频内容**：状态、登录、桥开关、捕获方式选择、allowlist 摘要、CA 操作、调试日志开关，且不出现滚动条 | G-002 | AC2-001、AC2-002 |
| SG-002 | 长内容进二级窗口：进程捕获的应用选择、调试日志、Allowlist 编辑各有独立窗口，且与主窗口状态实时一致 | G-002 | AC2-003..AC2-008 |
| SG-003 | 渲染层迁移到组件化栈（React + Ant Design），交互与可访问性由组件库与类型系统保证，替换手写 DOM 与全量重绘 | G-004 | AC2-012 与 design.md 的构建/测试方案落地 |
| SG-004 | 迁移**不改变任何界面之外的行为**：桥、代理、CA、会话、改写、配置持久化语义与既有验证矩阵保持一致 | G-003 | AC2-009、AC2-011 |

## Non-goals

> 项目级非目标 NG-001..NG-008 仍有效（见 [goals-and-non-goals.md](../../docs/overview/goals-and-non-goals.md)）；下表是本 Spec 追加的**局部非目标**（`SNG-*`）。

| ID | 非目标 | 原因 |
| -- | ------ | ---- |
| SNG-001 | 不引入路由/全局状态库（React Router、Redux、Zustand 等） | 窗口数固定为 4，状态权威仍在 Electron Main（经 preload IPC），引入第二套状态源会制造双真相 |
| SNG-002 | 不做暗色主题 / 主题切换 | 沿用 [ui-ux/main-window.md](../../docs/ui-ux/main-window.md) 的开放问题；本 Spec 只固定亮色默认主题 |
| SNG-003 | 不做托盘图标、多语言（英文界面）、打包与分发形态变更 | 均属既有开放项或其它里程碑（M5 开源准备候选） |
| SNG-004 | 不改变 IPC 数据面语义（`BridgeStatus` / `AllowlistConfig` / `DebugLogEvent` 等既有类型与字段含义不变） | 本 Spec 只新增窗口控制方法与日志缓冲读取，见 [design.md](design.md) §API Changes |
| SNG-005 | 不改动桥与 sidecar（`bridges/python/`）、系统代理、CA、会话与改写逻辑 | 迁移收益来自渲染层；越界改动会稀释回归证据 |
| SNG-006 | 不做界面自动化 E2E 框架（Playwright 等） | 依赖与 CI 成本高；本次用 vitest 组件测试 + 既有 CDP 实机冒烟（见 AC2-011） |

## User Stories

| ID | 角色 | 我想要 | 以便 | 优先级 |
| -- | ---- | ------ | ---- | ------ |
| US-201 | 西财师生 | 打开应用就在一个小窗口里看到状态与主操作（登录、开桥），不需要滚动 | 一眼判断「现在能不能用」，并立刻动作 | Must |
| US-202 | 西财师生 | 在独立窗口里挑要捕获的应用，挑选时主窗口仍可操作 | 长列表不影响开桥/看状态，选完即可继续 | Must |
| US-203 | 西财师生 | 在独立窗口里看调试日志（时间 / 域名 / 结果），随时开关 | 排障时能对照流量，且界面不被日志淹没 | Must |
| US-204 | 西财师生 | 在独立窗口里编辑 allowlist（增删主机、`*.swufe.edu.cn` 通配） | 主机多的时候不挤压主窗口 | Must |

## Functional Requirements

> 规范定义（描述、验收标准、边界）在 [docs/requirements/functional-requirements.md](../../docs/requirements/functional-requirements.md)；本表只引用 ID 并注明本 Spec 改变了该需求的哪一部分。
> REQ-012 为本 Spec 新增，已登记到需求文档（见 [plan.md](plan.md) §Documentation Updates）。

| ID | 需求（摘要） | 本 Spec 的影响 | 优先级 | 来源 |
| -- | ------------ | -------------- | ------ | ---- |
| REQ-001 | Electron 应用外壳（登录窗、连接开关、捕获方式选择、allowlist 管理、状态区、CA 安装/卸载、调试日志开关与日志面板） | 界面结构改为四窗口（主窗口 + 捕获/日志/allowlist 二级窗口）；能力集合不变 | Must | 既有需求（Accepted） |
| REQ-003 | 流量接管：`system-proxy` 与 `selected-apps` 两种捕获方式互斥 | 方式选择仍在主窗口（一级），**应用选择**移入捕获二级窗口；互斥与切换语义、错误码不变 | Must | 既有需求（Accepted） |
| REQ-005 | Allowlist 路由（默认含 `jwxt.swufe.edu.cn`、可增删、可选 `*.swufe.edu.cn`） | 编辑界面移入 allowlist 二级窗口；主窗口显示摘要；匹配与持久化语义不变 | Must | 既有需求（Accepted） |
| REQ-009 | 可观测性：状态可见 + 调试日志（时间 / 域名 / 结果，≤200 条，默认关，不含正文与 Cookie） | 日志面板改为**日志二级窗口**；日志缓冲从渲染层移到 Main（关闭窗口不丢历史）；开启/关闭开关的语义（关闭即清空）不变 | Should | 既有需求（Accepted） |
| REQ-012 | 多窗口界面结构（主窗口固定小尺寸零滚动；长内容进二级窗口；每类窗口单实例复用；窗口随主窗口退出） | 本 Spec 的全部界面结构由该需求定义 | Must | 本 Spec 新增 |

## Non-functional Requirements

> 既有 NFR 的表只引用；`SNFR-*` 为本 Spec 局部非功能要求。

| ID | 类别 | 要求 | 判据 |
| -- | ---- | ---- | ---- |
| NFR-003 | security | 不存密码；调试日志默认关且不含正文/Cookie | 日志窗口与 Main 环形缓冲中的记录键集合仍固定为 `ts/host/rewritten/direction/detail`，`detail` 不含正文与 Cookie（TC-J05 复核；沿用既有 TC-F04 的自动化部分） |
| NFR-005 | usability | 安装 CA 前必须展示风险提示 | 风险提示改为 Ant Design 模态，文案与 [ui-ux/main-window.md](../../docs/ui-ux/main-window.md) 一致，取消后无任何 OS 动作（TC-J08） |
| NFR-007 | usability | 界面与文案中文优先 | 全部窗口文案为中文（含 Ant Design `zh_CN` locale 的内置文案）（TC-J09） |
| SNFR-001 | usability | 主窗口在 720×560 且不可缩放下**零滚动**：无页面级滚动条，也无内部滚动区域被触发 | CDP 断言 `document.scrollingElement.scrollHeight ≤ clientHeight` 且文档内无可滚动溢出元素（TC-J01） |
| SNFR-002 | usability | 二级窗口每类同一时刻最多一个；重复触达入口时聚焦已有窗口而不新开 | 点击入口两次后 `BrowserWindow.getAllWindows()` 中该类窗口数量恒为 1（TC-J02） |
| SNFR-003 | usability | 状态与错误不依赖颜色，且关键控件键盘可达（按钮/开关/单选可用键盘操作与聚焦） | 手动检查：状态条有文字状态名、错误行有文字与错误码；Tab 可依次聚焦全部交互控件（TC-J09） |
| SNFR-004 | security | 渲染层保持同一隔离级别：`sandbox: true` + `contextIsolation: true`，无 Node 集成，仅经 preload 访问 Main；CSP 仅在 `style-src` 放宽 | 四个窗口的 `webPreferences` 检查 + 渲染层源码不含 `require(` / `process.` / `electron` 直接引用；`index.html` 的 CSP 中 `script-src 'self'` 未放宽（TC-J10） |
| SNFR-005 | performance | 二级窗口从点击到可见 ≤ 500ms；日志窗口在满 200 行且持续推流时保持可交互（不阻塞主窗口交互） | 本地实测：CDP 计时窗口创建到 `load` 完成；日志推流场景下主窗口仍可点击开桥。渲染合并取值（2026-09-23 决定）：常规 100ms，满 200 行且 > 50 条/秒 时降为 250ms（TC-J11） |

## Constraints

> 项目级约束 C-001..C-004 见 [docs/architecture/overview.md](../../docs/architecture/overview.md)；下表为本 Spec 的交付约束（`SC2-*`）。

| 约束 | 来源 | 影响 |
| ---- | ---- | ---- |
| SC2-001 主窗口基线 720×560（DIP）且**不可由用户拖拽缩放**（`resizable: false`）；尺寸只随内容缩放系数（`zoomFactor`）按比例自适应并 clamp 到工作区 | 用户决定（2026-09-23：720×560 固定 + 内容缩放自适应） | 布局必须在基线尺寸内一次排定；尺寸变化只来自缩放系数，任何新增内容仍须先回答「放主窗口还是二级窗口」 |
| SC2-002 主窗口严格零滚动 | 用户决定（2026-09-23）、SG-001 | 溢出不是可接受结果：溢出即视为布局缺陷（SNFR-001 的断言即门禁） |
| SC2-003 渲染层必须完全离线可用（无 CDN、无远程字体/图标） | 现有 CSP `default-src 'none'`、[security/README.md](../../docs/security/README.md) TB-003 | React / Ant Design / 图标全部随包分发；禁止运行时外联 |
| SC2-004 Ant Design 运行期样式注入要求 CSP 放宽 `style-src` | 用户决定（2026-09-23，[ADR-0012](../../docs/architecture/adr/ADR-0012-react-antd-multiwindow-renderer.md)） | 仅 `style-src` 加 `'unsafe-inline'`；`script-src 'self'`、`default-src 'none'`、`img-src` 不放宽 |
| SC2-005 状态权威仍在 Electron Main；渲染层不做业务判定 | 现有架构（[components.md](../../docs/architecture/components.md) 单向依赖规则） | 四个窗口各自订阅 IPC 事件并拉取初始状态；窗口之间不共享内存、不互相读写 |
| SC2-006 preload 与 IPC 面**只增不改**（新增方法向后兼容） | [docs/api/electron-ipc.md](../../docs/api/electron-ipc.md) §兼容性策略（IF-001） | 既有 16 个命令方法与 3 个事件签名不变；新增窗口控制方法与日志缓冲读取 |
| SC2-007 新增前端依赖按 [dependency-policy.md](../../docs/development/dependency-policy.md) 逐项记录；引入第二套测试运行器（vitest）需 ADR | dependency-policy §1「禁止引入第二套功能等价的依赖」 | React/AntD/Vite/vitest 的版本、许可证、风险记录进 dependency-policy；理由进 ADR-0012 |
| SC2-008 迁移为 clean cutover：`static/index.html`、`static/styles.css`、`src/renderer/renderer.ts` 在迁移完成后删除 | 仓库工程约定（不留双实现） | 旧渲染层不保留开关或回退分支；回退依赖版本控制（见 [plan.md](plan.md) §Rollback） |

## Edge Cases

| ID | 场景 | 期望行为 |
| ---- | ---- | -------- |
| EC2-001 | 某二级窗口已打开，用户再次点击其入口（如再次点「选择应用…」） | 不新开窗口；聚焦并前置已有窗口（SNFR-002） |
| EC2-002 | 调试日志开关被关闭时日志窗口正开着 | 日志窗口自动关闭，Main 环形缓冲清空；再次开启时窗口重新打开且列表为空 |
| EC2-003 | 日志窗口/捕获窗口在前台时发生会话过期或代理冲突 | 模态在主窗口呈现并聚焦主窗口；二级窗口不阻塞、不关闭，其状态经 IPC 广播刷新为过期/错误态 |
| EC2-004 | 用户关闭主窗口 | 应用退出（现有行为，`mainWindow.on('closed') → app.quit()`），所有二级窗口随进程退出；退出清理（清系统代理）仍执行（NFR-004 不变） |
| EC2-005 | 捕获方式从「指定应用」切回「系统代理」时捕获窗口开着 | 窗口保留；内容显示「当前捕获方式为系统代理，进程捕获未启用」，应用勾选仍可查看与修改（落盘、不生效） |
| EC2-006 | 候选应用枚举失败或返回空列表 | 捕获窗口显示空态与失败原因（不阻塞主窗口）；提供 [刷新列表] 重试 |
| EC2-007 | 调试日志超过 200 条 | Main 环形缓冲丢弃最旧记录；日志窗口始终只显示最新 200 条（最新在前） |
| EC2-008 | 渲染层某窗口组件抛错 | 该窗口显示中文错误面板与 [重新加载窗口] 按钮，不白屏；其它窗口与 Main 不受影响 |
| EC2-009 | 用户放大界面内容（浏览器缩放 / 后续的界面缩放入口，`zoomFactor` > 1）或系统字号导致内容变大 | 主窗口尺寸随内容缩放系数按比例增大（clamp 到当前显示器工作区），内容不溢出、不出现滚动条；若 clamp 后工作区仍不足以容纳放大后的窗口，则依次外移内容（系统代理状态行 → 捕获方式状态行 → allowlist 摘要行），**不得**用滚动兜底 |
| EC2-010 | 未登录时点击捕获窗口入口 | 允许打开（列表只读呈现，勾选可保存但不生效）；开桥仍由主窗口开关与既有错误码 `NOT_LOGGED_IN` 约束（不变） |

## Out of Scope

- 暗色主题与主题切换（SNG-002）
- 托盘图标（沿用 [ui-ux/main-window.md](../../docs/ui-ux/main-window.md) Q1）
- 英文界面与 i18n（SNG-003；NFR-007 中文优先不变）
- 打包、签名、分发形态（M5 候选）
- 桥 / sidecar / 代理 / CA / 会话 / 改写逻辑的任何行为变化（SNG-005）
- `BridgeStatus`、`AllowlistConfig`、`DebugLogEvent` 等既有 IPC 类型的字段语义变化（SNG-004）
- 界面自动化 E2E 框架（SNG-006）
- Windows 侧真机验收（仍延后，见 001 的 `KI-001`）；本 Spec 的实机验证在 macOS 执行

## Open Questions

| ID | 问题 | 影响 | 状态 | 阻塞实现？ |
| -- | ---- | ---- | ---- | ---------- |
| Q2-001 | 三个二级窗口的默认尺寸与最小尺寸最终取值 | 二级窗口的排版与滚动行为 | Resolved（2026-09-23）：捕获 560×480、日志 720×420、allowlist 480×400，均可缩放且 min = 默认（见 [ui-ux.md](ui-ux.md)） | No |
| Q2-002 | 开发期是否启用 Vite dev server（HMR） | 开发体验与 CSP/加载路径的额外分支（生产仍为静态构建） | Resolved（2026-09-23）：**启用**，仅开发期加载 dev server URL 并按开发模式放宽 CSP（见 [design.md](design.md) §5） | No |
| Q2-003 | 内容缩放（字号/界面缩放）导致主窗口装不下时的处置口径 | 主窗口尺寸与内容取舍 | Resolved（2026-09-23）：窗口尺寸随**内容缩放系数**（`zoomFactor`，默认 1.0）按比例自适应并 clamp 到工作区，仍零滚动；工作区不足以容纳时依次外移内容（不按显示器 `scaleFactor` 换算，见 [design.md](design.md) §2） | No |
| Q2-004 | 日志推流的渲染合并窗口取值 | SNFR-005 的性能判据 | Resolved（2026-09-23）：常规 100ms 合并；满 200 行且持续推流（> 50 条/秒）时降为 250ms 节流 | No |

## Acceptance Criteria

> 每条必须可验证，并与 [verification.md](verification.md) 的矩阵一一对应。
> 本 Spec 的实机验收在 macOS 执行（Windows 侧仍沿 001 的延期结论）；需要人的动作（CAS/MFA 登录、管理员密码、系统扩展授权）由测试者本人完成。

- [ ] AC2-001：当应用启动时，主窗口应为不可拖拽缩放的基线 720×560（DIP）窗口；在内容缩放系数 1.0 / 1.25 / 1.5 下窗口尺寸按同一比例自适应并 clamp 到工作区，且页面与任何内容区域都不出现滚动条（SNFR-001 / SC2-001 / SG-001；TC-J01）
- [ ] AC2-002：主窗口应一屏显示且仅显示——状态条、[登录/重新登录] 与桥接开关、捕获方式单选与进程捕获状态行（含 [选择应用…]）、allowlist 摘要（主机数 + 通配状态，含 [管理…]）、CA 状态与 [安装/卸载本机 CA]、系统代理状态一行、调试日志开关、消息行（REQ-001 / REQ-012；TC-J03）
- [ ] AC2-003：当用户点击 [选择应用…] 时，应打开捕获窗口，显示进程捕获状态、macOS 授权引导（仅失败时）与 [重试]、应用筛选框、[刷新列表] 与「一行一个应用」的复选框列表，并回显已保存的勾选（REQ-003 / REQ-012；TC-J04）
- [ ] AC2-004：当用户在捕获窗口勾选/取消应用时，勾选应立即下发与落盘（无需重启、无需重开桥），且主窗口状态行与捕获窗口计数随之更新（REQ-003；TC-J04）
- [ ] AC2-005：当调试日志开关打开时，日志窗口应出现并按「时间 | 域名 | 结果」三列显示记录（最新在前，最多 200 条）；关闭开关时日志窗口自动关闭且记录清空（REQ-009；TC-J05）
- [ ] AC2-006：当日志窗口被关闭后重新打开（开关仍为开）时，应显示 Main 进程保留的最近记录（≤200 条），不因窗口关闭而丢失（REQ-009；TC-J06）
- [ ] AC2-007：当用户在 allowlist 窗口增删主机或切换 `*.swufe.edu.cn` 通配时，改动应立即生效并在重启应用后保留，主窗口摘要随之刷新（REQ-005；TC-J07）
- [ ] AC2-008：当用户重复点击任一二级窗口入口时，同一类窗口在系统中最多存在一个实例（再次点击聚焦已有窗口）（REQ-012 / SNFR-002；TC-J02）
- [ ] AC2-009：当发生会话过期、代理冲突或 CA 安装前风险提示时，模态应在主窗口呈现，文案与既有约定一致，且级联动作（停桥、清系统代理、停进程捕获、会话过期后要求重登）与迁移前一致（REQ-002 / REQ-004 / REQ-010 / NFR-005；TC-J08）
- [ ] AC2-010：IPC 面在迁移后向后兼容：既有 16 个命令方法与 3 个事件（`onStatus` / `onDebugLog` / `onSessionExpired`）的签名与语义不变，仅新增窗口控制方法与日志缓冲读取（SC2-006；TC-J12）
- [ ] AC2-011：界面之外的行为无回归：`pnpm --filter swufe-webvpn-bridge run test:unit`、`test:ui`、`typecheck`、`build` 与 `uv run --directory bridges/python pytest -q` 全绿，且 macOS 实机冒烟（登录 → 开桥 → 浏览器访问 allowlist 主机 → 关桥 → 退出无残留系统代理）通过（SG-004；TC-J13）
- [ ] AC2-012：渲染层保持隔离级别：四个窗口 `sandbox: true` + `contextIsolation: true`、无 Node 集成，渲染层仅经 preload 访问 Main；CSP 仅 `style-src` 放宽为 `'self' 'unsafe-inline'`，`script-src` 仍为 `'self'`（SNFR-004 / NFR-003；TC-J10）
- [ ] AC2-013：所有窗口文案为中文，状态与错误不依赖颜色，关键控件可键盘操作（NFR-007 / SNFR-003；TC-J09）
