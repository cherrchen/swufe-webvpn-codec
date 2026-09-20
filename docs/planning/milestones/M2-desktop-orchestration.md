# M2: 桌面编排（Desktop Orchestration）

> Status: Planned
> Owner: cherrchen
> Target: TBD（原包未定义日期）

## 目标

把桥装进 Electron 应用，使「登录 → 开桥 → 校园资源可用」的编排由 App 完成：

- 登录 WebView + Session Broker：不存学号/密码，只保存会话所需 Cookie 及最小附属状态（REQ-001、REQ-002）；
- Proxy Orchestrator：开桥前读系统代理，已被占用则拒绝启动并提示先关闭 Clash / mihomo / sing-box 等（REQ-004）；开桥时把系统 HTTP/HTTPS 代理指向本地桥；关闭、会话过期或退出时仅在「由本 App 设置」的标记存在时清除（NFR-004）；
- Cert Manager：一键安装/卸载本机 MITM CA，安装时展示风险提示（REQ-010、NFR-005）；
- 会话失效处理：探测到失效则停桥 → 清系统代理 → 停进程捕获 → 弹窗重登。

## 包含的 Specs

| Spec | 状态 | 依赖 |
| ---- | ---- | ---- |
| [001-phase1-local-bridge](../../../specs/001-phase1-local-bridge/spec.md) | Draft | M1 |

## 退出条件

- [ ] Electron 可登录：WebView 完成 CAS/MFA 后取得可用 WebVPN 会话，且无密码文件（TC-D01，P0）
- [ ] 未登录时不能开桥（TC-D02，P0）
- [ ] 已有系统代理时拒绝启动并给出提示（TC-C01，P0；见 [ADR-0004](../../architecture/adr/ADR-0004-refuse-start-when-system-proxy-in-use.md)）
- [ ] 开桥把系统 HTTP/HTTPS 代理指向本桥端口（TC-C02，P0）
- [ ] 关桥 / 退出 App 清除由本 App 设置的代理（TC-C03、TC-C04，P0；NFR-004）
- [ ] CA 一键安装到系统信任库（TC-E01，P0）、一键卸载（TC-E02，P0）；未安装 CA 时给出明确失败提示（TC-E03，P1）
- [ ] 会话过期触发停桥 + 清代理 + 停进程捕获 + 弹窗重登（TC-D03，P0）
- [ ] 相关文档已同步（含双语配对）；无阻塞类缺陷

## 风险

| 风险 | 影响 | 应对 |
| ---- | ---- | ---- |
| R3 mitm 嵌入体积 / 签名（中/中） | 打包体积增大、签名与分发受阻 | 先开发者模式外置 mitm；退回独立安装 mitm 亦可接受 |
| R4 macOS 权限弹窗劝退（中/中） | 辅助功能/网络扩展授权被拒会阻断进程捕获路径 | UX 引导文案；必要时仅保留系统代理路径 |
| R2 Cookie 字段变更（中/高） | 会话探测误判，出现「假过期」或漏判过期 | 探测信号集中（探测 URL 标记、Set-Cookie 清空、302 到 CAS），并保留手动重登入口 |

## 完成记录

尚未开始；完成后在此记录完成时间、证据（命令与结果摘要）与遗留问题。
