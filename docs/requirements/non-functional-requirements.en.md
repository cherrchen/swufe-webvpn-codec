# Non-functional Requirements

> Status: TBD ｜ Owner: <OWNER> ｜ Last Reviewed: <DATE>
>
> Chinese source of truth: [non-functional-requirements.md](non-functional-requirements.md)

**Purpose**: define quality attributes and constraints. Non-functional requirements need verifiable criteria, otherwise they are slogans.
**Do not write**: implementation mechanisms (e.g. "use Redis" is design, and belongs in a spec or ADR).

---

## Template

```markdown
### NFR-001 <name>

- Category: performance | reliability | security | usability | maintainability | portability | observability | compliance
- Status: Proposed
- Priority: Must

**Requirement**
…

**Verification**
… (measurement method, threshold, environment)

**Consequence of missing the target**
…
```

## List

| ID | Category | Summary | Verification | Status |
| -- | -------- | ------- | ------------ | ------ |
| NFR-001 | TBD | TBD | TBD | Proposed |

## Category prompts

| Category | What must be made explicit |
| -------- | -------------------------- |
| performance | latency, throughput, concurrency, data volume, measurement environment |
| reliability | availability target, failure recovery, idempotency, data consistency |
| security | trust boundaries, authentication, authorisation, input validation, secret management (→ [security/](../security/README.md)) |
| usability | learnability, error messaging, accessibility |
| maintainability | modularity, testability, documentation obligations |
| portability | supported platforms, runtime versions, dependency constraints (→ [dependency-policy.md](../development/dependency-policy.md)) |
| observability | logging, metrics, tracing requirements |
| compliance | regulation, licensing, data retention |

## Relationship to ADRs

If a non-functional requirement forces a hard-to-reverse technical choice, add an ADR and reference it from this entry's `Related` field.
