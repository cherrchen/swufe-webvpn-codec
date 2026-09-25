# ADR-0014：Stash 使用本地 pseudo WebUI 管理精确 WebVPN 站点

## Status

`Accepted`

## Date

`2026-09-25`

## Decision Owners

`cherrchen`

## Context

Spec 003 需要用户在 Stash 安装后启用/禁用内置 SWUFE 网站、添加/移除自定义 hostname，并在保存后立即影响请求路由。Stash Script 可读写 `$persistentStore`、改写 HTTP request，并可由 request script synthetic response；Safari 页面不能直接调用 Stash persistent store。

允许用户动态选择任意新的 SWUFE 子域，与仅在 Stash MitM 列表里声明当前 allowlist host 不兼容：未声明 host 不会进入 HTTP Engine，Script 无法在运行后动态扩大 MitM。

## Decision

1. Stash 首发以随插件 bundle 发布的轻量 HTML/CSS/JS 提供 Settings 页面；request Script 在 `https://webvpn.swufe.edu.cn/__swufe_bridge__/` 下直接合成页面与 pseudo API response。
2. Settings API 仅读写 Stash 本机 `$persistentStore`。插件不引入 BoxJS、云端配置服务、GitHub Pages、CDN 页面、localhost server 或 `file://` 页面。
3. Settings namespace 在 Session Capture、Routing、WRD Codec 与普通 response rewrite 之前 short-circuit；任何 Settings 路径都不得访问真实 WebVPN upstream。
4. 业务 Routing Scope 只包含 Settings 中启用的精确 hostname。Stash Interception Scope 可包含 `*.swufe.edu.cn`，以便保存后无需重装 Override 即可路由新域。**被拦截不等于被 WebVPN 代理**：未选择 host 必须原样 PASS，不改 URL/header/body、不注入 Session Cookie、不请求 gateway。
5. 自定义 host 仅允许合法、精确 `.swufe.edu.cn` 子域；gateway/authserver 为永久保留 host。Settings V1→V2 migration 将已有精确 host 转成 builtin/custom 列表，并关闭旧 wildcard routing；不修改 `swufe.session.v1`。
6. 站点设置保存后，每个新业务请求读取最新 Settings 并编译 RoutingPolicy。Settings HTML、CSS、JS、状态响应与错误不暴露 Session、CAS Cookie、Authorization、MFA 或 WRD secret。
7. Wildcard MitM、子域 HTTP force-engine、QUIC suffix rule、request script synthetic response、crypto nonce 与超限 POST no-upstream 行为必须在目标 Stash 版本真机验证。此决策只冻结架构，不声称这些宿主配置已通过项目实机验证。关键能力失败时，Settings 只可管理静态声明 host；任意自定义 Domain 暂停并更新验收范围，不得虚报动态支持。

## Alternatives

| 方案 | 优点 | 缺点 | 未采纳原因 |
| --- | --- | --- | --- |
| Stash 本地 bundled pseudo WebUI + API | 自包含、用户直接管理、persistent store 本地化、无需重新下载插件 | 需要验证 Script synthetic response/CSRF/body gate；wildcard MitM 扩大本机可解密子域 | 采用；风险由精确 Routing Scope、用户披露和真机门禁控制 |
| BoxJS | 已有 Stash WebUI/persistent-store 类似模式 | 新增 runtime/config 依赖，功能远超项目需求 | 不符合自包含要求 |
| 远程 WebUI / GitHub Pages / 云端 backend | UI 可独立更新 | 需要在线服务，Settings 与外部来源耦合 | 不采用 |
| file URL 或 localhost HTTP server | 浏览器入口熟悉 | file origin 不能访问 Stash store；localhost 要求真实监听服务 | 不符合 Stash Script 模型 |
| 只在 Override 声明静态目标 host | MitM 面更窄、宿主范围直观 | 用户新增站点后要重新更新 Override；无法满足安装后自由管理任意 SWUFE 子域 | 仅作宿主不支持 wildcard 时的退化方案 |

## Consequences

### Positive

- 用户可以在 Stash 里管理站点，设置保存在设备本机并在后续请求即时生效。
- Loon/Desktop Core 边界保持宿主无关；Stash 页面、synthetic response 与 persistent store 由 Stash Adapter 负责。
- 未选中的 SWUFE 子域即使被 HTTP Engine 捕获，也不会获得 WebVPN Cookie 或 WRD 路由。

### Negative

- 用户需知晓 Stash 可在设备本地解密其 Interception Scope 内的 SWUFE HTTPS，即使网站未被启用。
- Settings API 写入端点需要 one-use nonce、来源校验、严格 schema、body size guard 与 route short-circuit。
- Stash 实机验证是发布门槛；无法动态拦截时必须缩小产品承诺。

### Risks

| 风险 | 可能性 | 影响 | 缓解措施 |
| --- | --- | --- | --- |
| 未选中的拦截域意外被 WebVPN rewrite | 低 | 高 | exact-only Routing Scope；未选域 PASS 与 Cookie negative cases |
| Settings API 被跨站调用或 body 上游泄露 | 中 | 高 | 随机 one-use token、Origin/Referer、JSON、16 KiB 限制、所有命名空间请求 short-circuit、超限 POST 设备测试 |
| Stash wildcard / synthetic response API 与文档描述有版本差异 | 中 | 高 | 记录设备版本真机验证；不把官方能力描述当项目验证 |

## References

- 相关需求：`specs/003-ios-proxy-client-plugins/prd.md` IOS-REQ-013/014/015、AC-SETTINGS-001..017
- 相关 Spec：`specs/003-ios-proxy-client-plugins/`
- 相关 ADR：ADR-0007（gateway-owned namespace）
- Stash 官方资料：`https://stash.wiki/en/configuration/override`、`https://stash.wiki/en/http-engine/mitm`、`https://stash.wiki/en/script/rewrite-requests`、`https://stash.wiki/en/rules/rule-types`
