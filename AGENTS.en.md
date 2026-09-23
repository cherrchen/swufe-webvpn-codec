# AGENTS.md

> This file is the **first entry point for every coding agent** working on this project.
> Goal: let an agent that knows nothing about the project build a working context in 2–5 minutes.
> It is a **router, not a documentation dump**: it only says what to read, what to do and what is forbidden; details live elsewhere.
>
> The Chinese version is the source of truth: [AGENTS.md](AGENTS.md).
> Project facts remain authoritative in [docs/](docs/README.en.md) and [specs/](specs/README.en.md).

---

## 1. Project Identity

```text
Project:          SWUFE WebVPN Bridge (repository swufe-webvpn-codec)
Purpose:          An Electron desktop app for macOS / Windows providing a local bridge: after
                  the user completes the official Wengine WebVPN (CAS/MFA) login, the local
                  browser reaches allowlisted hosts through the WebVPN automatically
                  (Phase 1 acceptance: the academic affairs site jwxt.swufe.edu.cn opens and works)
Status:           Phase 1 P0 cases and academic-affairs browser acceptance pass on both macOS and
                  real Windows hardware (see the 2026-09-23 record in spec 001 verification.md);
                  spec 001 remains `Implemented`. KI-014 (CAS theme asset truncation) is accepted
                  as a risk outside the app and bridge with a documented reload workaround.
                  KI-019 (sporadic stall through the bridge) has been reopened because local and
                  external causes remain undistinguished; spec 001 is not yet `Verified`.
                  The M6 UI rework (spec 002) is delivered and `Implemented`: React 19 + Ant Design 6
                  renders a four-window layout (720×560 scroll-free main window and three single-instance
                  non-modal secondary windows). Real-session academic-affairs use and process-capture
                  scope were checked on Windows with spec 001; see spec 002 verification.md for what remains.
Primary language: Python 3 (bridge sidecar/Addon, WRD codec, see `bridges/python/swufe_bridge/`) + TypeScript (Electron app, from M2);
                  Markdown docs (`docs/` + `specs/`) plus Node documentation-check scripts form the bulk
Repository type:  Documentation-first (docs/ + specs/) + implementation (Python bridge `bridges/python/`,
                  Electron app `apps/desktop/`) + Node documentation-check scripts
Layout:           Monorepo: `apps/` holds one directory per application (currently `desktop/`), `bridges/` one
                  directory per bridge implementation (currently `python/`); the layout decision is ADR-0009
                  (docs/architecture/adr/ADR-0009-monorepo-layout.md)
Owner:            cherrchen
```

## 2. Source of truth

| Information | Source of truth |
| ----------- | --------------- |
| Project goals, scope, terminology | [docs/overview/](docs/overview/glossary.en.md) |
| Product / functional / non-functional requirements | [docs/requirements/](docs/requirements/README.en.md) |
| Architecture, components, data flow, data model, interfaces | [docs/architecture/](docs/architecture/README.en.md) |
| External / internal interface contracts | [docs/api/](docs/api/README.en.md) |
| UI/UX conventions | [docs/ui-ux/](docs/ui-ux/README.en.md) |
| Feature what/why/how | [specs/](specs/README.en.md) |
| Phase 1 feature implementation and verification | [specs/001-phase1-local-bridge/](specs/001-phase1-local-bridge/spec.md) |
| Desktop UI structure (four windows, scroll-free main window, secondary windows) | [specs/002-desktop-ui-multiwindow/](specs/002-desktop-ui-multiwindow/spec.md) |
| Technical decisions (why) | [docs/architecture/adr/](docs/architecture/adr/README.en.md) |
| Testing strategy | [docs/development/testing-strategy.md](docs/development/testing-strategy.md) |
| Documentation rules and language policy | [docs/development/documentation-rules.md](docs/development/documentation-rules.md) |
| Agent rules and workflow | this file + [docs/agent/](docs/agent/README.en.md) |
| Verification and definition of done | [docs/verification/](docs/verification/README.en.md) |
| Repository directory layout (`apps/` + `bridges/`) | [ADR-0009](docs/architecture/adr/ADR-0009-monorepo-layout.en.md) |
| Long-term plans | [docs/planning/roadmap.md](docs/planning/roadmap.md) |

**If a fact is not in the table above, it is not a source of truth.** Do not treat it as a project fact without evidence.

## 3. Context routing (classify first, read second)

```text
Task
  ↓
AGENTS.md (this file)
  ↓
Task Classification
  ├─ Feature  ├─ Bug  ├─ Architecture  ├─ API
  ├─ UI       ├─ Database  ├─ Testing  └─ Documentation
  ↓
Minimum sufficient context
```

| Task type | Required reading |
| --------- | ---------------- |
| New feature / behaviour change | this file, `specs/001-phase1-local-bridge/` (spec/design/plan/tasks), related `docs/requirements/`, related `docs/architecture/` |
| Bug fix | this file, the related spec or [docs/architecture/components.md](docs/architecture/components.md), [testing-strategy](docs/development/testing-strategy.md) |
| Architecture change | [docs/architecture/overview.md](docs/architecture/overview.md), [components](docs/architecture/components.md), [ADR](docs/architecture/adr/README.en.md), related spec |
| API change | [docs/api/](docs/api/README.en.md), [docs/architecture/interfaces.md](docs/architecture/interfaces.md), related spec |
| Database / data model | [docs/architecture/data-model.md](docs/architecture/data-model.md), related ADR, migration spec |
| UI / UX | [docs/ui-ux/](docs/ui-ux/README.en.md), related spec |
| Testing | [docs/development/testing-strategy.md](docs/development/testing-strategy.md), [docs/verification/](docs/verification/README.en.md) |
| Documentation | [docs/development/documentation-rules.md](docs/development/documentation-rules.md) |
| Security-related | [docs/security/](docs/security/README.en.md), the Security Considerations section of the related spec |
| New session / taking over work | [docs/agent/session-handoff.md](docs/agent/session-handoff.md), the latest relevant note in `.agents/notes/` |

Full rules: [docs/agent/context-routing.en.md](docs/agent/context-routing.en.md).

**Never load all of `docs/` by default.** The goal is to cut context consumption, avoid irrelevant or stale information and reduce hallucination.

## 4. Agent mandatory rules

1. Never assume missing requirements; record them under `Open Questions` or mark them `TBD`.
2. Unknown facts stay `TBD` / placeholders — never invented.
3. Understand the relevant spec before changing code; a feature request without a spec gets one first (or is explicitly logged as a bug/chore).
4. When changing architecture, public interfaces, the data model or the security model, check whether a new ADR is required.
5. When changing behaviour, check tests and the [verification](docs/verification/README.en.md) matrix, and update the requirement-to-verification mapping.
6. When changing long-lived facts (requirements, architecture, API, data model), update the matching `docs/` file.
7. Never write session-temporary information (debug logs, chat transcripts, experiment results) into long-lived documents.
8. Never delete code or documents of unknown purpose to "clean up" the project; establish purpose first.
9. Never perform refactors unrelated to the task.
10. Never expand scope unilaterally: no "while we are here" validation, telemetry, abstractions, dependencies or formatting changes.

## 5. Documentation hygiene (forbidden pollution)

A coding agent must not:

- copy chat or reasoning transcripts into official documents;
- present guesses as project facts;
- put temporary debug output into Architecture / Requirements;
- change requirements because something "feels better";
- rewrite a whole document without justification;
- expand scope automatically;
- invent designs that do not exist just to make the docs look complete.

## 6. Agent workflow

The full loop (per-step requirements, task granularity, blocker handling, completion check) is defined in [docs/agent/agent-workflow.md](docs/agent/agent-workflow.md) and is not repeated here.
Summary: **orient → classify → check spec/ADR → plan → implement → verify → sync docs → handoff**.

Platform-neutral skill instructions live in [.agents/skills/](.agents/README.md):

| Skill | Purpose |
| ----- | ------- |
| `project-onboarding` | Build context and emit a short context summary |
| `create-spec` | Turn a requirement into spec/design/plan/tasks/verification |
| `implement-spec` | Implement from a spec and update task status |
| `verify-change` | Check requirement coverage, tests, build, docs, compatibility, security |
| `update-docs` | Sync documentation after code changes |
| `session-handoff` | Produce a session handoff record |

## 7. Definition of done

A change is done only once these are considered: implementation, tests, verification, documentation, compatibility, security, spec status.
See [docs/verification/verification-strategy.md](docs/verification/verification-strategy.md).
**"The code is written" does not mean the feature is done**; feature status flows `Draft → Approved → In Progress → Implemented → Verified → Archived`.

## 8. Sessions and temporary information

- Temporary context goes to [.agents/notes/](.agents/notes/README.en.md) as `YYYY-MM-DD-<topic>.md`;
- Notes are **not** a source of truth: never cite them for architecture, requirements, API contracts or final decisions;
- Long-lived conclusions discovered in a note must be migrated to `docs/`, `specs/` or an ADR.

## 9. Related entry points

- [README.md](README.md) — project overview (positioning, scope, documentation system)
- [CONTRIBUTING.md](CONTRIBUTING.md) — contribution flow and review requirements
- [docs/README.md](docs/README.md) — documentation index
- [specs/README.md](specs/README.md) — spec system
- [.agents/README.md](.agents/README.md) — skills and notes
