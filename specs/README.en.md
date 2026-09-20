# Feature Specs

> Status: Draft ｜ Owner: <OWNER> ｜ Last Reviewed: <DATE>
>
> Chinese source of truth: [README.md](README.md)

**Purpose**: this directory is **Layer 3 — Feature Specs**: the complete record of a feature from requirement to implementation and verification.
Spec-driven development turns `Prompt → Code` into
`Idea → Requirement → Spec → Design → Plan → Tasks → Implementation → Verification → Documentation Update → Archive`.

## Directory naming

```text
specs/<id>-<feature-name>/
specs/001-user-authentication/     ← the shape, not a feature of this project
```

- `<id>` increments in steps of one (`001`, `002`, …) and is never reused;
- `<feature-name>` is lower-case with hyphens;
- the template directory `specs/_template/` is excluded from checks and takes no number.

## Required files

| File | Question it answers |
| ---- | ------------------- |
| [spec.md](_template/spec.md) | what/why: requirements, goals, non-goals, acceptance criteria |
| [design.md](_template/design.md) | how: technical approach, impact, risks |
| [plan.md](_template/plan.md) | implementation strategy, phases, rollback, documentation plan |
| [tasks.md](_template/tasks.md) | atomic, individually executable tasks |
| [verification.md](_template/verification.md) | requirement → verification mapping and evidence |

## Optional extension files

Create only when needed — **not every feature needs them**:

| File | When |
| ---- | ---- |
| `research.md` | external options must be researched or compared |
| `data-model.md` | entities or invariants change |
| `api.md` | interface contracts change |
| `ui-ux.md` | screens and interaction change |
| `migration.md` | data or configuration migration is involved |

## Status flow

```text
Draft → Approved → In Progress → Implemented → Verified → Archived
```

Entry conditions: [verification-strategy.md](../docs/verification/verification-strategy.md).

## Creating a new spec

1. Copy `specs/_template/` to `specs/<id>-<feature-name>/`;
2. Fill in `spec.md` (missing information goes to `Open Questions`, never invented);
3. Once reviewed, move through `design.md` → `plan.md` → `tasks.md`;
4. Register a row in [roadmap.md](../docs/planning/roadmap.md);
5. Interfaces → [api/](../docs/api/README.md); data model → [data-model.md](../docs/architecture/data-model.md); hard-to-reverse decisions → ADR;
6. When done, update `verification.md` and sync the long-lived documents.

## Rules

- `specs/` holds **current and historical features**, never long-lived facts (those live in [docs/](../docs/README.md));
- When a spec changes a long-lived fact, sync it back to `docs/` or an ADR;
- A spec records one delivery; it does not redefine long-lived facts;
- Finished specs are kept (never deleted) with status `Archived`;
- Language: specs are implementation records and default to Chinese; `*.en.md` may be added (pairing is not enforced — see [documentation-rules.md](../docs/development/documentation-rules.md)).

## Checks

```bash
npm run spec:check   # structure + required sections
```
