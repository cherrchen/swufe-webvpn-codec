# API Documentation

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-20
>
> Chinese source of truth: [README.md](README.md)

**Purpose**: this directory is the source of truth for **interface contracts**: fields, errors, versions, compatibility promises.
Boundaries and stability policy: [architecture/interfaces.md](../architecture/interfaces.md). Data entities: [architecture/data-model.md](../architecture/data-model.md).

This repository has **no public HTTP API**: every Phase 1 interface is either in-process (Electron IPC), local inter-process (Electron Main ↔ mitm sidecar) or library-level.

## Interface surface inventory

| File | Surface | Provider → Consumer | Form | Stability |
| ---- | ------- | ------------------- | ---- | --------- |
| [electron-ipc.md](electron-ipc.md) | Electron IPC, preload namespace `window.swufeBridge` | Electron Main → Renderer | in-process | Internal |
| [bridge-control-protocol.md](bridge-control-protocol.md) | Bridge control protocol | Electron Main → mitm sidecar | inter-process (local only) | Internal / Evolving (two candidate implementations, undecided — see that document) |
| [wrd-codec-library.md](wrd-codec-library.md) | WrdCodec library API (host encrypt/decrypt and URL conversion) | WrdCodec library → callers (bridge addon, app) | library-level | Evolving |

> When adding a surface, add a row above and create `docs/api/<surface>.md` from the template below.

## Interface document template

```markdown
# <surface name>

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-20

## Scope

- Provider: …
- Consumer: …
- Stability: Stable / Evolving / Internal
- Related spec: `specs/<id>-<name>/`

## Authentication and authorisation

TBD

## Common conventions

- Encoding: …
- Time format: …
- Pagination: …
- Idempotency: …
- Rate limiting: …

## Endpoints / methods

### <METHOD> <path or signature>

- Purpose: …
- Input:

  | Field | Type | Required | Constraint | Notes |
  | ----- | ---- | -------- | ---------- | ----- |

- Output: …
- Errors:

  | Code | Meaning | Trigger | Suggested handling |
  | ---- | ------- | ------- | ------------------ |

- Example: …

## Versioning and compatibility

- Versioning: …
- Breaking change process: …
- Deprecation process: …

## Change log

| Date | Change | Compatibility | Related spec / ADR |
| ---- | ------ | ------------- | ------------------ |
```

## Maintenance rules

1. An interface change updates: this directory + [interfaces.md](../architecture/interfaces.md) + the related spec + tests.
2. Breaking changes must be assessed for an ADR and stated in the PR's Breaking Changes section.
3. Only confirmed contracts; undecided fields stay `TBD`.
