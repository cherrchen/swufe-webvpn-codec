# Components

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-21
>
> Chinese source of truth: [components.md](components.md)

**Purpose**: list the system's constituent units (modules, services, packages, processes, tasks) with their responsibilities, boundaries and dependency directions.
**Do not write**: interface fields (→ [interfaces.md](interfaces.md)), data entities (→ [data-model.md](data-model.md)).

---

## Component list

> "Code location" is the real path of landed implementations; components that are not implemented yet stay `TBD（实现首个任务确定）`.
> M1 (bridge core) has implemented WRD Codec, Bridge Addon (including the config surface and the sidecar entry) and the library layer of Allowlist Store; the Electron-side components land from M2 onwards.

| Component | Type | Responsibility (one line) | Code location | Status |
| --------- | ---- | ------------------------- | ------------- | ------ |
| App Shell | In-process module (Electron Main) | Windows/tray (optional), config persistence, and the Main-side orchestration entry exposing preload IPC | TBD（实现首个任务确定） | Planned |
| Login WebView | In-process module (Electron Renderer / BrowserWindow) | Hosts the official WebVPN / CAS login and guarantees anti-loop | TBD（实现首个任务确定） | Planned |
| Session Broker | In-process module (Electron Main) | Cookie extraction, storage and expiry detection | TBD（实现首个任务确定） | Planned |
| Proxy Orchestrator | In-process module (Electron Main) | Start/stop the mitm sidecar, set/clear the system proxy, manage process capture, detect proxy conflicts | TBD（实现首个任务确定） | Planned |
| WRD Codec | In-process library (shared by the App and the sidecar) | Hostname encryption/decryption and URL conversion (pure functions, no IO) | `swufe_bridge/wrd_codec.py` | Implemented (M1) |
| Bridge Addon | Separate process (addon inside the mitmproxy sidecar) | Request rewrite, response reverse-rewrite and Cookie injection | `swufe_bridge/addon.py` (pure reverse-rewrite functions in `swufe_bridge/rewrite.py`; config surface in `swufe_bridge/config.py`; process entry `swufe_bridge/sidecar.py`) | Implemented (M1) |
| Cert Manager | In-process module (Electron Main) | Install/uninstall and query the local MITM CA | TBD（实现首个任务确定；from M1 the sidecar's `--confdir` hosts mitmproxy CA generation） | Planned |
| Allowlist Store | In-process module (Electron Main) | Read/write host list and wildcard option (single source for routing decisions) | `swufe_bridge/allowlist.py` (matching semantics and validation) + `swufe_bridge/config.py` (`AllowlistStore` persistence) | Partial (M1: library; M2: IPC) |
| Telemetry UI | In-process module (Electron Renderer) | Status display and debug log panel | TBD（实现首个任务确定；M1's `swufe-debug` stderr lines are its data source） | Planned |

## Component relationships

Arrow direction means "depends on / calls"; dependencies are strictly one-way and the diagram contains no reverse dependency.

```mermaid
flowchart TD
    Telemetry["Telemetry UI"] -->|"IF-001"| Shell["App Shell"]
    Shell --> LoginWV["Login WebView"]
    Shell --> SessionBroker["Session Broker"]
    Shell --> ProxyOrch["Proxy Orchestrator"]
    Shell --> CertMgr["Cert Manager"]
    Shell --> AllowStore["Allowlist Store"]
    Shell --> Codec["WRD Codec"]
    SessionBroker --> LoginWV
    ProxyOrch --> AllowStore
    ProxyOrch -->|"IF-002"| Addon["Bridge Addon (sidecar)"]
    ProxyOrch -->|"IF-004"| OSProxy["OS proxy API"]
    CertMgr -->|"IF-005"| OSTrust["OS trust store"]
    Addon -->|"IF-003"| Codec
```

Description: Telemetry UI is a leaf (it only calls App Shell through preload IPC) and App Shell is the composition root on the Main side; Session Broker reads the Login WebView session and is the only Cookie reader; Proxy Orchestrator depends on Allowlist Store as the routing source and drives the Bridge Addon inside the sidecar through the local control port; WrdCodec has no IO, is not reverse-depended on by anything, and is shared by Bridge Addon and App Shell.

## Component detail

### App Shell

- Responsibility: window and tray (tray optional) lifecycle, config persistence, the Main-side orchestration entry, exposing the preload interface `window.swufeBridge`.
- Not responsible for: traffic rewriting (Bridge Addon); allowlist matching logic (Allowlist Store); calling OS-specific APIs directly (centralised in Cert Manager and Proxy Orchestrator).
- Input: IPC calls from the Renderer through `window.swufeBridge`; launch arguments and the user-data directory.
- Output: IPC responses (`BridgeStatus`, `AllowlistConfig`, CA status, …); `onDebugLog` events.
- Dependencies: Session Broker, Proxy Orchestrator, Cert Manager, Allowlist Store, WrdCodec, Login WebView.
- Depended on by: Telemetry UI, Login WebView (via preload).
- Key invariants: app exit must clear the system proxy (see [data-model.md](data-model.md) INV-002).
- Related tests: TC-H01, TC-D02.
- Related spec / ADR: [specs/001-phase1-local-bridge](../../specs/001-phase1-local-bridge/spec.md), [ADR-0003](adr/ADR-0003-electron-gui-for-phase-1.md).

### Login WebView

- Responsibility: host the official WebVPN / CAS login flow (including MFA) and expose the resulting session to Session Broker.
- Not responsible for: parsing or autofilling passwords; traffic rewriting; allowlist decisions.
- Input: `webvpnBase`; user interaction.
- Output: the logged-in session (Cookies) and login state.
- Dependencies: App Shell (window host).
- Depended on by: App Shell, Session Broker.
- Key invariants: login traffic must bypass the bridge, and `webvpn.swufe.edu.cn` / `authserver.swufe.edu.cn` must never be wrapped again (anti-loop, see INV-004).
- Related tests: TC-D01, TC-D04.
- Related spec / ADR: [specs/001-phase1-local-bridge](../../specs/001-phase1-local-bridge/spec.md), [ADR-0003](adr/ADR-0003-electron-gui-for-phase-1.md).

### Session Broker

- Responsibility: Cookie extraction, storage and expiry detection.
- Not responsible for: URL rewriting; holding student IDs/passwords; allowlist decisions.
- Input: the Login WebView session partition; responses from probe URLs (expiry signals).
- Output: `SessionState` (Cookie set), login/expiry state; consumed by Proxy Orchestrator when pushing to the sidecar.
- Dependencies: the Login WebView session.
- Depended on by: App Shell, Proxy Orchestrator.
- Key invariants: the only Cookie reader; Cookies must never enter logs (see INV-001).
- Related tests: TC-D01, TC-D02, TC-D03, TC-D04.
- Related spec / ADR: [specs/001-phase1-local-bridge](../../specs/001-phase1-local-bridge/spec.md).

### Proxy Orchestrator

- Responsibility: start/stop the mitm sidecar, set/clear the system proxy, manage process capture (local capture), detect proxy conflicts.
- Not responsible for: traffic rewriting; CA management (Cert Manager); reading Cookies directly (goes through Session Broker).
- Input: `startBridge` / `stopBridge` IPC; the current OS proxy settings; `capturePids`.
- Output: `BridgeStatus`; the system proxy target; the `{allowlist, cookies, debug}` config pushed to the sidecar.
- Dependencies: Allowlist Store, OS proxy API (IF-004), mitm sidecar control port (IF-002).
- Depended on by: App Shell.
- Key invariants: clear the system proxy only when the "set by this app" marker exists (INV-002); the bridge state machine is fixed at `idle → starting → running`, `running → stopping → idle`, `starting → error → idle`.
- Related tests: TC-C01, TC-C02, TC-C03, TC-C04, TC-D03.
- Related spec / ADR: [specs/001-phase1-local-bridge](../../specs/001-phase1-local-bridge/spec.md), [ADR-0004](adr/ADR-0004-refuse-start-when-system-proxy-in-use.md), [ADR-0002](adr/ADR-0002-reuse-mitmproxy-for-tls.md).

### WRD Codec

- Responsibility: hostname encryption/decryption and ordinary URL ↔ WebVPN URL conversion (AES-128-CFB, `segment_size=128`).
- Not responsible for: any IO; allowlist decisions; HTTP-layer rewriting.
- Input: host, ordinary/WebVPN URL, optional `key`/`iv`.
- Output: encrypted token, WebVPN URL, ordinary URL.
- Dependencies: none.
- Depended on by: Bridge Addon, App Shell.
- Key invariants: only the hostname is encrypted while path/query stay plaintext; the implementation must match the verified `wrd_codec.py` vectors (NFR-002).
- Related tests: TC-A01, TC-A02, TC-A03, TC-A04, TC-A05.
- Related spec / ADR: [specs/001-phase1-local-bridge](../../specs/001-phase1-local-bridge/spec.md), [ADR-0001](adr/ADR-0001-wrd-rewrite-in-mitm-layer.md), [ADR-0005](adr/ADR-0005-builtin-wrd-key-with-override.md).

### Bridge Addon

- Responsibility: WRD-rewrite allowlisted requests and inject Cookies; reverse-rewrite responses; emit debug log events.
- Not responsible for: UI; reading/writing user config directly (it only receives pushed config); depending on the Renderer/UI; session capture.
- Input: HTTP/HTTPS requests and responses through the local bridge; the pushed `{allowlist, cookies, debug}`.
- Output: upstream requests rewritten into WebVPN form; reverse-rewritten responses; debug log events (host + rewrite result).
- Dependencies: WrdCodec.
- Depended on by: Proxy Orchestrator (through the control port).
- Key invariants: traffic outside the allowlist stays direct and unrewritten (C-004); `webvpn.swufe.edu.cn` and `authserver.swufe.edu.cn` are hard-coded exclusions (INV-004); logs never contain Cookies or bodies (INV-001).
- Related tests: TC-F01, TC-F02, TC-F03, TC-F04, TC-D04.
- Related spec / ADR: [specs/001-phase1-local-bridge](../../specs/001-phase1-local-bridge/spec.md), [ADR-0001](adr/ADR-0001-wrd-rewrite-in-mitm-layer.md), [ADR-0002](adr/ADR-0002-reuse-mitmproxy-for-tls.md), [ADR-0005](adr/ADR-0005-builtin-wrd-key-with-override.md).

### Cert Manager

- Responsibility: generate/install/uninstall the local MITM CA and query its status.
- Not responsible for: building its own PKI (it reuses mitmproxy's CA mechanism); setting the system proxy.
- Input: `installCa` / `uninstallCa` / `getCaStatus` IPC; the mitmproxy-specific confdir.
- Output: `{ok, message}`, CA status (installed / trusted).
- Dependencies: OS trust store (IF-005).
- Depended on by: App Shell, Proxy Orchestrator (CA availability check before starting the bridge).
- Key invariants: the CA private key stays local and is never uploaded (REQ-010, NFR-003).
- Related tests: TC-E01, TC-E02, TC-E03.
- Related spec / ADR: [specs/001-phase1-local-bridge](../../specs/001-phase1-local-bridge/spec.md), [ADR-0002](adr/ADR-0002-reuse-mitmproxy-for-tls.md).

### Allowlist Store

- Responsibility: read/write the host list and the `*.swufe.edu.cn` wildcard option, and provide the matching semantics for routing decisions.
- Not responsible for: HTTP-layer rewriting; system proxy or CA management.
- Input: `setAllowlist` IPC and matching queries.
- Output: `AllowlistConfig`; match results.
- Dependencies: none (local JSON).
- Depended on by: App Shell, Proxy Orchestrator.
- Key invariants: hosts are stored lowercase and matched exactly; `jwxt.swufe.edu.cn` is always included by default (INV-003).
- Related tests: TC-B01, TC-B02, TC-B03, TC-B04, TC-B05.
- Related spec / ADR: [specs/001-phase1-local-bridge](../../specs/001-phase1-local-bridge/spec.md).

### Telemetry UI

- Responsibility: status bar, log panel, and the allowlist / CA / process-capture / debug-logging interfaces (Renderer).
- Not responsible for: calling OS APIs directly; rewriting; holding plaintext Cookies.
- Input: `BridgeStatus`, `DebugLogEvent`, `AllowlistConfig`, CA status.
- Output: IPC calls corresponding to user actions.
- Dependencies: App Shell (via preload IPC).
- Depended on by: none (leaf).
- Key invariants: errors must not be conveyed by colour alone (accessibility); the log panel never shows bodies or Cookies by default.
- Related tests: TC-H01, TC-H02, TC-F04.
- Related spec / ADR: [specs/001-phase1-local-bridge](../../specs/001-phase1-local-bridge/spec.md), [ADR-0003](adr/ADR-0003-electron-gui-for-phase-1.md).

## Dependency rules

| Rule | Description |
| ---- | ----------- |
| WRD Codec is a pure, IO-free function library | Shared by Bridge Addon and the App (App Shell); it depends on no other component and performs no network/file access |
| Bridge Addon must not depend on the Renderer/UI | The addon only depends on WrdCodec and the pushed config; it must not reference Electron/UI code, so the sidecar can run standalone |
| Session Broker is the only Cookie reader | Other components (including Bridge Addon) may only use the session through the Cookies pushed by Orchestrator, never by reading the login session themselves |
| OS differences are concentrated in Cert Manager and Proxy Orchestrator | No other component may call OS-specific APIs (proxy, trust store, process enumeration) directly |
| Allowlist Store is the single routing data source | Whether a request is rewritten is decided only by it (and its matching semantics); no second host list may be built in the addon or UI |
| One-way dependencies | The Renderer/UI may only call Main through preload IPC; Main must not depend on the Renderer; no reverse dependency is allowed in the component diagram |

## Boundaries and ownership

| Component | Owner | Must confirm before changing |
| --------- | ----- | ---------------------------- |
| App Shell | cherrchen | Whether the IPC boundary stays in sync with [interfaces.md](interfaces.md) and [api/electron-ipc.md](../api/electron-ipc.md) |
| Login WebView | cherrchen | Whether the anti-loop strategy (INV-004) still holds |
| Session Broker | cherrchen | Whether the Cookie strategy and the "only reader" constraint are preserved |
| Proxy Orchestrator | cherrchen | Whether the proxy-conflict and clearing policy (ADR-0004, INV-002) changes |
| WRD Codec | cherrchen | Whether codec vectors (NFR-002) and default key/iv semantics (ADR-0005) are affected |
| Bridge Addon | cherrchen | Whether the rewrite strategy, allowlist semantics and log minimisation (C-004, INV-001, INV-004) are affected |
| Cert Manager | cherrchen | Whether the CA / trust model (ADR-0002, REQ-010) changes |
| Allowlist Store | cherrchen | Whether the defaults and wildcard semantics (INV-003) change |
| Telemetry UI | cherrchen | Whether new IPC is introduced or sensitive data is displayed |
