# M3: Experience Polish

> Status: Planned
> Owner: cherrchen
> Target: TBD (the original package defines no date)
>
> Chinese source of truth: [M3-experience-polish.md](M3-experience-polish.md)

## Goal

Finish the controllable items that sit beside the main path but still belong to Phase 1, so users can manage the routing scope themselves, see what happened, and narrow capture per process:

- Allowlist UI: `jwxt.swufe.edu.cn` by default, hosts can be added/removed and persisted, optional `*.swufe.edu.cn` wildcard (REQ-005);
- Debug logging toggle and log panel: records only "domain + whether rewriting succeeded", off by default, never bodies or cookies (REQ-009, NFR-003);
- Process capture: list candidate processes and capture the selected ones only (REQ-003);
- Status area and Chinese copy: consistent with the bridge state machine; CA install risk notice, proxy conflict notice, session expiry notice (REQ-001, NFR-005).

## Included specs

| Spec | Status | Dependencies |
| ---- | ------ | ------------ |
| [001-phase1-local-bridge](../../../specs/001-phase1-local-bridge/spec.md) | Draft | M2 |

## Exit criteria

- [ ] Allowlist hosts can be added and removed and persist across an app restart (TC-B05, P1)
- [ ] The `*.swufe.edu.cn` wildcard checkbox and its explanatory copy work (TC-H02, P2)
- [ ] Debug logging works and carries no bodies: only the domain and the rewrite result (TC-F04, P1; NFR-003)
- [ ] Process capture works: candidate processes can be selected and capture applies only to them (TC-G04, P1)
- [ ] Status display matches the bridge state machine (TC-H01, P1)
- [ ] Key copy is in place: CA install risk notice, proxy conflict notice (close Clash / mihomo etc.), session expiry notice (NFR-005)
- [ ] Affected documents are synced (including bilingual pairs); no blocking defects

## Risks

| Risk | Impact | Mitigation |
| ---- | ------ | ---------- |
| R4 macOS permission prompts scare users off (medium/medium) | The accessibility/network-extension permission process capture needs gets denied; poor UI guidance blocks that path | Guide the permission steps in copy; failure of this path does not break the main system-proxy path |
| R1 Academic-affairs front end has many dynamic absolute URLs (medium/high) | Missed rewrites are only found in live testing and are hard to locate without logs | Use debug logging per domain to check rewrite results as the localization tool for response rewriting |

## Completion record

Not started yet; the completion time, evidence (commands and result summaries) and remaining issues are recorded here once it is done.
