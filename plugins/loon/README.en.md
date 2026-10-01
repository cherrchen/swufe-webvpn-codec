# SWUFE WebVPN · Loon

Local Spec 003 M3 implementation; device acceptance is pending. Further Stash development is paused and existing risk records remain in [verification](../../specs/003-ios-proxy-client-plugins/verification.md).

Requires **Loon 3.5.1 (983) or later** and uses new Script syntax. References: [Plugin](https://nsloon.app/docs/Plugin/), [new Script](https://nsloon.app/docs/Script/script_v2/), [Script API](https://nsloon.app/docs/Script/script_api/).

## Installation and use

1. Import [swufe-webvpn.plugin](swufe-webvpn.plugin), enable the plugin, scripts and MitM, and install/trust your own Loon CA.
2. Open `https://webvpn.swufe.edu.cn/__swufe_bridge__/` in Safari, or run Generic “SWUFE 网站设置” and tap its notification.
3. Toggle the academic site, add/remove exact SWUFE subdomains, choose HTTP/HTTPS per site, and save. The academic site defaults to HTTP. The next request reads the saved configuration.
4. Use “打开网页登录” to complete official WebVPN/CAS/MFA login. Gateway traffic supplies the Session; passwords and CAS Cookies are never stored.
5. Verify `http://jwxt.swufe.edu.cn/`. Generic “SWUFE 打开网页登录” provides another notification-based login entry.

Arguments control forwarding and safe debug. Settings remain available when forwarding is off; disable the entire plugin to stop interception. Site data and Sessions stay in Loon's local store and are not imported from Stash.

MitM includes `*.swufe.edu.cn` and decrypts SWUFE HTTPS locally. WRD forwarding applies only to selected exact hosts. A local QUIC rejection rule attempts TCP fallback. Avoid overlapping P0 loggers or other HTTP scripts: only the first matching Script executes.

## Artifacts and development

Current local artifacts are `0.1.3-m3`: Loon URL rewrites explicitly set the gateway `Host`, including a non-default port, instead of retaining the academic site's Host. See [verification](../../specs/003-ios-proxy-client-plugins/verification.md) for the original-URL device failure and the pending post-fix device check. Device recovery has not yet been verified.

This version also makes relative WRD 302 Locations absolute gateway URLs when the response context exposes the upstream URL, preventing browser resolution on the academic host and a second WRD wrapper. After updating, start again at `http://jwxt.swufe.edu.cn/` instead of refreshing an old mixed or nested URL.

Page GETs (root path or Accept containing text/html) now return a 302 to the full WebVPN URL so the browser establishes a native gateway connection. POST, HEAD and non-document GETs retain transparent rewriting. This reuses the Stash navigation predicate; Loon device recovery still awaits verification.

`dist/request.js`, `dist/response.js` and `dist/generic.js` are standalone bundles without Node runtime dependencies. The plugin references GitHub raw files on this repository's main branch. **Remote links cannot serve this change before it is pushed.** For local testing, import all three bundles into Loon and change Script paths to the corresponding local files. Distribute and roll back the plugin and all three bundles together at one version.

```bash
pnpm --filter swufe-webvpn-loon run typecheck
pnpm --filter swufe-webvpn-loon run test
pnpm --filter swufe-webvpn-loon run build
```

Both hosts reuse [plugin runtime](../../packages/webvpn-plugin-runtime/src/runtime.ts) and [Core](../../packages/webvpn-core-js/src/index.ts). Native Loon APIs live in `src/runtime.ts`; configuration and nonce adaptation live in `src/adapter.ts`. Third-party BoxJS is not required.

## Device gates

Node VM tests do not prove Loon parsing, network interception or actual upstream Cookie transmission. Follow the [Spec 003 test plan](../../specs/003-ios-proxy-client-plugins/test-plan.md) for G01–G18, N01–N10 and Loon equivalents of Settings K/M cases. Priorities include HTTP/80, request/response URL semantics, native bootstrap without self-redirects, CAS/MFA, cross-App tickets, logout, QUIC/TCP fallback, Settings Referer and local rejection above 16 KiB.

Safari Web Crypto supplies the nonce; GET bootstrap requires the Settings page Referer and returns 503 if unavailable. Tokens are single-use with a two-minute lifetime. Settings responses and Trace omit sensitive values; see [ADR-0016](../../docs/architecture/adr/ADR-0016-loon-local-settings-runtime.en.md). Core already guards rewrite size; host body-read memory and timeout limits still require M4 device measurements.
