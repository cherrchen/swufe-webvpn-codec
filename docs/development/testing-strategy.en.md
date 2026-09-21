# Testing Strategy

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-21
>
> Chinese source of truth: [testing-strategy.md](testing-strategy.md)

**Purpose**: define test layers, coverage expectations and how to run tests; one of the inputs to "what counts as verified".
**Single source**: the testing strategy lives here. Per-feature verification entries are registered in `specs/<id>/verification.md`; do not copy concrete cases into this file. The layers follow the L0–L3 wording of the source test plan.

---

## 1. Test layers

| Layer | Goal | Scope | Cost | When it is mandatory | Where it runs |
| ----- | ---- | ----- | ---- | -------------------- | ------------- |
| L0 unit | behaviour and boundaries of WRD codec vectors and the allowlist matching function | no external deps | low | every PR (regression baseline) | CI |
| App unit | Electron-side modules: bridge state machine, proxy/certificate/process output parsers, sidecar control-line parsing, session-probe classification, config store, Proxy Orchestrator orchestration (platform and process dependencies injected as fakes) | no Electron runtime dependency (`app/test` is entirely electron-free) | low | every PR (same batch as L0) | CI |
| L1 component | request/response rewriting behaviour of the bridge addon against recorded traffic or a fake upstream | addon + fake upstream | medium | rewriting logic, cookie injection or routing changes | local |
| L2 integration | end-to-end rewriting chain: `mitmdump` + curl through the local proxy against a fake WebVPN | sidecar + fake upstream + real proxy flow | medium | proxy set/clear, configuration delivery, rewriting chain changes | local |
| L3 system | the full user path on real hardware: real WebVPN + browser acceptance of the registrar site | whole app (Electron + sidecar) | high | before a release; requires the tester's own account | manual (macOS / Windows test machines) |
| Manual | scenarios that cannot be automated (CA install/uninstall, system proxy, permission prompts, UI states) | — | — | UI, environment or external systems | manual |

**Regression policy**: L0 runs on every PR; L1/L2 run locally when the relevant module changes; L3 runs before a release. The case set (TC-A01..TC-H02) and priorities live in the phase 1 spec's `verification.md`; the release gate is section 6 of [docs/verification/verification-strategy.md](../verification/verification-strategy.md).

## 2. Coverage expectations

```text
Coverage target: TBD (no numeric target; the current baseline is 190 green L0/L1/L2 cases plus 70 app unit cases)
Coverage tool:   TBD (not adopted in M1; the layers and cases are the current regression evidence)
Exceptions:      the L3 and manual layers are excluded from coverage and
                 replaced by manual steps
```

Coverage is a reference metric, not the goal. **Must be covered**:

- WRD codec vectors (TC-A01..TC-A05: authserver and jwxt samples, port-carrying URLs, wrong key);
- allowlist exact match / wildcard / apex boundaries (TC-B01..TC-B05);
- proxy conflict and system proxy clearing (TC-C01..TC-C04);
- stopping the bridge, clearing the proxy and stopping capture on session expiry (TC-D03);
- loop prevention: login traffic is never re-wrapped by WRD (TC-D04);
- the critical redirects of response reverse rewriting (`Location` and in-registrar navigation, TC-F03 / TC-G02);
- process capture (REQ-003): mode-set derivation, rollback on failure and the no-retry semantics of `swufe_bridge.capture` in L0 unit tests (`tests/l0/test_capture.py`), and the addon's capture loop in an L1 test with injected fakes (`tests/l1/test_addon_capture.py` — automated tests **must never** really enable local mode); the real scope and "switching back to the system proxy stops it" belong to L3 manual verification (the tester has to confirm the OS authorisation prompt in person).

Requirement acceptance criteria, reproductions of fixed bugs, and boundaries and error paths must also be covered.

## 3. Naming and organisation

```text
Location:  tests/l0 (unit: codec, allowlist, config), tests/l1 (component: addon request/response
           rewriting, logging, hot reload), tests/l2 (integration: real mitmdump + curl + fake upstream);
           shared fixtures: tests/conftest.py (config factory, no mitmproxy import) and
           tests/l1/conftest.py (flow / addon factories);
           app/test (app unit: `*.test.ts` + `helpers/fakes.ts`, Node's built-in test runner + tsx;
           `fixtures/` holds the fake upstream and the verification entry, which are not part of the CI unit run)
Naming:    files test_<topic>.py; functions test_<behaviour> (the case id goes into the function name,
           e.g. test_tc_f01_allowlisted_request_is_rewritten_end_to_end);
           parameterisation uses @pytest.mark.parametrize("input, expected", [...]);
           on the app side files are <topic>.test.ts and case names are full sentences describing observable behaviour
Structure: Arrange / Act / Assert (split with comments when useful)
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
Run all:        uv sync && uv run pytest (L0+L1+L2; no internet access needed)
Run one file:   uv run pytest tests/l1/test_addon_request.py
Run with watch: uv run pytest -f (requires the pytest-xdist plugin; not adopted this phase — when it is
                not installed, re-run uv run pytest manually)
App unit:       npm --prefix app run test:unit (run `npm --prefix app install` first)
App typecheck:  npm --prefix app run typecheck
CI test job:    L0: .github/workflows/python-tests.yml (runs uv sync --frozen + uv run pytest tests/l0 -q
                on pull_request and pushes to main);
                App unit and types: .github/workflows/app-tests.yml (npm ci --prefix app + typecheck + test:unit,
                needs neither the Electron binary nor a display);
                L1/L2 need mitmdump, curl and local ports, so they run locally only;
                documentation checks are handled separately by .github/workflows/docs-check.yml
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
