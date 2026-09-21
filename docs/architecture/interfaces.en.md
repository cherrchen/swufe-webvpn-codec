# Interfaces

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-21
>
> Chinese source of truth: [interfaces.md](interfaces.md)

**Purpose**: define the **boundaries** between modules and between the system and the outside: who provides, who consumes, what the contract is, and how compatibility is guaranteed.
**Do not write**: field-level API definitions (→ [docs/api/](../api/README.md)), data entities (→ [data-model.md](data-model.md)).

---

## Interface list

| ID | Interface | Provider | Consumer | Type | Stability | Detail |
| -- | --------- | -------- | -------- | ---- | --------- | ------ |
| IF-001 | Renderer ↔ Main (preload `window.swufeBridge`) | App Shell (Electron Main) | Telemetry UI, Login WebView (Renderer) | in-process | Internal | [api/electron-ipc.md](../api/electron-ipc.md) |
| IF-002 | Main ↔ mitm sidecar control | Bridge Addon (mitmproxy sidecar) | Proxy Orchestrator (Main) | inter-process (local) | Internal / Evolving | [api/bridge-control-protocol.md](../api/bridge-control-protocol.md) |
| IF-003 | Bridge Addon ↔ WRD Codec library | WRD Codec | Bridge Addon, App Shell | in-process | Evolving | [api/wrd-codec-library.md](../api/wrd-codec-library.md) |
| IF-004 | App ↔ OS proxy API | OS (system API) | Proxy Orchestrator | local system API | Evolving | [components.md](components.md) |
| IF-005 | App ↔ OS trust store | OS (system API) | Cert Manager | local system API | Evolving | [components.md](components.md) |
| IF-006 | App ↔ `webvpn.swufe.edu.cn` / `authserver.swufe.edu.cn` | Campus WebVPN / CAS | Bridge Addon, Login WebView | network HTTPS | Evolving | [components.md](components.md) |

## Boundary diagram

```mermaid
flowchart LR
    UI["Telemetry UI / Login WebView"] -->|"IF-001 calls"| Shell["App Shell (Main)"]
    Shell -->|"IF-001 events"| UI
    Shell -->|"IF-003"| Codec["WRD Codec"]
    Orch["Proxy Orchestrator"] -->|"IF-002"| Addon["Bridge Addon (sidecar)"]
    Addon -->|"IF-003"| Codec
    Orch -->|"IF-004"| OSProxy["OS proxy API"]
    Cert["Cert Manager"] -->|"IF-005"| OSTrust["OS trust store"]
    Addon -->|"IF-006"| WV["webvpn.swufe.edu.cn"]
    UI -->|"IF-006"| AS["authserver.swufe.edu.cn (login)"]
```

Description: the in-process boundary IF-001 is a stable contract (Internal); IF-003 is also in-process but may still change with the implementation (Evolving); the inter-process boundary (IF-002) and the external boundaries (IF-004–IF-006) change with the sidecar implementation and the external systems. The two IF-006 edges correspond to "login (authserver → webvpn)" and "rewritten business requests (Bridge Addon → webvpn)"; login traffic must not enter the rewrite path.

## Interface contracts

### IF-001 Renderer ↔ Main (preload `window.swufeBridge`)

- Provider: App Shell (Electron Main).
- Consumer: Telemetry UI, Login WebView (Renderer).
- Stability: Internal (app-internal only; breaking changes still need assessment).
- Input: method calls `login` / `logout` / `getSession`, `startBridge` / `stopBridge` / `getStatus`, `getAllowlist` / `setAllowlist` / `getSettings`, `installCa` / `uninstallCa` / `getCaStatus`, `listCaptureCandidates` / `setCaptureMode` / `setCaptureProcesses`, `setDebugLogging`; event subscriptions `onDebugLog` / `onStatus` / `onSessionExpired` (the last two, and `getSettings`, were added in M2; `getSettings` never returns the WRD key/IV). M3 replaces M2's `setCapturePids` with `setCaptureMode` (`'system-proxy' | 'selected-apps'`) and adds `setCaptureProcesses` (an array of intercept-pattern strings, written as a whole-set overwrite).
- Output: `BridgeStatus` (including `localCaptureEnabled` and `captureError`), `AllowlistConfig`, CA status, session state, `DebugLogEvent`. Field-level definitions in [api/electron-ipc.md](../api/electron-ipc.md).
- Error model: `BridgeStatus.error.code` takes the fixed codes `PROXY_CONFLICT` / `CA_MISSING` / `NOT_LOGGED_IN` / `SESSION_EXPIRED` / `BRIDGE_CRASH` / `ALLOWLIST_EMPTY` (switching to the "selected apps" capture mode while another application occupies the system proxy also returns `PROXY_CONFLICT`); CA operations use `{ok, message}`. A process-capture failure never enters `error`; it only shows up in `BridgeStatus.captureError`. Electron's `invoke` rejection keeps only `message` / `stack`, so rejections from `setCaptureMode` / `setCaptureProcesses` look like `<CODE>：<message>` (e.g. `PROXY_CONFLICT：…`) and the Renderer parses that prefix to decide whether to open the proxy-conflict modal.
- Idempotency: `getStatus` / `getSession` / `getAllowlist` / `getSettings` / `getCaStatus` are idempotent reads; `setAllowlist`, `setCaptureMode` and `setCaptureProcesses` (whole-set overwrite) are idempotent; `startBridge` / `stopBridge` / `installCa` / `uninstallCa` are not (repeated calls are handled by the state machine).
- Versioning: preload and Main are built and versioned together; no cross-version mixing.
- Compatibility commitment: added methods/fields are backward compatible; removals or signature changes are breaking (allowed exceptions in "Compatibility strategy").
- Related spec / ADR: [specs/001-phase1-local-bridge](../../specs/001-phase1-local-bridge/spec.md), [ADR-0003](adr/ADR-0003-electron-gui-for-phase-1.md), [ADR-0006](adr/ADR-0006-local-capture-mode-and-mutual-exclusion.md).

### IF-002 Main ↔ mitm sidecar control

- Provider: Bridge Addon (mitmproxy sidecar).
- Consumer: Proxy Orchestrator (Main).
- Stability: Internal / Evolving (consumed only inside this app; Phase 1 has adopted option A — "child-process lifecycle + config-file hot reload" — and no other control-plane shape is promised).
- Input: child-process lifecycle (spawn / terminate); the launch argument `--mode regular@<port>` (**never** `--listen-port`: a global `listen_port` would make the `local:<spec>` added at runtime collide with `regular` on the same listen address); whole-file overwrite of the config file (`allowlist` / `cookies` / `debug` / `webvpnBase` / `wrdKey` / `wrdIv` / `capture`; path and fields in [api/bridge-control-protocol.md](../api/bridge-control-protocol.md)). `capture` is `{"processes": string[]}` and defaults to an empty array; it is always `[]` in the `system-proxy` capture mode, and an invalid value (not a list / empty string / comma inside / non-string) ⇒ `CONFIG_INVALID`.
- Output: readiness and diagnostic lines on stderr (`swufe-ready` / `swufe-error <CODE> <message>` / `swufe-capture {"enabled":bool,"processes":string[],"error":string|null}`), the process exit code (normal `0`, startup validation failure `2`); and the config-application result (hot reload; on failure the last usable config is kept).
- Error model: sidecar-level diagnostics `swufe-error <CODE> <message>` + exit code `2` (`CONFIG_INVALID`, `ALLOWLIST_EMPTY`, `LISTEN_NOT_LOOPBACK`); a runtime config-reload failure does not exit — it keeps the last usable config and prints the same message only once; M2 maps an unexpected sidecar exit to `BRIDGE_CRASH`. `swufe-capture` only reports the process-capture state (keys fixed to `enabled` / `processes` / `error`); it never takes part in the readiness decision, a capture failure does not change the bridge state, and there is no automatic retry (it retries only once the runtime config is rewritten).
- Idempotency: the config file is written as a whole-file overwrite, with "last one wins" as the idempotency semantics; repeated terminate calls converge to the stopped state.
- Versioning: the sidecar ships with the App; control-plane capability changes (e.g. enabling option B) count as implementation changes rather than contract changes.
- Compatibility commitment: Cookies never enter logs or diagnostic lines (INV-001); the `swufe-ready` / `swufe-error` / `swufe-capture` line formats and the exit-code semantics are stable; the `swufe-capture` key set is fixed to `enabled` / `processes` / `error`; the listen address is always `127.0.0.1`.
- Related spec / ADR: [specs/001-phase1-local-bridge](../../specs/001-phase1-local-bridge/spec.md), [ADR-0006](adr/ADR-0006-local-capture-mode-and-mutual-exclusion.md), [ADR-0002](adr/ADR-0002-reuse-mitmproxy-for-tls.md).

### IF-003 Bridge Addon ↔ WRD Codec library

- Provider: WRD Codec (authoritative Python implementation; TypeScript may follow later).
- Consumer: Bridge Addon, App Shell.
- Stability: Evolving (the algorithm and default parameters are verified against a live address-bar URL, but the interface may still change with the Phase 1 implementation).
- Input: `encryptHost(host, key?, iv?)`, `decryptHost(token, key?, iv?)`, `encodeUrl(ordinaryUrl, webvpnHost?)`, `decodeUrl(webvpnUrl)`. Signatures and semantics in [api/wrd-codec-library.md](../api/wrd-codec-library.md).
- Output: encrypted token, WebVPN URL, ordinary URL.
- Error model: a wrong/custom key yields a non-correct hostname or an explicit failure (see TC-A05).
- Idempotency: all pure functions, same input yields the same output.
- Versioning: bound to the `wrd_codec.py` vectors; defaults `webvpnHost = webvpn.swufe.edu.cn`, `key = iv = wrdvpnisthebest!`.
- Compatibility commitment: vector consistency is the contract (NFR-002); added optional parameters are backward compatible.
- Related spec / ADR: [specs/001-phase1-local-bridge](../../specs/001-phase1-local-bridge/spec.md), [ADR-0001](adr/ADR-0001-wrd-rewrite-in-mitm-layer.md), [ADR-0005](adr/ADR-0005-builtin-wrd-key-with-override.md).

### IF-004 App ↔ OS proxy API

- Provider: OS (system API).
- Consumer: Proxy Orchestrator.
- Stability: Evolving (follows OS versions).
- Input: read the current HTTP/HTTPS system proxy; set the proxy to `127.0.0.1:<bridge_port>`; clear the proxy set by this app. In the `selected-apps` capture mode the system proxy is not set and one previously set by this app is revoked (ADR-0006).
- Output: proxy state (enabled or not, and where it points).
- Error model: read failure or a proxy already in use → `PROXY_CONFLICT` (the same applies when checking the system proxy before switching to the "selected apps" capture mode and another application occupies it).
- Idempotency: reads are idempotent; repeated set/clear calls converge to the same target state.
- Versioning: an OS adaptation layer inside Proxy Orchestrator absorbs differences; nothing else is exposed.
- Compatibility commitment: only the proxy set by this app is cleared (INV-002); no system proxy is set in the `selected-apps` capture mode (ADR-0006); macOS / Windows behaviour differences stay inside the adaptation layer.
- Related spec / ADR: [specs/001-phase1-local-bridge](../../specs/001-phase1-local-bridge/spec.md), [ADR-0004](adr/ADR-0004-refuse-start-when-system-proxy-in-use.md), [ADR-0006](adr/ADR-0006-local-capture-mode-and-mutual-exclusion.md).

### IF-005 App ↔ OS trust store

- Provider: OS (system API).
- Consumer: Cert Manager.
- Stability: Evolving (follows OS versions; installation often needs admin rights).
- Input: install the local MITM CA into the system trust store; remove it.
- Output: CA status (installed / trusted).
- Error model: a failed install/uninstall returns `{ok: false, message}`; starting the bridge without a trusted CA → `CA_MISSING`.
- Idempotency: repeated install/uninstall converges to the target state.
- Versioning: an OS adaptation layer inside Cert Manager absorbs differences.
- Compatibility commitment: the CA private key stays local and is never uploaded (REQ-010).
- Related spec / ADR: [specs/001-phase1-local-bridge](../../specs/001-phase1-local-bridge/spec.md), [ADR-0002](adr/ADR-0002-reuse-mitmproxy-for-tls.md).

### IF-006 App ↔ `webvpn.swufe.edu.cn` / `authserver.swufe.edu.cn`

- Provider: campus WebVPN (`webvpn.swufe.edu.cn`) and CAS (`authserver.swufe.edu.cn`).
- Consumer: Bridge Addon (business traffic), Login WebView (login traffic).
- Stability: Evolving (fully external).
- Input: rewritten WebVPN-form HTTPS requests (carrying WebVPN Cookies); CAS login interaction.
- Output: campus service responses; session Cookies after login.
- Error model: session-expiry signals (probe returns a login-page marker / `Set-Cookie` clears the session / repeated 302 to CAS after rewriting) → `SESSION_EXPIRED`; unreachable network → `BRIDGE_CRASH` or rewrite failure.
- Idempotency: GET/HEAD are idempotent per HTTP semantics; POST and others are decided by the campus service.
- Versioning: no version negotiation; changes are adapted (see R2 for Cookie field/policy changes).
- Compatibility commitment: `webvpn.swufe.edu.cn` and `authserver.swufe.edu.cn` are never wrapped twice (INV-004); Login WebView traffic bypasses the bridge; gateway-owned root namespaces (`/wengine-vpn/`, `/authserver/`) take no token and are fetched straight from the gateway root, and HTML documents that match the gateway bootstrap predicate are promoted by the Bridge Addon to the gateway-native URL space with `302` ([ADR-0007](adr/ADR-0007-gateway-owned-namespaces-and-native-mode-promotion.md)).
- Related spec / ADR: [specs/001-phase1-local-bridge](../../specs/001-phase1-local-bridge/spec.md), [ADR-0001](adr/ADR-0001-wrd-rewrite-in-mitm-layer.md), [ADR-0007](adr/ADR-0007-gateway-owned-namespaces-and-native-mode-promotion.md).

## Compatibility strategy

| Interface | Allowed changes | Changes requiring an ADR | Deprecation process |
| --------- | --------------- | ------------------------ | ------------------- |
| IF-001 | added optional methods/fields, added error codes | removing or changing signatures; changing `BridgeStatus` state-machine values | TBD |
| IF-002 | added config fields and diagnostic lines | changing the chosen control approach (option A → option B); changing config-file field semantics or exit codes | TBD |
| IF-003 | added optional parameters | changing signatures or the default key/iv semantics | TBD |
| IF-004 | adapting to new OS API versions | changing the proxy-clearing policy (INV-002) | TBD |
| IF-005 | adapting to new OS trust-store APIs | changing the CA / trust model (ADR-0002, REQ-010) | TBD |
| IF-006 | adapting to upstream semantics | upstream changes altering the rewrite/anti-loop strategy; changing the passthrough scope of gateway-owned namespaces or the bootstrap promotion predicate (ADR-0007) | TBD |

## Contract tests

| Interface | Test location | Coverage |
| --------- | ------------- | -------- |
| IF-001 | [specs/001-phase1-local-bridge/verification.md](../../specs/001-phase1-local-bridge/verification.md) (TC-D01, TC-D02, TC-C01–C04, TC-E01–E03, TC-B05, TC-H01) | Session / bridge-control / allowlist / CA / process-capture IPC behaviour and error codes |
| IF-002 | L1 `tests/l1/test_addon_reload.py` (config hot reload and failure fallback), L1 `tests/l1/test_addon_capture.py` (local-mode overlay and `swufe-capture` reporting) + L2 `tests/l2/test_proxy_end_to_end.py` (`swufe-ready` line with `listen_port`, exit code `2`, loopback listener) | config-file hot-reload semantics, readiness/diagnostic line formats and startup-failure exit code, process-capture mode overlay and reporting |
| IF-003 | [specs/001-phase1-local-bridge/verification.md](../../specs/001-phase1-local-bridge/verification.md) (TC-A01–A05) | codec vectors and URL conversion consistency |
| IF-004 | [specs/001-phase1-local-bridge/verification.md](../../specs/001-phase1-local-bridge/verification.md) (TC-C01–C04) | conflict refusal, proxy set and clear |
| IF-005 | [specs/001-phase1-local-bridge/verification.md](../../specs/001-phase1-local-bridge/verification.md) (TC-E01–E03) | install, uninstall and missing-CA prompt |
| IF-006 | [specs/001-phase1-local-bridge/verification.md](../../specs/001-phase1-local-bridge/verification.md) (TC-F01–F03, TC-G01–G03, TC-D01) + L1 `tests/l1/test_addon_request.py` / `test_addon_response.py` (gateway-owned path passthrough, bootstrap promotion and non-promotion) + L2 `tests/l2/test_proxy_end_to_end.py` | upstream rewrite, response reverse-rewrite, gateway-owned namespace passthrough and promotion, browser acceptance |
