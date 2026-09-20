# Coding Conventions

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-20
>
> Chinese source of truth: [coding-conventions.md](coding-conventions.md)

**Purpose**: align code organisation, naming and readability so that output from different authors (including coding agents) looks consistent.
**Do not write**: formatter configuration (that is repository config), architectural layering (→ [architecture/](../architecture/README.md)).

> This project's implementation languages come from the technical selection (see [architecture/overview.md](../architecture/overview.md));
> details that are not settled stay `TBD` — **do not** invent language-specific rules.

---

## 1. Language and versions

```text
Primary language:  Python 3 (bridge sidecar / authoritative WRD codec; the Electron app is TypeScript)
Language version:  TBD (implementation has not started)
Package manager:   npm on the Node side (package-lock.json is committed); Python side TBD (implementation has not started)
Formatter:         TBD (implementation has not started)
Linter:            TBD (implementation has not started)
```

## 2. Directory and module organisation

| Rule | Description |
| ---- | ----------- |
| TBD | This repository is currently a documentation repository (`docs/` + `specs/`); the implementation directory structure is decided by the first implementation task in `specs/001-phase1-local-bridge/` |

## 3. Naming

| Object | Convention |
| ------ | ---------- |
| Files | TBD (implementation has not started) |
| Types | TBD (implementation has not started) |
| Functions | TBD (implementation has not started) |
| Variables | TBD (implementation has not started) |
| Constants | TBD (implementation has not started) |

Every entry above is `TBD`: implementation has not started and is filled in by the first implementation task. Constraints already settled across modules:

- IPC / interface type and field naming has a single source of truth: [api/electron-ipc.md](../api/electron-ipc.md);
- Error codes must use the six established ones — `PROXY_CONFLICT`, `CA_MISSING`, `NOT_LOGGED_IN`, `SESSION_EXPIRED`, `BRIDGE_CRASH`, `ALLOWLIST_EMPTY` — and no synonymous codes may be invented.

## 4. Style essentials

- Follow existing repository patterns; two equivalent conventions side by side are **not allowed** (see the precedence rules in [README.md](README.md)).
- Avoid unreadable abbreviations; avoid abstractions used once.
- Comments explain *why*, never restate *what*.
- Public APIs must carry doc comments (format: `TBD`, implementation has not started; public interface contracts live in [docs/api/](../api/README.md), and code comments must point at the matching interface surface).

## 5. Error handling

| Scenario | Requirement |
| -------- | ----------- |
| Input validation | allowlist host names must be valid hostnames and lower-cased (see the matching algorithm in [architecture/data-model.md](../architecture/data-model.md)) |
| Recoverable error | return an error code to the UI; do not stop the bridge process |
| Unrecoverable error | `BRIDGE_CRASH`: log it and let the user restart the bridge |
| Never swallow errors | silent `catch`/ignored return codes are forbidden unless a comment states the reason |

## 6. Dependencies and imports

- Dependency direction must match [architecture/components.md](../architecture/components.md);
- No circular dependencies;
- Read [dependency-policy.md](dependency-policy.md) before adding a dependency;
- A second equivalent solution is forbidden (see [dependency-policy.md](dependency-policy.md)).

## 7. Change discipline

- No refactors unrelated to the task;
- Do not delete code of unknown purpose;
- Changing public behaviour requires syncing tests and documentation;
- "While I'm here" improvements are scope creep and need their own task.

## 8. Local check commands

```text
Format:  TBD (implementation has not started)
Lint:    TBD (implementation has not started)
Type:    TBD (implementation has not started)
Test:    TBD (implementation has not started)
Docs:    npm run docs:check
```

> `Docs` is the documentation check; CI currently runs documentation checks only (see [.github/workflows/docs-check.yml](../../.github/workflows/docs-check.yml)).
