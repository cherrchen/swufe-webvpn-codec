# Milestones

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-21
>
> Chinese source of truth: [README.md](README.md)

**Purpose**: define what "reaching a milestone" means, so progress can be reviewed from outside.
**Do not write**: requirements, design or task breakdown (see [requirements/](../../requirements/README.md), [architecture/](../../architecture/README.md), `specs/<id>/tasks.md`).

## When to create a milestone

- several feature specs must ship together;
- a verifiable date or version must be committed to externally;
- a shared set of exit criteria is needed (e.g. verification passed + documents synced + no blocking defects).

## File naming

```text
docs/planning/milestones/<MILESTONE_ID>-<short-name>.md
```

Examples: `M1-mitm-bridge.md` (numeric) or `2026-09-20-packaging.md` (date-based) — pick one convention per project and stay consistent.

## Milestone list

| Milestone | File | Status | Related spec | One-line goal |
| --------- | ---- | ------ | ------------ | ------------- |
| M0 pre-research | [M0-pre-research.md](M0-pre-research.md) | Done | — (M0 delivers the document package and requirement specs; it belongs to no spec) | WRD codec verification, Phase 1 requirement specs and document package completed and archived |
| M1 bridge core | [M1-mitm-bridge.md](M1-mitm-bridge.md) | Done | [001-phase1-local-bridge](../../../specs/001-phase1-local-bridge/spec.md) | mitm WRD addon request rewrite + cookie injection + unit/integration tests |
| M2 desktop orchestration | [M2-desktop-orchestration.md](M2-desktop-orchestration.md) | Done | [001-phase1-local-bridge](../../../specs/001-phase1-local-bridge/spec.md) | Electron can log in, start the bridge, set the system proxy, install the CA |
| M3 experience polish | [M3-experience-polish.md](M3-experience-polish.md) | Done | [001-phase1-local-bridge](../../../specs/001-phase1-local-bridge/spec.md) | Allowlist UI, debug logging, process capture and copy usable |
| M4 acceptance | [M4-acceptance.en.md](M4-acceptance.en.md) | In Progress | [001-phase1-local-bridge](../../../specs/001-phase1-local-bridge/spec.md) | P0 and browser acceptance pass on both OSes; `KI-014` is accepted, `KI-019` remains `Open`; field evidence locates it in the bridge upstream stage, but the root cause is unknown |
| M5 open-source preparation (optional) | [M5-open-source-preparation.en.md](M5-open-source-preparation.en.md) | Done (2026-09-23) | — (documentation-preparation milestone) | User/developer README, open-source boundary notes, and TUN follow-up design memo complete; no installer or public release |
| M6 UI rework | [M6-ui-rework.md](M6-ui-rework.md) | Done (2026-09-23) | [002-desktop-ui-multiwindow](../../../specs/002-desktop-ui-multiwindow/spec.md) (`Implemented`) | Migrate the renderer to React + Ant Design 6 and fix it into a four-window layout (720×560 scroll-free main window; capture/log/allowlist in non-modal secondary windows); every machine-executable case passes, unverified = the Windows real machine, the campus page under a real session and the real process-capture scope |

> Phase breakdown, dependencies and the spec index live in [roadmap.en.md](../roadmap.en.md). M5 only covers open-source documentation preparation; it does not mean release artifacts are complete.

## Milestone template

> The block below is a **template example** (placeholders stay as-is); copy it when creating a milestone file and replace the placeholders with real content.

```markdown
# <milestone id>: <name>

> Status: Candidate | Planned | In Progress | Done | Dropped
> Owner: <OWNER>
> Target: <DATE>

## Goal

(the verifiable outcome this milestone delivers)

## Included specs

| Spec | Status | Dependencies |
| ---- | ------ | ------------ |

## Exit criteria

- [ ] every included spec is `Verified`
- [ ] affected documents are synced (including bilingual pairs)
- [ ] no blocking defects
- [ ] the relevant verification commands pass
- [ ] compatibility and security impact confirmed

## Risks

| Risk | Impact | Mitigation |
| ---- | ------ | ---------- |

## Completion record

(date, evidence, remaining issues)
```

## Rules

1. Exit criteria must be verifiable; avoid "mostly done";
2. A milestone defines no new requirements; a missing requirement needs a spec first;
3. When a milestone slips, record the reason — never silently rewrite the historical milestone definition.
