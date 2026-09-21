# M3: 体验打磨（Experience Polish）

> Status: Done
> Owner: cherrchen
> Target: TBD（原包未定义日期）

## 目标

把主路径之外但仍属第一期的可控项补齐，让用户能自己管理分流范围、看到发生了什么、并按进程收窄捕获：

- Allowlist UI：默认含 `jwxt.swufe.edu.cn`，可增删并持久化，可选 `*.swufe.edu.cn` 通配（REQ-005）；
- 调试日志开关与日志面板：仅记录「域名 + 是否改写成功」，默认关闭且不含正文/Cookie（REQ-009、NFR-003）；
- 进程捕获：列出候选进程，按设置只捕获指定进程（REQ-003）；
- 状态区与中文文案：与桥状态机一致；CA 安装风险提示、代理冲突提示、会话过期提示（REQ-001、NFR-005）。

## 包含的 Specs

| Spec | 状态 | 依赖 |
| ---- | ---- | ---- |
| [001-phase1-local-bridge](../../../specs/001-phase1-local-bridge/spec.md) | In Progress | M2 |

## 退出条件

- [x] Allowlist 增删主机并持久化：添加后重启 App 仍在（TC-B05，P1）
- [x] `*.swufe.edu.cn` 通配勾选与提示文案可用（TC-H02，P2）
- [x] 调试日志可用且不含正文：日志面板仅有时间/域名/结果，且不含正文与 Cookie（TC-F04，P1；NFR-003；面板行为已实机验证，真实桥联动见完成记录「遗留问题」）
- [ ] 进程捕获可用：可选择候选应用（一个应用一行）并只对所选应用生效（TC-G04，P1）——**部分完成**：捕获方式 UI、候选应用归并、勾选与模式持久化、与系统代理互斥、系统代理被占用时拒绝启用、失败引导与「重试」、sidecar 侧模式集的叠加/移除/回滚与 `swufe-capture` 回报均已验证（实机 + L0/L1/App 单测）；「只对所选应用生效」需测试者本人在 macOS 系统扩展授权提示内确认，且开桥需先装 CA（管理员密码）并完成真实 WebVPN 登录，故保持未勾选（见「遗留问题」）
- [x] 状态展示与桥状态机一致（含捕获态）（TC-H01，P1）
- [x] 关键文案落地：CA 安装风险提示、代理冲突提示（关闭 Clash / mihomo 等）、会话过期提示，以及捕获方式说明与进程捕获授权引导（NFR-005）
- [x] 相关文档已同步（含双语配对，`pnpm run docs:check` 0 error/0 warning）；无阻塞类缺陷

## 风险

| 风险 | 影响 | 应对 |
| ---- | ---- | ---- |
| R4 macOS 权限弹窗劝退（中/中） | 进程捕获需要的辅助功能/网络扩展授权被拒，UI 引导不足会阻断该路径 | 文案引导授权步骤；该路径失败不影响系统代理主路径 |
| R1 教务前端大量动态绝对 URL（中/高） | 漏改只能靠实测发现，缺日志时难以定位 | 用调试日志按域名核对改写结果，作为响应改写的定位手段 |

## 完成记录

- **完成时间**：2026-09-21
- **交付物**
  - **捕获方式（一级）与进程捕获**：`apps/desktop/static/index.html` 捕获方式区（系统代理 / 指定应用 + 进程捕获状态 + 应用列表 + macOS 授权引导 + 重试）；`apps/desktop/src/renderer/renderer.ts`（`renderCapture`、`applyCaptureMode`、失败态与筛选）；`apps/desktop/src/shared/types.ts`（`CaptureMode` / `CaptureCandidate.pattern` / `CaptureReport` / `BridgeStatus.captureError`）；`apps/desktop/src/main/{store,orchestrator,ipc,sidecar,constants}.ts`（`captureMode` / `captureProcesses` 持久化与校验、两种方式的互斥与撤销/恢复系统代理、`swufe-capture` 解析与状态上报）；`apps/desktop/src/main/platform/parse.ts`（`capturePattern` / `captureName` / `groupCaptureCandidates`，一个应用一行）；`bridges/python/swufe_bridge/capture.py`（模式集推导、失败回滚、同配置不重试）+ `bridges/python/swufe_bridge/addon.py`（捕获循环与 `swufe-capture` 回报）+ `bridges/python/swufe_bridge/sidecar.py`（`--mode regular@<port>`）+ `bridges/python/swufe_bridge/config.py`（`capture.processes` 与 `ConfigWatcher.stamp`）。
  - **Allowlist 编辑界面**：主机名添加 / 逐行删除 / `*.swufe.edu.cn` 勾选，改动立即生效并在重启后保留。
  - **日志面板**：`时间 | 域名 | 结果` 三列、最多 200 条、最新在前、清空、默认隐藏并随调试日志开关联动。
  - **文案与状态**：捕获方式说明（含切换会撤销系统代理）、进程捕获授权引导、「启用失败 — <原因>」+「重试」；状态条新增「桥接中（进程捕获）」。
  - **文档**：需求 / UI-UX / 架构（组件、接口、数据流、数据模型）/ API（Electron IPC、桥控制协议）/ ADR-0006（新增，中英）/ Spec 001（spec、design、plan、tasks）/ testing-strategy / roadmap / 本里程碑（中英配对）。
- **验证证据**（完整命令与观察结果见 [verification.md](../../../specs/001-phase1-local-bridge/verification.md)）
  - `uv run --directory bridges/python pytest -q` → `190 passed`（L0 97 / L1 86 / L2 7；M3 新增 `bridges/python/tests/l0/test_capture.py` 14 例、`bridges/python/tests/l1/test_addon_capture.py` 7 例、config 捕获用例 7 例、L2 捕获用例 2 例）。
  - `pnpm --filter swufe-webvpn-bridge run typecheck` 无 error；`pnpm --filter swufe-webvpn-bridge run test:unit` → `70 passed`；`pnpm --filter swufe-webvpn-bridge run build` 通过。
  - `pnpm run docs:check` → `0 error(s), 0 warning(s)`（148 文件）；`pnpm run typecheck` 无 error。
  - macOS 实机（真实应用 + CDP 驱动，`--user-data-dir=/tmp/m3-e2e`）：allowlist 增删 / 非法主机提示 / 通配勾选、候选应用 363 行且 Chrome 主进程与 Helper 归并为一个 pattern、勾选与捕获方式在重启后保留、日志面板三列表头 / 200 条上限 / 清空 / 随开关显示隐藏、捕获态与失败引导（含「重试」）、系统代理被其它软件占用时切到「指定应用」弹出冲突模态且设置不落盘、退出后无 sidecar 残留且系统代理仍为 `Enabled: No`。
- **实现期决策与偏差**（均已落文档，不再重复决策）
  1. 进程捕获用 mitmproxy `local` 模式而非自研网络扩展，且与系统代理**互斥**（新增 [ADR-0006](../../architecture/adr/ADR-0006-local-capture-mode-and-mutual-exclusion.md)）。
  2. sidecar 改为 `--mode regular@<port>`、不再传 `--listen-port`（全局 listen_port 会让运行时新增的 `local:` 与 `regular` 判为同一监听地址）。
  3. 捕获是运行时异步生效的可选能力：addon 每秒轮询配置，失败不自动重试，失败不改桥状态（只置 `captureError`）。
  4. **偏差（接口细节）**：计划中的 renderer 冲突判定依赖 `error.code`，实测 Electron 44 的 `invoke` rejection **只保留 `message` 与 `stack`**（自定义属性被丢弃，已用最小 Electron 探针取证），因此 `setCaptureMode` / `setCaptureProcesses` 的拒绝消息改为 `<CODE>：<message>`，renderer 解析该前缀决定是否弹出冲突模态；该约定已写入 [electron-ipc.md](../../api/electron-ipc.md) § 错误模型。
  5. **偏差（实现细节）**：`capturePattern` 的正则用**非贪婪** `^(.*?\.app)/Contents/`（计划文本写的是贪婪版），否则 Chrome Helper 会被归并到 `…/Google Chrome Helper.app/` 而不是外层 `Google Chrome.app/`，与「主进程与 Helper 合并为一行」的目标冲突；已由 `apps/desktop/test/system-proxy-parse.test.ts` 固定。
  6. **偏差（界面顺序）**：切换捕获方式失败时先回显已保存的捕获方式再弹冲突模态（计划只要求「最后 refresh」，实测若先 await 模态，模态打开期间单选会停留在未保存的取值）。
- **遗留问题**
  - 真实进程捕获的**范围**验证（「只有所选应用经桥、未被选中的应用不经桥」）需测试者本人在 macOS 系统扩展授权提示内确认，且开桥需先装 CA（管理员密码）并完成真实 WebVPN 登录；本次只验证到授权前的全部链路与失败引导。
  - 日志面板与真实桥的联动（开桥产生流量后逐条出现）同样需要装 CA + 登录，未在本会话执行。
  - 捕获失败文案的等待时间（5 秒授权窗口）未在真实授权场景下实测。
  - Windows 真机项与教务浏览器验收仍归 M4（T038 / TC-G01）。

