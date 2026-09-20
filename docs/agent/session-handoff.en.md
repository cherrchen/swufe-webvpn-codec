# Session Handoff

> Status: Draft ｜ Owner: <OWNER> ｜ Last Reviewed: <DATE>
>
> Chinese source of truth: [session-handoff.md](session-handoff.md)

**Purpose**: define how to record state when a session ends, is interrupted, or is handed over, so the next agent or human can continue without reading chat history.
Related skill: [.agents/skills/session-handoff/SKILL.md](../../.agents/skills/session-handoff/SKILL.md).

---

## 1. Core rule

> **A session note is not a source of truth.**

- Location: [.agents/notes/](../../.agents/notes/README.md);
- Naming: `YYYY-MM-DD-<topic>.md`;
- Record **current state and next steps only**; never copy chat transcripts;
- Long-lived conclusions (requirements, architecture, interfaces, decisions) must be migrated to `docs/`, `specs/` or an ADR, with the destination written in the note.

## 2. Template

```markdown
# Session Handoff — <date> — <topic>

## Current Goal
(what this session is meant to achieve; related spec path)

## Completed
- [x] … (with evidence: files, commands, results)

## In Progress
- [ ] … (how far it got, what is left)

## Remaining
- [ ] …

## Important Decisions
- … (temporary decisions may live here; long-lived ones must already be in docs/specs/ADR, with the path written out)

## Changed Files
| File | Change | Related task |
| ---- | ------ | ------------ |

## Commands / Tests Run
| Command | Result | Notes |
| ------- | ------ | ----- |

## Known Problems
- … (unresolved errors, failing tests, environment limits)

## Recommended Next Step
1. …
2. …
```

## 3. Field requirements

| Field | Requirement |
| ----- | ----------- |
| Current Goal | link to a concrete spec or issue; explain why none exists if there is none |
| Completed | verifiable evidence (file paths, commands, output summaries) — not "mostly done" |
| In Progress | state the interruption point so work can resume directly |
| Remaining | work not started, including excluded scope |
| Decisions | separate "migrated" from "open"; mark unresolved ones `Open` |
| Changed Files | the real change list for review |
| Commands / Tests | commands actually run and their results; state why when not run |
| Known Problems | never hide failures; never write "should be fine" |
| Next Step | concrete, executable, verifiable — not "keep improving" |

## 4. Handoff checklist

- [ ] the note is written under `.agents/notes/` with a `YYYY-MM-DD-<topic>.md` name;
- [ ] long-lived conclusions were migrated to Level A/B documents (or explicitly declared unnecessary);
- [ ] uncommitted changes are listed under Changed Files;
- [ ] failing or unrun verification is explicitly flagged;
- [ ] the next step is executable without reading chat history.

## 5. When it is mandatory

| Situation | Required |
| --------- | -------- |
| Session interrupted by context/time limits | yes |
| Work handed to another person or agent | yes |
| Work finished and documents already synced | optional (the spec's `verification.md` is the record) |
| Pure Q&A with no repository change | no |
