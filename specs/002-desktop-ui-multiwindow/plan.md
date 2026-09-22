# Implementation Plan: 桌面界面重构（React + Ant Design 多窗口）

> Spec ID: 002
> Status: Implemented
> Owner: cherrchen
> Last Updated: 2026-09-23

> 本文件回答 **怎么做、按什么顺序做、怎么退回去**。
> 依赖 [spec.md](spec.md)（What/Why）、[design.md](design.md)（How）与 [ui-ux.md](ui-ux.md)（线框）；任务级拆解在 [tasks.md](tasks.md)。

## Strategy

总体策略：**先把工具链与窗口骨架立起来并保持应用可运行，再扩 Main 侧窗口管理，然后逐窗口对齐功能，最后清理旧实现并做回归**。每一步都保持「应用能启动、桥链路不受影响」这一不变量——本 Spec 的界面之外行为零变化（[spec.md](spec.md) SG-004），因此任一步失败都可以停在可用状态。

排序依据：

1. **界面是叶子**：渲染层只经 preload 调用 Main（[components.md](../../docs/architecture/components.md) 单向依赖规则），因此先建新渲染层骨架不会阻塞或改变桥链路；旧渲染层在 Phase 4 之前一直可运行。
2. **窗口结构先于窗口内容**：Main 侧窗口注册表与 IPC 扩展（Phase 2）是四个窗口的共同前置；在没有注册表时做窗口 UI 会产生重复劳动。
3. **零滚动是最后收敛的约束**：它依赖真实字体与缩放（EC2-009），只能在四个区块内容齐备后按实测定稿（Phase 3 末 + Phase 5 实测），提前固定会反复返工。
4. **旧实现一次性删除**（clean cutover，[spec.md](spec.md) SC2-008）：不保留兼容开关，避免双实现并存期间的状态双源。
5. **回归证据优先复用既有矩阵**：非界面行为的回归直接跑既有 App 单测与 L0/L1/L2，界面部分新增 TC-J01..TC-J13（含复用 TC-H01/H02/B05/F04 的重跑）。

## Phases

### Phase 1 工具链与渲染层骨架

- 目标：Vite + React + Ant Design 就位，四个入口 HTML 可构建与加载，应用能以新主窗口启动。
- 交付物：依赖与锁文件、`apps/desktop/vite.config.ts`、`src/renderer/{*.html,entry,lib}` 骨架、`tsconfig.renderer.json` 与 npm scripts 调整、开发期 dev server（`dev:renderer` + `SWUFE_RENDERER_URL`，仅开发期）、Main 加载新主窗口（基线 720×560，`resizable: false`，尺寸随内容缩放系数自适应）。
- 退出条件：`pnpm --filter swufe-webvpn-bridge run build` 产出四个入口 HTML 与共享 chunk；`pnpm start` 显示新主窗口骨架；`typecheck` 无 error。

### Phase 2 Main 侧窗口管理与 IPC 扩展

- 目标：窗口注册表、日志环形缓冲与新增 IPC 面可用（其余窗口尚未填充内容）。
- 交付物：`window-policy.ts`（纯策略 + 单测）、`window-registry.ts`、`debug-log-buffer.ts`（+ 单测）、`ipc.ts`（4 个新方法、广播到全部窗口、日志开关副作用）、`preload` 与 `shared/types.ts` 增补、渲染层 hooks 与日志批处理。
- 退出条件：`test:unit` 全绿（新增窗口策略与缓冲用例）；实机可用 `openCaptureWindow()` 打开空白二级窗口，重复调用不新开；`getDebugLogs()` 返回 Main 缓冲。

### Phase 3 四窗口功能对齐

- 目标：主窗口全部区块 + 捕获/日志/allowlist 三窗口功能与既有行为对齐，模态迁移到 AntD。
- 交付物：`windows/main/*`、`windows/capture/*`、`windows/logs/*`、`windows/allowlist/*`；组件测试（`test/ui/**`）；主窗口零滚动布局收敛。
- 退出条件：AC2-002..AC2-008 手工可验；`test:ui` 全绿；主窗口在内容缩放系数 1.0 / 1.25 / 1.5 下满足 TC-J01 的断言（含窗口尺寸随比例变化）。

### Phase 4 清理与文档同步

- 目标：删除旧渲染层，长期文档与需求同步到新事实。
- 交付物：删除 `apps/desktop/static/`、`src/renderer/renderer.ts`；更新 `apps/desktop/README.md`、[docs/ui-ux/](../../docs/ui-ux/README.md)（主窗口重写 + 二级窗口新增）、[docs/architecture/](../../docs/architecture/README.md)（components / interfaces / data-flow）、[docs/api/electron-ipc.md](../../docs/api/electron-ipc.md)、[docs/development/](../../docs/development/README.md)（dependency-policy / testing-strategy）；001 加取代注记。
- 退出条件：仓库内无旧渲染层引用；`pnpm run docs:check` 0 error / 0 warning；`pnpm run spec:check` 无 error。

### Phase 5 验证与回归

- 目标：界面与非界面行为都有回归证据，Spec 可推进到 `Implemented`。
- 交付物：[verification.md](verification.md) 的结果表（命令与实机观察）、CI 增加 `test:ui` 步骤、macOS 实机 CDP 验收与冒烟记录。
- 退出条件：AC2-001..AC2-013 全部有 `Passed` 或明确 `N/A`；非界面回归（App 单测 + L0/L1/L2 + typecheck + build）全绿；无阻塞类缺陷（已知问题登记到 `known-issues.md`）。

## Dependencies

| 依赖项 | 类型 | 阻塞内容 | 解除条件 |
| ------ | ---- | -------- | -------- |
| [ADR-0012](../../docs/architecture/adr/ADR-0012-react-antd-multiwindow-renderer.md) 已评审通过（`Accepted`，2026-09-23） | 决策 | 依赖选型与多窗口结构落地（Phase 1 起） | 已满足；若实现中发现结论需变，按 ADR 规则新建 ADR 取代 |
| 前端依赖可安装且许可证合规 | 外部 | Phase 1 全部任务 | `pnpm install --frozen-lockfile` 通过；无 `ERR_PNPM_IGNORED_BUILDS`（否则按 dependency-policy §3.1 审批） |
| Node 版本满足新工具链（vite 7 需 `^20.19 \|\| >=22.12`，vitest 3 需 `>=22`） | 外部 | `build` / `test:ui` | 本机 Node ≥ 22.12（实测 24.18.0）；CI `node-version: 22` 解析到 ≥ 22.12 |
| Main 侧窗口注册表（T210） | 内部 | 三个二级窗口的全部 UI 任务 | T209/T210 通过单测并实机可开空白窗口 |
| 日志缓冲迁至 Main（T211） | 内部 | 日志窗口（T224）与 AC2-006 | T211 单测通过且 `getDebugLogs()` 可用 |
| 主窗口零滚动定稿依赖真实字体与缩放实测（Q2-003） | 决策 | AC2-001 的收敛 | 100%/125%/200% 三档实测通过，或按实测把溢出内容再收进二级窗口 |
| macOS 测试机 + 真实 WebVPN 账号（沿用 001 的既有前置） | 外部 | Phase 5 的 TC-J01/J04/J05/J07/J13 中需要真实链路的项 | 环境与账号就绪；不需要管理员密码的项目可先行（TC-J01/J02/J03/J06/J09/J10/J11/J12） |

## Migration

不涉及持久化数据迁移（[design.md](design.md) §Data Model Changes）。代码迁移顺序：

1. Phase 1 建新渲染层与入口，Main 切到新主窗口加载路径（旧 `static/index.html` 仍在仓库中但不再被加载）；
2. Phase 2/3 补齐窗口与功能；
3. Phase 4 删除旧渲染层（`static/`、`src/renderer/renderer.ts`）与其构建配置（`tsconfig.renderer.json` 的旧编译产物路径、`static` 引用）。

可重入性：每步都是幂等的文件替换；中断在第 1 步不会破坏既有行为（旧文件仍在，可临时把加载路径改回）。失败处理：若 Vite 产物在 `file://` 下加载失败，先把 `base` 固定为 `'./'` 并复核入口 HTML 引用，再继续；不引入运行时回退分支。

## Rollback

| 场景 | 回滚动作 | 影响范围 | 验证回滚成功的方式 |
| ---- | -------- | -------- | ------------------ |
| Phase 1–3 期间新渲染层不可用（阻塞开发） | 把 Main 的窗口加载路径改回 `static/index.html`（该文件在 Phase 4 之前未被删除） | 仅界面；桥链路不受影响 | `pnpm start` 显示旧界面，主窗口功能可用（TC-J13 的冒烟子集） |
| Phase 4 之后需要整体回退 | 以版本控制回退本 Spec 的变更提交（旧渲染层文件随之恢复） | 界面 + 构建配置 | 回退后 `build` / `start` / `test:unit` 全绿，实机界面回到迁移前形态 |
| 依赖或工具链引入不可接受的问题（R2-005） | 回退 `package.json` / 锁文件的依赖变更，回到 tsc 编译渲染层的旧方式 | 构建链 | `pnpm install --frozen-lockfile` + `build` 通过 |
| 界面之外的行为出现回归 | 不改界面，按既有 `known-issues.md` 流程定位（桥/代理/CA/会话路径未被本 Spec 触及，优先怀疑环境） | 视缺陷而定 | 对应 TC（TC-C03/C04、TC-D03、TC-E01..E03）复跑 |

无残留状态需要清理：本 Spec 不写任何新的持久化数据、不改系统代理/CA/会话。

## Documentation Updates

| 文档 | 需要的更新 | 何时更新 | 负责人 |
| ---- | ---------- | -------- | ------ |
| [docs/requirements/functional-requirements.md](../../docs/requirements/functional-requirements.md)（+ `.en.md`） | 新增 `REQ-012`（多窗口界面结构）并登记索引；REQ-001 / REQ-003 / REQ-005 / REQ-009 加「界面部分见 REQ-012」的边界说明 | **本 Spec 建立时（已同步）** | cherrchen |
| [docs/architecture/adr/ADR-0012-*.md](../../docs/architecture/adr/ADR-0012-react-antd-multiwindow-renderer.md)（+ `.en.md`）与 [ADR 索引](../../docs/architecture/adr/README.md)（+ `.en.md`） | 新建 ADR（`Proposed`）并登记索引 | **本 Spec 建立时（已同步）** | cherrchen |
| [docs/planning/roadmap.md](../../docs/planning/roadmap.md)（+ `.en.md`）与 [milestones/](../../docs/planning/milestones/README.md)（+ `.en.md`） | 新增 M6 阶段行、Spec 索引 002 行、里程碑清单 M6 行、`M6-ui-rework.md`（+ `.en.md`） | **本 Spec 建立时（已同步）** | cherrchen |
| [specs/README.md](../README.md)（+ `.en.md`） | Spec 索引新增 002 行 | **本 Spec 建立时（已同步）** | cherrchen |
| [001-phase1-local-bridge/spec.md](../001-phase1-local-bridge/spec.md) 与 [verification.md](../001-phase1-local-bridge/verification.md) | 加「界面部分被 002 取代」注记（保留历史证据，不改结论） | **本 Spec 建立时（已同步）** | cherrchen |
| [docs/ui-ux/main-window.md](../../docs/ui-ux/main-window.md)（+ `.en.md`） | 重写：720×560 固定零滚动主窗口、四窗口信息层级、状态与文案表更新 | Phase 4 | cherrchen |
| `docs/ui-ux/secondary-windows.md`（新增，+ `.en.md`）与 [docs/ui-ux/README.md](../../docs/ui-ux/README.md)（+ `.en.md`） | 新增二级窗口文档（捕获 / 日志 / Allowlist）并登记索引 | Phase 4 | cherrchen |
| [docs/architecture/components.md](../../docs/architecture/components.md)、[interfaces.md](../../docs/architecture/interfaces.md)、[data-flow.md](../../docs/architecture/data-flow.md)（+ `.en.md`） | `Telemetry UI` 改为四窗口渲染层；新增窗口注册表与日志缓冲；IF-001 广播面与新增方法；数据流补窗口打开与广播路径 | Phase 4 | cherrchen |
| [docs/api/electron-ipc.md](../../docs/api/electron-ipc.md)（+ `.en.md`） | 新增 5 个方法（含幂等性、错误模型不变）、事件投递范围说明、`setDebugLogging` 副作用、变更记录行 | Phase 4 | cherrchen |
| [docs/development/dependency-policy.md](../../docs/development/dependency-policy.md)（+ `.en.md`） | 记录 8 个新增依赖（版本 / 用途 / 许可证 / 风险 / 替代方案）与 pnpm `allowBuilds` 结论 | Phase 4 | cherrchen |
| [docs/development/testing-strategy.md](../../docs/development/testing-strategy.md)（+ `.en.md`） | 新增「渲染层组件测试（vitest + jsdom）」层与 `test:ui`、与 CDP 实机断言的职责分工 | Phase 4 | cherrchen |
| [apps/desktop/README.md](../../apps/desktop/README.md) | 构建命令（Vite）、生成物路径（`dist/renderer/*.html`）、`test:ui`、窗口结构与环境变量（开发期 dev server） | Phase 4 | cherrchen |
| 根 [README.md](../../README.md) / [CONTRIBUTING.md](../../CONTRIBUTING.md) | 复核是否含构建命令描述，需要时同步（无变化则写「无」） | Phase 4 | cherrchen |
| [docs/planning/roadmap.md](../../docs/planning/roadmap.md) 的 Spec 状态列 | 完成时更新为 `Implemented` | 完成时 | cherrchen |
| [specs/002-desktop-ui-multiwindow/known-issues.md](.) | 如出现未决缺陷（例如 Windows 侧行为差异）则新建 | 发现时 | cherrchen |

> 对照 [Documentation Update Matrix](../../docs/development/documentation-rules.md) 逐项判断；无影响的行写 `无`。

## Verification Plan

| 验收标准 | 验证方式 | 何时执行 | 证据形式 |
| -------- | -------- | -------- | -------- |
| AC2-001 | 实机 CDP：读取 `scrollHeight`/`clientHeight`、溢出元素与窗口外框尺寸（TC-J01），在 zoom 1.0 / 1.25 / 1.5 三档 | Phase 5 | CDP 断言输出（含三档缩放与窗口尺寸） |
| AC2-002 / AC2-003 | 实机 CDP 读取主窗口与捕获窗口的可交互控件清单（TC-J03 / TC-J04） | Phase 5 | 控件清单 + 截图/ARIA 快照 |
| AC2-004 | 实机：捕获窗口勾选后读取 `getSettings().captureProcesses` 与 `config.json`，并观察主窗口状态行（TC-J04） | Phase 5 | IPC 返回 + 文件内容 + 状态行文本 |
| AC2-005 / AC2-006 | 实机：开关调试日志观察窗口出现/关闭；重开窗口读 `getDebugLogs()` 长度与内容（TC-J05 / TC-J06） | Phase 5 | 窗口清单 + 缓冲快照 |
| AC2-007 | 实机：allowlist 窗口增删主机、切换通配，重启应用复核 `config.json` 与主窗口摘要（TC-J07，复用 TC-B05/TC-H02） | Phase 5 | 文件内容 + 摘要文本 |
| AC2-008 | 实机：两次触达同一入口，读窗口数量（TC-J02） | Phase 5 | 窗口枚举输出 |
| AC2-009 | 实机：会话过期/代理冲突/CA 风险提示三条路径（TC-J08，复用 TC-D03/TC-C01/TC-E01 的触发方式） | Phase 5 | 模态文本 + OS 状态对照 |
| AC2-010 | 类型检查 + 既有权衡用例：`typecheck` 与 `orchestrator.test.ts` 等复用；新增方法实机调用（TC-J12） | Phase 5 | 命令输出 + IPC 调用结果 |
| AC2-011 | 全量回归：`test:unit`、`test:ui`、`typecheck`、`build`、`uv run --directory bridges/python pytest -q` + macOS 实机冒烟（TC-J13） | Phase 5 | 命令输出与实机记录 |
| AC2-012 | 源码检查（无 Node 直接访问）+ CSP meta 检查 + 实机样式生效（TC-J10） | Phase 5 | 源码检查命令 + 窗口表现 |
| AC2-013 | 手工检查：键盘遍历、状态文字、全部文案为中文（TC-J09） | Phase 5 | 手工记录 |

结果登记到 [verification.md](verification.md)。

## Open Questions

| ID | 问题 | 影响 | 状态 |
| -- | ---- | ---- | ---- |
| PQ-001 | 二级窗口默认尺寸最终取值 | T210/T223/T224/T225 的窗口参数 | Resolved（2026-09-23）：560×480 / 720×420 / 480×400 |
| PQ-002 | 开发期 dev server（HMR）是否落地 | T206 的 CSP 分支与开发流程 | Resolved（2026-09-23）：落地，仅开发期（`SWUFE_RENDERER_URL`） |
| PQ-003 | 日志合并窗口取值 | T214/T224 的实现参数 | Resolved（2026-09-23）：100ms；满 200 行且 > 50 条/秒 时 250ms |
| PQ-004 | 是否需要在 CI 为渲染层组件测试安装额外运行时（jsdom 已满足，无需浏览器） | T239 的 CI 步骤 | 已定：jsdom 足够，CI 无需浏览器（保持无显示器依赖） |
