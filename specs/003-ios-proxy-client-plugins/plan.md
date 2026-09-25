# Implementation Plan: iOS Proxy Client Plugins

> Spec ID: 003  
> Status: In Progress  
> Owner: cherrchen  
> Last Updated: 2026-09-24

## Strategy

先验证最不确定的宿主登录能力，再做共享 Core，然后按 **Stash → Loon** 顺序实现（Stash 首发宿主），最后完成安全、性能、GitHub 发布与长期文档同步。详细项目管理见 [project-management.md](project-management.md)。

## Phases

### Phase P0 — Host Capability

- 目标：验证 URL 呈现、CAS/MFA、Script 可观察性与 Session Capture。
- 交付物：Loon/Stash 最小 PoC + 真机证据。
- 退出条件：Q-001/Q-002 对两个宿主都有明确结论；至少一个宿主能自动捕获 Session，或路线重新决策。
- 2026-09-24 已退出：两边 URL 都打开系统 Safari；两边脚本都能看见登录后的 gateway 请求。继续 M1，不改 Companion App。

### Phase M1 — Shared Core

- 目标：JS Core + Python/JS 共享 vectors。
- 交付物：codec/routing/session/request/response/safe diagnostics。
- 退出条件：L0/L1 全绿且无 Host API 泄漏。

### Phase M2 — Stash（首发宿主）

- 目标：Stash Adapter、`.stoverride`、Tile、HTTP/3 fallback、bundled Settings WebUI/pseudo API、Settings V2 migration、动态精确 allowlist、E2E。
- 退出条件：Stash 主路径和 Settings E2E 通过；wildcard interception 通过真机，或产品明确退化为静态 interception；未选目标 PASS 与 Settings endpoint no-upstream 已有证据。

### Phase M3 — Loon

- 目标：Loon Adapter、`.plugin`、bundle、Session 通知、QUIC 路径、E2E。
- 退出条件：Loon 主路径与禁用/更新冒烟通过。

### Phase M4 — Hardening & Release

- 目标：body 压测、会话过期、安全审计、文档、GitHub 安装链接、rollback。
- 退出条件：`verification.md` 中 Must 项无 Pending。

## Dependencies

| 依赖项 | 类型 | 阻塞内容 | 解除条件 |
| --- | --- | --- | --- |
| Loon/Stash 真机 | 外部 | P0 | 完成实机验证 |
| 合法 SWUFE 测试账号 | 外部 | CAS/MFA/E2E | 测试者自行登录 |
| 学校 WebVPN 在线 | 外部 | E2E | 服务可访问 |
| Python codec vectors | 内部 | M1 | 共享向量生成完成 |
| 宿主 Script API | 外部 | M2/M3 | 版本兼容检查通过 |

## Migration

Settings 从 `swufe.settings.v1` 迁移到 `swufe.settings.v2`，V1 exact hosts 规范化为 builtin/custom host，V1 wildcard 强制关闭；详见 [data-model.md §16](data-model.md)。Settings migration 不触碰独立的 `swufe.session.v1`。未知 Session schema 仅按 Session 自身兼容规则处理，不因 Settings 升级主动清除。

## Rollback

| 场景 | 回滚动作 | 影响范围 | 验证 |
| --- | --- | --- | --- |
| 新 bundle 失败 | 固定回上一 release/version | 单宿主 | 重新安装 + smoke |
| Session schema 不兼容 | 清 Session，要求重登 | 本机移动端 | 重登成功 |
| 单宿主回归 | 仅回滚该 Adapter | Loon 或 Stash | 另一宿主不受影响 |
| WebVPN 协议变化 | 暂停自动 rewrite 或回退官方 WebVPN | 移动端 | 不泄露 Session、不发错误 WRD 请求 |

## Documentation Updates

实现阶段按 [project-management.md §12](project-management.md) 同步 README、requirements、architecture、api、security、roadmap 与 ADR；长期 `docs/**` 按仓库规则补 `.en.md`。

## Verification Plan

见 [test-plan.md](test-plan.md)、[test-cases.md](test-cases.md)、[verification.md](verification.md)。

## Open Questions

实现前 Gate D 需确认安全 nonce source、Origin/Referer/body host interface、synthetic response、wildcard MitM、HTTP force-engine 与 QUIC suffix rule；见 [project-management.md §10](project-management.md) 与 [verification.md](verification.md)。
