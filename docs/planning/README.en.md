# Planning

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-20
>
> Chinese source of truth: [README.md](README.md)

**Purpose**: record long-term plans and milestones: what comes first, and when a marker counts as reached.
**Do not write**: the goals themselves (→ [goals-and-non-goals.md](../overview/goals-and-non-goals.md)), requirement content (→ [requirements/](../requirements/README.md)), per-feature plans (→ `specs/<id>/plan.md`).

## Files

| File | Content |
| ---- | ------- |
| [roadmap.md](roadmap.md) | Phased direction and the spec index |
| [milestones/](milestones/README.md) | Concrete milestone definitions and exit criteria |

## Rules

1. The roadmap defines no requirements; requirements live only in [requirements/](../requirements/README.md). The roadmap references requirement IDs.
2. No unconfirmed feature commitments in the roadmap; unconfirmed items are `TBD` or `Candidate`.
3. Detailed breakdown of a feature belongs in `specs/<id>/plan.md`; the roadmap keeps a one-line index entry.
4. Plan changes do not need an ADR; dropping a previously committed direction must record the reason in the related spec or the roadmap.

## Status vocabulary

| Status | Meaning |
| ------ | ------- |
| Candidate | candidate, unconfirmed |
| Planned | scheduled, not started |
| In Progress | underway |
| Done | complete and verified |
| Dropped | abandoned (reason required) |
