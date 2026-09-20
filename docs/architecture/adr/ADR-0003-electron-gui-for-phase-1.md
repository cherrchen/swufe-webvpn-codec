# ADR-0003: Phase 1 采用 Electron 而非纯 CLI

## Status

`Accepted`

## Date

`2026-09-20`

## Decision Owners

`cherrchen`

## Context

本机桥的登录不是 API 调用，而是官方 WebVPN 的 CAS / MFA 网页流程：用户必须在能渲染登录页、处理跳转与多因素的 WebView 中完成登录，桥才能取得可用会话 Cookie（REQ-002）。CA 的安装与卸载同样绕不开图形交互：需要调用系统信任库、在安装前展示「本机 HTTPS 会被解密」的风险提示并支持一键撤销（REQ-010、NFR-005、G-003）。此外还有连接开关、allowlist 增删、状态与错误原因、进程捕获选择、调试日志开关等持续可见的操作面（REQ-001、REQ-005、REQ-009）。

约束：G-002 要求从「已登录」到「浏览器打开教务」不超过 3 次点击；NFR-007 要求界面与文案中文优先；REQ-011 / NFR-006 要求第一期覆盖 macOS 与 Windows。因此交付形态必须现在确定，它决定 UI、打包与 OS 适配层的组织方式。

## Decision

Phase 1 采用 Electron 桌面应用作为唯一交付形态，**不提供纯 CLI 作为第一期可用路径**。

- 登录、CA 引导、开桥 / 停桥、allowlist 管理与状态展示全部由 GUI 承担（REQ-001）；
- 不允许把「用户手动执行命令行」作为任何验收流程的前置条件（G-002 依赖 GUI 内 ≤3 次点击）；
- 界面与文案中文优先（NFR-007），同时支持 macOS 与 Windows（REQ-011）；
- 自 Phase 1 起生效；更换桌面壳（例如改用 Tauri / Qt）必须新建 ADR 取代本条目；
- 执行责任人：cherrchen。

## Alternatives

| 备选方案 | 优点 | 缺点 | 未采纳原因 |
| -------- | ---- | ---- | ---------- |
| 什么都不做（不提供图形界面，也不提供 CLI） | 无 UI 开发成本 | 登录、CA 引导与状态全无入口，REQ-001 与 G-001 均不成立 | 需求不满足 |
| 纯 CLI（命令 + 配置文件） | 开发量最小；易于脚本化与排障 | CAS / MFA 登录与证书引导体验差，用户需自行操作系统信任库；状态与错误不可见，G-002 无法达成 | 登录与证书引导体验差，不满足验收路径 |
| Tauri | 包体积小、内存占用低 | 登录 WebView 行为与跨平台成熟度需要额外评估；与 Python sidecar 的集成同样要自建 | 考虑到 WebView 登录与 macOS/Windows 成熟度，第一期选 Electron |
| Qt | 成熟的原生 UI 能力；性能好 | 与团队既有前端栈无关，开发与打包链路另起一套，第一期成本高 | 技术栈与交付节奏不匹配 |

## Consequences

### Positive

- WebView 可直接承载 CAS / MFA 登录并导出同一 session 的 Cookie，REQ-002 的会话来源明确；
- CA 安装 / 卸载与风险提示有统一落点，NFR-005、G-003 的「可逆」要求可视化；
- 跨 macOS / Windows 的窗口、托盘、系统代理与证书交互集中在 Electron 与 OS 适配层，NFR-006 的差异被收敛。

### Negative

- 包体积增大（Electron 运行时叠加 Python / mitmproxy sidecar，见 ADR-0002）；
- UI 层需要维护安全边界（preload 暴露受控 API，见 [electron-ipc.md](../../api/electron-ipc.md)）。

### Risks

| 风险 | 可能性 | 影响 | 缓解措施 |
| ---- | ------ | ---- | -------- |
| macOS 权限弹窗（辅助功能 / 网络扩展 / 信任设置）劝退用户（R4） | 中 | 中 | UI 内引导逐步说明用途与撤销方式；错误态给出具体操作路径 |
| 包体积随 Electron + Python 双重膨胀 | 中 | 低 | 发布形态在打包阶段确定体积方案；体积不是第一期验收阻断项 |

## References

- 相关需求：REQ-001、REQ-002、REQ-005、REQ-009、REQ-010、REQ-011、G-002、NFR-005、NFR-006、NFR-007
- 相关 Spec：[specs/001-phase1-local-bridge/spec.md](../../../specs/001-phase1-local-bridge/spec.md)
- 相关 ADR：[ADR-0002](ADR-0002-reuse-mitmproxy-for-tls.md)（Python / mitmproxy sidecar 由 App 分发）、[ADR-0004](ADR-0004-refuse-start-when-system-proxy-in-use.md)（代理冲突以 GUI 模态阻止）
- 来源（归档原包，仅作历史出处）：[04-architecture-and-tech-selection.md §2 ADR-3、§3 技术选型对比](../../archive/2026-09-20-swufe-webvpn-bridge-docs-v1.0/01-requirements/04-architecture-and-tech-selection.md)
