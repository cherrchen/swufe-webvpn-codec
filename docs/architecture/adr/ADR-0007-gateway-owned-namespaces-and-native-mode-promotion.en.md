# ADR-0007: Pass gateway-owned namespaces straight through, and promote bootstrap documents to the gateway's native URL space

> Chinese source of truth: [ADR-0007-gateway-owned-namespaces-and-native-mode-promotion.md](ADR-0007-gateway-owned-namespaces-and-native-mode-promotion.md)

## Status

`Accepted`

## Date

`2026-09-21`

## Decision Owners

`cherrchen`

## Context

This deployment's university WebVPN gateway (`webvpn.swufe.edu.cn`) is an **application-layer reverse proxy** that ships a client-side rewriting runtime of its own (the shim below). The bridge's established policy is "the client side always uses the real hostname; only the upstream leg goes through WebVPN" (REQ-007). The two collide head-on on `KI-011`, blocking Phase 1 acceptance (TC-G01 / TC-G02).

Decision-relevant facts (all measured on real hardware; see the M4 record and this round's record in [verification.md](../../../specs/001-phase1-local-bridge/verification.md)):

- In the **ordinary URL space** the gateway injects the shim into every HTML response it proxies: inline `__vpn_*` variables (measured `__vpn_protocol_host=https://webvpn.swufe.edu.cn`) and `<script src="/wengine-vpn/js/main.js?ver=20211207">`. That `main.js` is fetchable from the gateway root (200 / 376 922 B) and is the vendor's client-side rewriting runtime (`vpnGlobal`, `vpn_eval`, `vpn_rewrite_url`, `vpn_inject_script`, XHR/CORS hooks, IndexedDB).
- `/wengine-vpn/` and `/authserver/` are **gateway-owned root namespaces** and belong to no proxied site: even while logged out, `/wengine-vpn/js/js/wechat-font.js` is fetchable from the gateway root (200); the assets in the login page body are root-relative `/authserver/swufeThemezxqr/…`.
- The bridge encodes **every** path of an allowlisted host into WRD form, so the browser requesting the relative path `/wengine-vpn/js/main.js` on the `jwxt.swufe.edu.cn` origin is rewritten to `https://webvpn.swufe.edu.cn/http/<token>/wengine-vpn/js/main.js`: through the bridge that is **404** (fetched straight from the gateway root it is **200 / 376 922 B**) → the shim never starts.
- Consequence: `http://jwxt.swufe.edu.cn/` returns the gateway's 925 B shim bootstrap page and **blank-screens**; `/xtgl/index_initMenu.html` is 200 / 76 854 B through the bridge with its body already reverse-rewritten, but the page's scripts depend on the shim → it renders yet is not interactive (logged-out state, dead controls). TC-G01 / TC-G02 fail and AC-007 is unreachable.
- The criterion is separable: the shim bootstrap page is 925 B, while a real page carrying the same injection is 76 854 B (both measured on the same host — more than an 80× gap in magnitude).
- In the gateway's **native URL space** (`https://webvpn.swufe.edu.cn/<scheme>/<token>/…`) the shim is no longer injected: links are rewritten by the gateway on the server side (measured asset URLs look like `/http/<token>/…?vpn-7&ver=…`) and pages are interactive normally. Also measured: an `https` scheme token is unusable for `jwxt.swufe.edu.cn` (the gateway returns `/wengine-vpn/failed`), so the academic-affairs site can only be proxied through the gateway in its `http` form.
- While logged out, the gateway answers any path with the same CAS login page, so a status code **cannot** be used to decide whether a path exists.

All three candidate resolving paths (gateway-owned paths without a token / strip the shim from the HTML / accept the academic-affairs site in portal form) change a public contract and need a decision first — this ADR is that decision.

## Decision

1. **Gateway-owned path prefixes bypass the token and are fetched straight from the gateway root.** For an allowlisted host whose request path starts with `/wengine-vpn/` or `/authserver/` (`GATEWAY_ROOT_PREFIXES` in `swufe_bridge/addon.py`), the bridge points the upstream leg at `{webvpnBase}{path}` (query included), injects only the session cookies and does **not** WRD-encode; such responses are never reverse-rewritten (they are the gateway's own resources and carry no proxied-site URL). The test is "the path starts with that prefix", so a site-owned path such as `/xtgl/wengine-vpn/x` still goes through token rewriting.
2. **HTML documents that match the bootstrap criterion are promoted to the gateway's native URL space.** For a `GET` / `HEAD` response that has already been WRD-rewritten, if the `Content-Type` is `text/html`, the body is ≤ `GATEWAY_BOOTSTRAP_MAX_BYTES` (8192 B) and contains both `GATEWAY_BOOTSTRAP_MARKERS` (`__vpn_` and `/wengine-vpn/js/main.js`), the bridge answers `302` + `Cache-Control: no-store` and turns that document into the WRD form of the same URL (`_promote_to_gateway` in `swufe_bridge/addon.py`). The entry address bar keeps the ordinary URL, and **other allowlist hosts stay in the ordinary URL space**.
3. **The criterion only decides "whether to promote"**: it changes neither allowlist semantics nor the main contract of `Location` → `Set-Cookie` → body reverse-rewriting. After promotion, that host's subsequent traffic is issued by the browser directly in the gateway's native space; `webvpn.swufe.edu.cn` and `authserver.swufe.edu.cn` remain `not-allowlisted` pass-throughs (the INV-004 loop guard is unchanged).
4. **Accountable owner**: cherrchen.

## Alternatives

| Alternative | Pros | Cons | Why not chosen |
| ----------- | ---- | ---- | -------------- |
| Do nothing (accept the blank screen / dead page) | Zero change, zero risk | TC-G01 / TC-G02 never pass; AC-007 unreachable | Directly conflicts with this milestone's acceptance goal that the academic-affairs site opens and can be operated |
| Strip the shim from the rewritten HTML | Apparently no need to enter the gateway's native space | Site scripts depend on the symbols and the URL-rewriting capability the shim provides, so stripped behaviour equals today's failure state (blank screen / dead page); telling "which injections are the shim" apart needs fragile content matching | Feasibility unproven, and the failure mode is the same as today's |
| Promote every allowlist host to the gateway's native form, with no criterion | Least implementation, a single rule | Gives up the transparency promise that "the client side always uses the real hostname": every site's address bar lands in `webvpn.swufe.edu.cn/<scheme>/<token>/…`, and REQ-007 / AC-007 have to be reworded wholesale | Cancels Phase 1's core experience in one go; the cost outweighs the benefit |
| Implement a shim compatibility layer inside the bridge (own `vpnGlobal` and friends, plus URL rewriting) | Can stay entirely in the ordinary URL space | Must replicate the behaviour of the vendor's obfuscated runtime (URL rewriting, XHR/CORS hooks, IndexedDB cache), and breaks the moment the gateway changes | Long-term maintenance cost and uncontrollability far exceed "send the document back to the gateway's native space" |
| Gateway-owned pass-through + strip the shim (1 + alternative 2) | Own resources no longer 404 | The shim-stripping feasibility problem stands unchanged | Same reason as alternative 2 |

## Consequences

### Positive

- The academic-affairs site opens and can be operated: the entry is still `http://jwxt.swufe.edu.cn/`, and once the browser has been `302`-ed to the gateway's native form the gateway's own shim takes over (measured: the home page, `xtgl/index_initMenu.html` and the in-site "student grade query" are all interactive, and links do not jump to unreachable addresses);
- Other allowlist hosts keep their transparency semantics: non-bootstrap pages stay in the ordinary URL space (measured: navigating inside `www.swufe.edu.cn` keeps ordinary hostnames and renders pages completely);
- The pass-through rule also fixes the gateway's own resources 404-ing in the ordinary URL space (measured: `/wengine-vpn/js/main.js` is 200 / 376 922 B through the bridge, with the body unchanged byte for byte);
- The criterion is a pure function (`is_gateway_bootstrap_html` in `swufe_bridge/rewrite.py`), so L1 covers it without a real gateway.

### Negative

- Promoted hosts' address bars land in `https://webvpn.swufe.edu.cn/<scheme>/<token>/…`, so users no longer see `jwxt.swufe.edu.cn` (REQ-007's wording is qualified accordingly);
- That space depends on the **browser's own** gateway session: the bridge does not inject the in-app session into the browser (the INV-004 loop guard and the security model do not allow it), so a second CAS may be required the first time that browser is used against that host (measured and confirmed; expected behaviour);
- The bridge no longer participates in rewriting these pages: in-page URL rewriting and relative-path resolution are done by the gateway's server, so when something breaks the bridge's debug log can only prove "promoted", not why a particular in-page navigation failed;
- The criterion contains empirical constants (8192 B + two markers): if the gateway changes the bootstrap page's shape, promotion silently stops working and the constants must be updated from fresh measurements.

### Risks

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| A gateway upgrade: the bootstrap page grows or no longer contains the two markers | Low | High | Constants and predicate are centralised in `swufe_bridge/rewrite.py`; the measured byte counts and the re-verification commands are recorded in the M5 record of [verification.md](../../../specs/001-phase1-local-bridge/verification.md), so a gateway change is re-measured the same way and the constants updated |
| A real site page happens to be ≤ 8192 B and contain both markers ⇒ false promotion | Low | Medium | The measured real page and bootstrap page differ by >80× (76 854 B vs 925 B); an L1 case pins "a large page carrying the same injection is not promoted" |
| Users assume "one login is enough" and hit a second CAS in the gateway's native space | Medium | Medium | Write that behaviour into spec / verification / development-run; the in-app CAS/MFA login window is still only needed once |
| The `https` scheme token is unusable for some hosts (academic affairs is `http` only) | Measured | Medium | Keep the measured fact on record: the entry uses `http://`, and the promotion target follows the entry's scheme (`/http/<token>/…`) |

## References

- Related requirements: REQ-006, REQ-007, REQ-008, REQ-011, NFR-006, AC-007
- Related spec: [specs/001-phase1-local-bridge/](../../../specs/001-phase1-local-bridge/spec.md) (design.md §Proposed Solution, the M5 record in verification.md, `KI-011` in known-issues.md)
- Related ADRs: [ADR-0001](ADR-0001-wrd-rewrite-in-mitm-layer.en.md) (rewriting lives in the mitm layer), [ADR-0004](ADR-0004-refuse-start-when-system-proxy-in-use.en.md) (refuse rather than half-work on conflict), [ADR-0006](ADR-0006-local-capture-mode-and-mutual-exclusion.en.md) (capture modes are mutually exclusive)
- Implementation basis: `swufe_bridge/addon.py` (`GATEWAY_ROOT_PREFIXES`, `_promote_to_gateway`, `METADATA_WRD_URL`, `METADATA_GATEWAY_ROOT`), `swufe_bridge/rewrite.py` (`GATEWAY_BOOTSTRAP_MARKERS`, `GATEWAY_BOOTSTRAP_MAX_BYTES`, `is_gateway_bootstrap_html`)
