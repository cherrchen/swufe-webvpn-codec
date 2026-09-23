# M4: Acceptance

> Status: In Progress (2026-09-23: Windows real-machine acceptance passed; `KI-014` is accepted, while `KI-019` is reopened because local and external causes remain undistinguished)
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
| [001-phase1-local-bridge](../../../specs/001-phase1-local-bridge/spec.md) | Implemented (P0 and browser acceptance pass on both desktop OSes; `KI-019` needs diagnosis before `Verified` can be assessed) | M3 |

## Exit criteria

- [x] macOS: the app starts and the full login / start / stop / quit chain works (TC-D01/D02/D03/D04, TC-C01..C04, TC-E01/E02/E03, TC-F01/F04, TC-G04, TC-H01/H02, TC-B05 pass)
- [x] macOS: the browser opens the academic-affairs home page (TC-G01, P0) - **passed in M5 (2026-09-21)**: after the `KI-011` fix (gateway-owned namespaces passed straight through + bootstrap documents promoted, [ADR-0007](../../architecture/adr/ADR-0007-gateway-owned-namespaces-and-native-mode-promotion.md)) the entry `http://jwxt.swufe.edu.cn/` is promoted to the WebVPN native URL form and opens normally (bridge log `detail=promoted`)
- [x] macOS: in-site navigation works and does not jump to an unreachable address because of absolute URLs (TC-G02, P0) - **passed in M5 (2026-09-21)**: in the gateway-native space both the home-page menu and the in-site "Student Grade Query" are interactive with no error page (same [ADR-0007](../../architecture/adr/ADR-0007-gateway-owned-namespaces-and-native-mode-promotion.md))
- [x] Windows: TC-G01 repeated and passed (TC-G03, P0) - **passed on 2026-09-23** (real Windows 11 24H2): the entry `http://jwxt.swufe.edu.cn/` is promoted by the bridge to `https://webvpn.swufe.edu.cn/http/<token>/` (bridge log `detail=promoted`) and cherrchen confirmed the page opens and is operable; `/xtgl/index_initMenu.html` through the bridge is `200` with a reversed-rewritten body
- [x] All P0 cases pass (TC-A01/A02/A03, TC-B01..TC-B03, TC-C01..TC-C04, TC-D01..TC-D04, TC-E01/E02, TC-F01/F02, TC-G01..TC-G03) - **both macOS (after M5) and Windows (2026-09-23) now pass**: the Windows re-run covered TC-D01..D04, TC-C01..C04, TC-E01/E02/E03, TC-F01/F04, TC-G03, TC-G04, TC-H01/H02, TC-B05
- [ ] No unresolved blocking defects in the P1 cases — `KI-014` (CAS asset truncation) is `Accepted` as an issue outside the app and bridge, with reload as a workaround; `KI-019` (sporadic academic-affairs stall through the bridge) is reopened because the original upstream attribution did not distinguish local TUN/mitmproxy from the external path.
- [x] Browser acceptance on the academic-affairs site passes on at least one desktop OS (both targeted) - **both passed on 2026-09-23**: macOS TC-G01/TC-G02 (M5) and Windows TC-G03 (M4 Windows round)
- [x] The known-issues list is recorded (`id/title/severity/status/linked_case/owner/note`, including the new `KI-007`..`KI-020`; `KI-001` set to `Fixed` on 2026-09-23)
- [x] Affected documents are synced (including bilingual pairs: `development-run.md`, milestone/roadmap/testing-strategy and the five spec files)

> Exit floor: macOS and Windows P0 cases and academic-affairs browser acceptance all pass, and `KI-001` is `Fixed`. The external transfer risk of `KI-014` is accepted. The historical `KI-019` stall did not recur in same-path checks, but its prior non-local attribution is unsupported; M4 and spec 001 therefore remain short of `Done` / `Verified`. See the "KI-014 / KI-019 同日复核" section of [verification.md](../../../specs/001-phase1-local-bridge/verification.md).

Acceptance environment: one macOS and one Windows test machine, Chrome/Edge, mitmproxy and curl; the test account is the tester's own SWUFE account (never committed to the repository) and is used only on authorized devices.
Measured additions this round: **the TUN / virtual-interface mode of any other proxy tool must be off before acceptance** (Clash/mihomo fake-ip makes upstream connections through the bridge hang, see `KI-013`; since 2026-09-21 the fake-ip shape is refused by a pre-start preflight, while the `redir-host` shape still has to be turned off by hand — see [ADR-0011](../../architecture/adr/ADR-0011-refuse-start-on-fake-ip-dns.en.md)); the academic-affairs site is only proxyable through the gateway in its `http://jwxt.swufe.edu.cn/...` form (the `https` form returns `/wengine-vpn/failed`). **Windows-side additions (2026-09-23)**: (1) Chrome / Edge upgrade the entry to `https://` automatically — use `--disable-features=HttpsUpgrades` or turn "always use secure connections" off during acceptance; (2) "selected apps" capture does not intercept DNS, so the academic-affairs site (no public record) works only in the default "system proxy" mode; (3) the bundled Windows curl needs `--ssl-no-revoke` to accept the local CA; (4) reaching the academic-affairs site through the bridge stalls sporadically (`KI-019`) and a reload recovers it.

## Risks

| Risk | Impact | Mitigation |
| ---- | ------ | ---------- |
| R5 School policy restricts automation (low/high) | If acceptance judges the access non-compliant, the project must stop or fall back to manual conversion | Private use first; documentation states the usage boundary; degrade to manual conversion and record the conclusion if needed |
| R1 Academic-affairs front end has many dynamic absolute URLs (medium/high) | In-site navigation may build URLs dynamically at runtime, failing acceptance | Accept against "operable critical path", not the DOM; locate missed rewrites with layered response rewriting and debug logging |
| R2 Cookie field changes (medium/high) | During acceptance, session injection or expiry detection fails and blocks manual acceptance | Centralized probing + fast patches; re-run affected cases after re-login if needed |

### M5 re-verification record (2026-09-21, after the `KI-011` fix)

**Scope**: fixing `KI-011` (the gateway's client-side shim is incompatible with the transparent bridge) and re-verifying it on a real macOS machine; the fix is described in [ADR-0007](../../architecture/adr/ADR-0007-gateway-owned-namespaces-and-native-mode-promotion.md) (gateway-owned namespaces passed straight through + bootstrap documents promoted to the gateway's native URL space).

**Result**: TC-G01 passes (entry `http://jwxt.swufe.edu.cn/` → bridge log `detail=promoted` → the gateway-native home page renders in full), TC-G02 passes (the in-site "Student Grade Query" is interactive and links do not jump away); non-jwxt hosts (`www.swufe.edu.cn`) stay in the ordinary URL space; `/wengine-vpn/js/main.js` through the bridge is 200 / 376 922 B (404 through the bridge before the fix); `lib.swufe.edu.cn` is promoted as well because it too is a bootstrap page (expected). Regression: `uv run --directory bridges/python pytest -q` = 198 passed, app unit tests 71 passed, `docs:check` 0 error / 0 warning, and after stopping the bridge neither the system proxy nor any process is left behind.

**Evidence**: the "M5 (`KI-011` fix) run record" in [specs/001-phase1-local-bridge/verification.md](../../../specs/001-phase1-local-bridge/verification.md); redacted snapshot `specs/001-phase1-local-bridge/evidence/acceptance-macos/acceptance-darwin-20260921-154657.md`.

**New issue this round**: `KI-014` (the CAS theme's static assets are truncated by the server → the login window loses its styling; a reload recovers it; unrelated to the bridge).

**Still outstanding**: `KI-014` (the Windows real-machine items were completed on 2026-09-23, see the next section). (`KI-007`, listed in that round, was fixed on 2026-09-21 — see [ADR-0008](../../architecture/adr/ADR-0008-ca-trust-authorization-in-app-session.en.md); `KI-013` was fixed on 2026-09-21 — see [ADR-0011](../../architecture/adr/ADR-0011-refuse-start-on-fake-ip-dns.en.md).)

### M4 Windows-side run record (2026-09-23)

**Scope**: lifting `KI-001` — running every Windows item of the "M4 dual-platform acceptance handbook" on a real Windows 11 24H2 machine.

**Environment**: `win32 10.0.26200` (x64, Chinese UI), Node v24.14.0, `uv` 0.11.17, Python 3.13.11, the tester's own SWUFE account (CAS/MFA), real Chrome and the bundled Windows curl (Schannel); isolated profile; `SWUFE_PROBE_INTERVAL_MS=8000`; TC-G04 ran with the app elevated (UAC).

**Result**: TC-G03 (academic-affairs site opens and is operable through the bridge, entry `detail=promoted`), TC-D01..D04, TC-C01..C04, TC-E01/E02/E03, TC-F01, TC-F04, TC-G04 (real capture: mutual exclusion + forward + reverse), TC-H01/H02, TC-B05 all pass; commands: `pytest` `198 passed`, app unit tests `108 passed`, `typecheck` clean, `docs:check` 0 error / 0 warning, `pnpm run acceptance:check --scheme http` with no `FAIL`.

**Defects found and fixed this round**: `KI-015` (a stale "not logged in" error survived a successful login), `KI-016` (localized `certutil` output plus a non-filtering selector made the CA look absent although it was imported), `KI-017` (`execFile`'s stdin pipe hung `certutil` until the 10s timeout, so every CA install failed), `KI-018` (CRLF from `reg query` made the WinINET proxy parse always empty: missed `PROXY_CONFLICT`, and stop/quit never cleared the proxy), `KI-020` (tooling platform assumptions: mode bits, Schannel curl, a security case silently skipped without `ifconfig`, HTTP/2 header casing); `KI-001` is `Fixed`.

**Windows acceptance record at the time (later status superseded)**: `KI-019` was then marked `Accepted` as suspected upstream risk, while `KI-014` remained `Open`. The same-day review reopened `KI-019` and accepted `KI-014`; see [known-issues.md](../../../specs/001-phase1-local-bridge/known-issues.md) and [verification.md](../../../specs/001-phase1-local-bridge/verification.md).

**Evidence**: the "M4 Windows 验收执行记录（2026-09-23）" section of [specs/001-phase1-local-bridge/verification.md](../../../specs/001-phase1-local-bridge/verification.md) (result table, per-REQ/NFR/AC coverage, command results); redacted snapshots `specs/001-phase1-local-bridge/evidence/acceptance-windows/` (4); the "Windows 真机验收新增" tables in [known-issues.md](../../../specs/001-phase1-local-bridge/known-issues.md).

## Completion record

**Run date**: 2026-09-21 (macOS local machine, `darwin 24.6.0`, app started with `--user-data-dir=/tmp/m4-acceptance` and `SWUFE_PROBE_INTERVAL_MS=8000`).

**Method**: the real app driven over CDP (`--remote-debugging-port=9222`); the decisive browser observations were made by hand by cherrchen (automated navigation wedged repeatedly in this environment). Both platforms share the redacted evidence collector `pnpm run acceptance:check` (T044).

**Evidence**:
- "M4 双平台验收执行手册" + "M4 结果表" + "M4 教务浏览器验收记录" + the M4 rows of "执行的命令与结果" in [specs/001-phase1-local-bridge/verification.md](../../../specs/001-phase1-local-bridge/verification.md);
- redacted snapshots: `specs/001-phase1-local-bridge/evidence/acceptance-macos/` (7) and `evidence/kit-selfcheck/` (5, T044 self-check);
- defect ledger: [known-issues.md](../../../specs/001-phase1-local-bridge/known-issues.md) (`KI-001`..`KI-013`).

**Passing**: TC-D01/D02/D03/D04, TC-C01/C02/C03/C04, TC-E01 (via the app's own manual command)/E02/E03, TC-F01/F04, TC-G04, TC-H01/H02, TC-B05; `uv run --directory bridges/python pytest -q` = 190 passed, `pnpm --filter swufe-webvpn-bridge run test:unit` = 71 passed, both typechecks clean, `pnpm run docs:check` = 0 error / 0 warning.

**Failing**: TC-G01 and TC-G02 (browser acceptance). Root cause (`KI-011`): this deployment's gateway injects a client-side shim into every HTML response (`__vpn_*` plus `<script src="/wengine-vpn/js/main.js">`) that expects the browser to live in the WebVPN URL space; the transparent bridge token-prefixes that relative path, so it 404s through the bridge (the gateway root serves it: 200 / 376,922B) - the home page stays blank and the real page renders but is not interactive. The three candidate fixes (serve gateway-owned paths without a token / strip the shim from HTML / accept operating the site in portal form) all change public contracts and need a cherrchen decision plus an ADR.

**Deferred**: every Windows real-machine item (`KI-001`).

**Defects fixed during acceptance**: `KI-008` (session probe omitted the partition cookies, so every real session was reported expired and the bridge self-destructed; P0), `KI-009` (an ERR_ABORTED initial load was treated as fatal: misleading error plus a page stuck in the QR-only server render; P1), `KI-010` (CA uninstall lacked `-Z`, so no fingerprint could be read and uninstall never worked; P1).

**Remaining issues**: `KI-011` (P0, blocks browser acceptance), `KI-012` (some direct hosts get no response through mitmproxy; environment-dependent), `KI-013` (TUN interference needs an environment pre-check / wording — fixed on 2026-09-21, see [ADR-0011](../../architecture/adr/ADR-0011-refuse-start-on-fake-ip-dns.en.md)), `KI-006` (the other two expiry signals of Q-001; the 2026-09-21 decision keeps it `Open`). (`KI-007` from that round was fixed on 2026-09-21: the CA install became "elevated keychain write + app-process trust-settings write", see [ADR-0008](../../architecture/adr/ADR-0008-ca-trust-authorization-in-app-session.en.md).)
