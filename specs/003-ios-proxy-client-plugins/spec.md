# Feature: iOS Proxy Client Plugins

> Spec ID: 003  
> Status: In Progress  
> Owner: cherrchen  
> Created: 2026-09-24  
> Related: REQ-002 / REQ-005 / REQ-006 / REQ-007 / NFR-002 / NFR-003

> 本文件回答 **What / Why**。**不写**技术方案（→ [design.md](design.md)）、任务拆解（→ [tasks.md](tasks.md)）。
> 本文中的 `IOS-REQ-*` / `IOS-NFR-*` / `AC-IOS-*` 等编号是**本 Spec 局部编号**；项目级需求（REQ-*、NFR-*）的定义仍在 [docs/requirements/](../../docs/requirements/README.md)，本 Spec 只引用。完整产品需求以 [prd.md](prd.md) 为准；交互见 [ui-ux.md](ui-ux.md)，领域边界见 [domain.md](domain.md)。在并入 `functional-requirements.md` 并分配全局 `REQ-*` 之前，不在该文件中占用新编号。

本文件是仓库 Spec 体系的 **What / Why** 入口。

## Status

`Draft | Approved | In Progress | Implemented | Verified | Archived`

当前为 **`In Progress`**（2026-09-25）：Gate A 与 Core parity 已通过；Stash 基础 Adapter/Demo 已开发并有部分设备日志。2026-09-25 修订确认动态站点 Settings、pseudo HTTP API、精确 Routing Scope 与较宽 Interception Scope 的架构方向；Settings 实现、wildcard MitM/QUIC 实机确认与 Settings E2E 尚未通过。M3/M4 未开始。

| Gate | 含义 | 本 Spec 状态 |
| --- | --- | --- |
| **Gate A** | P0 登录链路与 Script 可观察性（见 [project-management.md §10](project-management.md)） | **已通过**（2026-09-24 真机；见 [verification.md](verification.md)） |
| **文档评审** | PRD / 架构 / 任务 / 验证计划一致，产品决策已冻结（含 Stash 首发、自包含 Settings、无 BoxJS/backend、GitHub 只分发） | **已通过**（本轮文档修订；宿主能力仍需 Gate D） |
| **Approved** | Gate A + 文档评审通过 | **当前** |
| **Gate B** | M1 退出：Python/JS 共享向量全绿、Core 无 Host API 泄漏（见 [project-management.md §10](project-management.md)） | **已通过**（2026-09-24 本地向量与隔离扫描；真机 E2E 仍待 T027） |
| **In Progress** | Gate B 通过后进入 M2/M3 实现 | **当前**（M1/M2 实现中；Gate B 以向量全绿为准） |

## Background

现有 desktop 已通过 Electron + mitmproxy 实现 SWUFE WebVPN bridge。移动端希望复用 Loon/Stash 已有的 Network Extension、代理、MitM 与 Script 能力，避免独立开发和维护 iOS App。

## Problem

移动端仍需要保持真实校内域名访问语义，同时完成 WRD URL 编码、WebVPN Session 注入与响应反向改写；如果独立开发 iOS App，会重复建设大量与业务无关的网络基础设施。

## Goals

| ID | 目标 | 成功判据 |
| --- | --- | --- |
| G-001 | 第三方代理客户端承载移动端 | 至少一个宿主完成真实设备 E2E |
| G-002 | 协议与 desktop 一致 | Python/JS 共享向量 100% 通过 |
| G-003 | 不处理用户密码 | 存储、日志与代码审计通过 |
| G-004 | 双宿主共享 Core | Loon/Stash 不复制业务核心 |

## Non-goals

- 独立 iOS App；
- 任意 TCP/UDP VPN；
- 绕过 CAS/MFA；
- 首期支持所有第三方代理客户端；
- 在插件里重做一个完整浏览器 UI。

## User Stories

见 [prd.md §6](prd.md)。

## Functional Requirements

见 [prd.md §7](prd.md)，使用 `IOS-REQ-*` 作为本 Feature 内部 ID。并入长期 `docs/requirements/functional-requirements.md` 时再分配全局 `REQ-*`。

## Non-functional Requirements

见 [prd.md §8](prd.md)。

## Constraints

- 第三方宿主 UI/API 决定插件可实现的登录呈现；
- 当前公开 Script API 没有稳定的第三方 `presentWebView()` 契约；
- Stash HTTP/3 不进入其 HTTP Engine；
- Session 必须本地、最小化、不可进入日志；
- JS Core 必须能构建为无 Node runtime 依赖的单文件脚本；
- Stash Settings 页面由 bundle 内资源经 HTTP Script synthetic response 提供；Settings 路径在普通业务流前 short-circuit；不存在远程 UI/backend。
- Stash Interception Scope 计划允许 `*.swufe.edu.cn`，Routing Scope 只包含 Settings 中启用的精确域；wildcard/HTTP/QUIC 相关 host 能力尚未实机确认。

## Edge Cases

见 [prd.md §9](prd.md)。

## Out of Scope

见 [prd.md §5](prd.md)。

## Open Questions

| ID | 问题 | 影响 | 状态 | 阻塞实现？ |
| --- | --- | --- | --- | --- |
| Q-001 | URL 是否 App 内呈现 | 登录 UX | Closed：系统 Safari | No |
| Q-002 | 登录网页流量是否可被 Script 观察 | 自动 Session Capture | Closed：可观察 | No |
| Q-003 | 最小 WebVPN Cookie 集与过期信号 | 数据最小化 | Open / P0 | 部分 |
| Q-004 | Loon 目标域 QUIC 最佳策略 | 稳定性 | Open / M3 | No |
| Q-005 | Body Script 上限 | 性能/可靠性 | Open / M4 | No |
| Q-006 | Stash secure random token source、Origin/Referer 信息及 synthetic response 能力 | Settings API CSRF/合成路由 | Open / Gate D | 是；失败时拒绝开放写 API并采用静态 scope |
| Q-007 | wildcard MitM、SWUFE 子域 script match、HTTP 子域 force-http-engine | 动态自定义 Domain | Open / Gate D | 是；失败时改用静态 interception 列表 |
| Q-008 | `DOMAIN-SUFFIX,swufe.edu.cn` QUIC 规则在目标 iOS Override 真机命中与 TCP 回落 | 子域 HTTPS script | Open / Gate D | M2 发布前 |
| Q-009 | Tile `$done({url})` 动态切换到 Settings 是否可靠 | Tile Journey | Open / M2 | 否；固定 Settings + 独立登录按钮为退化 |
| Q-010 | 16 KiB 以上 Settings POST 能否本地 413 且保证不被 Stash `max-size` 跳过后发往 upstream | Settings API 安全 | Open / Gate D | 是；失败则不能交付 POST API |

## Acceptance Criteria

见 [prd.md §10](prd.md)，Requirement → Verification 映射见 [verification.md](verification.md)。
