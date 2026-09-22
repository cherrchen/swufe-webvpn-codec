# ADR-0012: 渲染层迁移到 React + Ant Design 6，桌面界面改为四窗口结构

## Status

`Accepted`

> 评审通过：2026-09-23（cherrchen）；实现记录见 [specs/002-desktop-ui-multiwindow/](../../../specs/002-desktop-ui-multiwindow/spec.md)。

## Date

`2026-09-23`

## Decision Owners

`cherrchen`

## Context

Phase 1 的界面（`Telemetry UI`）自 M2 起是**裸 TypeScript 直接操作 DOM** 的实现：`apps/desktop/src/renderer/renderer.ts`（约 498 行）+ `apps/desktop/static/index.html` + `static/styles.css`，由 `tsc` 编译、由 `index.html` 以 `<script type="module">` 加载；渲染层没有任何运行时依赖、没有组件库、没有打包器。

M3 加入「捕获方式 / 候选应用列表 / 调试日志面板」之后，出现两类压力：

- **窗口压力**：主窗口（720×640，`minWidth 560` / `minHeight 520`，内容可滚动）同时承载状态与主操作、配置（allowlist、捕获方式）、长列表（候选应用动辄数百行、日志 200 条）与诊断信息。高频动作（开桥、看状态）需要滚动才能完成，信息层级被内容长度破坏。
- **维护压力**：渲染层状态分散在六个模块级变量（`status` / `caStatus` / `settings` / `allowlist` / `candidates` / `logRows`），靠 `render()` + `renderXxx()` 全量重写 DOM 与手动 `refresh()` 收敛；新增控件要同时改 HTML、CSS、事件绑定与渲染函数，漏渲染无法被类型系统发现；可访问性属性靠人工保证。

同时存在约束：

- 渲染层必须**完全离线可用**：现有 CSP 为 `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:`，不允许 CDN 与远程字体/图标（[security/README.md](../../security/README.md) TB-003、[csp 相关约定在实现中固定](../../../apps/desktop/static/index.html)）。
- 渲染层是叶子：只能经 preload `window.swufeBridge` 调用 Main（[components.md](../../architecture/components.md) 的单向依赖规则），状态权威在 Main。
- [dependency-policy.md](../../development/dependency-policy.md) 第 1 节禁止「引入第二套功能等价的依赖」，其中「引入第二套等价方案」与「Native build」两类判定需要 ADR（第 2 节：基础设施级/难以替换的依赖记 ADR）；`[ADR-0003](ADR-0003-electron-gui-for-phase-1.md)` 只决定了「用 Electron 而非纯 CLI」，未约束渲染层框架，因此本次属**核心技术栈改变**，按 [adr/README.md](README.md) 的「何时必须写 ADR」必须落 ADR。
- 产品侧决定（2026-09-23）：主窗口固定 720×560 且**不出现滚动**；进程捕获的应用选择、调试日志、Allowlist 编辑各自进入**二级窗口**；二级窗口非模态、每类最多一个实例。

## Decision

**渲染层一次性迁移到 React 19 + Ant Design 6，用 Vite 构建（多入口），桌面界面固定为四窗口结构；长期不再维护裸 DOM 渲染层。**

具体条款：

1. **框架与组件库**：`react` / `react-dom` 19.3.0 + `antd` 6.6.5 + `@ant-design/icons` 6.3.4（均为 MIT）。选择 antd 6 而非 5：antd 6 原生支持 React 19（无需 `@ant-design/v5-patch-for-react-19` 补丁包）。
2. **构建**：渲染层由 `vite` 7.3.6 + `@vitejs/plugin-react` 5.2.0 构建为多入口产物（`main.html` / `capture.html` / `logs.html` / `allowlist.html` + 共享 chunk，`base: './'`）；Main 仍由 `tsc` 编译、preload 仍由 esbuild 打单文件。不引入 rolldown 系打包链（避免额外原生二进制审批）。
3. **窗口结构**：
   - 主窗口基线 720×560（DIP）、`resizable: false`（用户不能拖拽缩放）、**零滚动**（根容器 `overflow: hidden`，尺寸内一次排定）；窗口尺寸随**内容缩放系数**（`zoomFactor`，默认 1.0）按比例自适应并 clamp 到当前显示器工作区——**不**按显示器 `scaleFactor` 换算（macOS Retina 的 `scaleFactor = 2` 会把窗口放大到 1440×1120 DIP，超过普通笔记本的逻辑工作区）；
   - 三个二级窗口（捕获 / 日志 / Allowlist）**非模态**、**每类单实例复用**（重复触达入口即聚焦已有窗口）；
   - 长内容一律进二级窗口；主窗口溢出时的处置是「把内容再收进二级窗口」，**禁止**用滚动兜底；
   - 主窗口关闭仍等同于退出应用（沿用现有行为），二级窗口随之退出。
4. **状态与数据流**：状态权威仍在 Electron Main（不变）。IPC 事件（`onStatus` / `onDebugLog` / `onSessionExpired`）由「只投递主窗口」改为**广播到全部存活窗口**；调试日志的最近 200 条环形缓冲由渲染层**移到 Main**（窗口关闭不丢历史，`setDebugLogging(false)` 时清空并关闭日志窗口）；IPC 面只新增 `openCaptureWindow` / `openLogWindow` / `openAllowlistWindow` / `getDebugLogs` 四个方法，既有方法与事件签名不变。
5. **CSP**：允许把 `style-src` 放宽为 `'self' 'unsafe-inline'`（antd 6 仍以 `@ant-design/cssinjs` 在运行期注入 `<style>`）；`default-src 'none'`、`script-src 'self'`、`img-src 'self' data:` **不放宽**；所有前端资源随包分发，禁止运行时外联。CSP 由构建插件按模式注入（生产严格、开发期额外允许 dev server 源与 HMR WebSocket）。
6. **测试栈（第二套测试运行器的例外）**：渲染层组件测试使用 `vitest` 3.2.7 + `jsdom` 26.1.0 + `@testing-library/react` 16.3.3（全部 dev 依赖、MIT）。理由：既有 `node:test` + `tsx` 无法提供 DOM 环境与组件渲染；`test:ui` 与既有 `test:unit` 分工明确（前者只测可观察的界面行为，后者继续覆盖 Main 侧 electron-free 逻辑），且不引入浏览器运行时（CI 无显示器依赖）。不可在 jsdom 中测量的断言（主窗口零滚动、多窗口数量、窗口打开时延）由既有 CDP 实机方式验证。
7. **清理**：迁移完成后删除 `apps/desktop/static/`、`src/renderer/renderer.ts` 与其构建路径，不保留双实现或特性开关。
8. **生效时间**：Spec [002-desktop-ui-multiwindow](../../../specs/002-desktop-ui-multiwindow/spec.md) 实施时生效；执行责任人：cherrchen。本 ADR 不改变 [ADR-0003](ADR-0003-electron-gui-for-phase-1.md)（仍是 Electron 而非纯 CLI），也不改变任何桥侧决策（ADR-0001、ADR-0002、ADR-0004、ADR-0006、ADR-0007、ADR-0011）。

## Alternatives

| 备选方案 | 优点 | 缺点 | 未采纳原因 |
| -------- | ---- | ---- | ---------- |
| 什么都不做（保留裸 TS 渲染层，只调整布局） | 零新增依赖、迁移成本最低 | 渲染层维护成本继续累积；交互与可访问性仍靠人工；无法满足「一屏承载 + 二级窗口」的持续演进 | 产品方要求全面迁移到 React + Ant Design（2026-09-23） |
| 继续用 antd 5 + React 19 补丁包 | v5 生态成熟 | antd 6 已原生支持 React 19；补丁包是多一个依赖 | 用户改选 antd 6（2026-09-23） |
| 用 `Modal` / `Drawer` 在单窗口内模拟「二级窗口」 | 实现最简单，无多窗口生命周期问题 | 不是真窗口：不能独立移动/缩放，无法与主窗口并行操作（与「挑选应用时主窗口仍可操作」冲突） | 用户明确要求二级窗口（2026-09-23） |
| 单入口 + hash 路由 | 只需一个 HTML | 需自写分发或引入路由库（与「不引入路由/全局状态库」冲突），且无法按窗口裁剪加载 | 多入口更贴合多 `BrowserWindow`，并允许按窗口 code split |
| antd 6 的 `zeroRuntime` 静态样式提取，保持 `style-src 'self'` | CSP 更严格 | 多一步样式提取构建；运行期主题/token 调整受限 | 用户已决定解锁 `style-src 'unsafe-inline'`（仅样式，脚本策略不变）；记录为可回退方向 |
| 引入 Playwright for Electron 做界面 E2E | 可自动断言多窗口与零滚动 | 依赖与 CI 成本高（需浏览器运行时） | 本次用 vitest 组件测试 + 既有 CDP 实机断言，避免为单窗口结构引入浏览器运行时 |

## Consequences

### Positive

- 主窗口回到「一屏可读」：状态与主操作不再被长列表挤压，信息层级（状态 → 主操作 → 配置 → 诊断）稳定；
- 交互与可访问性由组件库提供（开关、单选、复选框列表、表格、模态、中文 locale），新增控件只需写组件；
- 类型系统可发现漏渲染类缺陷（组件 props 与状态类型绑定），渲染层不再是「手写 DOM + 手动 refresh」；
- 日志缓冲进 Main 后，日志窗口关闭/重开不再丢历史，且日志最小化约束（仅时间/域名/结果、不含 Cookie 与正文）集中在一处实现；
- 窗口注册表提供单一位置管理窗口生命周期，退出清理（清系统代理）路径不变。

### Negative

- 渲染层首次引入运行时依赖树（react / react-dom / antd / icons 及其传递依赖），构建产物体积与安装体积上升；
- `style-src 'unsafe-inline'` 是安全策略的实质放宽（样式层面）；
- 启动时按需创建 renderer 进程，最多 4 个（主 + 3 个二级），内存占用高于单窗口；
- 需要新增第二套测试运行器（vitest）与 jsdom 环境，测试配置从一套变为两套（已用职责边界约束）；
- 主窗口由 720×640 可缩放变为 720×560 基线且不可拖拽缩放（尺寸只随内容缩放系数变化）：用户可见变化，且必须用紧凑排版维持可读性；

### Risks

| 风险 | 可能性 | 影响 | 缓解措施 |
| ---- | ------ | ---- | -------- |
| 固定小窗口 + 中文文案导致主窗口溢出（系统缩放/字体放大） | 中 | 高 | 紧凑 token 与 `componentSize="small"`；在 100%/125%/200% 三档实测断言零滚动；溢出时把内容再收进二级窗口（不加滚动） |
| antd 运行期样式注入在严格 CSP 下被拦截 | 中 | 高 | 生产与开发两套 CSP 由同一构建插件注入；实机断言样式生效且 `script-src` 未放宽 |
| IPC 广播面扩大后满速日志造成多窗口重渲染压力 | 中 | 中 | 窗口侧按 ~100ms 合并渲染；缓冲上限 200 条；实机压测 |
| 多窗口生命周期与「退出清系统代理」交互出错 | 低 | 高 | 显式处理 `window-all-closed` 与主窗口 `closed`；`recoverOnLaunch()` 兜底；实机验证关窗/退出/过期三条路径 |
| 依赖树引入导致的安装/供应链风险 | 低 | 中 | 依赖全部 MIT、离线随包分发；按 dependency-policy 逐项记录；如遇 pnpm `allowBuilds` 审批则先评审再列入 |
| 迁移期界面回归覆盖不足（001 的界面用例需重做） | 高（确定） | 中 | 002 重新执行界面相关用例并登记；001 只加取代注记、保留历史证据 |

## References

- 相关需求：REQ-001、REQ-003、REQ-005、REQ-009、REQ-012（新增：多窗口界面结构）、NFR-003、NFR-005、NFR-007
- 相关 Spec：[specs/002-desktop-ui-multiwindow/](../../../specs/002-desktop-ui-multiwindow/spec.md)（design / ui-ux / plan / tasks / verification）
- 相关 ADR：[ADR-0003](ADR-0003-electron-gui-for-phase-1.md)（Electron 外壳；本 ADR 不改变）、[ADR-0006](ADR-0006-local-capture-mode-and-mutual-exclusion.md)（捕获方式互斥；界面归属变化但语义不变）
- 相关文档：[dependency-policy.md](../../development/dependency-policy.md)、[testing-strategy.md](../../development/testing-strategy.md)、[ui-ux/](../../ui-ux/README.md)、[api/electron-ipc.md](../../api/electron-ipc.md)
- 外部资料：Ant Design 6 仓库与文档站点（`https://ant.design`，版本以 `npm view antd version` 为准，访问于 2026-09-23）；Vite（`https://vite.dev`）；React 19（`https://react.dev`）；Vitest（`https://vitest.dev`）
