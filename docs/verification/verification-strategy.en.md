# Verification Strategy

> Status: Draft ｜ Owner: <OWNER> ｜ Last Reviewed: <DATE>
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
Additional checks:     TBD
Exemptions:            TBD
Required reviewers:    TBD
Release gate:          TBD
```

> Adopting projects tighten or extend the requirements here. **Overrides belong in this section**, never scattered across specs.

## 7. When to re-verify

| Trigger | Action |
| ------- | ------ |
| Related code changed | re-run the relevant verification entries, update matrix status |
| Dependency upgraded | re-run tests + compatibility judgement |
| Requirement changed | update the matrix entries themselves |
| Verification failed | set status `Failed`, record the issue in the spec's `Open Questions` / `Risks` |
