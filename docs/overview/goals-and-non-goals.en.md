# Goals and Non-goals

> Status: TBD ｜ Owner: <OWNER> ｜ Last Reviewed: <DATE>
>
> Chinese source of truth: [goals-and-non-goals.md](goals-and-non-goals.md)

**Purpose**: state what the project will and will not do, to resist scope creep.
Before implementing anything, an agent should be able to decide from this file whether the work is in scope.

**How to fill it in**:

- Goals must be decidable (verifiable end conditions), not slogans.
- Non-goals must be specific enough for an agent to refuse implementing them.
- Do not describe implementation approaches (→ [architecture/](../architecture/README.md)).

---

## Goals

| ID | Goal | Success criterion | Status |
| -- | ---- | ----------------- | ------ |
| G-001 | TBD | TBD | Open |

## Non-goals

> A non-goal is not "maybe later"; it is "explicitly not now, and an agent must not add it on its own".

| ID | Non-goal | Reason | Escalation path if needed |
| -- | -------- | ------ | ------------------------- |
| NG-001 | TBD | TBD | New feature spec / new ADR / explicit authorisation |

## Relationship to the roadmap

Goals are defined here; timing and ordering live in [planning/roadmap.md](../planning/roadmap.md) and are not duplicated here.

## Change process

Changing goals or non-goals is a requirement change:

1. Update this file;
2. Update affected requirement entries in [requirements/](../requirements/README.md);
3. Assess whether an ADR is needed if the architectural direction changes;
4. Explain it in the PR's Documentation Impact section.
