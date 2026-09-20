# Agent Workflow

> Status: Draft ｜ Owner: <OWNER> ｜ Last Reviewed: <DATE>
>
> Chinese source of truth: [agent-workflow.md](agent-workflow.md)

**Purpose**: define the complete working loop for a coding agent. The human flow is in [development-workflow.md](../development/development-workflow.md); both use the same artifacts, and agents have the extra constraints below.

---

## 1. Loop

```text
1. Orient     read AGENTS.md → read the minimum sufficient context
2. Classify   decide the task type (feature / bug / architecture / API / UI / database / testing / docs)
3. Check      does a spec / ADR / verification requirement exist? create the gap first if not
4. Plan       produce or update tasks.md (or justify why a trivial change needs no plan)
5. Implement  smallest change, following existing repository patterns
6. Verify     run the relevant tests/commands; explain when they cannot be run
7. Sync docs  update documents per the documentation update matrix
8. Handoff    write .agents/notes/YYYY-MM-DD-<topic>.md when needed
```

## 2. Per-step requirements

| Step | Required | Forbidden |
| ---- | -------- | --------- |
| Orient | state which files were read | pretending to have read them |
| Classify | state the classification and why | editing code without classifying |
| Check | cite the spec/ADR path; create or record the gap if missing | implementing a feature without a spec |
| Plan | tasks small enough to verify independently | "implement the whole feature" as one task |
| Implement | touch only files relevant to the task | opportunistic refactors, extra validation, scope creep |
| Verify | give the commands actually run and their results | claiming "it should be fine" |
| Sync docs | state which documents changed, or why none needed to | writing temporary conclusions into long-lived docs |
| Handoff | record the true state and the next step | treating a handoff note as a source of truth |

## 3. Task granularity and parallelism

- A task must be independently verifiable and describe inputs/outputs and dependencies;
- When tasks can be parallelised, fix the contracts first (interfaces, data structures, file ownership) so the same file is not edited concurrently;
- Tasks touching one file are serialised, or an integration owner is named up front.

## 4. Handling blockers

When blocked (missing information, conflicting requirements, unavailable environment):

1. Exhaust what the repository provides (docs, specs, notes, code, tests);
2. If still unresolved, record it in the spec's `Open Questions` or a note, with impact;
3. In the delivery summary state exactly what is missing, what was tried, and who must decide;
4. Never fill gaps with guesses and never silently shrink scope.

## 5. Completion check

Before claiming completion, confirm:

- acceptance criteria map one-by-one (see the `specs/<id>/verification.md` matrix);
- relevant tests/commands were actually run and their output captured;
- affected documents are synced;
- no unrelated changes were introduced.

## 6. Related

- Context routing: [context-routing.md](context-routing.md)
- Skills: [.agents/skills/](../../.agents/README.md)
- Definition of done: [docs/verification/verification-strategy.md](../verification/verification-strategy.md)
