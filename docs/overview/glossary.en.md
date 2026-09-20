# Glossary

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-20
>
> Chinese source of truth: [glossary.md](glossary.md)

**Purpose**: keep terminology consistent so humans and agents mean the same thing by the same word.
**Single source**: this file is the source of truth for term definitions; other documents reference terms instead of redefining them.

---

## Terms

| Term | English | Definition | Aliases / not to be confused with | Origin |
| ---- | ------- | ---------- | --------------------------------- | ------ |
| WebVPN | WebVPN (Wengine) | The university's Wengine application-layer reverse proxy at `webvpn.swufe.edu.cn`: after login, campus web resources are reached through portal-rewritten URLs | Alias: Wengine WebVPN; not to be confused with SSLVPN / a TUN-level real VPN | Source package `01-requirements/01-PRD.md` §2; `99-appendix/requirements-onepager-v1.0.md` §2 |
| WRD | WRD | The URL rewrite scheme used by the Wengine WebVPN: the campus hostname is encrypted and spliced into the WebVPN path | Not to be confused with WrdCodec (this repository's implementation of the scheme) | Source package `99-appendix/wrd_codec-README.md`; `wrd_codec.py` header |
| WrdCodec | WrdCodec | The URL codec implementing WRD, exposing `encryptHost` / `decryptHost` / `encodeUrl` / `decodeUrl`; Python is authoritative, TS may follow | Alias: WRD codec; not to be confused with WRD (the scheme itself) | Source package `01-requirements/03-technical-design.md` §3; `05-api-interfaces.md` §3 |
| WRD URL form | WRD URL form | `https://webvpn.swufe.edu.cn/{http\|https}[-{port}]/{iv_hex}{host_cipher}{path}?{query}`; AES-128-CFB (`segment_size=128`), default `key = iv = wrdvpnisthebest!`; only the hostname is encrypted, path/query stay plaintext | Alias: WebVPN-shaped URL; not to be confused with an ordinary URL (real hostname) | Source package `01-requirements/03-technical-design.md` §3; `wrd_codec.py` |
| 本机桥 | local bridge | The on-machine mitmproxy sidecar plus a thin WRD addon: local HTTP/HTTPS requests matching the allowlist are rewritten into WRD URLs carrying the session | Aliases: bridge, bridge sidecar; not to be confused with a real VPN / TUN | Source package `01-requirements/04-architecture-and-tech-selection.md` §1 |
| allowlist | allowlist | The set of hosts routed through the WebVPN (rewritten) instead of going direct; `jwxt.swufe.edu.cn` is always included by default and users may add or remove hosts | Alias: AllowlistConfig (data-model name); not to be confused with a system-proxy bypass list | Source package `01-requirements/06-data-model.md` §2.1; `99-appendix/requirements-onepager-v1.0.md` FR-5 |
| 通配 `*.swufe.edu.cn` | SWUFE wildcard | Optional allowlist switch `includeSwufeWildcard` (default `false`): matches the apex `swufe.edu.cn` and the `.swufe.edu.cn` suffix | Not to be confused with the exact-match host list | Source package `01-requirements/06-data-model.md` §2.1; `99-appendix/requirements-onepager-v1.0.md` FR-5 |
| Session Broker | Session Broker | The Electron Main-process module that extracts and stores WebVPN session cookies from the login WebView and detects expiry | Not to be confused with allowlist matching or WrdCodec | Source package `01-requirements/03-technical-design.md` §2, §6 |
| 响应反向改写 | response reverse rewrite | Rewrites upstream WebVPN responses back to "ordinary hostname" semantics, in priority order: 1) `Location` 2) `Set-Cookie` Domain/Path 3) absolute URLs inside `text/html` / `application/javascript` / `application/json` 4) other types are left untouched | Alias: reverse rewrite; not to be confused with the request rewrite (upstream direction) | Source package `01-requirements/03-technical-design.md` §5 |
| 系统代理接管 | system proxy takeover | Before starting, read the OS proxy; refuse to start if one is already enabled and not ours; otherwise set `127.0.0.1:<bridge_port>` and record a "set by this app" marker, clearing it on stop/expiry/exit only when that marker is present | Not to be confused with per-process capture (the other takeover path) | Source package `01-requirements/03-technical-design.md` §7 |
| 进程捕获 | per-process capture | Uses mitmproxy local mode to capture traffic of user-selected processes (e.g. Chrome); can run together with the system proxy and is stopped with it | Alias: local capture; not to be confused with the system proxy | Source package `01-requirements/03-technical-design.md` §8 |
| MITM CA | MITM CA | A locally generated root certificate used to decrypt and rewrite HTTPS on this machine; prefers reusing the mitmproxy CA mechanism instead of a custom PKI; the private key never leaves the machine and the CA can be uninstalled in one click | Alias: local CA; not to be confused with official university certificates | Source package `99-appendix/requirements-onepager-v1.0.md` FR-8; `01-requirements/03-technical-design.md` §10 |
| 防环 | loop prevention | Requests to `webvpn.swufe.edu.cn` / `authserver.swufe.edu.cn` must never enter the bridge; requests already in WebVPN shape pass through | Not to be confused with the allowlist wildcard switch | Source package `01-requirements/03-technical-design.md` §6; `99-appendix/requirements-onepager-v1.0.md` FR-2 |
| CAS / MFA | CAS / MFA | Unified identity at `authserver.swufe.edu.cn` (CAS, possibly with multi-factor authentication); completed by the user in the official WebView, never auto-filled or stored by the app | Not to be confused with WebVPN session cookies (the login's output) | Source package `99-appendix/requirements-onepager-v1.0.md` §2, FR-2 |
| TUN (not in Phase 1) | TUN | Later-stage transparent-gateway approach `sing-box TUN → 127.0.0.1:mitm`; not implemented in Phase 1 and does not block Phase 1 acceptance | Not to be confused with the system proxy / per-process capture used in Phase 1 | Source package `01-requirements/04-architecture-and-tech-selection.md` §1; [NFR-006](../requirements/non-functional-requirements.md) |
| 桥状态机 | bridge state machine | Bridge lifecycle: `idle → (start) → starting → running`; `running → (stop\|expire\|error) → stopping → idle`; `starting → (fail) → error → idle` | Not to be confused with the UI status-bar colour | Source package `01-requirements/06-data-model.md` §5; `05-api-interfaces.md` §1.2 |
| 错误码 | error code | Fixed error set exposed to the UI: `PROXY_CONFLICT` (system proxy in use) / `CA_MISSING` (CA not installed or not trusted) / `NOT_LOGGED_IN` (no session) / `SESSION_EXPIRED` (session invalid) / `BRIDGE_CRASH` (mitm process exited) / `ALLOWLIST_EMPTY` (no hosts) | Not to be confused with `BridgeStatus.state` (state-machine value) | Source package `01-requirements/03-technical-design.md` §9 |

## Status vocabulary

The following status values are used across specs and documents and have fixed meaning:

| Status | Applies to | Meaning |
| ------ | ---------- | ------- |
| Draft | spec / document | not yet reviewed |
| Approved | spec | confirmed as implementable |
| In Progress | spec | being implemented |
| Implemented | spec | code complete, unverified |
| Verified | spec | verification matrix passed |
| Archived | spec / document | historical, no longer current fact |
| Proposed / Accepted / Superseded / Deprecated / Rejected | ADR | decision record status |

## Adding a term

1. Add a row to the table;
2. Link to this file from the document that first uses the term;
3. If the change alters meaning, check whether [requirements/](../requirements/README.md) and [architecture/](../architecture/README.md) need updates.
