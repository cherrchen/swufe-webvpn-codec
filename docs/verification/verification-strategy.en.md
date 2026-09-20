# Verification Strategy

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-20
>
> Chinese source of truth: [verification-strategy.md](verification-strategy.md)

**Purpose**: define verification levels, evidence requirements, the feature lifecycle and the definition of done.
This is the source of truth for what "done" means; project-specific tightening lives in section 6.

---

## 1. Verification levels

| Level | Means | Typical evidence |
| ----- | ----- | ---------------- |
| Requirement coverage | criterion-by-criterion review | `verification.md` matrix |
| Automated tests | unit / integration / end-to-end | command + output summary |
| Manual verification | reproducible steps | steps + observed result |
| Static checks | build, types, lint, formatting | command + result |
| Documentation consistency | `npm run docs:check`, documentation update matrix | command + result |
| Compatibility | interface/data/behaviour compatibility check | conclusion + risk notes |
| Security | input, permissions, secrets, dependency risk | conclusion + mitigations |
| Review | PR checklist | PR record |

## 2. Requirement → verification mapping (mandatory)

Every feature must provide a mapping table in `specs/<id>-<name>/verification.md`:

| Requirement | Verification | Status |
| ----------- | ------------ | ------ |
| REQ-001 | unit test … | Pending |
| REQ-002 | integration test … | Pending |
| REQ-003 | manual verification … | Pending |

Status values: `Pending` / `Passed` / `Failed` / `N/A` (`N/A` requires a stated reason).

## 3. Evidence requirements

| Claim | Required evidence |
| ----- | ----------------- |
| "tests pass" | command + result summary |
| "behaviour matches the requirement" | verification steps for the acceptance criteria and their results |
| "no compatibility impact" | compatibility conclusion, or why it does not apply |
| "no documentation impact" | item-by-item judgement against the documentation update matrix |
| "cannot verify" | exactly what is missing and what was attempted |

"Should be fine" and "looks correct" are never evidence.

## 4. Feature lifecycle

```text
Draft
 → Approved
 → In Progress
 → Implemented
 → Verified
 → Archived
```

| Status | Entry condition |
| ------ | --------------- |
| Draft | spec.md created |
| Approved | acceptance criteria explicit; open questions resolved or marked blocking |
| In Progress | implementation started |
| Implemented | code and tasks complete, **verification not yet done** |
| Verified | verification matrix has no `Pending` entries (or reasons are stated) |
| Archived | conclusions synced to long-lived docs; the spec remains as history |

## 5. Definition of done (default)

A feature must consider at least:

| Dimension | Requirement |
| --------- | ----------- |
| Implementation | only the scope the spec defines |
| Tests | relevant tests exist and pass |
| Verification | matrix complete, no `Pending` |
| Documentation | long-lived docs synced (including bilingual pairs) |
| Compatibility | compatibility impact stated |
| Security | security impact stated |
| Spec status | updated to `Implemented` / `Verified` |

## 6. Project override

```text
Additional checks:     Every PR: L0 (codec vectors TC-A01..TC-A05 + allowlist unit tests TC-B01..TC-B03)
                       Every PR: L1 components and L2 local integration (addon against a fake upstream /
                       mitmdump + curl)
                       Before release: L3 acceptance on real hardware (TC-G01..TC-G04, requires the
                       tester's own account)
Exemptions:            CI currently runs documentation checks only (npm run docs:check) and no code
                       tests; code tests join CI once the implementation repository exists
Required reviewers:    cherrchen
Release gate:          all P0 cases pass;
                       registrar browser acceptance passes on at least one desktop OS
                       (target: both macOS and Windows);
                       no open blocking defects;
                       no system proxy left behind after stop or session expiry
```

- Level definitions, the case inventory and how to run things are in [testing-strategy.md](../development/testing-strategy.md);
- The phase 1 case set, priorities and exit criteria are in [specs/001-phase1-local-bridge/verification.md](../../specs/001-phase1-local-bridge/verification.md).

> This project's coverage requirements are sourced from the `Project override` block above: tighten or extend them here only, never scattered across specs.

## 7. When to re-verify

| Trigger | Action |
| ------- | ------ |
| Related code changed | re-run the relevant verification entries, update matrix status |
| Dependency upgraded | re-run tests + compatibility judgement |
| Requirement changed | update the matrix entries themselves |
| Verification failed | set status `Failed`, record the issue in the spec's `Open Questions` / `Risks` |
