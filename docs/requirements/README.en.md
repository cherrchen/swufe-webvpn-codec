# Requirements

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-20
>
> Chinese source of truth: [README.md](README.md)

**Purpose**: this directory is the source of truth for **requirement facts**.
Requirements state what must be achieved, why, and to what standard — **never how** (implementation lives in [architecture/](../architecture/README.md) and [specs/](../../specs/README.md)).

## Files

| File | Content | Granularity |
| ---- | ------- | ----------- |
| [product-requirements.md](product-requirements.md) | Product goals, users, value, priorities | project level |
| [functional-requirements.md](functional-requirements.md) | Functional requirement entries (REQ-xxx) | feature level |
| [non-functional-requirements.md](non-functional-requirements.md) | Performance, reliability, security, usability, maintainability constraints | project level |

## Requirement IDs

```text
REQ-001  functional requirement (functional-requirements.md)
NFR-001  non-functional requirement (non-functional-requirements.md)
```

- IDs are never reused and never renumbered;
- Removed requirements keep their entry with `Status: Removed`, a reason and a replacement;
- A feature spec's `Functional Requirements` section references these IDs (it may mint new `REQ-xxx`, but the canonical list must be synced back here).

## Status

```text
Proposed → Accepted → Implemented → Verified
                    ↘ Deprecated / Removed
```

## Change process

1. Update the requirement document;
2. Check affected feature-spec verification matrices ([verification.md](../../specs/_template/verification.md));
3. Check whether an ADR is triggered ([docs/architecture/adr/](../architecture/adr/README.md));
4. Explain it in the PR's Documentation Impact section.

## Not stored here

- Per-feature implementation plans and tasks → [specs/](../../specs/README.md)
- Field-level interface contracts → [docs/api/](../api/README.md)
- Temporary discussion and research → [.agents/notes/](../../.agents/notes/README.md)
