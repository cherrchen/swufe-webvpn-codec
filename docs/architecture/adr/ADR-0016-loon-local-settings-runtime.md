# ADR-0016：Loon 复用本地 Settings 与共享插件运行流程

> Status: Accepted  
> Date: 2026-10-01  
> Owner: cherrchen

## Context

Spec 003 M3 需要 Loon 与 Stash 保持站点、Gateway Session 与安全 Trace 的行为一致。用户已确认 Loon 复用 Stash 本地虚拟设置页。Loon 的公开 Script API 未提供安全随机数契约，不能假设其 JavaScriptCore 支持 Web Crypto，也不能用弱随机值生成 Settings nonce。

## Decision

1. `packages/webvpn-plugin-runtime` 承载宿主无关的设置页资源、会话编排、响应上下文推导与 Trace；只依赖 Core 和注入的 runtime，不访问宿主全局。Loon/Stash Adapter 映射各自 API。Stash 原生导航 redirect 仍只在 Stash request entry 使用。
2. Loon 使用本地 Settings V2 页面与同一合成 API，站点仅按精确 hostname 转发；无 BoxJS、远程运行时页面或服务。两个宿主各用自己的 persistent store，不共享跨宿主 Cookie。
3. Loon 页面在 Safari 的安全 HTTPS 上下文通过 Web Crypto 生成 128-bit nonce，经 GET Settings API 的 `X-SWUFE-Settings-Bootstrap` header 提交。Adapter 只接受精确 HTTPS origin/API path、精确 Settings 页面 Referer、无冲突 Origin、32 位十六进制 nonce；否则不开放 API。
4. Core 存储并回传该 nonce，POST 使用既有 one-use token、两分钟 TTL、来源、JSON、16 KiB、schema/hostname 校验。GET/POST/异常/未知 Settings path 都只在本机终结，无 CORS 开放。页面、header、nonce、Settings body 和 Session 值不得进入诊断。
5. Browser bootstrap 依赖同源隔离和 custom-header preflight：跨站网页不能读取合成 API，也不能提交通过来源检查的 bootstrap。它不防御已被控制的同源网页、设备或代理宿主。缺失安全随机能力或可信 Referer 时 fail closed；不回退弱随机或远程随机服务。
6. `.plugin` 使用 Build 983+ 新 Script 语法。Settings request 优先；普通 request 不读取 body；raw authserver response 只读 header；文本 response 与其它 header-only response 分开。Argument 仅覆盖启用与脱敏 debug；站点设置来自本地页。
7. QUIC 仅对 SWUFE suffix 拒绝以尝试 TCP 回落；wildcard MitM 为本地 Interception Scope，精确站点列表为 Routing Scope。原生 Gateway response 不进行自 promotion；Loon 两阶段 URL 语义、QUIC、Settings 来源/大小边界与 E2E 必须独立真机验证。

## Consequences

- 避免复制业务与会话策略；抽取须通过原有 Stash 回归。
- Loon 的 nonce 来源不同于 Stash；ADR-0014 的 Stash 决策保持有效，本 ADR 仅扩展 Loon 与共享实现边界，不取代既有安全策略。
- 自动化测试与官方文档不能替代设备验收；Spec 003 在真机与 M4 门槛满足前保持 In Progress。

## References

- [Spec 003 design](../../../specs/003-ios-proxy-client-plugins/design.md)、[interfaces](../../../specs/003-ios-proxy-client-plugins/interfaces.md)
- [ADR-0014](ADR-0014-stash-local-settings-and-routing-scope.md)、[ADR-0015](ADR-0015-session-realm-and-proxy-reuse.md)
- [Loon Plugin](https://nsloon.app/docs/Plugin/)、[新 Script 语法](https://nsloon.app/docs/Script/script_v2/)、[Script API](https://nsloon.app/docs/Script/script_api/)：宿主语法与 API 契约
