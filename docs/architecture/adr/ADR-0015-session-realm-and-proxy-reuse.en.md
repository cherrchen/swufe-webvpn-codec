# ADR-0015: Separate Session Realms and Reuse Gateway Sessions at the Proxy Layer

> Chinese source of truth: [ADR-0015-session-realm-and-proxy-reuse.md](ADR-0015-session-realm-and-proxy-reuse.md)

## Status

`Accepted`

## Date

`2026-09-25`

## Decision owners

`cherrchen`

## Context

Spec 003 Stash M2 can observe Safari's WebVPN login traffic, capture the Gateway Cookie and persist it in `swufe.session.v1`. The Core also injects the saved Gateway Session into WRD Gateway requests for ordinary campus hosts. Safari and a third-party App's WKWebView usually have different Cookie Jars.

Today a direct request to `webvpn.swufe.edu.cn` with no Cookie passes through even when the Plugin Gateway Session Store has a usable ticket. The Gateway may therefore treat another App/WKWebView as logged out. This is separate from whether CAS Cookies are shared.

CAS/SSO runs on `authserver.swufe.edu.cn`. This change does not capture, store or inject CAS Cookies. A CAS page appearing again can mean the Gateway Session was not injected or expired, or that a business site requested CAS after Gateway authentication. The page alone does not establish the cause.

Desktop ADR-0007 describes desktop bridge and browser-session behavior. This ADR defines proxy-layer reuse for Spec 003; it does not change ADR-0007 or claim native Cookie sharing between Safari and WKWebView.

## Decision

1. **Define separate Session Realms.**

   ```ts
   type SessionRealm = "webvpn-gateway" | "cas-sso"
   ```

   M2 implements only `webvpn-gateway`. The current `SessionRecordV1` and `swufe.session.v1` implicitly represent this Realm. This decision does not require a schema migration. The Gateway Session belongs to `webvpn.swufe.edu.cn`, may be captured from Safari's post-login Gateway traffic, and may be stored locally by Stash/Loon.

   Future `cas-sso` support would require a separate high-risk, optional review: off by default, separately threat-modeled and separately stored and expired, with injection only to `authserver.swufe.edu.cn`. It must never be concatenated with Gateway Cookies or moved into the Gateway Store. A CAS Session Bridge is not part of this phase.

2. **Provide Inter-App Gateway Session Reuse at the proxy layer.**

   `Browser Cookie Jar != Plugin Gateway Session Store`. Safari, each WKWebView and each App may keep a separate Cookie Jar. Requests handled by the same Stash/Loon proxy can use the Plugin Gateway Session Store. The proxy does not modify a client's Cookie Jar. This applies only when the request actually passes through the host HTTP Engine and script.

   Gateway Session may only be sent to the exact host `webvpn.swufe.edu.cn`. It must not be sent to ordinary `.swufe.edu.cn` origins or authserver. It does not widen MitM or Routing Scope, and authserver Cookies are not rewritten to the Gateway domain.

3. **Classify Gateway requests before injection.**

   | Kind | Decision |
   | --- | --- |
   | SETTINGS_NAMESPACE | Terminate locally; no upstream, capture or injection |
   | WRAPPED_RESOURCE | `/http/<token>/...` or `/https/<token>/...`; inject only if no request ticket and session is ready |
   | GATEWAY_ROOT | Reuse only when the classifier confirms no login intent; explicit or unknown intent disables it |
   | GATEWAY_STATIC / GATEWAY_OWNED | Enable class by class only with protocol evidence; otherwise no injection |
   | LOGIN | Do not inject a stored Session; preserve the official login flow |
   | LOGOUT | Do not inject; clear the local Gateway Session once the real endpoint is confirmed |
   | AUTH_CALLBACK / OTHER | No injection by default; pass through |

   `https://webvpn.swufe.edu.cn/__swufe_bridge__/...` is always the local Settings Namespace. Do not guess real endpoint pathnames in the absence of evidence. Unknown or unclassifiable requests fall back to no injection; injection is also disabled when the classifier cannot confirm there is no login intent. Desktop ADR-0007's `/wengine-vpn/` and `/authserver/` namespace facts do not automatically become iOS injection rules.

4. **The client's existing ticket and Cookies take priority.**

   If a request already carries the core ticket `wengine_vpn_ticketwebvpn_swufe_edu_cn`, do not inject or replace it with the stored ticket. Preserve the request Cookies, capture/refresh the new request Session (for example A updated to B), then pass through. With no ticket, inject at the proxy layer only when the Gateway Request Kind permits it, the classifier confirms `loginIntent=none`, and the stored Gateway Session has a readable schema, matching host, ticket and unexpired lifetime. Otherwise pass through so the official login flow can continue. Injection must not replace any same-name Cookie already in the request.

5. **Keep Gateway and CAS causality distinct.**

   Raw requests to `authserver.swufe.edu.cn` pass through without Gateway Session injection or CAS Cookie/credential capture. A WRD URL on Gateway that decodes to `originalHost=authserver.swufe.edu.cn` is still a network request to Gateway. Trace records request host and decoded original host separately and does not add authserver to ordinary Routing Scope.

   In a `tyxycg.swufe.edu.cn` flow, a missing/uninjected Gateway Session may lead Gateway to redirect to CAS. A business site may also request CAS after Gateway accepted its session. The latter does not mean Gateway Session reuse failed. Clear Gateway Session only on explicit Gateway expiry evidence.

6. **Diagnose with a Safe Auth Trace without recording secrets.**

   Local Trace allowlist: timestamp, request host, pathname classification, route kind, Gateway Request Kind, ticket presence, stored Session existence/state, injection result, client Cookie precedence, WRD flag, decoded original host, redirect target host, necessary Cookie names, only the target hostname parsed from a CAS `service` parameter, and the login-intent classification.

   Never record Cookie values, Gateway ticket values, CAS tickets, `execution`, Authorization, account/password/MFA, a full query, full service URL, long hexadecimal WRD token or request/response body. Trace is not written to Settings DTOs, notifications, cloud services or the Gateway Session Store.

7. **Keep verification status separate from the design decision.**

   This ADR freezes the design; it does not mean direct Gateway injection, logout pathname, Safe Auth Trace or tyxycg device diagnosis have been implemented or passed. Spec 003 cases N02–N10 stay Pending until each has device evidence.

## Alternatives

| Alternative | Why not chosen |
| --- | --- |
| Rely on Safari and WKWebView sharing a Cookie Jar | Client Cookie containers are independent and cannot be assumed to provide proxy behavior |
| Keep passing all direct Gateway requests without a Cookie | Ignores a local Gateway Session and sends a cross-App request back into Gateway login |
| Inject unconditionally on every Gateway path | Could interfere with explicit login, logout, Settings, callback or unknown endpoints |
| Store CAS Cookie in the existing SessionRecordV1 | Mixes credentials for different hosts/Realms and expands the exposure boundary |
| Rewrite CAS Cookie Domain or concatenate it with Gateway Cookies | Changes origin security boundaries without protocol basis |

## Consequences

### Positive

- Safari-captured Gateway Sessions can be reused by other Apps/WKWebViews through Stash/Loon when classification permits.
- A new ticket supplied by the client remains first; Settings, CAS host and ordinary origins stay isolated.
- Trace can distinguish raw authserver from WRD-wrapped authserver and a Gateway redirect from a business site's own CAS redirect.

### Negative

- M2 needs classifier, direct Gateway injection, login/logout safety and Safe Auth Trace work, followed by Stash device verification.
- Actual Gateway login/logout/callback pathnames still need device evidence; the conservative fallback may temporarily skip some otherwise reusable requests.
- Even after Gateway reuse succeeds, a third-party App may lack a CAS Cookie and ask the user to complete official CAS/MFA in that App.

## References

- [Spec 003 PRD](../../../specs/003-ios-proxy-client-plugins/prd.md)
- [Spec 003 Domain](../../../specs/003-ios-proxy-client-plugins/domain.md)
- [Spec 003 Interfaces](../../../specs/003-ios-proxy-client-plugins/interfaces.md)
- [Spec 003 Verification](../../../specs/003-ios-proxy-client-plugins/verification.md)
- [ADR-0007: Desktop gateway-owned namespace and promotion](ADR-0007-gateway-owned-namespaces-and-native-mode-promotion.en.md)
