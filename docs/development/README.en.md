# Development

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-20
>
> Chinese source of truth: [README.md](README.md)

**Purpose**: this directory holds **development practice guidance** (Level B): workflow, coding conventions, testing strategy, documentation rules, dependency policy.
It constrains *how* work is done, not *what* is required (→ [requirements/](../requirements/README.md)) or *what exists* (→ [architecture/](../architecture/README.md)).

## Files

| File | Question it answers | When it is mandatory reading |
| ---- | ------------------- | ---------------------------- |
| [development-workflow.md](development-workflow.md) | Which steps a change goes through | before starting any work |
| [coding-conventions.md](coding-conventions.md) | How code is organised and named | before writing code |
| [testing-strategy.md](testing-strategy.md) | Test layers, coverage expectations, how to run them | before writing tests |
| [documentation-rules.md](documentation-rules.md) | Document levels, language, sync and anti-pollution rules | before changing docs or behaviour |
| [dependency-policy.md](dependency-policy.md) | When a dependency may be added | before adding a dependency |

## Conflict precedence

```text
more specific rule  >  more general rule
accepted project ADR  >  general advice in this directory
requirements and non-functional constraints  >  convenience preferences
```

When rules conflict, **do not pick one yourself**: record the conflict in the PR, ask for a decision, then update this directory so that only one conclusion remains.

## Related entry points

- Agent-specific rules: [AGENTS.md](../../AGENTS.md), [docs/agent/](../agent/README.md)
- Contribution summary: [CONTRIBUTING.md](../../CONTRIBUTING.md)
- Verification and definition of done: [docs/verification/](../verification/README.md)
