# Interfaces

> Status: TBD ｜ Owner: <OWNER> ｜ Last Reviewed: <DATE>
>
> Chinese source of truth: [interfaces.md](interfaces.md)

**Purpose**: define the **boundaries** between modules and with external systems: who provides, who consumes, what the contract is, how compatibility is preserved.
**Do not write**: field-level API definitions (→ [docs/api/](../api/README.md)), data entities (→ [data-model.md](data-model.md)).

---

## Interface list

| ID | Interface | Provider | Consumer | Type | Stability | Detail |
| -- | --------- | -------- | -------- | ---- | --------- | ------ |
| IF-001 | TBD | TBD | TBD | in-process / inter-process / network / file | Stable / Evolving / Internal | TBD |

## Boundary diagram

```mermaid
flowchart LR
    A["Consumer"] -->|"IF-001"| B["Provider"]
```

## Interface contract template

```markdown
### IF-001 <name>

- Provider: …
- Consumer: …
- Stability: Stable / Evolving / Internal (Stable means breaking changes require an ADR)
- Inputs: … (link to docs/api or the signature location)
- Outputs: …
- Error model: …
- Idempotency: …
- Versioning: …
- Compatibility promise: …
- Related spec / ADR: …
```

## Compatibility policy

| Interface | Allowed changes | Changes requiring an ADR | Deprecation process |
| --------- | --------------- | ------------------------ | ------------------- |
| IF-001 | backward-compatible additions | breaking changes | TBD |

## Contract tests

| Interface | Test location | Coverage |
| --------- | ------------- | -------- |
| IF-001 | TBD | TBD |
