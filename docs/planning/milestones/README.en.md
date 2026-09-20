# Milestones

> Status: Draft ｜ Owner: <OWNER> ｜ Last Reviewed: <DATE>
>
> Chinese source of truth: [README.md](README.md)

**Purpose**: define what "reaching a milestone" means, so progress can be reviewed from outside.
**Do not write**: requirements, design or task breakdown (see [requirements/](../../requirements/README.md), [architecture/](../../architecture/README.md), `specs/<id>/tasks.md`).

## When to create a milestone

- several feature specs must ship together;
- a verifiable date or version must be committed to externally;
- a shared set of exit criteria is needed (e.g. verification passed + documents synced + no blocking defects).

## File naming

```text
docs/planning/milestones/<MILESTONE_ID>-<short-name>.md
```

Examples: `M1-<short-name>.md` or `<DATE>-<short-name>.md` — pick one convention per project and stay consistent.

> No milestone files exist yet. Create the first one once it is defined, and update [roadmap.md](../roadmap.md) at the same time.

## Milestone template

```markdown
# <milestone id>: <name>

> Status: Candidate | Planned | In Progress | Done | Dropped
> Owner: <OWNER>
> Target: <DATE>

## Goal

(the verifiable outcome this milestone delivers)

## Included specs

| Spec | Status | Dependencies |
| ---- | ------ | ------------ |

## Exit criteria

- [ ] every included spec is `Verified`
- [ ] affected documents are synced (including bilingual pairs)
- [ ] no blocking defects
- [ ] the relevant verification commands pass
- [ ] compatibility and security impact confirmed

## Risks

| Risk | Impact | Mitigation |
| ---- | ------ | ---------- |

## Completion record

(date, evidence, remaining issues)
```

## Rules

1. Exit criteria must be verifiable; avoid "mostly done";
2. A milestone defines no new requirements; a missing requirement needs a spec first;
3. When a milestone slips, record the reason — never silently rewrite the historical milestone definition.
