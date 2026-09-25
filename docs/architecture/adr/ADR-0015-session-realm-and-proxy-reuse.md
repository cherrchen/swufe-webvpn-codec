# ADR-0015：分离 Session Realm，并在代理层复用 Gateway Session

## Status

`Accepted`

## Date

`2026-09-25`

## Decision Owners

`cherrchen`

## Context

Spec 003 的 Stash M2 已能观察 Safari 的 WebVPN 登录流量、捕获 Gateway Cookie 并持久化到 `swufe.session.v1`；普通校内目标被改写为 WRD Gateway request 时，Core 也已注入保存的 Gateway Session。Safari 与第三方 App 内 WKWebView 通常使用不同 Cookie Jar。

目前直接访问 `webvpn.swufe.edu.cn` 的无 Cookie request 会 pass-through，即使 Plugin Gateway Session Store 已有有效票据。这会让另一个 App/WKWebView 被 Gateway 当作未登录客户端送入登录流程。该问题与 CAS Cookie 是否共享是两个独立问题。

CAS/SSO 位于 `authserver.swufe.edu.cn`。本轮不捕获、不存储、不注入 CAS Cookie。某个 App 再次显示 CAS 页面，既可能是 Gateway Session 未注入/失效，也可能是 Gateway 已成功访问业务站点后由业务系统另行要求 CAS；仅凭页面出现不能确定根因。

桌面 ADR-0007 约束桌面 bridge 和浏览器自身 gateway session 的行为。本 ADR 定义 Spec 003 的代理层 Session reuse，不修改桌面 ADR-0007，也不声称 Safari 与 WKWebView 原生共享 Cookie。

## Decision

1. **定义相互独立的 Session Realm。**

   ```ts
   type SessionRealm = "webvpn-gateway" | "cas-sso"
   ```

   M2 只实现 `webvpn-gateway`。当前 `SessionRecordV1` 与 `swufe.session.v1` 隐含该 Realm，不为本决策强制迁移 schema。Gateway Session 属于 `webvpn.swufe.edu.cn`，可从 Safari 登录后的 Gateway 流量捕获并由 Stash/Loon 本地安全持久化。

   未来 `cas-sso` 只可作为独立评审的高风险可选能力：默认关闭、单独威胁建模、单独 storage key、单独生命周期，只能发往 `authserver.swufe.edu.cn`，不得与 Gateway Cookie 拼接或迁移到 Gateway Store。本阶段不实现 CAS Session Bridge。

2. **通过代理层提供 Inter-App Gateway Session Reuse。**

   `Browser Cookie Jar != Plugin Gateway Session Store`。Safari、各 WKWebView 和 App 仍有各自 Cookie Jar；经同一 Stash/Loon 代理处理的请求可使用 plugin store 中的 Gateway Session。代理不会更改客户端 Cookie Jar。此能力仅适用于确实经过宿主 HTTP Engine/script 的请求。

   Gateway Session 只可发送给精确 host `webvpn.swufe.edu.cn`。不得发往普通 `.swufe.edu.cn` 源站或 authserver，不扩大 MitM/Routing Scope，不把 authserver Cookie 改 Domain 到 Gateway。

3. **先分类 Gateway request，再决定注入。**

   | Kind | Decision |
   | --- | --- |
   | SETTINGS_NAMESPACE | 本地终结，不上游、不 capture、不注入 |
   | WRAPPED_RESOURCE | `/http/<token>/...` / `/https/<token>/...`；request 无 ticket 且 session ready 时允许注入 |
   | GATEWAY_ROOT | 仅 classifier 确认 login intent 不存在时允许复用；显式或未知时禁用 |
   | GATEWAY_STATIC / GATEWAY_OWNED | 逐类按真机协议证据启用；未确认时不注入 |
   | LOGIN | 不注入 stored Session，保留官方登录流 |
   | LOGOUT | 不注入；真实 endpoint 确认后清本地 Gateway Session |
   | AUTH_CALLBACK / OTHER | 默认不注入并 pass |

   `https://webvpn.swufe.edu.cn/__swufe_bridge__/...` 永远按 Settings Namespace 处理。除已固定的 namespace 和 WRD URL 结构外，不在缺乏证据时假定真实 pathname。未知/无法分类请求采用 no-injection fallback；classifier 无法确认没有 login intent 时也不注入。desktop 的 `/wengine-vpn/` 与 `/authserver/` namespace 事实不会自动变成 iOS 注入规则。

4. **客户端已有 ticket/Cookie 优先。**

   请求已携带核心票据 `wengine_vpn_ticketwebvpn_swufe_edu_cn` 时，不得注入或覆盖为 stored ticket。保留请求 Cookie、capture/refresh 请求自己的新 Session（例如 A 更新为 B）后 pass。请求没有核心 ticket 时，仅当 Gateway Request Kind 允许、classifier 确认 `loginIntent=none`、stored Gateway Session schema/host/ticket/expiry 均可用时，才在代理层注入；否则 pass，允许官方登录流程继续。合并时不得覆盖客户端 Cookie 中已有的同名值。

5. **明确 Gateway 与 CAS 的因果边界。**

   raw `authserver.swufe.edu.cn` 请求 pass-through，不注入 Gateway Session、不捕获 CAS Cookie 或认证字段。Gateway 上的 WRD URL 若解码出 `originalHost=authserver.swufe.edu.cn`，仍是发往 Gateway 的网络请求；Trace 分开记录 request host 与 decoded original host，且不把 authserver 加入普通 Routing Scope。

   `tyxycg.swufe.edu.cn` 流程中，若 Gateway Session 缺失/未注入，Gateway 可重定向到 CAS；若 Gateway 已接受会话，业务站点也可能独立要求 CAS。后者不等于 Gateway Session 失败。只在有明确 Gateway 失效证据时清除 Gateway Session。

6. **使用 Safe Auth Trace 诊断而不记录秘密。**

   本地 Trace allowlist 包括 timestamp、request host、pathname classification、route kind、Gateway Request Kind、ticket 是否存在、stored Session 是否存在及状态、是否注入、客户端 Cookie 是否优先、是否为 WRD、decoded original host、redirect target host、必要 Cookie names、CAS `service` 参数解析出的 target hostname，以及 login intent 分类。

   禁止 Cookie value、Gateway ticket value、CAS ticket、`execution`、Authorization、账号/密码/MFA、完整 query、完整 service URL、长十六进制 WRD token 和 request/response body。Trace 不进入 Settings DTO、通知、云端或 Gateway Session Store。

7. **验证状态与设计决策分开。**

   本 ADR 冻结规范；不表示 direct Gateway injection、logout pathname、Safe Auth Trace 或 tyxycg 设备诊断已经实现/通过。Spec 003 N02–N10 在取得各自真机证据前保持 Pending。

## Alternatives

| Alternative | Why not chosen |
| --- | --- |
| 依赖 Safari 与 WKWebView 共享 Cookie Jar | 客户端 Cookie 容器彼此独立，不可作为代理能力前提 |
| 继续对所有直接 Gateway request 无条件 PASS | 会忽略本机已有 Gateway Session，导致无 Cookie 的跨 App request 重入 Gateway login |
| 对每个 Gateway path 无条件注入 | 会干扰显式登录、登出、Settings 与尚未确认的 callback/other endpoint |
| 把 CAS Cookie 存入现有 SessionRecordV1 | 混合不同 host/Realm 的凭据并扩大泄露边界；本阶段明确不做 |
| 把 CAS Cookie 改 Domain 或拼到 Gateway Cookie | 改变 origin 安全边界，且没有协议依据 |

## Consequences

### Positive

- Safari 捕获的 Gateway Session 可由 Stash/Loon 代理层复用于符合分类策略的其他 App/WKWebView Gateway request。
- 客户端自带的新 ticket 保持优先；Settings、CAS host 与普通源站继续隔离。
- Trace 可判断 raw authserver 与 WRD-wrapped authserver，也可区分 Gateway redirect 与业务系统自己的 CAS 跳转。

### Negative

- 需要 M2 增补 classifier、direct Gateway injection、login/logout safety 与 Safe Auth Trace，并分别完成 Stash 真机验证。
- Gateway login/logout/callback 的真实 pathname 尚需设备证据；保守 fallback 可能暂时不注入一部分安全可复用请求。
- Gateway Session 复用成功后，第三方 App 仍可能没有 CAS Cookie，因而需要用户在该 App 的官方页面完成 CAS/MFA。

## References

- [Spec 003 PRD](../../../specs/003-ios-proxy-client-plugins/prd.md)
- [Spec 003 Domain](../../../specs/003-ios-proxy-client-plugins/domain.md)
- [Spec 003 Interfaces](../../../specs/003-ios-proxy-client-plugins/interfaces.md)
- [Spec 003 Verification](../../../specs/003-ios-proxy-client-plugins/verification.md)
- [ADR-0007：桌面 Gateway-owned namespace 与 promotion](ADR-0007-gateway-owned-namespaces-and-native-mode-promotion.md)
