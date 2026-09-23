# Feature Specs

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-20
>
> Chinese source of truth: [README.md](README.md)

**Purpose**: this directory is **Layer 3 — Feature Specs**: the complete record of a feature from requirement to implementation and verification.
Spec-driven development turns `Prompt → Code` into
`Idea → Requirement → Spec → Design → Plan → Tasks → Implementation → Verification → Documentation Update → Archive`.

## Directory naming

```text
specs/<id>-<feature-name>/
specs/001-phase1-local-bridge/     ← the first spec of this project (phase 1 local bridge and academic-system browser acceptance)
```

- `<id>` increments in steps of one (`001`, `002`, …) and is never reused;
- `<feature-name>` is lower-case with hyphens;
- the template directory `specs/_template/` is excluded from checks and takes no number.

## Spec index

| Spec | Title | Related REQs | Status | Link |
| ---- | ----- | ------------ | ------ | ---- |
| 001-phase1-local-bridge | phase 1 local bridge and academic-system browser acceptance | REQ-001..REQ-011, NFR-001..NFR-007 | Implemented (macOS and Windows real-machine acceptance passes; `KI-014` is accepted, while `KI-019` needs diagnosis) | [spec.md](001-phase1-local-bridge/spec.md) |
| 002-desktop-ui-multiwindow | desktop UI rework (React + Ant Design, multiple windows) | REQ-001 / REQ-003 / REQ-005 / REQ-009 / REQ-012, NFR-003 / NFR-005 / NFR-007 | Implemented (2026-09-23: implementation and machine-executable acceptance are complete; Windows UI criteria and macOS process-capture authorization checks remain, see verification.md) | [spec.md](002-desktop-ui-multiwindow/spec.md) |

> Register one row per spec here, and mirror it in [roadmap.md](../docs/planning/roadmap.md); long-lived facts never live in a spec.

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
pnpm run spec:check   # structure + required sections
```
