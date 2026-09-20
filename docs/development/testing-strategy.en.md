# Testing Strategy

> Status: Draft ｜ Owner: <OWNER> ｜ Last Reviewed: <DATE>
>
> Chinese source of truth: [testing-strategy.md](testing-strategy.md)

**Purpose**: define test layers, coverage expectations and how to run tests; one of the inputs to "what counts as verified".
**Single source**: the testing strategy lives here. Per-feature verification entries are registered in `specs/<id>/verification.md`; do not copy concrete cases into this file.

---

## 1. Test layers

| Layer | Goal | Scope | Cost | When it is mandatory |
| ----- | ---- | ----- | ---- | -------------------- |
| Unit | behaviour and boundaries of one function/module | no external deps | low | branches, boundaries, error paths |
| Integration | module collaboration, interface contracts | multiple modules | medium | cross-module behaviour, data flow, contract changes |
| End-to-end | user-visible flows | whole system | high | critical paths when affordable |
| Manual | scenarios that cannot be automated | — | — | UI, environment, external systems |

> Explain unused layers under `TBD` below instead of deleting this table.

## 2. Coverage expectations

```text
Coverage target: TBD
Coverage tool:   TBD
Exceptions:      TBD
```

Coverage is a reference metric, not the goal. **Must be covered**: requirement acceptance criteria, reproductions of fixed bugs, boundaries and error paths, idempotency and concurrency-sensitive logic where applicable.

## 3. Naming and organisation

```text
Location:  TBD
Naming:    TBD
Structure: TBD   (arrange / act / assert or project convention)
```

## 4. When tests are required

| Change type | Requirement |
| ----------- | ----------- |
| New behaviour | reproducible verification (automated, or explicit manual steps) |
| Bug fix | reproduction first (failing test or minimal steps); confirm it no longer triggers |
| Refactor | behaviour-preserving refactors rely on existing tests; add coverage for critical paths if missing |
| Documentation only | no tests needed |

## 5. How to run

```text
Run all:        TBD
Run one file:   TBD
Run with watch: TBD
CI test job:    TBD   (state explicitly if CI only runs documentation checks)
```

## 6. Test data and environments

| Item | Convention |
| ---- | ---------- |
| Test data | TBD (real user data is forbidden) |
| External dependencies | TBD (stub / sandbox / contract tests) |
| Environment isolation | TBD |
| Sensitivity | no real secrets, tokens or personal data in tests |

## 7. Relationship to verification

Passing tests is not the same as a finished feature. See [docs/verification/verification-strategy.md](../verification/verification-strategy.md) for the definition of done, and `specs/<id>/verification.md` for the per-requirement mapping.
