# Bridge Control Protocol (Electron Main → mitm sidecar)

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-20
>
> Chinese source of truth: [bridge-control-protocol.md](bridge-control-protocol.md)

## Scope

- Provider: the mitm sidecar (the local bridge process, including the thin WRD addon).
- Consumer: the Electron Main process (Proxy Orchestrator).
- Form: local inter-process interface (two candidate implementations below).
- Stability: Internal / Evolving — consumed only inside this app; `TBD`: which implementation Phase 1 uses is undecided, so no stability promise is made until then.
- Related spec: [specs/001-phase1-local-bridge/spec.md](../../specs/001-phase1-local-bridge/spec.md)

## Authentication and authorisation

- Under option B the control port listens on `127.0.0.1` only (loopback is the trust boundary); no token or account system is introduced, and it is never exposed to the LAN or an external address.
- Cookies are sensitive: they must never be written to debug logs or to control-port responses (NFR-003).

## Common conventions

- Encoding: option B request/response bodies are JSON (UTF-8); option A uses a configuration file (JSON).
- Time format: ISO8601 (where time fields are involved).
- Pagination: none.
- Rate limiting: none (loopback / single-process calls).
- Idempotency: `GET /health` is read-only; `POST /config` is a full overwrite (idempotent); `POST /shutdown` is idempotent.

## Candidate implementations

Undecided for Phase 1: both options satisfy the Phase 1 requirements, and the concrete control-plane shape is decided during implementation.

### Option A: child-process lifecycle + configuration file hot reload

- Main only launches and terminates the sidecar process and writes the configuration file the sidecar reads.
- Configuration takes effect via `SIGHUP` or by polling the file for changes (pick one during implementation).
- No new listening port; the control plane is weaker than option B (no liveness endpoint).

### Option B: local HTTP control port

- The sidecar listens on the local control port `127.0.0.1:control` (the actual port is decided during implementation); Main calls it over HTTP.

| Method | Path | Description |
|---|---|---|
| GET | `/health` | liveness |
| POST | `/config` | body: `{ allowlist, cookies, debug }` |
| POST | `/shutdown` | graceful exit |

### `TBD` note

- **Undecided**: whether Phase 1 uses option A or option B.
- **Why**: left to the implementation phase (both options satisfy the Phase 1 requirements; the trade-off depends on how the sidecar is packaged and on the cost of configuration hot reload).

## Hard constraints

1. Cookies must never be written to debug logs or to control-port responses.
2. The control port listens on `127.0.0.1` only and must never listen on `0.0.0.0` or any externally reachable address.

## Versioning and compatibility

- Versioning: no standalone version number; stability is Internal.
- Breaking change process: update this file + [architecture/interfaces.md](../architecture/interfaces.md) + [specs/001-phase1-local-bridge/spec.md](../../specs/001-phase1-local-bridge/spec.md) and state it in the PR's Breaking Changes section.
- Deprecation process: mark the endpoint `Deprecated` here with its replacement, then remove it once Main has fully migrated.

## Change log

| Date | Change | Compatibility | Related spec / ADR |
| ---- | ------ | ------------- | ------------------ |
| 2026-09-20 | First version: options A / B recorded with hard constraints; implementation marked `TBD` | — | [spec 001](../../specs/001-phase1-local-bridge/spec.md) |
