# ADR-0014: Stash Uses a Local Pseudo WebUI for Exact WebVPN Site Selection

## Status

`Accepted`

## Date

`2026-09-25`

## Decision Owners

`cherrchen`

## Context

Spec 003 needs Stash users to enable or disable built-in SWUFE sites, add or remove custom hostnames, and apply saved choices to request routing immediately. Stash Scripts can read and write `$persistentStore`, rewrite HTTP requests, and synthesize a response from a request Script; a Safari page cannot directly access Stash persistent storage.

Allowing users to dynamically select a new SWUFE subdomain is incompatible with declaring only the current allowlist in Stash's MitM list: a host outside that list never enters the HTTP Engine, so a Script cannot expand MitM at runtime.

## Decision

1. Stash's first release provides a small Settings page from HTML/CSS/JS bundled with the plugin. A request Script synthesizes the page and pseudo API responses under `https://webvpn.swufe.edu.cn/__swufe_bridge__/`.
2. The Settings API reads and writes only Stash's local `$persistentStore`. The plugin does not add BoxJS, a cloud configuration service, GitHub Pages, CDN-hosted UI, a localhost server, or a `file://` page.
3. The Settings namespace short-circuits before Session Capture, Routing, WRD Codec, and ordinary response rewriting. No Settings path may reach the real WebVPN upstream.
4. The business Routing Scope contains only exact hostnames enabled in Settings. Stash's Interception Scope may include `*.swufe.edu.cn` so a new hostname can be routed without reinstalling the Override. **Interception does not imply WebVPN routing**: unselected hosts must PASS unchanged, without URL/header/body changes, Session Cookie injection, or a gateway request.
5. Custom hosts are limited to valid exact `.swufe.edu.cn` subdomains; gateway and authserver are permanently reserved. Settings V1-to-V2 migration maps existing exact hosts into built-in/custom entries and disables legacy wildcard routing; it does not modify `swufe.session.v1`.
6. Each new business request reads the latest Settings and compiles its RoutingPolicy. Settings HTML, CSS, JS, status responses, and errors never expose Session, CAS Cookie, Authorization, MFA, or WRD secrets.
7. Wildcard MitM, subdomain HTTP force-engine, the QUIC suffix rule, synthetic request responses, cryptographic nonces, and no-upstream behavior for oversized POSTs must be validated on the target Stash version. This decision freezes the architecture; it does not claim these host settings passed this project's device tests. If a critical capability fails, Settings may manage only statically declared hosts; arbitrary custom Domain support pauses and its acceptance scope must be updated.

## Alternatives

| Option | Benefits | Drawbacks | Reason not selected |
| --- | --- | --- | --- |
| Bundled Stash pseudo WebUI + API | Self-contained, user-managed, local persistence, no plugin reinstall | Requires verification of synthetic responses/CSRF/body guards; wildcard MitM expands locally decryptable subdomains | Selected; control with exact Routing Scope, user disclosure, and device gates |
| BoxJS | Existing Stash UI/persistent-storage pattern | Adds runtime/config dependency and much more functionality than needed | Conflicts with self-contained requirement |
| Remote WebUI / GitHub Pages / cloud backend | UI can update independently | Requires online service and couples Settings to an external origin | Rejected |
| File URL or localhost HTTP server | Familiar browser entry point | File origin cannot access Stash store; localhost requires a real listening service | Does not fit Stash Script model |
| Static target hosts in Override | Narrower MitM scope and clear host declaration | Adding a site requires an Override update; does not support arbitrary dynamic SWUFE selection | Fallback only if wildcard support is unavailable |

## Consequences

### Positive

- Users manage sites in Stash; settings remain on-device and apply to later requests immediately.
- Loon/Desktop Core boundaries stay host-independent; the Stash page, synthetic responses, and persistent store remain in the Stash Adapter.
- Unselected SWUFE subdomains receive neither WebVPN Cookies nor WRD routing even when the HTTP Engine intercepts them.

### Negative

- Users must be told that Stash can locally decrypt SWUFE HTTPS inside the Interception Scope, even when a site is not enabled.
- Settings write endpoints need one-use nonces, origin checks, strict schemas, body limits, and namespace short-circuiting.
- Stash device validation is a release gate; if dynamic interception is unavailable, product scope must be narrowed.

### Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| An intercepted but unselected host is accidentally rewritten through WebVPN | Low | High | Exact-only Routing Scope; PASS and Cookie-negative cases for unselected hosts |
| Cross-site Settings API writes or request bodies leak upstream | Medium | High | One-use random token, Origin/Referer, JSON, 16 KiB limit, namespace short-circuit, oversized POST device test |
| Stash wildcard/synthetic-response behavior differs by version | Medium | High | Record device/version evidence; do not treat docs as project validation |

## References

- Requirements: `specs/003-ios-proxy-client-plugins/prd.md` IOS-REQ-013/014/015 and AC-SETTINGS-001..017
- Related Spec: `specs/003-ios-proxy-client-plugins/`
- Related ADR: ADR-0007 (gateway-owned namespace)
- Stash docs: `https://stash.wiki/en/configuration/override`, `https://stash.wiki/en/http-engine/mitm`, `https://stash.wiki/en/script/rewrite-requests`, `https://stash.wiki/en/rules/rule-types`
