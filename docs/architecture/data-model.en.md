# Data Model

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-20
>
> Chinese source of truth: [data-model.md](data-model.md)

**Purpose**: define core entities, relationships and invariants; the source of truth for data-related changes.
**Do not write**: storage technology choices (that is an ADR), migration scripts (that is a spec's `migration.md`, see [specs/README.md](../../specs/README.md)).

---

## Entity list

| Entity | Description | Lifecycle | Detail |
| ------ | ----------- | --------- | ------ |
| AllowlistConfig | Host list and wildcard option deciding which hosts are rewritten through WebVPN | Created/updated with config writes, kept long term | this file |
| SessionState | Cookies and minimal ancillary state needed for the WebVPN session | Created after login, invalidated on expiry/logout | this file |
| AppSettings | App settings (port, debug, capture PIDs, WebVPN base, WRD key/iv, proxy marker) | Created on first launch, updated on user changes | this file |
| BridgeRuntimeStatus | Bridge runtime status (not persisted) | Born and dies in-process | this file, [api/electron-ipc.md](../api/electron-ipc.md) |
| DebugLogRecord | Debug log record (host + rewrite result) | In-memory ring buffer, optionally persisted | this file |

## Relationship diagram

The entities are mutually independent and have no relationship diagram: `AllowlistConfig`, `SessionState` and `AppSettings` are persisted independently with no identity or reference between them; `BridgeRuntimeStatus` is not persisted and `DebugLogRecord` is only an in-memory ring buffer. This file therefore provides no relationship diagram, and the former `erDiagram` section has been removed. Composition between entities happens at runtime (the bridge reads a logged-in session and the allowlist and then enters `running`), which is not a data-model relationship.

## Entity detail

### AllowlistConfig

- Description: decides which hosts are rewritten through WebVPN; hosts outside the list stay direct and unrewritten.
- Identity: a single config object (no multiple instances).
- Key attributes:

  | Attribute | Type | Required | Constraint | Notes |
  | --------- | ---- | -------- | ---------- | ----- |
  | hosts | string[] | yes | each a valid hostname, stored lowercase, exact match | default `["jwxt.swufe.edu.cn"]` |
  | includeSwufeWildcard | boolean | yes | default `false` | matches the `swufe.edu.cn` apex or any `.swufe.edu.cn` suffix |
  | updatedAt | string (ISO8601) | yes | — | last update time |

- Invariants: lowercase storage and exact matching (INV-003); `webvpn.swufe.edu.cn` / `authserver.swufe.edu.cn` are never rewrite targets (INV-004).
- Lifecycle: created when config is first read at startup; updated when hosts are added/removed or the wildcard is toggled; deleted by explicit clearing (back to defaults).
- Owner: cherrchen.
- Related requirements: REQ-005, REQ-001.

### SessionState

- Description: Cookies and minimal ancillary state for the official WebVPN session; sensitive data.
- Identity: a single session object (one after login).
- Key attributes:

  | Attribute | Type | Required | Constraint | Notes |
  | --------- | ---- | -------- | ---------- | ----- |
  | cookies | Cookie[] | yes | sensitive; must never enter logs | WebVPN session Cookies |
  | capturedAt | string | yes | — | capture time |
  | lastValidatedAt | string \| null | no | — | last expiry-detection time |

  Cookie sub-structure:

  | Field | Type | Constraint | Notes |
  | ----- | ---- | ---------- | ----- |
  | name | string | — | Cookie name |
  | value | string | sensitive, must never enter logs | Cookie value |
  | domain | string | — | scope |
  | path | string | — | path |
  | expires | number \| null | — | expiry time |
  | httpOnly | boolean | — | — |
  | secure | boolean | — | — |
  | sameSite | string \| null | — | — |

- Invariants: Cookies and bodies never enter logs (INV-001).
- Lifecycle: created by capture after a successful login; updated on re-capture/validation; deleted on logout, expiry or bridge session reset.
- Owner: cherrchen.
- Related requirements: REQ-002, REQ-009.

### AppSettings

- Description: application-level settings and runtime markers.
- Identity: a single config object.
- Key attributes:

  | Attribute | Type | Required | Constraint | Notes |
  | --------- | ---- | -------- | ---------- | ----- |
  | bridgePort | number | yes | default 8080 or automatic | local bridge listening port |
  | debugLogging | boolean | yes | default `false` | debug logging toggle |
  | capturePids | number[] | yes | default `[]` | process-capture targets |
  | webvpnBase | string | yes | default `https://webvpn.swufe.edu.cn` | WebVPN entry |
  | wrdKey | string | yes | default `wrdvpnisthebest!`, overridable | default WRD key (ADR-0005) |
  | wrdIv | string | yes | default `wrdvpnisthebest!`, overridable | default WRD IV (ADR-0005) |
  | systemProxyManagedByApp | boolean | yes | default `false`; runtime | "system proxy set by this app" marker |

- Invariants: `systemProxyManagedByApp` stays strongly consistent with the actual proxy state; the system proxy is cleared only when the marker is true (INV-002).
- Lifecycle: created on first launch; updated on user setting changes or bridge start/stop; deleted by resetting settings.
- Owner: cherrchen.
- Related requirements: REQ-001, REQ-003, REQ-004.

### BridgeRuntimeStatus

- Description: bridge runtime status for the UI; **not persisted**.
- Identity: a single runtime object; defined as the `BridgeStatus` interface.
- Key attributes:

  | Attribute | Type | Required | Constraint | Notes |
  | --------- | ---- | -------- | ---------- | ----- |
  | state | `idle` \| `starting` \| `running` \| `stopping` \| `error` | yes | fixed state-machine values | bridge state |
  | loggedIn | boolean | yes | — | whether a usable session has been obtained |
  | systemProxyEnabled | boolean | yes | — | whether the system proxy points at the bridge |
  | localCaptureEnabled | boolean | yes | — | whether process capture is enabled |
  | bridgePort | number | no | — | local bridge port |
  | error | `{ code, message }` | no | code drawn from the fixed error-code set | error information |

- Invariants: transitions must follow `idle → starting → running`, `running → stopping → idle`, `starting → error → idle`.
- Lifecycle: created and destroyed in-process; never written to disk.
- Owner: cherrchen.
- Related requirements: REQ-001, REQ-009.

### DebugLogRecord

- Description: a debug log record containing only the host and whether rewriting succeeded.
- Identity: one entry in the in-memory ring buffer, optionally persisted.
- Key attributes:

  | Attribute | Type | Required | Constraint | Notes |
  | --------- | ---- | -------- | ---------- | ----- |
  | ts | string | yes | — | time |
  | host | string | yes | — | hostname |
  | rewritten | boolean | yes | — | whether rewriting succeeded |
  | direction | `request` \| `response` | yes | — | direction |
  | detail | string \| null | no | **must not contain Cookies or bodies** | short message |

- Invariants: records never contain Cookies or bodies (INV-001).
- Lifecycle: created per request/response handling; in-memory ring buffer by default, optionally persisted; disappears with process exit or cleanup.
- Owner: cherrchen.
- Related requirements: REQ-009.

## Invariants

| ID | Invariant | Consequence of violation | Validated at |
| -- | --------- | ------------------------ | ------------ |
| INV-001 | Cookies and bodies never enter logs | session leak, privacy leak | DebugLogRecord write path and the log panel |
| INV-002 | After stop / expiry / exit, only the system proxy set by this app is cleared | wrongly clearing the user's own proxy setting and breaking other tools | Proxy Orchestrator's proxy-clearing logic |
| INV-003 | Allowlist hosts are stored lowercase and matched exactly | a miss sends a host that should be rewritten direct; a false match widens rewriting | Allowlist Store write path and the matching function |
| INV-004 | `webvpn.swufe.edu.cn` and `authserver.swufe.edu.cn` are never wrapped twice | anti-loop fails, login and bridge traffic loop | Bridge Addon hard-coded exclusions and the Login WebView bypass |

## Storage and migration

| Item | Location |
| ---- | -------- |
| Storage decision | ADR (see [adr/README.md](adr/README.md)); config is stored as JSON (settings + allowlist → `userData/config.json`, session → `userData/session.bin` (encrypted) or an Electron persistent session partition, CA → mitmproxy-specific confdir) |
| Migration approach | None yet (Phase 1 is local-only persistence with no cloud account system) |
| Backup / recovery | [docs/operations/](../operations/README.md) |

## Change process

Before changing the data model:

1. Update this file (entities, invariants);
2. Assess whether an ADR is required (a material data-model change requires one);
3. Define migration and rollback in the spec;
4. Update the verification entries in [verification](../../specs/_template/verification.md).
