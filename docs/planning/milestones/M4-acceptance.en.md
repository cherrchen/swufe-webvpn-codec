# M4: Acceptance

> Status: In Progress
> Owner: cherrchen
> Target: TBD (the original package defines no date)
>
> Chinese source of truth: [M4-acceptance.md](M4-acceptance.md)

## Goal

Complete Phase 1 acceptance on real machines against the real WebVPN, reaching "usable privately":

- Run the P0 cases on a macOS and a Windows desktop OS;
- Open and operate the academic-affairs site `jwxt.swufe.edu.cn` in a browser (TC-G01..TC-G03);
- Burn down defects, document known issues, and produce a test report later work can reference.

## Included specs

| Spec | Status | Dependencies |
| ---- | ------ | ------------ |
| [001-phase1-local-bridge](../../../specs/001-phase1-local-bridge/spec.md) | Implemented (after M5; `Verified` pending the Windows side, `KI-001`) | M3 |

## Exit criteria

- [x] macOS: the app starts and the full login / start / stop / quit chain works (TC-D01/D02/D03/D04, TC-C01..C04, TC-E01/E02/E03, TC-F01/F04, TC-G04, TC-H01/H02, TC-B05 pass)
- [x] macOS: the browser opens the academic-affairs home page (TC-G01, P0) - **passed in M5 (2026-09-21)**: after the `KI-011` fix (gateway-owned namespaces passed straight through + bootstrap documents promoted, [ADR-0007](../../architecture/adr/ADR-0007-gateway-owned-namespaces-and-native-mode-promotion.md)) the entry `http://jwxt.swufe.edu.cn/` is promoted to the WebVPN native URL form and opens normally (bridge log `detail=promoted`)
- [x] macOS: in-site navigation works and does not jump to an unreachable address because of absolute URLs (TC-G02, P0) - **passed in M5 (2026-09-21)**: in the gateway-native space both the home-page menu and the in-site "Student Grade Query" are interactive with no error page (same [ADR-0007](../../architecture/adr/ADR-0007-gateway-owned-namespaces-and-native-mode-promotion.md))
- [ ] Windows: TC-G01 repeated and passed (TC-G03, P0) - **deferred**: the machine is not reachable in this round (`KI-001`)
- [ ] All P0 cases pass (TC-A01/A02/A03, TC-B01..TC-B03, TC-C01..TC-C04, TC-D01..TC-D04, TC-E01/E02, TC-F01/F02, TC-G01..TC-G03) - **everything on macOS now passes** (TC-G01/TC-G02 turned to pass after M5); **only TC-G03 is unmet** (the Windows real-machine item is deferred, `KI-001`)
- [ ] No unresolved blocking defects in the P1 cases - **not met**: `KI-011` is `Fixed` (M5) and `KI-007` is `Fixed` (2026-09-21, [ADR-0008](../../architecture/adr/ADR-0008-ca-trust-authorization-in-app-session.en.md)); what is still unresolved is `KI-013` (TUN interference) and `KI-014` (CAS theme assets truncated by the server, so the login window needs a reload)
- [x] Browser acceptance on the academic-affairs site passes on at least one desktop OS (both targeted) - **met in M5 (2026-09-21)**: TC-G01/TC-G02 pass on macOS; the Windows side still waits for `KI-001` to be lifted and then re-run per [development-run.md](../../operations/development-run.md)
- [x] The known-issues list is recorded (`id/title/severity/status/linked_case/owner/note`, including the new `KI-007`..`KI-014`; after M5 `KI-011` is set to `Fixed`)
- [x] Affected documents are synced (including bilingual pairs: `development-run.md`, milestone/roadmap/testing-strategy and the five spec files)

> Exit floor: on macOS, including the academic-affairs browser acceptance, everything passes; Windows is explicitly deferred. **The "at least one desktop OS" floor was reached in M5 (2026-09-21)**, but "all P0 pass" still misses TC-G03 (Windows, `KI-001`) and "no unresolved blocking P1 defects" still has `KI-013`/`KI-014`, so this milestone stays `In Progress` and spec 001 advances to `Implemented` (not yet `Verified`).

Acceptance environment: one macOS and one Windows test machine, Chrome/Edge, mitmproxy and curl; the test account is the tester's own SWUFE account (never committed to the repository) and is used only on authorized devices.
Measured additions this round: **the TUN / virtual-interface mode of any other proxy tool must be off before acceptance** (Clash/mihomo fake-ip makes upstream connections through the bridge hang, see `KI-013`); the academic-affairs site is only proxyable through the gateway in its `http://jwxt.swufe.edu.cn/...` form (the `https` form returns `/wengine-vpn/failed`).

## Risks

| Risk | Impact | Mitigation |
| ---- | ------ | ---------- |
| R5 School policy restricts automation (low/high) | If acceptance judges the access non-compliant, the project must stop or fall back to manual conversion | Private use first; documentation states the usage boundary; degrade to manual conversion and record the conclusion if needed |
| R1 Academic-affairs front end has many dynamic absolute URLs (medium/high) | In-site navigation may build URLs dynamically at runtime, failing acceptance | Accept against "operable critical path", not the DOM; locate missed rewrites with layered response rewriting and debug logging |
| R2 Cookie field changes (medium/high) | During acceptance, session injection or expiry detection fails and blocks manual acceptance | Centralized probing + fast patches; re-run affected cases after re-login if needed |

### M5 re-verification record (2026-09-21, after the `KI-011` fix)

**Scope**: fixing `KI-011` (the gateway's client-side shim is incompatible with the transparent bridge) and re-verifying it on a real macOS machine; the fix is described in [ADR-0007](../../architecture/adr/ADR-0007-gateway-owned-namespaces-and-native-mode-promotion.md) (gateway-owned namespaces passed straight through + bootstrap documents promoted to the gateway's native URL space).

**Result**: TC-G01 passes (entry `http://jwxt.swufe.edu.cn/` → bridge log `detail=promoted` → the gateway-native home page renders in full), TC-G02 passes (the in-site "Student Grade Query" is interactive and links do not jump away); non-jwxt hosts (`www.swufe.edu.cn`) stay in the ordinary URL space; `/wengine-vpn/js/main.js` through the bridge is 200 / 376 922 B (404 through the bridge before the fix); `lib.swufe.edu.cn` is promoted as well because it too is a bootstrap page (expected). Regression: `uv run pytest -q` = 198 passed, app unit tests 71 passed, `docs:check` 0 error / 0 warning, and after stopping the bridge neither the system proxy nor any process is left behind.

**Evidence**: the "M5 (`KI-011` fix) run record" in [specs/001-phase1-local-bridge/verification.md](../../../specs/001-phase1-local-bridge/verification.md); redacted snapshot `specs/001-phase1-local-bridge/evidence/acceptance-macos/acceptance-darwin-20260921-154657.md`.

**New issue this round**: `KI-014` (the CAS theme's static assets are truncated by the server → the login window loses its styling; a reload recovers it; unrelated to the bridge).

**Still outstanding**: every Windows real-machine item (`KI-001`); `KI-013` (TUN interference), `KI-014`. (`KI-007`, listed in that round, was fixed on 2026-09-21 — see [ADR-0008](../../architecture/adr/ADR-0008-ca-trust-authorization-in-app-session.en.md).)

## Completion record

**Run date**: 2026-09-21 (macOS local machine, `darwin 24.6.0`, app started with `--user-data-dir=/tmp/m4-acceptance` and `SWUFE_PROBE_INTERVAL_MS=8000`).

**Method**: the real app driven over CDP (`--remote-debugging-port=9222`); the decisive browser observations were made by hand by cherrchen (automated navigation wedged repeatedly in this environment). Both platforms share the redacted evidence collector `npm run acceptance:check` (T044).

**Evidence**:
- "M4 双平台验收执行手册" + "M4 结果表" + "M4 教务浏览器验收记录" + the M4 rows of "执行的命令与结果" in [specs/001-phase1-local-bridge/verification.md](../../../specs/001-phase1-local-bridge/verification.md);
- redacted snapshots: `specs/001-phase1-local-bridge/evidence/acceptance-macos/` (7) and `evidence/kit-selfcheck/` (5, T044 self-check);
- defect ledger: [known-issues.md](../../../specs/001-phase1-local-bridge/known-issues.md) (`KI-001`..`KI-013`).

**Passing**: TC-D01/D02/D03/D04, TC-C01/C02/C03/C04, TC-E01 (via the app's own manual command)/E02/E03, TC-F01/F04, TC-G04, TC-H01/H02, TC-B05; `uv run pytest -q` = 190 passed, `npm --prefix app run test:unit` = 71 passed, both typechecks clean, `npm run docs:check` = 0 error / 0 warning.

**Failing**: TC-G01 and TC-G02 (browser acceptance). Root cause (`KI-011`): this deployment's gateway injects a client-side shim into every HTML response (`__vpn_*` plus `<script src="/wengine-vpn/js/main.js">`) that expects the browser to live in the WebVPN URL space; the transparent bridge token-prefixes that relative path, so it 404s through the bridge (the gateway root serves it: 200 / 376,922B) - the home page stays blank and the real page renders but is not interactive. The three candidate fixes (serve gateway-owned paths without a token / strip the shim from HTML / accept operating the site in portal form) all change public contracts and need a cherrchen decision plus an ADR.

**Deferred**: every Windows real-machine item (`KI-001`).

**Defects fixed during acceptance**: `KI-008` (session probe omitted the partition cookies, so every real session was reported expired and the bridge self-destructed; P0), `KI-009` (an ERR_ABORTED initial load was treated as fatal: misleading error plus a page stuck in the QR-only server render; P1), `KI-010` (CA uninstall lacked `-Z`, so no fingerprint could be read and uninstall never worked; P1).

**Remaining issues**: `KI-011` (P0, blocks browser acceptance), `KI-012` (some direct hosts get no response through mitmproxy; environment-dependent), `KI-013` (TUN interference needs an environment pre-check / wording), `KI-006` (the other two expiry signals of Q-001). (`KI-007` from that round was fixed on 2026-09-21: the CA install became "elevated keychain write + app-process trust-settings write", see [ADR-0008](../../architecture/adr/ADR-0008-ca-trust-authorization-in-app-session.en.md).)
