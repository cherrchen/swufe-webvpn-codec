# Stash / Loon functional comparison and alignment proposals

> Status: Draft
>
> Spec ID: 003
>
> Owner: cherrchen
>
> Last Reviewed: 2026-10-02
>
> Chinese primary: [functional-alignment.md](functional-alignment.md)

## 1. Purpose and boundaries

This document supports the next alignment review and task breakdown. It compares repository implementations, not the full capabilities of the third-party clients. The baseline is Git `648167b`: Stash Override `0.1.18-m2-bodydiag`, Tile provider `0.1.16-m2`, and Loon `0.1.3-m3`. Version strings do not rank completeness or prove that remote GitHub artifacts are current.

This pass only adds analysis, index links and verification evidence. Source, tests, plugin configurations, bundles and release artifacts are unchanged. The six existing untracked P0 files are excluded from the production baseline and untouched. Production evidence comes from the two plugin source trees, shared packages and production `.stoverride` / `.plugin`; P0 observations remain in [verification.md](verification.md).

Source/configuration establishes implementation, automation establishes local regression evidence, and device records establish actual host verification. All proposed alignment work is **Draft** and does not change the [PRD](prd.md), [contracts](interfaces.md), existing [tasks](tasks.md), or the Spec's `In Progress` status. Unsettled questions are isolated in section 7 rather than treated as approved design.

## 2. Overall findings

Both hosts already share `webvpn-core-js` and `webvpn-plugin-runtime`: WRD codec, exact-host routing, Gateway Session orchestration, Settings V2 and the main security invariants. Loon has Stash's capture, persistence and direct Gateway injection branches. Remaining alignment work primarily concerns entry points and runtime switches, notification policy, native request/response mapping, body acquisition, compatibility and verification coverage.

The proposed goal is equal user tasks and business invariants, with necessary native differences retained. In particular, Loon's Host correction and relative WRD Location handling must not be removed for source similarity, and a Loon Tile API must not be assumed. The existing Stash development pause is recorded in [plan.md](plan.md); this report does not lift it.

### 2.1 Evidence index

| ID | Files and symbols | Purpose |
| --- | --- | --- |
| E1 | [Core request](../../packages/webvpn-core-js/src/rewrite/request.ts): `rewriteRequest`; [gateway classifier](../../packages/webvpn-core-js/src/routing/gateway-request.ts) | WRD, Cookie, Origin/Referer and injection boundaries |
| E2 | [Core response](../../packages/webvpn-core-js/src/rewrite/response.ts), [body](../../packages/webvpn-core-js/src/rewrite/body.ts) | Location/Cookie/body, size limits and bootstrap |
| E3 | [Shared runtime](../../packages/webvpn-plugin-runtime/src/runtime.ts): `handlePluginRequest`, `handlePluginResponse`, `nativeGatewayRedirect`, `handleStatusTile` | Common orchestration and conditional host branches |
| E4 | [Stash request](../../plugins/stash/src/request-entry.ts), [response](../../plugins/stash/src/response-entry.ts), [Tile](../../plugins/stash/src/tile-entry.ts), [Adapter](../../plugins/stash/src/adapter.ts) | Native completion, notification and storage mapping |
| E5 | [Loon Adapter](../../plugins/loon/src/adapter.ts), [runtime](../../plugins/loon/src/runtime.ts), [Generic](../../plugins/loon/src/generic-entry.ts) | Arguments, build gate, nonce, notifications, Host and execution protection |
| E6 | [Stash Override](../../plugins/stash/swufe-webvpn.stoverride), [Loon plugin](../../plugins/loon/swufe-webvpn.plugin) | Script matching, body acquisition, MitM, QUIC and entry points |
| E7 | [Settings V2](../../packages/webvpn-core-js/src/runtime/settings-v2.ts), [shared page](../../packages/webvpn-plugin-runtime/src/settings-page.ts), [Loon page](../../plugins/loon/src/settings-page.ts) | Configuration, public DTO, nonce and save retries |
| E8 | [Session](../../packages/webvpn-core-js/src/session/session.ts), [status model](../../packages/webvpn-core-js/src/runtime/settings.ts), [diagnostics](../../packages/webvpn-core-js/src/runtime/diagnostics.ts) | State, keys, logs and notification content |

## 3. Functions already aligned

“Same” means shared implementation or equivalent output semantics, not device acceptance on both hosts. Evidence IDs refer to the index above.

| Function | Current common implementation | Evidence / boundary |
| --- | --- | --- |
| WRD protocol | Same JS codec and authoritative Python vectors; HTTP/HTTPS, ports, path/query/fragment | E1; codec tests; site settings override target scheme |
| Site routing | Only jwxt enabled by default; exact SWUFE custom hosts, add/remove, builtin switches; gateway/authserver reserved | E1/E7; unselected hosts PASS without Session injection |
| Site scheme | Per-host HTTP/HTTPS, HTTP unless explicitly HTTPS; next request reads saved settings | E1/E7; HTTPS source may intentionally become WRD `/http/` |
| Login and capture | Official Safari WebVPN/CAS/MFA; Gateway Cookie/Set-Cookie capture and native persistence; no CAS Cookie/password/MFA storage | E3/E8; Gateway Session is separate from service/CAS Cookie Jars |
| Cross-client injection | Rewritten selected targets receive Session; ticketless direct Gateway injection only for classified paths such as selected WRD and query-free root GET/HEAD | E1/E3; direct gateway-owned/login/logout/unknown injection is excluded |
| Conflicting tickets | Stored core ticket replaces a different client ticket on selected WRD resources, preserving other cookies; a conflicting request alone cannot replace the store | E1/E3; root 200 confirms a new ticket only under the allowed response conditions |
| Rotation and expiry | Bound-ticket update/deletion, clock expiry and exact `/logout`; ticketless/different-ticket responses cannot contaminate an existing Session | E3/E8; CAS-only pages/redirects do not clear Gateway Session |
| Ordinary request headers | Cookie merge and selected Origin/Referer rewrite; completion omits body so the host preserves it | E1/E4/E5; body acquisition still differs, ALIGN-05 |
| Page navigation | A rewrite decision for page GET (root or Accept containing `text/html`) becomes a synthetic 302 to the full Gateway URL; POST/HEAD/non-document GET remain transparent | E3/E4/E5; Loon now reuses Stash's `nativeGatewayRedirect` |
| Reverse response rewriting | Original-site URL context rewrites Location, Set-Cookie Domain/Path and HTML/JS/JSON references; default 1 MiB body guard | E2/E3; native Gateway WRD body/bootstrap PASS to prevent self-promotion; not every Gateway page is reverse-rewritten |
| Local Settings API | Same namespace, V2 schema, JSON, 16 KiB, one-use token, two-minute TTL, source checks and local errors; updates do not touch Session | E3/E7; Loon GET has an additional strict bootstrap/source gate |
| Settings save UX | Fresh token before save; errors preserve drafts and allow retries; dark mode, safe area, login button and migration warning | E7; both page handlers have VM coverage |
| Migration | V1 to V2 disables old wildcard routing, drops invalid/out-of-scope entries with a summary; Session schema is independent | E7/E8; identical keys do not make the two apps share storage |
| Diagnostics/distribution | Safe classified/redacted Trace; no raw pathname/authentication values/body; self-contained IIFE, GitHub distribution, no BoxJS or remote Settings backend | E3/E8; redacted system events still exist with debug=false, section 5 |
| Network scope | Wildcard SWUFE MitM interception versus exact selected routing; QUIC rejection limited to SWUFE suffix | E6; configured rules do not prove device interception/TCP fallback |

## 4. Implementation differences

Types: “UX” is a user-visible difference; “policy” can be reviewed for convergence; “native” has a platform adaptation basis; “coverage” concerns tests/delivery evidence. `ALIGN-*` are proposal identifiers, not approved implementation tasks.

| ID / type | Stash implementation | Loon implementation | Impact and proposal |
| --- | --- | --- | --- |
| ALIGN-01 / UX | Home Tile refreshes every 30 seconds; logged-out/expired opens login, logged-in opens Settings; static Override openUrl remains login | Separate settings/login Generic actions with clickable notifications and status at invocation; no periodic Tile | Align view-status/open-settings/relogin tasks while retaining native UI. Loon lacks equivalent automatic status refresh; no Tile API is assumed. E4/E5/E6/E8 |
| ALIGN-02 / UX | Reads persisted enabled/debug; production Override has no parameter controls | Argument enabled/debug overrides V2 switches per request; Settings works with forwarding off | Neither page has global enabled/debug controls. Review accessible Stash controls and explain argument/persistence precedence. E5/E6/E7 |
| ALIGN-03 / policy | Default 60 seconds per event; shared throttle write retains only the current event, discarding earlier event timestamps | Login/expiry 30 minutes, errors 10 minutes; Adapter merges event timestamps | Stash is more frequent and alternating events lose independent throttle memory. Preserve timestamps first, then choose intervals. User-invoked Generic notifications are outside automatic error throttling. E3/E5 |
| ALIGN-04 / native | Nonce uses host `globalThis.crypto.getRandomValues`; API GET returns 503 without secure randomness | Safari Web Crypto nonce via GET bootstrap header; exact HTTPS origin/API path, Settings-page Referer and no conflicting Origin | Align security outcomes, retain different sources. Loon bootstrap is not automatically the approved Stash design. E3/E5/E7; ADR-0014/0016 |
| ALIGN-05 / policy | Settings and ordinary requests both require body | Only Settings requires body; ordinary requests do not acquire it | Stash differs from IOS-NFR-005 and also reads auth request bodies. Review header-only business requests with a Settings-write exception; verify real POST/upload byte preservation. E6 |
| ALIGN-06 / policy | One broad response rule requires body for every match | Raw authserver is header-only; HTML/JS/JSON body rule, other responses header-only | Same Core supported types, different acquisition/privacy costs. Assess Stash rule splitting; merely disabling body loses text rewriting. Core size guard runs after host acquisition, not before host buffering. E2/E6 |
| ALIGN-07 / native | URL rewrite returns url/headers without explicitly changing Host | Removes all case variants and sets one Host to rewritten URL authority, including nondefault port | Loon has device evidence of retained old Host; Stash need is unproven. Keep the fix and first verify Stash Host/destination. Test page synthetic navigation separately from transparent requests. E4/E5 |
| ALIGN-08 / native | Native/upstream Gateway WRD responses PASS, including relative Location | In the same branch, only 3xx same-origin, decodable, non-self relative WRD Location becomes a full Gateway URL | Compensates upstream URL exposure while the browser may resolve against the original site; not another generic decode. Check Stash URL context before adopting. E3: `absoluteGatewayRedirect` |
| ALIGN-09 / coverage | Reads environment version/platform; no minimum declaration or HTTP runtime build gate | Declares 3.5.1(983); parses `$loon`; missing/low build yields business PASS and local Settings 503 | Stash minimum is TBD; do not copy Loon's number. Data schema checks are separate from host compatibility. Loon Generic bypasses the HTTP build gate. E4/E5/E6 |
| ALIGN-10 / native | Null writes become empty strings; only explicit false fails, accommodating void; empty reads count as absent | Null writes become undefined for single-key deletion; boolean result preserved | Keep native deletion APIs and align logical deletion/failure semantics. Do not copy Loon deletion syntax into Stash. E4/E5 |
| ALIGN-11 / coverage | Outer entry exceptions complete with PASS; Settings handler already has its own local catch | HTTP executor prevents repeated done and returns local 500 for Settings outer exceptions, otherwise PASS | Stash errors before the shared handler, such as runtime binding, may still PASS Settings; actual device occurrence is TBD. Add entry-level fault coverage, without claiming the common handler lacks protection. E3/E4/E5 |
| ALIGN-12 / policy | Business regex lacks a hostname terminator and is case-sensitive; dedicated Settings regex matches only textual HTTPS without port | Case-insensitive authority regex permits only port/slash after domain; Settings comes first | Stash regex can text-match a lookalike such as jwxt.swufe.edu.cn.evil.example; Core exact-host routing still PASSes, so this is not evidence of Cookie leakage. Tighten trigger boundaries, verify actual MitM scope and each host's rule precedence. E1/E6 |
| ALIGN-13 / coverage | Mainly 37 Adapter tests, few entry VMs; no dedicated production Override structure/matching test file | 48 runtime VM tests compile/execute real entries and assert one done; 4 plugin text tests | Counts do not rank capability. Add missing Stash configuration/native coverage with common fixtures. Page handler tests live in Stash suite but also execute Loon HTML. Text tests are not native parser acceptance. |
| ALIGN-14 / coverage | Request/response provider 0.1.18-m2-bodydiag versus Tile 0.1.16-m2; entry logs lack an equivalent semantic version string | All three providers 0.1.3-m3 and entry Trace includes that version | Both build banners include Git commit; main URLs with v query are cache identifiers, not immutable artifacts. Align inventory/cache refresh/rollback, rather than making numbers identical or asserting mixed caches already occurred. E4/E5/E6; build scripts |

### 4.1 Native differences to preserve

Secure nonce sources, Host correction, response URL context, native key deletion, notification url (Stash) versus openUrl (Loon), Tile versus Generic, Stash HTTP/80 force-engine and Loon new Script syntax belong at the adaptation boundary. Align semantics and achievable user tasks, not literal completion/configuration text.

### 4.2 Local matching-boundary check

A read-only Node RegExp check loaded patterns from production configurations and applied them to synthetic URLs. No network requests were made. Results establish text matching differences, not actual MitM interception or Core Cookie injection.

| Synthetic URL | Stash business regex | Loon business regex |
| --- | --- | --- |
| `http://jwxt.swufe.edu.cn/` | Matches | Matches |
| `https://jwxt.swufe.edu.cn.evil.example/` | Matches | Does not match |
| `https://swufe.edu.cn@evil.example/` | Matches | Does not match |
| `https://JWXT.SWUFE.EDU.CN/` | Does not match | Matches |

## 5. Common unfinished work and interpretation limits

These are not missing features already available in the other host.

| Topic | Current facts / limitations | Next-step basis |
| --- | --- | --- |
| Real cross-App/WKWebView access | Shared injection and Loon separate-client VM simulation exist; Stash historical tyxycg failure remains, later stored-ticket strategy is not fully revalidated; Loon has no actual cross-App upstream acceptance evidence | T054/T057, N02–N10; Safari jwxt access is not cross-App success |
| Minimal Gateway Cookie set | captureSession stores the observed Gateway Cookie header; Set-Cookie handling recognizes the core ticket, but capture does not retain only that ticket | E8, Spec Q-003; necessary auxiliary cookies still need evidence, so complete minimization cannot be claimed |
| Explicit/unknown login intent | Known paths exclude login/logout/unknown; no independent loginIntent field or intent classifier is present in current RequestDTO/rewriteRequest | PRD IOS-REQ-016/017, interfaces, T052/T053; known-path protection is not complete intent handling |
| Complete status | Tile/Generic/Settings primarily show logged-out/logged-in/expired/incompatible; captured can display logged-in. No active upstream probe, MitM readiness detection or separate healthy state; page status updates on reads, not polling | IOS-REQ-008; distinguish local Session presence from upstream acceptance; a script cannot itself prove MitM readiness |
| Switch visibility | Public Settings DTO has site fields; page omits enabled/debug and explicit forwarding-disabled status | ALIGN-02; public status/control additions require product/interface review |
| Pausing custom sites | Presence in customHosts means enabled; add/remove and scheme selection exist, but no separate retained disabled custom entry | Same on both hosts; adding pause capability is TBD, not a single-host omission |
| Debug meaning | debug=false filters traffic records but entries/shared emit still produce redacted system events | IOS-REQ-009/F01 versus entry diagnostics; clarify wording/acceptance without deleting useful evidence or expanding logging |
| Bodies/network | Core 1 MiB and Settings 16 KiB guards exist; host acquisition limits, oversize local termination, wildcard MitM and QUIC/TCP fallback lack complete device evidence | Gate D/M4 and K/M/G/H/O device cases |
| Updates/rollback | Both have self-contained bundles and scans; mutable main raw URLs are not completed version locking/rollback smoke | IOS-REQ-012/M4; pin complete artifacts and verify upgrades/rollback separately |

### 5.1 Documentation drift

The next alignment pass should synchronize existing documentation. This pass does not rewrite Accepted ADRs or redefine requirements:

- [ADR-0016](../../docs/architecture/adr/ADR-0016-loon-local-settings-runtime.en.md) Decision 1 still limits native redirect to Stash. Loon now reuses it; the current contract is in [interfaces.md](interfaces.md) and T065 evidence. Use an addendum/successor decision under repository rules rather than silently rewriting accepted history.
- [design.md](design.md) still summarizes existing client tickets as preserved/captured. Current selected WRD policy uses the stored ticket; details are in interfaces and PRD. Retain login/root/unknown exceptions when updating the summary.
- Early [verification.md](verification.md) prose says G13–G18 are all Pending; later evidence records Loon G13 page entry Passed. This only establishes entry recovery; G17 and in-page operations remain Pending. Consolidate current granularity later without mistaking early summaries or historical failures for current state.

## 6. Proposed sequence and acceptance inputs

These are candidate work packages, not approved T tasks or a lifting of Stash's pause. Confirm the pause and section 7 product choices, then update requirements/tasks/verification through the existing Spec workflow.

| Order / work package | Proposed scope | Independently verifiable outcome | References |
| --- | --- | --- | --- |
| 1 / Preserve business baseline | Keep Core/ticket policy/native navigation; assemble original/upstream URL and POST/HEAD/page GET fixtures | Same Session/routing semantics, only declared native output differences; no bootstrap self-loop/double WRD | E1–E5; G13/G16/G17/H07/N cases |
| 2 / Local Settings termination and body policy | Stash outer Settings exception protection; header-only business requests, response splitting and matching boundaries | No Settings upstream for methods/errors/oversize; real POST/upload bytes preserved; auth bodies unread; large responses retain header handling | ALIGN-05/06/11/12; IOS-NFR-005, K10/K21/K22/M05 |
| 3 / Entry points and switches | Accessible Stash status/settings/login, Loon status messaging; decide global controls/public disabled status | Configure while logged out; forwarding-off keeps Settings; clear relogin; consistent parameter/store/page meanings | ALIGN-01/02; IOS-REQ-008, H02/H06/O01/O06 |
| 4 / Notifications/compatibility | Preserve event timestamps, choose intervals, establish Stash minimum and secure randomness | Alternating events do not bypass throttling; supported versions and actionable failures documented; no weak nonce fallback | ALIGN-03/04/09/10; G05/K/O |
| 5 / Regression/artifacts | Stash config/entry comparison, Tile provider refresh, fixed complete releases/rollback, drift synchronization | Traceable artifacts, no Node/CDN, one completion per entry; installation combination smoke; documentation matches evidence | ALIGN-13/14; G18/H14, IOS-REQ-011/012 |
| 6 / Independent device acceptance | Real jwxt operations/POST after entry, cross-App, two-stage URL, wildcard, QUIC, Settings save/oversize | Per-host environment and Passed/Failed/Pending evidence; never inherit another host or VM's acceptance | T020/T021/T027/T054/T057, M4 |

Device evidence should contain only versions, methods, hosts/fixed path classifications, status codes, redirect classifications, injection/preservation booleans and operation outcomes. Do not retain Cookie values, accounts, authentication parameters or full headers/bodies. Actual upstream sending/acceptance requires independent evidence, not only script decision logs.

## 7. Open Questions for the next review

| ID | Question | Independent work |
| --- | --- | --- |
| ALIGN-Q01 | Resume Stash, or first finish Loon acceptance while maintaining shared security regressions? | Retain the comparison; do not start Stash development |
| ALIGN-Q02 | Equal enabled/debug access through native controls, local page, or both; how to explain precedence? | Define observable forwarding-off/settings/login behavior without expanding API |
| ALIGN-Q03 | Adopt Loon's 30/10-minute intervals; distinguish active Generic from automatic errors? | Separate timestamp correctness from product interval choices |
| ALIGN-Q04 | Does Loon offer appropriate automatic status display, or is on-demand Generic/Settings sufficient? | Do not assume Tile; assess existing navigation and notifications |
| ALIGN-Q05 | Reliable Stash minimum, secure randomness, source metadata and response precedence on the target version? | Collect device evidence; retain fail-closed/static-scope fallback constraints |
| ALIGN-Q06 | Accept native Gateway URL after page entry; how should original-domain goals describe the deployed workaround? | Separate page GET from transparent API acceptance; preserve usable navigation |
| ALIGN-Q07 | How to close login intent/callback/real cross-App contracts? | Reuse T052/T053/T054/T057; do not add CAS Cookie sharing or guess callbacks |

## 8. Validation and documentation impact

Current tests were run via exec vitest run, avoiding package test scripts that rebuild dist. Entry compilation in tests writes only in-memory output, not production bundles.

| Command | Result | Evidence scope |
| --- | --- | --- |
| `pnpm --filter webvpn-core-js exec vitest run` | 76 Passed | Codec/routing/session/rewrite/Settings Core |
| `pnpm --filter swufe-webvpn-stash exec vitest run` | 42 Passed | Adapter, request/response entries, both page handlers |
| `pnpm --filter swufe-webvpn-loon exec vitest run` | 52 Passed | Loon entry VM and plugin text contracts |
| `node scripts/scan-bundle.mjs` in each host directory | Passed | Dependency isolation of six existing bundles, not remote freshness or device loading |
| `pnpm_config_verify_deps_before_run=false pnpm run docs:check` | Passed; 0 errors / 0 warnings | Links, bilingual pairs and Spec structure |
| `git diff --check` | Passed | Whitespace check for tracked documentation patches |

Device status still comes from [verification.md](verification.md): Stash Safari capture has evidence, cross-App historical failures/new policy remain unclosed; Loon parser/Settings GET and jwxt entry have passed records, but saving, in-page operations, full chains and cross-App acceptance are incomplete. No device, remote publication verification or M4 pressure test was performed in this pass.

Documentation impact: add the bilingual comparison and index links, and record this review's evidence in verification. Requirements, contracts, data models, architecture, security policies, dependencies, implementation tasks and testing procedures remain unchanged; their long-lived bodies need no synchronization and no ADR is created. Review ADR/contract impact if switch/status DTO/nonce proposals are later accepted.
