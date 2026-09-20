# Functional Requirements

> Status: TBD ｜ Owner: <OWNER> ｜ Last Reviewed: <DATE>
>
> Chinese source of truth: [functional-requirements.md](functional-requirements.md)

**Purpose**: the complete, verifiable list of functional requirements and their source of truth.
**Do not write**: implementation approach, component design, interface field definitions (→ [architecture/](../architecture/README.md), [api/](../api/README.md)).

---

## Requirement template

Copy this block when adding a requirement; IDs increase monotonically and are never reused.

```markdown
### REQ-001 <name>

- Status: Proposed
- Priority: Must
- Related: G-001 / <LINK>
- Source: <OWNER> / <LINK>

**Description**
The system shall …

**Rationale**
…

**Acceptance criteria**
1. When …, the system shall …
2. When …, the system shall …

**Boundaries and exceptions**
- …

**Related spec**
- specs/<id>-<name>/
```

## Requirement list

| ID | Name | Priority | Status | Related spec |
| -- | ---- | -------- | ------ | ------------ |
| REQ-001 | TBD | Must | Proposed | TBD |

(Expand full entries inline using the template above.)

## Requirement → verification mapping

Per-requirement verification lives in each feature spec's [verification.md](../../specs/_template/verification.md); this file keeps the overview only:

| REQ | Verification method | Status |
| --- | ------------------- | ------ |
| REQ-001 | TBD | Pending |
