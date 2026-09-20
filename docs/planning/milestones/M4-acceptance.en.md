# M4: Acceptance

> Status: Planned
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
| [001-phase1-local-bridge](../../../specs/001-phase1-local-bridge/spec.md) | Draft | M3 |

## Exit criteria

- [ ] macOS: the browser opens the academic-affairs home page (TC-G01, P0)
- [ ] macOS: in-site navigation works and does not jump to an unreachable address because of absolute URLs (TC-G02, P0)
- [ ] Windows: TC-G01 repeated and passed (TC-G03, P0)
- [ ] All P0 cases pass (TC-A01/A02/A03, TC-B01..TC-B03, TC-C01..TC-C04, TC-D01..TC-D04, TC-E01/E02, TC-F01/F02, TC-G01..TC-G03)
- [ ] No unresolved blocking defects in the P1 cases
- [ ] Browser acceptance on the academic-affairs site passes on at least one desktop OS (both targeted)
- [ ] The known-issues list is recorded
- [ ] Affected documents are synced (including bilingual pairs)

Acceptance environment: one macOS and one Windows test machine, Chrome/Edge, mitmproxy and curl; the test account is the tester's own SWUFE account (never committed to the repository) and is used only on authorized devices.

## Risks

| Risk | Impact | Mitigation |
| ---- | ------ | ---------- |
| R5 School policy restricts automation (low/high) | If acceptance judges the access non-compliant, the project must stop or fall back to manual conversion | Private use first; documentation states the usage boundary; degrade to manual conversion and record the conclusion if needed |
| R1 Academic-affairs front end has many dynamic absolute URLs (medium/high) | In-site navigation may build URLs dynamically at runtime, failing acceptance | Accept against "operable critical path", not the DOM; locate missed rewrites with layered response rewriting and debug logging |
| R2 Cookie field changes (medium/high) | During acceptance, session injection or expiry detection fails and blocks manual acceptance | Centralized probing + fast patches; re-run affected cases after re-login if needed |

## Completion record

Not started yet; the completion time, evidence (test report and execution-record summaries) and remaining issues are recorded here once it is done.
