# 目标与非目标

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-20

**用途**：明确项目**要做什么**与**明确不做什么**，用来抵抗 Scope Creep。
Agent 在实现任何功能前，应能在这里判断该功能是否属于项目范围。

---

## 目标（Goals）

| ID | 目标 | 成功判据 | 状态 |
| -- | ---- | -------- | ---- |
| G-001 | 本机 HTTP/HTTPS 客户端在完成官方 WebVPN 登录后，对 allowlist 内主机自动经 WebVPN 访问 | 在桥已开启、CA 已信任的前提下，本机浏览器能打开并操作 `jwxt.swufe.edu.cn`（教务）页面 | Open |
| G-002 | 体验：日常使用低摩擦，不需要用户理解改写机制 | 从「已登录」到「浏览器打开教务」≤ 3 次点击（不含 CAS 登录本身） | Open |
| G-003 | 安全：凭据与信任链可控、危险操作可逆 | 无密码落盘；CA 可一键卸载；关闭桥后无残留系统代理 | Open |
| G-004 | 架构保持日后可开源（私用优先；原包列为里程碑 M5「文档与开源准备」，可选） | 交付物中不含私有凭据或不可分发资产，开源材料可在 M5 单独补齐；不阻塞第一期验收 | Open |

## 非目标（Non-goals）

> 非目标不是「以后可能做」，而是「当前明确不做，且不应由 Agent 自行补上」。

| ID | 非目标 | 原因 | 若需要则走 |
| -- | ------ | ---- | ---------- |
| NG-001 | SSH / 数据库 / SMB / 任意 TCP·UDP | WebVPN 是应用层反向代理，本机桥只覆盖 HTTP/HTTPS | 新 Feature Spec（TUN/透明网关方向） |
| NG-002 | 替代学校 SSLVPN 或 TUN 级真 VPN | TUN/sing-box 为后续阶段，第一期不上，且不阻塞第一期验收 | 新 Feature Spec + 新 ADR |
| NG-003 | 与 Clash / mihomo / sing-box 等对系统代理的链式共存 | 叠加难测，第一期选择「系统代理被占用时拒绝启动」 | 新 ADR |
| NG-004 | PAC | 第一期流量接管方案只有系统 HTTP/HTTPS 代理与按进程捕获两种 | 新 Feature Spec |
| NG-005 | 存储密码或自动化填密码绕过 MFA | CAS/MFA 必须由用户在官方 WebView 内自行完成，且不得存储密码 | 明确授权（需产品与安全评审，不得由 Agent 自行补上） |
| NG-006 | 班级批量分发、应用商店上架 | 第一期以私用为主，不按批量分发设计安装与签名流程 | 后续阶段 M5 / 新 Feature Spec |
| NG-007 | Linux | 第一期只支持 macOS、Windows | 后续阶段 / 新 Feature Spec |
| NG-008 | 保证所有证书钉扎（pinning）应用可用 | MITM 无法覆盖钉扎应用；第一期验收只要求浏览器访问教务 | 新 Feature Spec |

## 与 Roadmap 的关系

目标在本文件中定义；时间与排序在 [planning/roadmap.md](../planning/roadmap.md) 中维护，不在此处重复。

## 变更流程

修改目标或非目标属于需求变更：

1. 更新本文件；
2. 在 [requirements/](../requirements/README.md) 中同步受影响的需求条目；
3. 若涉及架构方向，评估是否需要 ADR；
4. 在 PR 的 Documentation Impact 中说明。
