# Testing Strategy

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-20
>
> Chinese source of truth: [testing-strategy.md](testing-strategy.md)

**Purpose**: define test layers, coverage expectations and how to run tests; one of the inputs to "what counts as verified".
**Single source**: the testing strategy lives here. Per-feature verification entries are registered in `specs/<id>/verification.md`; do not copy concrete cases into this file. The layers follow the L0–L3 wording of the source test plan.

---

## 1. Test layers

| Layer | Goal | Scope | Cost | When it is mandatory | Where it runs |
| ----- | ---- | ----- | ---- | -------------------- | ------------- |
| L0 unit | behaviour and boundaries of WRD codec vectors and the allowlist matching function | no external deps | low | every PR (regression baseline) | CI |
| L1 component | request/response rewriting behaviour of the bridge addon against recorded traffic or a fake upstream | addon + fake upstream | medium | rewriting logic, cookie injection or routing changes | local |
| L2 integration | end-to-end rewriting chain: `mitmdump` + curl through the local proxy against a fake WebVPN | sidecar + fake upstream + real proxy flow | medium | proxy set/clear, configuration delivery, rewriting chain changes | local |
| L3 system | the full user path on real hardware: real WebVPN + browser acceptance of the registrar site | whole app (Electron + sidecar) | high | before a release; requires the tester's own account | manual (macOS / Windows test machines) |
| Manual | scenarios that cannot be automated (CA install/uninstall, system proxy, permission prompts, UI states) | — | — | UI, environment or external systems | manual |

**Regression policy**: L0 runs on every PR; L1/L2 run locally when the relevant module changes; L3 runs before a release. The case set (TC-A01..TC-H02) and priorities live in the phase 1 spec's `verification.md`; the release gate is section 6 of [docs/verification/verification-strategy.md](../verification/verification-strategy.md).

## 2. Coverage expectations

```text
Coverage target: TBD (implementation not started; no numeric target set yet)
Coverage tool:   TBD (implementation not started; tooling not chosen yet)
Exceptions:      the L3 and manual layers are excluded from coverage and
                 replaced by manual steps
```

Coverage is a reference metric, not the goal. **Must be covered**:

- WRD codec vectors (TC-A01..TC-A05: authserver and jwxt samples, port-carrying URLs, wrong key);
- allowlist exact match / wildcard / apex boundaries (TC-B01..TC-B05);
- proxy conflict and system proxy clearing (TC-C01..TC-C04);
- stopping the bridge, clearing the proxy and stopping capture on session expiry (TC-D03);
- loop prevention: login traffic is never re-wrapped by WRD (TC-D04);
- the critical redirects of response reverse rewriting (`Location` and in-registrar navigation, TC-F03 / TC-G02).

Requirement acceptance criteria, reproductions of fixed bugs, and boundaries and error paths must also be covered.

## 3. Naming and organisation

```text
Location:  TBD (implementation not started; set by the first implementation
           task of specs/001-phase1-local-bridge)
Naming:    TBD (as above)
Structure: TBD (as above; prefer arrange / act / assert)
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
Run all:        TBD (implementation not started)
Run one file:   TBD (implementation not started)
Run with watch: TBD (implementation not started)
CI test job:    none. The current CI only runs documentation checks
                (npm run docs:check), see .github/workflows/docs-check.yml;
                that workflow does not build or run any code tests and will be
                extended once implementation starts
```

Documentation-check workflow: [docs-check.yml](../../.github/workflows/docs-check.yml) (runs `npm run docs:check` and `npm run typecheck` on pull requests and pushes to `main`).

## 6. Test data and environments

| Item | Convention |
| ---- | ---------- |
| Test data | Real data is limited to "the tester's own SWUFE account" and **must never be committed**; everything else uses constructed sample URLs and configurations |
| External dependencies | L0 has none; L1/L2 use a fake WebVPN upstream (recorded traffic or a stub); L3 uses the real `webvpn.swufe.edu.cn` (authorised devices only) |
| Environment isolation | L3 needs exclusive use of the system proxy (the app refuses to start when a system proxy is already in use); the same test machine must not run Clash / mihomo / sing-box at the same time |
| Sensitivity | Logs and test output must not contain session cookies or response bodies; never commit real cookies, accounts or personal data |

## 7. Relationship to verification

Passing tests is not the same as a finished feature. See [docs/verification/verification-strategy.md](../verification/verification-strategy.md) for the definition of done, and `specs/<id>/verification.md` for the per-requirement mapping.
