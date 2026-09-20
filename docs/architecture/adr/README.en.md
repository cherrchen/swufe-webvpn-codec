# Architecture Decision Records (ADR)

> Status: Draft ｜ Owner: <OWNER> ｜ Last Reviewed: <DATE>
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

> No ADRs exist yet. Add a row here when the first one is created.

| ADR | Title | Status | Date | Supersedes |
| --- | ----- | ------ | ---- | ---------- |
| — | — | — | — | — |

## Rules

1. Once `Accepted`, an ADR is not rewritten; a semantic change creates a new ADR that supersedes the old one.
2. Only one ADR may claim to be current for a given decision topic; superseded ones must point to the successor.
3. ADRs must stay consistent with [overview.md](../overview.md), [components.md](../components.md) and [interfaces.md](../interfaces.md); on conflict, update the ADR status first.
4. ADRs do not contain implementation detail or task breakdown (→ [specs/](../../../specs/README.md)).
5. Language: the primary ADR text is Chinese; an English `ADR-XXXX-<slug>.en.md` may be added when needed.

## Not stored here

- Feature-level technical design → `specs/<id>-<name>/design.md`
- Temporary technical research → [.agents/notes/](../../../.agents/notes/README.md)
