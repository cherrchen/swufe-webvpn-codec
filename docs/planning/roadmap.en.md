# Roadmap

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-21
>
> Chinese source of truth: [roadmap.md](roadmap.md)

**Purpose**: a phased view of the long-term direction, plus a spec index.
**Do not write**: requirement definitions, technical design, task breakdown.

---

## Phases

| Phase | Goal summary | Related goal | Timeframe | Status |
| ----- | ------------ | ------------ | --------- | ------ |
| [M0 pre-research](milestones/M0-pre-research.md) | WRD codec verification, Phase 1 requirement specs and document package | G-001 / G-002 / G-003 | TBD | Done |
| [M1 bridge core](milestones/M1-mitm-bridge.md) | mitm WRD addon (request rewrite), cookie injection, response reverse rewrite, unit/integration tests | G-001 | TBD | Done |
| [M2 desktop orchestration](milestones/M2-desktop-orchestration.md) | Electron shell, system proxy, CA, proxy conflict detection, stop-on-expiry | G-001 / G-002 / G-003 | TBD | Done (the trust-store write and Windows real-machine checks still need a human/M4) |
| [M3 experience polish](milestones/M3-experience-polish.md) | Allowlist UI, debug logging, process capture, copy | G-002 / G-003 | TBD | Done (the real capture scope and the log panel against a live bridge still need a human to authorise the system extension; see the milestone's remaining issues) |
| [M4 acceptance](milestones/M4-acceptance.md) | macOS + Windows academic-affairs browser acceptance, defect burn-down | G-001 / G-002 / G-003 | TBD | Planned |
| M5 open-source preparation (optional) | Open-source cleanup, README, follow-up TUN design memo | G-004 | TBD | Candidate |

> Every timeframe is `TBD`: the original package defines no calendar dates (it only gives milestone ordering and dependencies). Milestone completion definitions and exit criteria live in [milestones/](milestones/README.md); M5 is a candidate row only and has no milestone file yet.

## Spec index

Each feature spec is registered here with one row; details live in `specs/<id>-<name>/`.

| Spec | Title | Related REQ | Phase | Status | Link |
| ---- | ----- | ----------- | ----- | ------ | ---- |
| 001-phase1-local-bridge | Phase 1 local bridge and academic-affairs browser acceptance | REQ-001..REQ-011, NFR-001..NFR-007 | M1–M4 | In Progress | [spec.md](../../specs/001-phase1-local-bridge/spec.md) |

> Phase 1 is one spec; add another row here per [specs/README.md](../../specs/README.md) when a later spec is created. REQ/NFR are defined in [requirements/](../requirements/README.md); this table only references IDs.

## Ordering principles

```text
1. Protect the academic-affairs acceptance path first: freeze the codec → addon request rewrite → response reverse rewrite → Electron orchestration (login / proxy / CA) → on-device acceptance
2. Correctness and reversibility before feature count (response reverse rewrite, CA uninstall, clearing the system proxy on stop are all on the main path)
```

## Dependencies and blockers

| Item | Depends on | Blocked because | Unblock condition |
| ---- | ---------- | --------------- | ----------------- |
| M1 | M0 | The bridge core depends on verified codec conclusions and a frozen requirement spec | M0 is done (codec vectors and requirement spec ready) |
| M2 | M1 | Desktop orchestration needs a working bridge and bridge control protocol | M1 exit criteria met (curl through the local bridge reaches an allowlist host) |
| M3 | M2 | Allowlist UI / debug logging / process capture build on an Electron shell that can start the bridge | M2 exit criteria met (login, start bridge, system proxy, CA all usable) |
| M4 | M3 + one macOS and one Windows test machine + the tester's own SWUFE test account | The dual-platform P0 cases and the browser acceptance need real machines, the real WebVPN and an account | Test environments and account ready, and M3 exit criteria met |
| External blocker | School WebVPN / portal or cookie policy changes | URL shape, cookie fields or the login flow are decided by the school; a change breaks rewriting or the session | Centralized session probing + fast patch and re-login flow (risk R2) |
| External blocker | Default key rotation | A change to the WRD default `key`/`iv` breaks URL rewriting and decoding | `wrdKey` / `wrdIv` config override and hot reload (see [ADR-0005](../architecture/adr/ADR-0005-builtin-wrd-key-with-override.md), risk R6) |

## Explicitly out of scope (this period)

> Non-goals are defined in [goals-and-non-goals.md](../overview/goals-and-non-goals.md); this table only references NG IDs and gives the scheduling reason.

| Item | Reason | Related non-goal |
| ---- | ------ | ---------------- |
| SSH / databases / SMB / arbitrary TCP·UDP | Phase 1 only rewrites HTTP/HTTPS traffic that matches the allowlist; no arbitrary TCP/UDP forwarding | NG-001 |
| Replacing the school SSLVPN or a TUN-level real VPN | Phase 1 ships no TUN; a TUN/routing core is a later-phase candidate (PR-005 Won't now) | NG-002 |
| Chained coexistence with Clash / mihomo / sing-box | Stacking on another system proxy is hard to test; the app refuses to start when the system proxy is already in use (see [ADR-0004](../architecture/adr/ADR-0004-refuse-start-when-system-proxy-in-use.md)) | NG-003 |
| PAC | No PAC requirement; routing is decided by the bridge's allowlist matching | NG-004 |
| Storing passwords / auto-filling passwords to bypass MFA | Security constraint: no passwords at rest; CAS/MFA is completed by the user inside the login WebView | NG-005 |
| Class-wide distribution / app store listing | Private use first; Phase 1 has no distribution channel | NG-006 |
| Linux | Phase 1 supports macOS and Windows only | NG-007 |
| Guaranteeing that every certificate-pinning app works | MITM does not cover pinning clients; the boundary is only stated in the documentation | NG-008 |

## Maintenance rules

- Update this file when phases change, keeping it consistent with [goals-and-non-goals.md](../overview/goals-and-non-goals.md);
- The roadmap references requirements and design, it never copies them;
- Milestone exit criteria live in [milestones/](milestones/README.md).
