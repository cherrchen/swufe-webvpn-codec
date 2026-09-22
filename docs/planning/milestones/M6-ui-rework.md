# M6: 界面重构（UI Rework）

> Status: Done（2026-09-23）
> Owner: cherrchen
> Target: TBD（原包未定义日历时间；本里程碑于 2026-09-23 实施完成）

## 目标

把渲染层迁移到 React 19 + Ant Design 6（Vite 多入口构建），并固定桌面界面为四窗口结构：

- 主窗口固定 720×560、不可缩放、**零滚动**：只承载状态、主操作、捕获方式选择、allowlist 摘要、CA 操作与诊断；
- 进程捕获的应用选择、调试日志、Allowlist 编辑各自进入**非模态二级窗口**（每类单实例复用）；
- 调试日志的最近 200 条缓冲移到 Electron Main，日志窗口关闭重开不丢历史；
- 界面之外（桥、sidecar、系统代理、CA、会话、改写、配置持久化）行为**零变化**。

## 包含的 Specs

| Spec | 状态 | 依赖 |
| ---- | ---- | ---- |
| [002-desktop-ui-multiwindow](../../../specs/002-desktop-ui-multiwindow/spec.md) | Draft | 001（`Implemented`，提供界面能力与验收基线）、[ADR-0012](../../architecture/adr/ADR-0012-react-antd-multiwindow-renderer.md) 评审通过 |

## 退出条件

- [x] 002 的 `AC2-001..AC2-013` 全部有 `Passed` 或写明理由的 `N/A` 证据（登记在 002 的 `verification.md`：13 条全部 `Passed`，未验证项三条已单列）
- [x] 主窗口零滚动在 100% / 125% / 200% 缩放下实测通过（TC-J01：zoom 1.0/1.25/1.5/2.0 四档 `scrollHeight==clientHeight` 且无溢出元素，外框 720×560 / 900×700 / 1080×840 / 1440×935）
- [x] 非界面回归全绿：`test:unit` 85 例、`test:ui` 36 例、`typecheck` 无 error、`build` 通过、`uv run --directory bridges/python pytest -q` 198 例（基线一致）
- [x] macOS 实机冒烟通过：登录（假上游会话）→ 开桥 → 真实浏览器（Chrome，经系统代理）访问 `http://jwxt.swufe.edu.cn/` 收到改写后的上游响应 → 关桥 → 退出，6 个服务 `Enabled: No`、无 sidecar 残留（TC-J13；真实校内会话下的教务页面操作登记为未验证项）
- [x] 001 的界面相关用例（TC-H01 / TC-H02 / TC-B05 / TC-F04）在新界面上重跑并登记（002 的 verification.md 映射表；TC-F04 的自动化部分 = 日志键集合 `ts/host/rewritten/direction/detail`）
- [x] 相关文档已同步（含双语配对：`pnpm run docs:check` 0 error / 0 warning、`pnpm run spec:check` 无 error）
- [x] 无阻塞类缺陷；未决项 = Windows 真机（既有 `KI-001`）、真实会话下的教务页面操作、进程捕获真实范围（登记在 002 的 `verification.md`「未验证 / 无法验证项」）
- [x] 窗口隔离与 CSP 影响已确认（四窗口 `sandbox: true` + `contextIsolation: true` + 无 Node 集成；产物 CSP 仅放宽 `style-src 'unsafe-inline'`，TC-J10）

## 风险

| 风险 | 影响 | 应对 |
| ---- | ---- | ---- |
| 固定小窗口在中文字体/系统缩放下溢出（R2-001） | 高（零滚动判据失效） | 紧凑 token + `componentSize="small"`；三档缩放实测；溢出即把内容再收进二级窗口，不加滚动 |
| antd 运行期样式注入与 CSP 冲突（R2-002） | 高（界面样式全丢） | 生产/开发两套 CSP 由同一构建插件注入；实机断言样式生效且 `script-src` 未放宽 |
| 多窗口生命周期与「退出清系统代理」交互（R2-004） | 高（NFR-004 回归） | 显式处理 `window-all-closed` 与主窗口 `closed`；`recoverOnLaunch()` 兜底；实机验证三条路径 |
| 迁移期界面回归覆盖不足（R2-006） | 中 | 001 的界面用例在新界面重跑并登记；001 只加取代注记、保留历史证据 |
| 新依赖树与第二套测试运行器（R2-005 / R2-008） | 中 | 按 dependency-policy 逐项记录；组件测试与 CDP 实机断言职责分离 |

## 完成记录

已完成（2026-09-23）。Spec [002](../../../specs/002-desktop-ui-multiwindow/spec.md) 推进到 `Implemented`（[tasks.md](../../../specs/002-desktop-ui-multiwindow/tasks.md) 的 T201..T242 全部完成）；渲染层为 React 19 + Ant Design 6 的四窗口结构（Vite 多入口，`dist/renderer/{main,capture,logs,allowlist}.html` + 共享 chunk），主窗口 720×560 零滚动、三个二级窗口单实例非模态，调试日志的 200 条环形缓冲在 Main（`window-registry.ts` / `debug-log-buffer.ts` / `shared/limits.ts` 新增，旧 `static/` 与 `renderer.ts` 已删除）。

证据与未决项：

- 可机器执行的验收（TC-J01/J02/J03/J04/J05/J06/J07/J08/J09/J10/J11/J12/J13）全部通过，逐条结果记录在 [002 的 verification.md](../../../specs/002-desktop-ui-multiwindow/verification.md)（含命令输出、窗口/尺寸实测、CSP 与隔离检查）。
- 未验证项：Windows 真机（既有 `KI-001`）、真实 CAS/MFA 会话下的教务页面操作（本里程碑以假上游 + 假会话 + 真实浏览器验证了同一路径）、进程捕获的系统扩展授权后的真实范围（需管理员密码与手动允许）。
- 界面之外行为零变化：`capture.processes` 在 system-proxy 方式下仍为空、退出仍清系统代理（6 个服务 `Enabled: No`）、Python 198 例与 App 单测 85 例与迁移前一致。
