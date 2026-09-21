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
| App unit | Electron-side modules: bridge state machine, proxy/certificate/process output parsers, sidecar control-line parsing, session-probe classification, config store, Proxy Orchestrator orchestration (platform and process dependencies injected as fakes) | no Electron runtime dependency (`apps/desktop/test` is entirely electron-free) | low | every PR (same batch as L0) | CI |
| L1 component | request/response rewriting behaviour of the bridge addon against recorded traffic or a fake upstream | addon + fake upstream | medium | rewriting logic, cookie injection or routing changes | local |
| L2 integration | end-to-end rewriting chain: `mitmdump` + curl through the local proxy against a fake WebVPN | sidecar + fake upstream + real proxy flow | medium | proxy set/clear, configuration delivery, rewriting chain changes | local |
| L3 system | the full user path on real hardware: real WebVPN + browser acceptance of the registrar site | whole app (Electron + sidecar) | high | before a release; requires the tester's own account | manual (macOS / Windows test machines) |
| Manual | scenarios that cannot be automated (CA install/uninstall, system proxy, permission prompts, UI states) | — | — | UI, environment or external systems | manual |

**Regression policy**: L0 runs on every PR; L1/L2 run locally when the relevant module changes; L3 runs before a release. The case set (TC-A01..TC-H02) and priorities live in the phase 1 spec's `verification.md`; the release gate is section 6 of [docs/verification/verification-strategy.md](../verification/verification-strategy.md).

**How L3 is executed (from M4 on)**: follow the "M4 双平台验收执行手册" in [specs/001-phase1-local-bridge/verification.md](../../specs/001-phase1-local-bridge/verification.md) step by step (each step names the executor, command, expectation and where its evidence lands); both platforms share `pnpm run acceptance:check` to collect redacted evidence (OS / proxy / trust store / CA permissions / bridge liveness / curl controls plus `redaction-self-check`) and to fill the manual's result table. Prerequisite: **turn off the TUN / virtual-interface mode of any other proxy tool first** (`KI-013`); the actions that need a human (administrator password, CAS/MFA login, system-extension authorization) are performed by the tester. The login step may hit `KI-014` (CAS theme static assets truncated by the server, leaving the login window unstyled): reloading the login window is enough to continue, and this is external-service behaviour.

## 2. Coverage expectations

```text
Coverage target: TBD (no numeric target; the current baseline is 198 green L0/L1/L2 cases (L0 97 + L1 93 + L2 8) plus 71 app unit cases)
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
- gateway-owned namespace passthrough (paths beginning with `/wengine-vpn/` or `/authserver/` take no token, are fetched from the gateway root and their responses are not reverse-rewritten) and the boundaries of the bootstrap promotion predicate (`text/html` + ≤ 8192 B + containing both markers; a large page carrying the same injection **must not** be promoted), covered in the L1 `bridges/python/tests/l1/test_addon_request.py` / `test_addon_response.py`, with one end-to-end case in the L2 `bridges/python/tests/l2/test_proxy_end_to_end.py` (ADR-0007);
- process capture (REQ-003): mode-set derivation, rollback on failure and the no-retry semantics of `swufe_bridge.capture` in L0 unit tests (`bridges/python/tests/l0/test_capture.py`), and the addon's capture loop in an L1 test with injected fakes (`bridges/python/tests/l1/test_addon_capture.py` — automated tests **must never** really enable local mode); the real scope and "switching back to the system proxy stops it" belong to L3 manual verification (the tester has to confirm the OS authorisation prompt in person).

Requirement acceptance criteria, reproductions of fixed bugs, and boundaries and error paths must also be covered.

## 3. Naming and organisation

```text
Location:  bridges/python/tests/l0 (unit: codec, allowlist, config), bridges/python/tests/l1 (component: addon request/response
           rewriting, logging, hot reload), bridges/python/tests/l2 (integration: real mitmdump + curl + fake upstream);
           shared fixtures: bridges/python/tests/conftest.py (config factory, no mitmproxy import) and
           bridges/python/tests/l1/conftest.py (flow / addon factories);
           apps/desktop/test (app unit: `*.test.ts` + `helpers/fakes.ts`, Node's built-in test runner + tsx;
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
Run all:        uv sync --directory bridges/python && uv run --directory bridges/python pytest (L0+L1+L2; no internet access needed)
Run one file:   uv run --directory bridges/python pytest tests/l1/test_addon_request.py
Run with watch: uv run --directory bridges/python pytest -f (requires the pytest-xdist plugin; not adopted this phase — when it is
                not installed, re-run uv run --directory bridges/python pytest manually)
App unit:       pnpm --filter swufe-webvpn-bridge run test:unit (run `pnpm install` first)
App typecheck:  pnpm --filter swufe-webvpn-bridge run typecheck
CI test job:    L0: .github/workflows/python-tests.yml (runs uv sync --frozen --directory bridges/python + uv run --directory bridges/python pytest tests/l0 -q
                on pull_request and pushes to main);
                App unit and types: .github/workflows/app-tests.yml (pnpm install --frozen-lockfile + typecheck + test:unit,
                needs neither the Electron binary nor a display);
                L1/L2 need mitmdump, curl and local ports, so they run locally only;
                documentation checks are handled separately by .github/workflows/docs-check.yml
```

Documentation-check workflow: [docs-check.yml](../../.github/workflows/docs-check.yml) (runs `pnpm run docs:check` and `pnpm run typecheck` on pull requests and pushes to `main`).

## 6. Test data and environments

| Item | Convention |
| ---- | ---------- |
| Test data | Real data is limited to "the tester's own SWUFE account" and **must never be committed**; everything else uses constructed sample URLs and configurations |
| External dependencies | L0 has none; L1/L2 use a fake WebVPN upstream (recorded traffic or a stub); L3 uses the real `webvpn.swufe.edu.cn` (authorised devices only) |
| Environment isolation | L3 needs exclusive use of the system proxy (the app refuses to start when a system proxy is already in use); the same test machine must not run Clash / mihomo / sing-box at the same time, and **their TUN / virtual-interface mode must be off as well** (fake-ip DNS makes upstream connections through the bridge hang, `KI-013`; `PROXY_CONFLICT` cannot see TUN) |
| Sensitivity | Logs and test output must not contain session cookies or response bodies; never commit real cookies, accounts or personal data |

## 7. Relationship to verification

Passing tests is not the same as a finished feature. See [docs/verification/verification-strategy.md](../verification/verification-strategy.md) for the definition of done, and `specs/<id>/verification.md` for the per-requirement mapping.
