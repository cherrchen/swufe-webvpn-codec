# Electron IPC (`window.swufeBridge`)

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-23
>
> Chinese source of truth: [electron-ipc.md](electron-ipc.md)

## Scope

- Provider: the Electron Main process (single outward face of Login WebView / Session Broker / Proxy Orchestrator / Cert Manager / Allowlist Store).
- Consumer: the Renderer (four windows — the main window plus the capture / logs / allowlist secondary windows, see [../ui-ux/main-window.md](../ui-ux/main-window.md) and [../ui-ux/secondary-windows.md](../ui-ux/secondary-windows.md)).
- Form: in-process IPC; the preload script exposes the namespace `window.swufeBridge` (placeholder name).
- Window control: opening/focusing a secondary window also goes through this surface (`openCaptureWindow` / `openLogWindow` / `openAllowlistWindow`); window lifecycle lives in Main's window registry, one instance per kind.
- Stability: Internal — consumed only inside this app, no external promise; breaking changes update this file + [architecture/interfaces.md](../architecture/interfaces.md) + the related spec.
- Related spec: [specs/001-phase1-local-bridge/spec.md](../../specs/001-phase1-local-bridge/spec.md), [specs/002-desktop-ui-multiwindow/spec.md](../../specs/002-desktop-ui-multiwindow/spec.md)

## Authentication and authorisation

Not applicable. Both sides are two processes of the same application on the same machine (the Renderer namespace is injected by this app's preload). There is no network boundary, no external caller and no separate user identity or token concept; isolation comes from Electron context isolation and the preload allowlist, so no authentication or authorisation layer is introduced.

## Common conventions

- Encoding: UTF-8 strings; signatures and types declared in TypeScript (see "Type definitions").
- Time format: ISO8601 strings (e.g. `getSession().expiresAt`, `DebugLogEvent.ts`).
- Pagination: none (returned collections are small local lists).
- Rate limiting: none (in-process calls).
- Idempotency: marked per method below; "yes" means repeating the call with the same arguments is equivalent to calling it once.
- Errors: a method may reject with an error carrying a code, or report `{ code, message }` through `BridgeStatus.error`; the full code set and user actions are in [Error model](#error-model).

| Method | Idempotent |
| ------ | ---------- |
| `login` | no (opens the login WebView; interactive flow) |
| `logout` | yes |
| `getSession` | yes (read-only) |
| `startBridge` | yes (stays `running` when already running) |
| `stopBridge` | yes |
| `getStatus` | yes (read-only) |
| `getAllowlist` | yes (read-only) |
| `setAllowlist` | yes (full overwrite) |
| `getSettings` | yes (read-only) |
| `installCa` / `uninstallCa` | yes |
| `getCaStatus` | yes (read-only) |
| `listCaptureCandidates` | yes (read-only) |
| `setCaptureMode` | yes (full overwrite) |
| `setCaptureProcesses` | yes (full overwrite) |
| `setDebugLogging` | yes |
| `openCaptureWindow` | yes (single instance: an open window is focused, never duplicated) |
| `openLogWindow` | yes (single instance: an open window is focused, never duplicated) |
| `openAllowlistWindow` | yes (single instance: an open window is focused, never duplicated) |
| `getDebugLogs` | yes (read-only) |
| `clearDebugLogs` | yes |
| `onDebugLog` | yes (subscription; repeated subscriptions are independent and each returns its own unsubscribe function) |
| `onStatus` | yes (subscription; independent per subscription, returns its own unsubscribe function) |
| `onSessionExpired` | yes (subscription; independent per subscription, returns its own unsubscribe function) |

> The original package does not specify idempotency per method; the table above is this document's convention for the implementation.

## Type definitions

These types are taken verbatim from the archived package's interface definition.

```ts
interface BridgeStatus {
  state: 'idle' | 'starting' | 'running' | 'stopping' | 'error'
  loggedIn: boolean
  systemProxyEnabled: boolean
  localCaptureEnabled: boolean
  bridgePort?: number
  error?: { code: string; message: string }
  captureError?: string   // added in M3: why process capture failed (never changes the bridge state)
}
```

```ts
interface AllowlistConfig {
  hosts: string[]           // exact hostnames
  includeSwufeWildcard: boolean  // *.swufe.edu.cn
}
```

```ts
interface CaStatus {
  installed: boolean
  trusted: boolean
}
```

```ts
interface DebugLogEvent {
  ts: string
  host: string
  rewritten: boolean
  direction: 'request' | 'response'
  detail?: string   // short message, no body
}
```

```ts
type CaptureMode = 'system-proxy' | 'selected-apps'   // added in M3: the two modes exclude each other
```

```ts
interface CaptureCandidate {          // added in M3: one candidate row per application
  pid: number
  name: string
  pattern: string                     // mitmproxy intercept pattern: an .app bundle path or a full executable path
}
```

```ts
interface CaptureReport {             // added in M3: mirrors the sidecar's swufe-capture diagnostic line
  enabled: boolean
  processes: string[]
  error: string | null
}
```

```ts
interface AppSettingsView {
  bridgePort: number
  debugLogging: boolean
  captureMode: CaptureMode            // M3: replaces capturePids
  captureProcesses: string[]          // M3: intercept patterns (at most 32)
  webvpnBase: string
}
```

Persisted entities (`AllowlistConfig.updatedAt`, `SessionState`, `AppSettings`) are defined by [architecture/data-model.md](../architecture/data-model.md); this file only defines the IPC surface types.

## Methods

### `login(): Promise<void>`

```ts
login(): Promise<void>           // opens the login WebView
```

- Purpose: open the login WebView so the user completes CAS/MFA on the official portal and a usable WebVPN session is obtained (Session Broker).
- Input: none.
- Output: `Promise<void>`; a successful login means the app "reliably holds a usable WebVPN session" (cookie names as observed on the live site), after which `getStatus().loggedIn` is `true`.
- Errors: see [Error model](#error-model) (starting the bridge while logged out returns `NOT_LOGGED_IN`).

### `logout(): Promise<void>`

```ts
logout(): Promise<void>          // clears cookies; stops the bridge if running
```

- Purpose: clear session cookies; if the bridge is running, stop it first.
- Input: none.
- Output: `Promise<void>`.
- Errors: see [Error model](#error-model) (`BRIDGE_CRASH` if the bridge fails to stop).

### `getSession(): Promise<{ loggedIn: boolean; expiresAt?: string | null }>`

```ts
getSession(): Promise<{
  loggedIn: boolean
  expiresAt?: string | null      // when available
}>
```

- Purpose: query the current session state.
- Input: none.
- Output:

  | Field | Type | Required | Constraint | Notes |
  | ----- | ---- | -------- | ---------- | ----- |
  | `loggedIn` | `boolean` | yes | — | whether a usable WebVPN session exists |
  | `expiresAt` | `string \| null` | no | ISO8601 | session expiry, when available |

- Errors: see [Error model](#error-model).

### `startBridge(): Promise<BridgeStatus>`

```ts
startBridge(): Promise<BridgeStatus>
```

- Purpose: start the local bridge: launch the mitm sidecar, set the system proxy and process capture as needed.
- Input: none (bridge port, allowlist and webvpnBase come from `AppSettings` and the Allowlist Store).
- Output: `BridgeStatus` (see "Type definitions"); on success `state` goes `idle → starting → running`.
- Errors: see [Error model](#error-model); if the system proxy is already in use, or the gateway host resolves into the fake-ip range (`198.18.0.0/15`, Clash / mihomo / sing-box TUN mode), starting is refused with `PROXY_CONFLICT` (ADR-0004, [ADR-0011](../architecture/adr/ADR-0011-refuse-start-on-fake-ip-dns.en.md)).

### `stopBridge(): Promise<BridgeStatus>`

```ts
stopBridge(): Promise<BridgeStatus>
```

- Purpose: stop the local bridge: stop the sidecar and process capture, and clear the system proxy only if this app set it.
- Input: none.
- Output: `BridgeStatus`; on success `state` goes through `stopping` back to `idle`.
- Errors: see [Error model](#error-model).

### `getStatus(): Promise<BridgeStatus>`

```ts
getStatus(): Promise<BridgeStatus>
```

- Purpose: read the bridge runtime status (never persisted).
- Input: none.
- Output: `BridgeStatus`; a non-empty `error` means the error state (e.g. `SESSION_EXPIRED`, `BRIDGE_CRASH`).
- Errors: see [Error model](#error-model).

### `getAllowlist(): Promise<AllowlistConfig>`

```ts
getAllowlist(): Promise<AllowlistConfig>
```

- Purpose: read the allowlist (only these hosts are rewritten through WebVPN; everything else goes direct).
- Input: none.
- Output: `AllowlistConfig`; default `{"hosts":["jwxt.swufe.edu.cn"],"includeSwufeWildcard":false}`.
- Errors: see [Error model](#error-model).

### `setAllowlist(cfg: AllowlistConfig): Promise<void>`

```ts
setAllowlist(cfg: AllowlistConfig): Promise<void>
```

- Purpose: overwrite the allowlist as a whole.
- Input:

  | Field | Type | Required | Constraint | Notes |
  | ----- | ---- | -------- | ---------- | ----- |
  | `hosts` | `string[]` | yes | each entry a valid hostname, stored lowercase | exact match |
  | `includeSwufeWildcard` | `boolean` | yes | default `false` | when ticked, matches `swufe.edu.cn` and the `.swufe.edu.cn` suffix |

- Output: `Promise<void>`.
- Side effect (added in M6): after a successful write Main broadcasts the current `BridgeStatus` once more so windows re-read the allowlist summary (the main window is the only consumer; the push channel is still `onStatus` and no new event is added).
- Errors: see [Error model](#error-model) (with empty `hosts` and the wildcard off, starting the bridge returns `ALLOWLIST_EMPTY`).

### `getSettings(): Promise<AppSettingsView>`

```ts
getSettings(): Promise<AppSettingsView>   // added in M2: read-only, for UI defaults
```

- Purpose: read the UI-visible subset of the current settings (`bridgePort` / `debugLogging` / `captureMode` / `captureProcesses` / `webvpnBase`) so the UI can show the initial switch, capture mode and port values.
- Input: none.
- Output: `AppSettingsView`; it does **not** include `wrdKey` / `wrdIv` (sensitive values never cross IPC).
- Errors: see the [error model](#error-model).

### `installCa(): Promise<{ ok: boolean; message?: string }>`

```ts
installCa(): Promise<{ ok: boolean; message?: string }>
```

- Purpose: install the locally generated MITM CA into the system trust store (reusing the mitmproxy CA mechanism).
- Input: none.
- Output: `ok` reports success; `message` is optional extra information.
- Errors: see [Error model](#error-model) (`CA_MISSING` when not installed/trusted).

### `uninstallCa(): Promise<{ ok: boolean; message?: string }>`

```ts
uninstallCa(): Promise<{ ok: boolean; message?: string }>
```

- Purpose: remove the local CA from the system trust store (reversible in one click).
- Input: none.
- Output: `ok` plus optional `message`.
- Errors: see [Error model](#error-model).

### `getCaStatus(): Promise<CaStatus>`

```ts
getCaStatus(): Promise<{ installed: boolean; trusted: boolean }>
```

- Purpose: query whether the CA is installed and trusted by the system.
- Input: none.
- Output: `CaStatus` (see "Type definitions").
- Errors: see [Error model](#error-model).

### `listCaptureCandidates(): Promise<CaptureCandidate[]>`

```ts
listCaptureCandidates(): Promise<CaptureCandidate[]>   // M3: each row carries a pattern
```

- Purpose: list the applications selectable for "process capture" (mitmproxy local mode), e.g. Chrome.
- Input: none.
- Output: `CaptureCandidate[]`; **one row per application** — a main process and its helpers collapse onto one `pattern` (the `.app` bundle path), anything else uses its full executable path.
- Errors: see [Error model](#error-model).

### `setCaptureMode(mode: CaptureMode): Promise<void>`

```ts
setCaptureMode(mode: CaptureMode): Promise<void>   // added in M3
```

- Purpose: switch the capture mode (`system-proxy` = the system proxy takes all traffic; `selected-apps` = capture only the chosen apps).
- Input:

  | Field | Type | Required | Constraint | Notes |
  | ----- | ---- | -------- | ---------- | ----- |
  | `mode` | `'system-proxy' \| 'selected-apps'` | yes | must be one of the two literals | full overwrite |

- Output: `Promise<void>`.
- Behaviour: the two modes are **mutually exclusive** — switching to `selected-apps` revokes the system proxy this app set (instead of setting a new one), and switching back to `system-proxy` removes process capture and sets the system proxy again. While the bridge is not running only the config is written and pushed; no OS proxy is touched.
- Errors: see [Error model](#error-model); when another tool owns the system proxy, switching to `selected-apps` is refused with `PROXY_CONFLICT` and nothing is persisted.

### `setCaptureProcesses(patterns: string[]): Promise<void>`

```ts
setCaptureProcesses(patterns: string[]): Promise<void>   // added in M3, replaces setCapturePids
```

- Purpose: set the captured application set (effective only while the capture mode is `selected-apps`).
- Input:

  | Field | Type | Required | Constraint | Notes |
  | ----- | ---- | -------- | ---------- | ----- |
  | `patterns` | `string[]` | yes | values must come from `listCaptureCandidates()` `pattern` fields; non-empty, comma-free, deduplicated; at most 32; an empty array captures no application | full overwrite |

- Output: `Promise<void>`.
- Errors: see [Error model](#error-model); invalid input rejects without writing the config.

### `setDebugLogging(enabled: boolean): Promise<void>`

```ts
setDebugLogging(enabled: boolean): Promise<void>
```

- Purpose: toggle debug logging (off by default; even when enabled it records only "host + whether the rewrite succeeded", never bodies, request payloads or cookies).
- Input:

  | Field | Type | Required | Constraint | Notes |
  | ----- | ---- | -------- | ---------- | ----- |
  | `enabled` | `boolean` | yes | default `false` | maps to `AppSettings.debugLogging` |

- Output: `Promise<void>`.
- Side effect: when `enabled === false`, besides persisting and pushing the config, Main **clears its debug-log ring buffer and closes the log window** (an extension of the existing "closing clears" semantics); `true` only persists and pushes, and the renderer then opens the log window through `openLogWindow()`.
- Errors: see [Error model](#error-model).

### `openCaptureWindow(): Promise<void>`

```ts
openCaptureWindow(): Promise<void>   // added in M6: opens or focuses the capture window
```

- Purpose: open the "process capture — application selection" secondary window (the target of the main window's "choose apps…" action).
- Input: none.
- Output: `Promise<void>` (it only reports that the create/focus action finished; it does not wait for the page to render).
- Behaviour: one instance per window kind — an existing window is `restore()`d / `show()`n / `focus()`ed, otherwise it is created from `WINDOW_SPECS`; secondary windows are non-modal (no `parent`, the main window stays usable); on mount the new window fetches its initial state through this surface (`getStatus` / `getSettings` / `listCaptureCandidates`).
- Errors: see [Error model](#error-model).

### `openLogWindow(): Promise<void>`

```ts
openLogWindow(): Promise<void>   // added in M6: opens or focuses the log window
```

- Purpose: open the "debug log" secondary window (the target after the debug-logging switch is turned on).
- Input: none.
- Output: `Promise<void>`.
- Behaviour: same single-instance / non-modal semantics as `openCaptureWindow`; on mount the window restores history through `getDebugLogs()` (the buffer lives in Main, so reopening loses nothing).
- Errors: see [Error model](#error-model).

### `openAllowlistWindow(): Promise<void>`

```ts
openAllowlistWindow(): Promise<void>   // added in M6: opens or focuses the allowlist window
```

- Purpose: open the allowlist editing window (the target of the main window's "manage…" action: add/remove hosts, toggle `*.swufe.edu.cn`).
- Input: none.
- Output: `Promise<void>`.
- Behaviour: same single-instance / non-modal semantics as `openCaptureWindow`; on mount the window reads its initial values through `getAllowlist()`.
- Errors: see [Error model](#error-model).

### `getDebugLogs(): Promise<DebugLogEvent[]>`

```ts
getDebugLogs(): Promise<DebugLogEvent[]>   // added in M6: read-only
```

- Purpose: read a copy of the debug log held in Main's ring buffer (used by the log window to restore history on mount).
- Input: none.
- Output: `DebugLogEvent[]`, **newest first**, at most `MAX_DEBUG_LOG_ENTRIES` (200) entries; the array is a copy, so mutating it never affects the buffer. The buffer is in-memory only and never persisted (NFR-003).
- Errors: see [Error model](#error-model).

### `clearDebugLogs(): Promise<void>`

```ts
clearDebugLogs(): Promise<void>   // added in M6: clears Main's ring buffer
```

- Purpose: clear Main's debug-log ring buffer (the target of the log window's "clear" button); after clearing, closing and reopening the window no longer brings the cleared records back.
- Input: none.
- Output: `Promise<void>`.
- Errors: see [Error model](#error-model).

### `onDebugLog(cb: (e: DebugLogEvent) => void): () => void`

```ts
// Main → Renderer event
onDebugLog(cb: (e: DebugLogEvent) => void): () => void
```

- Purpose: subscribe to Main → Renderer debug log events (log panel: host | rewrite result | time).
- Input:

  | Field | Type | Required | Constraint | Notes |
  | ----- | ---- | -------- | ---------- | ----- |
  | `cb` | `(e: DebugLogEvent) => void` | yes | — | event callback |

- Output: an unsubscribe function `() => void`.
- Delivery scope (changed in M6): Main **broadcasts to every live window** (previously the main window only); each window subscribes and renders on its own.
- Event payload: `DebugLogEvent` (see "Type definitions"); `detail` may hold a short message and must not hold bodies or cookies.
- Errors: see [Error model](#error-model).

### `onStatus(cb: (status: BridgeStatus) => void): () => void`

```ts
// Main → Renderer event (added in M2)
onStatus(cb: (status: BridgeStatus) => void): () => void
```

- Purpose: subscribe to Main → Renderer bridge-status pushes; Main pushes once after every status change (start/stop/failure/expiry/session change) so the UI never has to poll.
- Input: `cb` (status callback).
- Output: unsubscribe function `() => void` (independent per subscription).
- Delivery scope (changed in M6): Main **broadcasts to every live window** (previously the main window only); the extra broadcast after a successful `setAllowlist` rides the same channel.
- Event payload: `BridgeStatus` (see "Type definitions").
- Errors: see the [error model](#error-model).

### `onSessionExpired(cb: () => void): () => void`

```ts
// Main → Renderer event (added in M2)
onSessionExpired(cb: () => void): () => void
```

- Purpose: subscribe to "the session expired and the bridge has stopped with the system proxy cleared", so the UI can show the re-login modal (copy in [../ui-ux/main-window.md](../ui-ux/main-window.md)); `getStatus().error.code` is `SESSION_EXPIRED` at the same time.
- Input: `cb` (no-argument callback).
- Output: unsubscribe function `() => void`.
- Delivery scope (changed in M6): Main **broadcasts to every live window** (previously the main window only), so the event also arrives while a secondary window is in front.
- Errors: see the [error model](#error-model).

## Error model

The full error code set (meaning and user action); `message` carries the user-facing reason.

| Code | Meaning | User action |
| ---- | ------- | ----------- |
| `PROXY_CONFLICT` | Proxy-environment conflict: the system proxy is already in use (checked before starting, and before switching to selected apps), or the gateway host resolves into the fake-ip range (`198.18.0.0/15`, TUN mode, [ADR-0011](../architecture/adr/ADR-0011-refuse-start-on-fake-ip-dns.en.md)) | Turn off the other tool's system proxy and TUN mode |
| `CA_MISSING` | CA not installed / not trusted | go install it |
| `NOT_LOGGED_IN` | no session | go log in |
| `SESSION_EXPIRED` | session expired | log in again |
| `BRIDGE_CRASH` | mitm process exited | check logs / restart the bridge |
| `ALLOWLIST_EMPTY` | no hosts | add a host |

How error codes travel: `BridgeStatus.error` / `BridgeStatus.captureError` ride on the status object, while a rejecting method throws an `Error` carrying the code.
Electron keeps only `message` and `stack` of an `invoke` rejection (custom properties are dropped), so `setCaptureMode` / `setCaptureProcesses` reject with
`<CODE>：<message>` (for example `PROXY_CONFLICT：检测到代理环境冲突：…`); the renderer parses that prefix to decide whether to show the proxy-conflict modal.

A capture failure **has no error code**: it never changes the bridge state and only fills `BridgeStatus.captureError` (REQ-003 boundary / [ADR-0006](../architecture/adr/ADR-0006-local-capture-mode-and-mutual-exclusion.en.md)).

The full post-expiry handling (stop bridge → clear system proxy → stop process capture → prompt re-login) is in [../ui-ux/main-window.md](../ui-ux/main-window.md).

## Versioning and compatibility

- Versioning: no standalone version number; stability is Internal.
- Breaking change process: update this file + [architecture/interfaces.md](../architecture/interfaces.md) + [specs/001-phase1-local-bridge/spec.md](../../specs/001-phase1-local-bridge/spec.md) in the same change and state it in the PR's Breaking Changes section.
- Deprecation process: mark the method `Deprecated` here with its replacement, then remove it once the Renderer has fully migrated.

## Change log

| Date | Change | Compatibility | Related spec / ADR |
| ---- | ------ | ------------- | ------------------ |
| 2026-09-20 | First version: session, bridge control, allowlist, certificate, process capture and debug logging — 15 methods/events total | — | [spec 001](../../specs/001-phase1-local-bridge/spec.md) |
| 2026-09-21 | M2 added three items (the semantics of the 15 methods above are unchanged): `getSettings` (read-only, for UI defaults; the WRD key/IV never cross IPC), `onStatus` (Main → Renderer status pushes) and `onSessionExpired` (session-expiry event driving the re-login modal) | Compatible (added methods/events) | [spec 001](../../specs/001-phase1-local-bridge/spec.md) / [M2 completion record](../planning/milestones/M2-desktop-orchestration.en.md) |
| 2026-09-21 | M3 capture modes: `setCapturePids` → **`setCaptureProcesses`** (intercept patterns instead of PIDs, full overwrite); new `setCaptureMode` (`system-proxy` / `selected-apps`, mutually exclusive); `BridgeStatus.captureError`; `CaptureCandidate.pattern`; `AppSettingsView.captureMode` / `.captureProcesses`; `getStatus().localCaptureEnabled` now means "bridge running + selected apps + the sidecar reported enabled" | **Breaking**: `setCapturePids` is gone | [spec 001](../../specs/001-phase1-local-bridge/spec.md) / [ADR-0006](../architecture/adr/ADR-0006-local-capture-mode-and-mutual-exclusion.en.md) |
| 2026-09-23 | M6 four-window UI: 5 added methods — `openCaptureWindow` / `openLogWindow` / `openAllowlistWindow` (secondary-window entry points, one instance per kind, a repeated call focuses), `getDebugLogs` (read-only copy of Main's ring buffer, newest first, ≤200) and `clearDebugLogs` (clears that buffer); `setDebugLogging(false)` gained a side effect (clears the buffer and closes the log window); a successful `setAllowlist` broadcasts `status` once more; the delivery scope of `onDebugLog` / `onStatus` / `onSessionExpired` changed from "the main window only" to **every live window**; the 16 pre-existing methods and all event signatures are unchanged (21 methods / 3 events in total) | Compatible (additive only) | [spec 002](../../specs/002-desktop-ui-multiwindow/spec.md) / [ADR-0012](../architecture/adr/ADR-0012-react-antd-multiwindow-renderer.md) |
