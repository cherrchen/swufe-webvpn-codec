# iOS 插件本地 Settings API

> Status: In Progress ｜ Owner: cherrchen ｜ Last Reviewed: 2026-10-01

提供方为 Stash/Loon Script Adapter，消费者为 Safari 中的 bundled Settings 页面。该接口是代理宿主内的合成 HTTP 响应，没有公网服务器或真实 socket listener，稳定性为 Evolving。

端点、DTO、错误、迁移与 nonce 契约统一定义在 [Spec 003 interfaces](../../specs/003-ios-proxy-client-plugins/interfaces.md)；Loon M3 的 bootstrap/native mapping 增补见其 §17。永久存储模型见 [data-model](../../specs/003-ios-proxy-client-plugins/data-model.md)。这里仅登记接口，不重复定义。

认证授权与本地终结安全边界见 [ADR-0014](../architecture/adr/ADR-0014-stash-local-settings-and-routing-scope.md)（Stash）和 [ADR-0016](../architecture/adr/ADR-0016-loon-local-settings-runtime.md)（Loon）。该 API 不返回 Session Cookie/密码/MFA，也不提供跨宿主会话导入。

兼容性：复用 V2 Settings/V1 Session，不改变 desktop IPC。Loon 新增 bootstrap header，仅影响 Loon 页面；缺失可信来源时 API fail closed。各宿主真机验证状态由 [verification](../../specs/003-ios-proxy-client-plugins/verification.md) 单独记录。
