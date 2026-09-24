# M7：iOS 代理客户端插件

> Status: Draft  
> Owner: cherrchen  
> Target: TBD

## 目标

在 iPhone/iPad 上通过 Stash / Loon 插件（非独立 App）复用宿主代理、TUN 与 HTTPS MitM，完成与 desktop 语义一致的 WRD 改写、Session 注入与响应反向改写；共享 `packages/webvpn-core-js` 业务 Core，**Stash 为首发宿主**、Loon 为第二宿主；安装与更新经本仓库 GitHub 分发。

阶段顺序与任务细节见 [003 project-management.md](../../../specs/003-ios-proxy-client-plugins/project-management.md)：`P0 宿主能力（已完成）→ M1 Shared Core → M2 Stash → M3 Loon → M4 Hardening & Release`。

## 包含的 Specs

| Spec | 状态 | 依赖 |
| ---- | ---- | ---- |
| [003-ios-proxy-client-plugins](../../../specs/003-ios-proxy-client-plugins/spec.md) | Approved | 001（协议与 WRD 行为基线）、Python codec 测试向量 |

## 退出条件

- [ ] Spec 003 状态推进到 `Verified`（或等价：Must 验收项无 `Pending`，见 003 的 [verification.md](../../../specs/003-ios-proxy-client-plugins/verification.md)）
- [x] P0 Gate：Q-001/Q-002 对宿主有实机结论（URL 呈现与 Script 可观察 Session Capture；2026-09-24）
- [ ] 至少一个宿主（Loon 或 Stash）完成教务主路径 E2E
- [ ] Python/JS WRD 向量 parity；Session 安全红线测试通过
- [ ] 实现阶段按 003 的文档同步计划更新长期 `docs/` 与必要 ADR
- [ ] Desktop 回归无行为变化（桥与 Electron 壳）

## 风险

| 风险 | 影响 | 应对 |
| ---- | ---- | ---- |
| 宿主内网页登录流量不进 Script（R-IOS-002） | 高 | P0 前置；Gate A 决策 |
| Stash HTTP/3 绕过 HTTP Engine（R-IOS-004） | 高 | 目标域回落 TCP |
| 宿主 Script API 变更（R-IOS-009） | 中 | Adapter 隔离 + 版本 guard |

完整登记见 003 [project-management.md §9](../../../specs/003-ios-proxy-client-plugins/project-management.md)。

## 完成记录

（2026-09-24：Spec 003 标为 `Approved`，P0 Gate A 通过；M1 实现未启动。）
