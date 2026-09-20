# Architecture

> Status: Draft ｜ Owner: <OWNER> ｜ Last Reviewed: <DATE>
>
> Chinese source of truth: [README.md](README.md)

**Purpose**: this directory is the source of truth for **structure and technical facts**: what the system is made of, how parts collaborate, how data flows, where interface boundaries are, and why decisions were made.
**Do not write**: requirements (→ [requirements/](../requirements/README.md)), per-feature implementation plans (→ [specs/](../../specs/README.md)), temporary research (→ [.agents/notes/](../../.agents/notes/README.md)).

## Files

| File | Question it answers |
| ---- | ------------------- |
| [overview.md](overview.md) | Overall shape, boundaries and key constraints |
| [components.md](components.md) | Which components exist, their responsibilities and dependencies |
| [data-flow.md](data-flow.md) | Where data comes from, what it passes through, where it goes |
| [data-model.md](data-model.md) | Core entities, relationships, invariants |
| [interfaces.md](interfaces.md) | Interface boundaries between modules/services |
| [adr/](adr/README.md) | Key technical decisions and their consequences |

## Maintenance rules

- Architecture documents reflect **confirmed** design only; unconfirmed options live in the related feature spec's `design.md` or `Alternatives Considered`.
- Every diagram needs prose around it; diagrams are supporting material (Mermaid rules in [documentation-rules.md](../development/documentation-rules.md)).
- Architecture changes must be checked against the ADR triggers ([adr/README.md](adr/README.md)).
- Do not restate requirements here; link to them.

## When to update

| Trigger | Update |
| ------- | ------ |
| Component added/removed | [components.md](components.md), and [overview.md](overview.md) when relevant |
| Data flow changes | [data-flow.md](data-flow.md) |
| Entities or invariants change | [data-model.md](data-model.md) |
| Module interface changes | [interfaces.md](interfaces.md), [docs/api/](../api/README.md) |
| Hard-to-reverse technical choice | new ADR |
