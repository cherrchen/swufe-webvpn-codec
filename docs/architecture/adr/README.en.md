# Architecture Decision Records (ADR)

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-20
>
> Chinese source of truth: [README.md](README.md)

**Purpose**: record **why** the system is designed this way. Requirements say what, architecture says what exists, an ADR says why that option was chosen, what was rejected and what it costs.
This directory is the source of truth for technical decisions.

## When an ADR is mandatory

Any one of these triggers an ADR:

- the core technology stack changes;
- a public interface changes;
- the data model changes materially;
- the security model changes;
- cross-module architecture changes;
- significant infrastructure is introduced;
- a decision would be hard to reverse later.

Do **not** write ADRs for routine small implementations, local refactors or internal naming changes.

## Naming and numbering

```text
docs/architecture/adr/ADR-0001-<short-slug>.md
```

- Numbers increase in steps of one and are never reused;
- `ADR-XXXX` is a stable identifier: titles may be refined, numbers may not;
- Template: [template.md](template.md) (the template is not a decision and takes no number).

## Status

| Status | Meaning |
| ------ | ------- |
| Proposed | raised, not yet decided |
| Accepted | adopted and currently in force |
| Superseded | replaced by a newer ADR, which must be linked |
| Deprecated | still present but no longer recommended |
| Rejected | considered and not adopted; the reason is kept |

## Index

| ADR | Title | Status | Date | Supersedes |
| --- | ----- | ------ | ---- | ---------- |
| [ADR-0001](ADR-0001-wrd-rewrite-in-mitm-layer.en.md) | Do not implement WRD rewriting inside the sing-box / mihomo kernel | Accepted | 2026-09-20 | — |
| [ADR-0002](ADR-0002-reuse-mitmproxy-for-tls.en.md) | Reuse mitmproxy instead of building a custom TLS / MITM stack | Accepted | 2026-09-20 | — |
| [ADR-0003](ADR-0003-electron-gui-for-phase-1.en.md) | Use Electron for Phase 1 instead of a CLI-only tool | Accepted | 2026-09-20 | — |
| [ADR-0004](ADR-0004-refuse-start-when-system-proxy-in-use.en.md) | Refuse to start when the system proxy is already in use | Accepted | 2026-09-20 | — |
| [ADR-0005](ADR-0005-builtin-wrd-key-with-override.en.md) | Ship a built-in default WRD key with a configuration override | Accepted | 2026-09-20 | — |
| [ADR-0006](ADR-0006-local-capture-mode-and-mutual-exclusion.en.md) | Process capture via mitmproxy local mode, mutually exclusive with the system proxy | Accepted | 2026-09-21 | — |
| [ADR-0007](ADR-0007-gateway-owned-namespaces-and-native-mode-promotion.en.md) | Pass gateway-owned namespaces straight through, and promote bootstrap documents to the gateway's native URL space | Accepted | 2026-09-21 | — |
| [ADR-0008](ADR-0008-ca-trust-authorization-in-app-session.en.md) | The app process writes CA trust settings (keychain writes keep the elevation) | Accepted | 2026-09-21 | — |

## Rules

1. Once `Accepted`, an ADR is not rewritten; a semantic change creates a new ADR that supersedes the old one.
2. Only one ADR may claim to be current for a given decision topic; superseded ones must point to the successor.
3. ADRs must stay consistent with [overview.md](../overview.md), [components.md](../components.md) and [interfaces.md](../interfaces.md); on conflict, update the ADR status first.
4. ADRs do not contain implementation detail or task breakdown (→ [specs/](../../../specs/README.md)).
5. Language: the primary ADR text is Chinese; an English `ADR-XXXX-<slug>.en.md` may be added when needed.

## Not stored here

- Feature-level technical design → `specs/<id>-<name>/design.md`
- Temporary technical research → [.agents/notes/](../../../.agents/notes/README.md)
