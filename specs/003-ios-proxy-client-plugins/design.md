# Technical Design: iOS Proxy Client Plugins

> Spec ID: 003  
> Status: Approved  
> Owner: cherrchen  
> Last Updated: 2026-09-24

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
| ADR | 是 | 第三方宿主、共享 Core、AES backend | 新 ADR |

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

核心约束：不存密码；Session 只注入 gateway；authserver 不持久化认证 Cookie/表单；日志脱敏；MitM scope 最小化；无自建云端后端。

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

Desktop 无数据迁移。移动端 storage 使用独立 schema；无法安全迁移的 Session 直接清除并要求重新登录。

## Alternatives Considered

见 [architecture.md §16](architecture.md)。

## Risks

见 [project-management.md §9](project-management.md)。

## Open Questions

P0 未决项见 [README.md](README.md) 与 [project-management.md §10](project-management.md)。
