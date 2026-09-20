# Notes (temporary context)

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-20
>
> Chinese source of truth: [README.md](README.md)

**Purpose**: hold **temporary context** such as agent session handoffs, debugging records, research and experiment results.

> **Core rule: notes are not a source of truth.**
> Never cite a note for architecture, requirements, API contracts or final decisions. Long-lived conclusions must be migrated to [docs/](../../docs/README.md), [specs/](../../specs/README.md) or an ADR.

---

## Naming

```text
.agents/notes/YYYY-MM-DD-<topic>.md
```

Multiple notes on one day may add a suffix: `YYYY-MM-DD-<topic>-2.md`.

## Allowed content

- Agent session handoff ([template](../../docs/agent/session-handoff.md));
- Debugging records and investigation leads;
- Research and option comparisons (not yet decided);
- Experiments and temporary design thinking;
- Temporary decisions with their rationale (marked `Open` / temporary).

## Forbidden content

| Not allowed | Reason |
| ----------- | ------ |
| Acting as an architecture source of truth | unreviewed and short-lived |
| Defining requirements | requirements live in [requirements/](../../docs/requirements/README.md) |
| Acting as an API contract | contracts live in [api/](../../docs/api/README.md) |
| Recording final decisions | decisions belong in an ADR or [docs/architecture/](../../docs/architecture/README.md) |
| Copying chat/reasoning transcripts as official docs | pollutes long-term memory |
| Secrets, tokens or real personal data | security risk |

## Migration rules

When a note yields a long-lived conclusion:

1. Write it into the correct Level A/B document (docs / specs / ADR);
2. Add the following at the top of the note:

   ```text
   > Migrated to: <path>
   > Migrated on: YYYY-MM-DD
   ```

3. Leave the note unchanged (never rewrite history); mark `Status: Superseded` when useful.

## Lifecycle

| Stage | Handling |
| ----- | -------- |
| Active | used by the current session |
| Migrated | destination recorded; kept for traceability |
| Obsolete | mark `Status: Obsolete` with a reason; do not delete unless it has no historical value |

## Checks

This directory is exempt from bilingual pairing and spec-structure checks, but its Markdown links are still verified by `npm run docs:links`.
