# Development Workflow

> Status: Draft ｜ Owner: <OWNER> ｜ Last Reviewed: <DATE>
>
> Chinese source of truth: [development-workflow.md](development-workflow.md)

**Purpose**: define the standard path from idea to merge. Humans and coding agents follow the same workflow.

---

## 1. Overall flow

```text
Idea
 ↓
Issue / Discussion
 ↓
Spec
 ↓
Design
 ↓
Plan
 ↓
Tasks
 ↓
Implementation
 ↓
Verification
 ↓
Documentation Sync
 ↓
Review
 ↓
Complete
```

Artifacts live in `specs/<id>-<name>/`: `spec.md → design.md → plan.md → tasks.md → verification.md`
(templates: [specs/_template/](../../specs/_template/README.md)).

## 2. Change tiers

| Tier | Criteria | Required artifacts |
| ---- | -------- | ------------------ |
| Trivial | typo, comment, behaviour-neutral formatting | PR (using the template) |
| Bug | behaviour inconsistent with an existing requirement/spec | reproduction + fix + test + documentation impact |
| Feature | new or changed user-visible behaviour | full spec |
| Architecture | affects structure, public interfaces, data model or security model | spec + ADR |

When unsure, treat the change as the higher tier.

## 3. Simplified bug flow

```text
Bug → Reproduce → Root Cause → Fix → Test → Documentation Impact
```

Requirements:

1. **Reproduce first**: provide a minimal executable path or a failing test;
2. Find the root cause instead of patching the symptom;
3. After the fix, confirm the original reproduction no longer triggers;
4. Check whether requirements / architecture / spec / ADR text is affected;
5. If the bug exposes a requirements or design gap, escalate to a spec and record it under `Open Questions`.

## 4. Exit criteria per stage

| Stage | Exit criteria |
| ----- | ------------- |
| Spec | goals, non-goals and acceptance criteria are explicit; open questions resolved or marked blocking |
| Design | chosen approach, alternatives, risks and impact documented; ADR created when required |
| Plan | phases and dependencies clear, including rollback and documentation updates |
| Tasks | tasks small enough, independently verifiable, with dependency notes |
| Implementation | all tasks complete, `tasks.md` status updated |
| Verification | the [verification.md](../../specs/_template/verification.md) matrix has no `Pending` entries (or reasons stated) |
| Documentation sync | affected long-lived documents updated, or explicitly declared unaffected |
| Review | every PR checklist item passes |

## 5. Branches and commits

```text
Branch naming:  TBD
Commit message: TBD
```

> Adopting projects must replace or delete this section.

## 6. Relationship to agents

Coding agents follow the same workflow with additional constraints from [AGENTS.md](../../AGENTS.md) and
[docs/agent/agent-workflow.md](../agent/agent-workflow.md). An agent may not skip the spec stage for a feature.

## 7. Related

- Documentation sync matrix: [documentation-rules.md](documentation-rules.md)
- Test requirements: [testing-strategy.md](testing-strategy.md)
- Verification strategy: [docs/verification/verification-strategy.md](../verification/verification-strategy.md)
