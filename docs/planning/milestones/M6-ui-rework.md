# M6: 界面重构（UI Rework）

> Status: Planned
> Owner: cherrchen
> Target: TBD（待排期；不早于 M4 遗留项——Windows 真机项与进程捕获真实范围——收敛）

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

- [ ] 002 的 `AC2-001..AC2-013` 全部有 `Passed` 或写明理由的 `N/A` 证据（登记在 002 的 `verification.md`）
- [ ] 主窗口零滚动在 100% / 125% / 200% 缩放下实测通过（TC-J01）
- [ ] 非界面回归全绿：`test:unit`、`test:ui`、`typecheck`、`build`、`uv run --directory bridges/python pytest -q`
- [ ] macOS 实机冒烟通过：登录 → 开桥 → 浏览器访问 allowlist 主机 → 关桥/退出后无残留系统代理（TC-J13）
- [ ] 001 的界面相关用例（TC-H01 / TC-H02 / TC-B05 / TC-F04）在新界面上重跑并登记
- [ ] 相关文档已同步（含双语配对：`pnpm run docs:check` 0 error、`pnpm run spec:check` 无 error）
- [ ] 无阻塞类缺陷；未决项登记到 002 的 `known-issues.md` 或既有 `KI-*`
- [ ] 窗口隔离与 CSP 影响已确认（`sandbox: true` + `contextIsolation: true`；仅 `style-src` 放宽，TC-J10）

## 风险

| 风险 | 影响 | 应对 |
| ---- | ---- | ---- |
| 固定小窗口在中文字体/系统缩放下溢出（R2-001） | 高（零滚动判据失效） | 紧凑 token + `componentSize="small"`；三档缩放实测；溢出即把内容再收进二级窗口，不加滚动 |
| antd 运行期样式注入与 CSP 冲突（R2-002） | 高（界面样式全丢） | 生产/开发两套 CSP 由同一构建插件注入；实机断言样式生效且 `script-src` 未放宽 |
| 多窗口生命周期与「退出清系统代理」交互（R2-004） | 高（NFR-004 回归） | 显式处理 `window-all-closed` 与主窗口 `closed`；`recoverOnLaunch()` 兜底；实机验证三条路径 |
| 迁移期界面回归覆盖不足（R2-006） | 中 | 001 的界面用例在新界面重跑并登记；001 只加取代注记、保留历史证据 |
| 新依赖树与第二套测试运行器（R2-005 / R2-008） | 中 | 按 dependency-policy 逐项记录；组件测试与 CDP 实机断言职责分离 |

## 完成记录

未完成。实施进度与证据见 [002 的 tasks.md](../../../specs/002-desktop-ui-multiwindow/tasks.md) 与 [verification.md](../../../specs/002-desktop-ui-multiwindow/verification.md)。
