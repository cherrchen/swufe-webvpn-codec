# Feature: iOS Proxy Client Plugins

> Spec ID: 003  
> Status: Draft  
> Owner: cherrchen  
> Created: 2026-09-24  
> Related: REQ-002 / REQ-005 / REQ-006 / REQ-007 / NFR-002 / NFR-003

> 本文件回答 **What / Why**。**不写**技术方案（→ [design.md](design.md)）、任务拆解（→ [tasks.md](tasks.md)）。
> 本文中的 `IOS-REQ-*` / `IOS-NFR-*` / `AC-IOS-*` 等编号是**本 Spec 局部编号**；项目级需求（REQ-*、NFR-*）的定义仍在 [docs/requirements/](../../docs/requirements/README.md)，本 Spec 只引用。完整产品需求以 [prd.md](prd.md) 为准；交互见 [ui-ux.md](ui-ux.md)，领域边界见 [domain.md](domain.md)。Draft 阶段不在 `functional-requirements.md` 占用新全局 REQ 编号。

本文件是仓库 Spec 体系的 **What / Why** 入口。

## Status

`Draft`

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

见 [prd.md §7](prd.md)，使用 `IOS-REQ-*` 作为本 Feature 内部 ID。并入长期 `docs/requirements/functional-requirements.md` 时再分配全局 `REQ-*`，避免 Draft 阶段提前占用仓库编号。

## Non-functional Requirements

见 [prd.md §8](prd.md)。

## Constraints

- 第三方宿主 UI/API 决定插件可实现的登录呈现；
- 当前公开 Script API 没有稳定的第三方 `presentWebView()` 契约；
- Stash HTTP/3 不进入其 HTTP Engine；
- Session 必须本地、最小化、不可进入日志；
- JS Core 必须能构建为无 Node runtime 依赖的单文件脚本。

## Edge Cases

见 [prd.md §9](prd.md)。

## Out of Scope

见 [prd.md §5](prd.md)。

## Open Questions

| ID | 问题 | 影响 | 状态 | 阻塞实现？ |
| --- | --- | --- | --- | --- |
| Q-001 | URL 是否 App 内呈现 | 登录 UX | Open / P0 | 部分 |
| Q-002 | 登录网页流量是否可被 Script 观察 | 自动 Session Capture | Open / P0 | Yes |
| Q-003 | 最小 WebVPN Cookie 集与过期信号 | 数据最小化 | Open / P0 | 部分 |
| Q-004 | Loon 目标域 QUIC 最佳策略 | 稳定性 | Open / M2 | No |
| Q-005 | Body Script 上限 | 性能/可靠性 | Open / M4 | No |

## Acceptance Criteria

见 [prd.md §10](prd.md)，Requirement → Verification 映射见 [verification.md](verification.md)。
