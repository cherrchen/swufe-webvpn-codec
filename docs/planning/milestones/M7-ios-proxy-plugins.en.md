# M7: iOS proxy client plugins

> Status: Draft  
> Owner: cherrchen  
> Target: TBD

## Goal

Deliver SWUFE WebVPN rewrite semantics on iPhone/iPad through Stash / Loon plugins (not a standalone app), reusing the host’s proxy, TUN, and HTTPS MitM. Share a `packages/webvpn-core-js` core; **Stash is the first host**, Loon the second. Install and updates are distributed via this repository on **GitHub**.

Phase order and tasks live in [003 project-management.md](../../../specs/003-ios-proxy-client-plugins/project-management.md): `P0 host capability (done) → M1 shared core → M2 Stash → M3 Loon → M4 hardening & release`.

## Included specs

| Spec | Status | Depends on |
| ---- | ------ | ---------- |
| [003-ios-proxy-client-plugins](../../../specs/003-ios-proxy-client-plugins/spec.md) | Approved | 001 (protocol and WRD baseline), Python codec test vectors |

## Exit criteria

- [ ] Spec 003 reaches `Verified` (or equivalent: no `Pending` on Must acceptance items; see 003 [verification.md](../../../specs/003-ios-proxy-client-plugins/verification.md))
- [x] P0 gate: Q-001/Q-002 have real-device conclusions per host (URL presentation and script-observable session capture; 2026-09-24)
- [ ] At least one host (Loon or Stash) passes the academic-affairs main-path E2E
- [ ] Python/JS WRD vector parity; session security red-line tests pass
- [ ] Long-lived `docs/` and any ADRs updated per 003’s documentation sync plan during implementation
- [ ] Desktop regression shows no behaviour change (bridge and Electron shell)

## Risks

| Risk | Impact | Mitigation |
| ---- | ------ | ---------- |
| In-app login traffic not visible to scripts (R-IOS-002) | High | P0 first; Gate A decision |
| Stash HTTP/3 bypasses HTTP engine (R-IOS-004) | High | Force TCP for target domains |
| Host script API changes (R-IOS-009) | Medium | Adapter isolation + version guard |

Full register: 003 [project-management.md §9](../../../specs/003-ios-proxy-client-plugins/project-management.md).

## Completion record

(2026-09-24: spec 003 marked `Approved`, P0 Gate A passed; M1 implementation not started.)
