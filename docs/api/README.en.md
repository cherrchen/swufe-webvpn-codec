# API Documentation

> Status: Draft ｜ Owner: <OWNER> ｜ Last Reviewed: <DATE>
>
> Chinese source of truth: [README.md](README.md)

**Purpose**: this directory is the source of truth for **interface contracts**: fields, errors, versions, compatibility promises.
Boundaries and stability policy: [architecture/interfaces.md](../architecture/interfaces.md). Data entities: [architecture/data-model.md](../architecture/data-model.md).

## When to create files

| Situation | File |
| --------- | ---- |
| Network interface exists (public or internal) | `docs/api/<surface>.md` (name by service or resource) |
| Only a library-level public API exists | `docs/api/library-api.md` |
| No interfaces yet | keep this README only |

> This template defines no interfaces. Do not create empty interface documents just to look complete.

## Interface document template

```markdown
# <surface name>

> Status: Draft ｜ Owner: <OWNER> ｜ Last Reviewed: <DATE>

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
