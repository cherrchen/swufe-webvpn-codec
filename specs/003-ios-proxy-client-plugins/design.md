# Technical Design: iOS Proxy Client Plugins

> Spec ID: 003  
> Status: Approved  
> Owner: cherrchen  
> Last Updated: 2026-09-25

本文件是仓库 Spec 体系的 **How** 入口。完整技术内容拆分为：

- [architecture.md](architecture.md)
- [interfaces.md](interfaces.md)
- [data-model.md](data-model.md)
- [ui-ux.md](ui-ux.md)

## Context

Desktop 当前由 Electron + mitmproxy + Python `WrdCodec` 实现。Loon/Stash 已提供移动端网络接管、HTTPS MitM 与 HTTP Script，移动端不应再复制这些基础设施。

## Proposed Solution

新增共享 `packages/webvpn-core-js`，Loon/Stash 只实现 Host Adapter 与各自配置制品。**Stash 为首发宿主**，Loon 为第二实现；制品与脚本经 GitHub 分发。WRD 行为由现有 Python 实现与共享测试向量约束。

## Architecture Impact

| 影响对象 | 是否变化 | 说明 | 后续需同步长期文档 |
| --- | --- | --- | --- |
| 组件/分层 | 是 | 新增 JS Core + Loon/Stash Adapter | architecture/components |
| 数据流 | 是 | 新增 iOS Host HTTP Engine 路径 | architecture/data-flow |
| 接口 | 是 | 新增 Core/Adapter contracts | architecture/interfaces + api |
| 数据模型 | 是 | 新增 PluginSettings/SessionRecord | architecture/data-model |
| desktop | 否 | 行为保持不变，作为回归与协议基线 | 仅补总体架构描述 |
| ADR | 是 | Settings pseudo WebUI、动态 Routing/Interception 边界 | [ADR-0014](../../docs/architecture/adr/ADR-0014-stash-local-settings-and-routing-scope.md) |

## Components

见 [architecture.md §4-5](architecture.md)。

## Data Flow

见 [architecture.md §8-10](architecture.md)。

## API Changes

见 [interfaces.md](interfaces.md)。

## Data Model Changes

见 [data-model.md](data-model.md)。

## UI/UX Changes

见 [ui-ux.md](ui-ux.md)。

## Security Considerations

核心约束：M2 只实现 webvpn-gateway Session Realm。Gateway Session 只发送给 webvpn.swufe.edu.cn：普通目标 WRD upstream 与通过 Gateway Request Kind 分类的直接 Gateway 请求均可按策略注入；authserver/普通源站/Settings namespace 不得接收。客户端已有 ticket 时保留并 capture/refresh；LOGIN/LOGOUT 不被旧 Session injection 破坏。CAS Cookie、密码和 MFA 不持久化。未来 cas-sso 仅为默认关闭、独立威胁建模/存储/生命周期的研究项，不属于 M2。日志使用 Safe Auth Trace allowlist。Stash Interception Scope 与 WebVPN Routing Scope 分开；无自建云端后端。Settings synthetic route、CSRF 防护与 wildcard MITM 的安全边界见 [architecture.md §12–14](architecture.md)。

## Performance Considerations

- header-only request 不读取 body；
- response body rewrite 设置大小上限；
- 宿主的时间/内存上限通过真机压测冻结，不在设计阶段虚构 SLA。

## Compatibility

- Loon/Stash 由独立 Adapter 隔离；
- Core bundle 不依赖 Node runtime；
- desktop 既有行为不改变；
- 持久数据显式 `schemaVersion`。

## Migration

Desktop 无数据迁移。Settings V1 → V2 migration 按 [data-model.md §16](data-model.md) 执行，且必须保留 `swufe.session.v1`。Session 自身 schema 兼容属于独立判断，Settings 升级不清 Session。

## Alternatives Considered

见 [architecture.md §18](architecture.md)。

## Risks

见 [project-management.md §9](project-management.md)。

## Open Questions

P0 未决项见 [README.md](README.md) 与 [project-management.md §10](project-management.md)。
