# Electron IPC (`window.swufeBridge`)

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-20
>
> Chinese source of truth: [electron-ipc.md](electron-ipc.md)

## Scope

- Provider: the Electron Main process (single outward face of Login WebView / Session Broker / Proxy Orchestrator / Cert Manager / Allowlist Store).
- Consumer: the Renderer (main window UI, see [../ui-ux/main-window.md](../ui-ux/main-window.md)).
- Form: in-process IPC; the preload script exposes the namespace `window.swufeBridge` (placeholder name).
- Stability: Internal — consumed only inside this app, no external promise; breaking changes update this file + [architecture/interfaces.md](../architecture/interfaces.md) + the related spec.
- Related spec: [specs/001-phase1-local-bridge/spec.md](../../specs/001-phase1-local-bridge/spec.md)

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
| `installCa` / `uninstallCa` | yes |
| `getCaStatus` | yes (read-only) |
| `listCaptureCandidates` | yes (read-only) |
| `setCapturePids` | yes (full overwrite) |
| `setDebugLogging` | yes |
| `onDebugLog` | yes (subscription; repeated subscriptions are independent and each returns its own unsubscribe function) |

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
- Errors: see [Error model](#error-model); if the system proxy is already in use, starting is refused with `PROXY_CONFLICT` (ADR-0004).

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
- Errors: see [Error model](#error-model) (with empty `hosts` and the wildcard off, starting the bridge returns `ALLOWLIST_EMPTY`).

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

### `listCaptureCandidates(): Promise<Array<{ pid: number; name: string }>>`

```ts
listCaptureCandidates(): Promise<Array<{ pid: number; name: string }>>
```

- Purpose: list the processes selectable for "process capture" (mitmproxy local mode), e.g. Chrome.
- Input: none.
- Output: an array of processes, each with `pid` and `name`.
- Errors: see [Error model](#error-model).

### `setCapturePids(pids: number[]): Promise<void>`

```ts
setCapturePids(pids: number[]): Promise<void>
```

- Purpose: set the captured process set (may be enabled together with the system proxy).
- Input:

  | Field | Type | Required | Constraint | Notes |
  | ----- | ---- | -------- | ---------- | ----- |
  | `pids` | `number[]` | yes | values must come from `listCaptureCandidates()`; an empty array disables process capture | full overwrite |

- Output: `Promise<void>`.
- Errors: see [Error model](#error-model).

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
- Event payload: `DebugLogEvent` (see "Type definitions"); `detail` may hold a short message and must not hold bodies or cookies.
- Errors: see [Error model](#error-model).

## Error model

The full error code set (meaning and user action); `message` carries the user-facing reason.

| Code | Meaning | User action |
| ---- | ------- | ----------- |
| `PROXY_CONFLICT` | system proxy already in use | close the other proxy |
| `CA_MISSING` | CA not installed / not trusted | go install it |
| `NOT_LOGGED_IN` | no session | go log in |
| `SESSION_EXPIRED` | session expired | log in again |
| `BRIDGE_CRASH` | mitm process exited | check logs / restart the bridge |
| `ALLOWLIST_EMPTY` | no hosts | add a host |

The full post-expiry handling (stop bridge → clear system proxy → stop process capture → prompt re-login) is in [../ui-ux/main-window.md](../ui-ux/main-window.md).

## Versioning and compatibility

- Versioning: no standalone version number; stability is Internal.
- Breaking change process: update this file + [architecture/interfaces.md](../architecture/interfaces.md) + [specs/001-phase1-local-bridge/spec.md](../../specs/001-phase1-local-bridge/spec.md) in the same change and state it in the PR's Breaking Changes section.
- Deprecation process: mark the method `Deprecated` here with its replacement, then remove it once the Renderer has fully migrated.

## Change log

| Date | Change | Compatibility | Related spec / ADR |
| ---- | ------ | ------------- | ------------------ |
| 2026-09-20 | First version: session, bridge control, allowlist, certificate, process capture and debug logging — 15 methods/events total | — | [spec 001](../../specs/001-phase1-local-bridge/spec.md) |
