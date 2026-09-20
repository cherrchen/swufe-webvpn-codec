# Glossary

> Status: TBD ｜ Owner: <OWNER> ｜ Last Reviewed: <DATE>
>
> Chinese source of truth: [glossary.md](glossary.md)

**Purpose**: keep terminology consistent so humans and agents mean the same thing by the same word.
**Single source**: this file is the source of truth for term definitions; other documents reference terms instead of redefining them.

**How to fill it in**:

- Only project-specific, ambiguous, or non-standard terms;
- Each entry: term (zh/en), definition, aliases, what it must not be confused with, origin;
- Do not list generic programming vocabulary.

---

## Terms

| Term | English | Definition | Aliases / not to be confused with | Origin |
| ---- | ------- | ---------- | --------------------------------- | ------ |
| TBD | TBD | TBD | TBD | TBD |

## Status vocabulary

The following status values are used across specs and documents and have fixed meaning:

| Status | Applies to | Meaning |
| ------ | ---------- | ------- |
| Draft | spec / document | not yet reviewed |
| Approved | spec | confirmed as implementable |
| In Progress | spec | being implemented |
| Implemented | spec | code complete, unverified |
| Verified | spec | verification matrix passed |
| Archived | spec / document | historical, no longer current fact |
| Proposed / Accepted / Superseded / Deprecated / Rejected | ADR | decision record status |

## Adding a term

1. Add a row to the table;
2. Link to this file from the document that first uses the term;
3. If the change alters meaning, check whether [requirements/](../requirements/README.md) and [architecture/](../architecture/README.md) need updates.
